import twilio from "twilio";
import {
  FLEX_PLUGIN_PATH,
  FLEX_PLUGIN_UNIQUE_NAME,
  FLEX_PLUGIN_VERSION,
} from "../flex-plugin/bundle.js";
import { BRAND, longDate } from "./script.js";
import { intelForTask } from "./intel.js";
import { activeClasses, completeBeat, type JourneyState } from "./state.js";

/**
 * Real Twilio Flex handoff.
 *
 * When the voice agent decides it cannot finish the job (expired card, needs a
 * human), we do NOT fake a contact centre. We take the tenant's live in-progress
 * call and redirect it into the customer's actual Flex instance as a genuine
 * TaskRouter voice task, with her whole context on the task attributes so the
 * Flex agent has it before they say hello.
 */

let client: ReturnType<typeof twilio> | null = null;
function twilioClient() {
  if (!client) {
    client = twilio(process.env.TWILIO_API_KEY, process.env.TWILIO_API_SECRET, {
      accountSid: process.env.TWILIO_ACCOUNT_SID,
    });
  }
  return client;
}

export interface FlexSetup {
  workspaceSid?: string;
  workflowSid?: string;
  taskQueueSid?: string;
  chatServiceSid?: string;
  flexUrl: string;
}

export interface FlexHealth extends FlexSetup {
  /** True when we have everything needed to enqueue a task. */
  configured: boolean;
  workflowName?: string;
  queueName?: string;
  workersTotal: number;
  workersAvailable: number;
  availableWorkerNames: string[];
  /** True when the tenant context plugin is released to the agent desktop. */
  pluginReleased: boolean;
  pluginVersion?: string;
  pluginUrl?: string;
  /** True when the handoff would actually reach a human right now. */
  ok: boolean;
  problem?: string;
  hint?: string;
  /** The store team's fallback phone, used when nobody is available in Flex. */
  forwardNumber?: string;
  checkedAt: string;
}

const FLEX_URL = process.env.NEXT_PUBLIC_FLEX_URL || "https://flex.twilio.com/agent-desktop";

/** The store team's fallback phone — used whenever nobody is available in Flex. */
function resolveHandoffNumber(): string | undefined {
  return process.env.FWD_NUMBER || undefined;
}

let setupCache: FlexSetup | null = null;

/**
 * Resolve the Flex routing targets. Environment values win; anything missing is
 * read straight off the account's live Flex Configuration so this keeps working
 * if the instance is rebuilt.
 */
export async function resolveFlexSetup(force = false): Promise<FlexSetup> {
  if (setupCache && !force) return setupCache;

  const setup: FlexSetup = {
    workspaceSid: process.env.FLEX_WORKSPACE_SID || undefined,
    workflowSid: process.env.FLEX_WORKFLOW_SID || undefined,
    taskQueueSid: process.env.FLEX_TASK_QUEUE_SID || undefined,
    flexUrl: FLEX_URL,
  };

  if (!setup.workspaceSid || !setup.workflowSid) {
    try {
      const config = await twilioClient().flexApi.v1.configuration().fetch();
      const raw = config as unknown as Record<string, string | undefined>;
      setup.workspaceSid = setup.workspaceSid || raw.taskrouterWorkspaceSid;
      setup.workflowSid = setup.workflowSid || raw.taskrouterTargetWorkflowSid;
      setup.taskQueueSid = setup.taskQueueSid || raw.taskrouterTargetTaskqueueSid;
      setup.chatServiceSid = raw.chatServiceInstanceSid;
    } catch (err) {
      console.error("[journey/flex] could not read Flex configuration", err);
    }
  }

  setupCache = setup;
  return setup;
}

export function invalidateFlexSetup() {
  setupCache = null;
}

let healthCache: { value: FlexHealth; at: number } | null = null;
const HEALTH_TTL_MS = 15_000;

/**
 * Is the handoff going to land on a real person right now? There is no point
 * transferring a live caller into an empty queue, so the demo surfaces this
 * before the call is ever placed.
 */
export async function checkFlexHealth(force = false): Promise<FlexHealth> {
  if (healthCache && !force && Date.now() - healthCache.at < HEALTH_TTL_MS) {
    return healthCache.value;
  }

  const setup = await resolveFlexSetup(force);
  const health: FlexHealth = {
    ...setup,
    configured: Boolean(setup.workspaceSid && setup.workflowSid),
    workersTotal: 0,
    workersAvailable: 0,
    availableWorkerNames: [],
    pluginReleased: false,
    ok: false,
    forwardNumber: resolveHandoffNumber(),
    checkedAt: new Date().toISOString(),
  };

  if (!health.configured) {
    health.problem = "No Flex workspace or workflow could be resolved for this account.";
    health.hint = "Open Flex once in the Twilio Console so the instance finishes provisioning.";
    healthCache = { value: health, at: Date.now() };
    return health;
  }

  try {
    const tr = twilioClient().taskrouter.v1.workspaces(setup.workspaceSid!);

    const [workflow, workers, plugin] = await Promise.all([
      tr.workflows(setup.workflowSid!).fetch().catch(() => null),
      tr.workers.list({ limit: 50 }).catch(() => []),
      checkPluginRelease(),
    ]);

    health.workflowName = workflow?.friendlyName ?? undefined;
    health.pluginReleased = plugin.released;
    health.pluginVersion = plugin.version;
    health.pluginUrl = plugin.url;

    if (setup.taskQueueSid) {
      const queue = await tr.taskQueues(setup.taskQueueSid).fetch().catch(() => null);
      health.queueName = queue?.friendlyName ?? undefined;
    }

    health.workersTotal = workers.length;
    const available = workers.filter((w) => Boolean(w.available));
    health.workersAvailable = available.length;
    health.availableWorkerNames = available.map((w) => w.friendlyName);

    if (health.workersTotal === 0) {
      health.problem = health.forwardNumber
        ? "There are no agents in this Flex workspace yet — the call will forward to the store team's phone instead."
        : "There are no agents in this Flex workspace yet.";
      health.hint =
        "Log in to Flex once at flex.twilio.com — that creates your agent automatically.";
    } else if (health.workersAvailable === 0) {
      health.problem = health.forwardNumber
        ? "Flex has agents, but nobody is available — the call will forward to the store team's phone instead."
        : "Flex has agents, but nobody is available to take a call.";
      health.hint = "Open Flex and set your status to Available before running Act 4.";
    } else {
      health.ok = true;
    }
  } catch (err) {
    health.problem = "Could not read the Flex workspace.";
    health.hint = (err as Error).message;
  }

  healthCache = { value: health, at: Date.now() };
  return health;
}

export function invalidateFlexHealth() {
  healthCache = null;
}

/**
 * Is the tenant context plugin actually live on the agent desktop?
 *
 * A released plugin is the difference between the Flex agent seeing the
 * tenant's record and seeing an empty panel, so it is worth reporting
 * explicitly rather than discovering it mid-demo.
 */
async function checkPluginRelease(): Promise<{
  released: boolean;
  version?: string;
  url?: string;
}> {
  try {
    const flexApi = twilioClient().flexApi.v1;

    const releases = await flexApi.plugins
      .list({ limit: 1 })
      .then(() => flexApi.pluginReleases.list({ limit: 20 }))
      .catch(() => []);

    if (!releases.length) return { released: false };

    const latest = releases
      .slice()
      .sort(
        (a, b) =>
          new Date(b.dateCreated ?? 0).getTime() - new Date(a.dateCreated ?? 0).getTime()
      )[0];

    const configured = await flexApi
      .pluginConfigurations(latest.configurationSid)
      .plugins.list({ limit: 50 })
      .catch(() => []);

    const mine = configured.find(
      (p: { uniqueName?: string | null }) =>
        (p.uniqueName ?? "") === FLEX_PLUGIN_UNIQUE_NAME
    ) as { uniqueName?: string; version?: string; pluginUrl?: string } | undefined;

    return {
      released: Boolean(mine),
      version: mine?.version ?? FLEX_PLUGIN_VERSION,
      url: mine?.pluginUrl ?? FLEX_PLUGIN_PATH,
    };
  } catch {
    return { released: false };
  }
}

/* ------------------------------------------------------------------ *
 * Task attributes — the context the Flex agent sees
 * ------------------------------------------------------------------ */

const ESCALATED_BY = "CubeSmart voice AI";

export function buildTaskAttributes(
  state: JourneyState,
  reason: string,
  summary: string
): Record<string, unknown> {
  const studioPhone = process.env.CUBESMART_STORE_PHONE || process.env.TWILIO_PHONE_NUMBER || "";
  const fullName = `${state.firstName} ${state.lastName}`.trim();
  const history = state.classes.map(
    (c) => `${c.className} · ${c.dayName} ${c.shortDate} ${c.timeLabel} (${c.status})`
  );
  const recentTranscript = state.transcript
    .slice(-8)
    .map((line) => `${line.role === "member" ? state.firstName : "Voice AI"}: ${line.text}`);

  return {
    // Flex UI essentials
    type: "inbound",
    direction: "inbound",
    name: fullName,
    customerName: fullName,
    from: state.phone,
    called: studioPhone,
    to: studioPhone,
    customerAddress: state.phone,
    // Flex's customer panel
    customers: {
      phone: state.phone,
      name: fullName,
      external_id: state.profileId ?? state.phone,
      customer_id: state.profileId ?? state.phone,
    },
    // Why the AI escalated
    escalated_by: ESCALATED_BY,
    escalation_reason: reason,
    ai_summary: summary,
    // Everything the human would otherwise have to ask for
    cubesmart: {
      store: `${BRAND.name} — ${BRAND.studio}, ${BRAND.city}`,
      unit_type: state.membership.tier,
      account_status: state.membership.status,
      access_window_start: state.membership.holdStart ? longDate(state.membership.holdStart) : null,
      access_window_end: state.membership.holdEnd ? longDate(state.membership.holdEnd) : null,
      access_window_days: state.membership.holdDays ?? null,
      payment_status: state.membership.paymentStatus,
      card_on_file: `Visa •••• ${state.membership.cardLast4} exp ${state.membership.cardExpiry}`,
      failed_charge: state.membership.failedChargeAmount ?? null,
      units_booked: activeClasses(state).length,
      reservation_history: history,
      usual_supply_order: state.fuelOrder?.name ?? null,
      last_staff_rating: state.instructorRating ?? null,
      memory_profile_id: state.profileId ?? null,
      memory_store_id: process.env.TWILIO_MEMORY_STORE_ID ?? null,
    },
    recent_transcript: recentTranscript,
    // Live Conversation Intelligence — what the operators made of the call.
    intelligence: intelForTask(state),
    // The live call this task belongs to. Kept as `call_sid` because that is
    // what the task lookup filters on — without it the task can never be found
    // again and the intelligence block stops updating mid-call.
    call_sid: state.callSid ?? null,
    journey_call_sid: state.callSid ?? null,
    conversations: {
      // Flex Insights segment metadata
      conversation_attribute_1: "voice-ai-escalation",
      conversation_attribute_2: state.membership.status,
      initiated_by: "customer",
    },
  };
}

/* ------------------------------------------------------------------ *
 * The transfer itself
 * ------------------------------------------------------------------ */

/** Locate the live inbound call if we never saw the ConversationRelay setup frame. */
async function findLiveCallSid(state: JourneyState): Promise<string | undefined> {
  if (state.callSid) return state.callSid;
  const to = process.env.CUBESMART_STORE_PHONE || process.env.TWILIO_PHONE_NUMBER;
  if (!to) return undefined;
  try {
    const calls = await twilioClient().calls.list({
      status: "in-progress",
      to,
      limit: 5,
    });
    const match = calls.find((c) => c.from === state.phone) ?? calls[0];
    return match?.sid;
  } catch {
    return undefined;
  }
}

/**
 * Pull the caller out of ConversationRelay and hand them to a human.
 *
 * If a Flex agent is genuinely available right now, the call is enqueued into
 * the real TaskRouter workflow, exactly as before. Otherwise — no agents
 * logged in, or nobody available — the same live call is dialled straight to
 * the store team's fallback phone instead, so the demo always reaches a real
 * person. Either way the redirect TwiML speaks the connect line itself so the
 * caller hears something the instant the AI session tears down.
 */
export async function transferCallToFlex(
  state: JourneyState,
  reason: string,
  summary: string
): Promise<{ ok: boolean; taskSid?: string; error?: string; mode?: "flex" | "forwarded" }> {
  const callSid = await findLiveCallSid(state);
  if (!callSid) {
    return { ok: false, error: "No live call to transfer." };
  }
  state.callSid = callSid;

  const attributes = buildTaskAttributes(state, reason, summary);
  const forwardNumber = resolveHandoffNumber();

  const health = await checkFlexHealth();
  const useFlex = health.ok && Boolean(health.workspaceSid && health.workflowSid);

  if (!useFlex && !forwardNumber) {
    return {
      ok: false,
      error: "Flex has no available agent and no fallback forwarding number is configured.",
    };
  }

  const response = new twilio.twiml.VoiceResponse();
  response.say(
    { voice: "Polly.Joanna" },
    `Connecting you to the ${BRAND.studio} store team now. They already have everything in front of them.`
  );

  if (useFlex) {
    const enqueue = response.enqueue({ workflowSid: health.workflowSid! });
    enqueue.task({ priority: 10, timeout: 900 }, JSON.stringify(attributes));
  } else {
    const dial = response.dial({
      callerId: process.env.TWILIO_PHONE_NUMBER,
      timeout: 30,
      answerOnBridge: true,
    });
    dial.number(forwardNumber!);
    response.say(
      { voice: "Polly.Joanna" },
      "Sorry, nobody at the store could take that call right now. Please try again shortly."
    );
  }

  try {
    await twilioClient().calls(callSid).update({ twiml: response.toString() });
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }

  state.flex = {
    ...(state.flex ?? {}),
    workspaceSid: useFlex ? health.workspaceSid : undefined,
    workflowSid: useFlex ? health.workflowSid : undefined,
    attributes,
    transferred: true,
    transferredAt: new Date().toISOString(),
    callSid,
    mode: useFlex ? "flex" : "forwarded",
    forwardedTo: useFlex ? undefined : forwardNumber,
    // A previous run's task must not be carried over. Everything about the task
    // is unknown again until TaskRouter creates this call's own.
    taskSid: undefined,
    status: useFlex ? "pending" : "assigned",
    worker: useFlex ? undefined : `Store team · ${forwardNumber}`,
    queue: undefined,
    error: undefined,
  };

  if (useFlex) {
    // The task is created asynchronously by the Enqueue verb; pick it up shortly.
    void pollForTask(state);
  } else {
    const { pushState } = await import("./bus.js");
    pushState(state);
  }

  return { ok: true, mode: useFlex ? "flex" : "forwarded" };
}

/** Task states where a human could still be looking at the task. */
const LIVE_TASK_STATES = new Set(["pending", "reserved", "assigned", "wrapping"]);

function parseAttributes(raw?: string | null): Record<string, unknown> {
  try {
    return JSON.parse(raw || "{}") as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** Look up the real task the Enqueue verb created for this call. */
export async function fetchFlexTask(state: JourneyState): Promise<JourneyState["flex"]> {
  // A forwarded call never created a TaskRouter task — there is nothing to poll.
  if (state.flex?.mode === "forwarded") return state.flex;

  const setup = await resolveFlexSetup();
  if (!setup.workspaceSid || !state.flex?.transferred) return state.flex;

  const tr = twilioClient().taskrouter.v1.workspaces(setup.workspaceSid);

  const callSid = state.flex.callSid ?? state.callSid;
  const transferredAt = state.flex.transferredAt
    ? new Date(state.flex.transferredAt).getTime()
    : 0;

  /**
   * Does this task actually belong to the call happening right now?
   *
   * Demos get run more than once, and TaskRouter keeps completed tasks around
   * for a long time. Without this check the lookup happily returns a task from
   * an earlier run — and then every live intelligence update is written to a
   * task nobody is looking at, which is exactly why the retention meter and the
   * recommended save never appeared on the agent's screen.
   */
  const belongsToThisCall = (task: { attributes?: string | null; dateCreated?: Date | null }) => {
    const attrs = parseAttributes(task.attributes);
    if (callSid && (attrs.call_sid === callSid || attrs.journey_call_sid === callSid)) {
      return true;
    }
    // Enqueue can drop attributes we filter on, so age is the backstop: the task
    // must have been created around the moment we redirected the call.
    const created = task.dateCreated ? new Date(task.dateCreated).getTime() : 0;
    return created > 0 && transferredAt > 0 && created >= transferredAt - 15_000;
  };

  try {
    let task = null;

    if (state.flex.taskSid) {
      const stored = await tr.tasks(state.flex.taskSid).fetch().catch(() => null);
      if (stored && belongsToThisCall(stored)) {
        task = stored;
      } else if (stored) {
        // Left over from a previous run. Forget it and find this call's task.
        state.flex = { ...state.flex, taskSid: undefined, worker: undefined, queue: undefined };
      }
    }

    if (!task && callSid) {
      for (const expression of [
        `call_sid == "${callSid}"`,
        `journey_call_sid == "${callSid}"`,
      ]) {
        const found = await tr.tasks
          .list({
            evaluateTaskAttributes: expression,
            ordering: "DateCreated:desc",
            limit: 5,
          })
          .catch(() => []);
        const match = found.find(belongsToThisCall);
        if (match) {
          task = match;
          break;
        }
      }
    }

    // Last resort: the newest live voice-AI escalation. Newest first, still in
    // play, and only if it plausibly belongs to this call.
    if (!task) {
      const recent = await tr.tasks
        .list({
          evaluateTaskAttributes: `escalated_by == "${ESCALATED_BY}"`,
          ordering: "DateCreated:desc",
          limit: 10,
        })
        .catch(() => []);
      task =
        recent.find(
          (t) =>
            LIVE_TASK_STATES.has(String(t.assignmentStatus)) && belongsToThisCall(t)
        ) ?? null;
    }

    if (!task) return state.flex;

    const attrs = parseAttributes(task.attributes);

    let worker: string | undefined;
    const reservations = await tr
      .tasks(task.sid)
      .reservations.list({ limit: 5 })
      .catch(() => []);
    const accepted =
      reservations.find((r) => r.reservationStatus === "accepted") ?? reservations[0];
    if (accepted?.workerName) worker = accepted.workerName;

    let queue: string | undefined = (attrs.queue_name as string) || undefined;
    if (!queue && task.taskQueueSid) {
      const q = await tr.taskQueues(task.taskQueueSid).fetch().catch(() => null);
      queue = q?.friendlyName ?? undefined;
    }

    state.flex = {
      ...state.flex,
      taskSid: task.sid,
      status: task.assignmentStatus,
      worker,
      queue,
    };

    // A human has actually picked her up. The story moves to the final beat,
    // where the operators keep scoring the human conversation.
    if (worker && task.assignmentStatus === "assigned" && state.beatId === "flex") {
      completeBeat(state, "flex");
    }
  } catch (err) {
    state.flex = { ...state.flex, error: (err as Error).message };
  }

  return state.flex;
}

/** Nudge the task lookup until the real task exists, then keep it in step. */
async function pollForTask(state: JourneyState) {
  const { pushState } = await import("./bus.js");
  const { pushIntelToFlexTask } = await import("./intel.js");
  let syncedSid: string | undefined;

  for (const delay of [1500, 2000, 2500, 3000, 4000, 5000, 6000, 8000]) {
    await new Promise((resolve) => setTimeout(resolve, delay));
    await fetchFlexTask(state);
    pushState(state);

    // Whenever the task we are targeting changes, put the latest intelligence
    // on it — operator results that arrived before the task existed, or that
    // went to a task we have since corrected, had nowhere to land.
    const sid = state.flex?.taskSid;
    if (sid && sid !== syncedSid) {
      syncedSid = sid;
      await pushIntelToFlexTask(state);
    }

    if (state.flex?.worker && sid) break;
  }
}
