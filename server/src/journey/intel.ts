import twilio from "twilio";
import { pushState } from "./bus.js";
import { EVENTS, RETENTION_RISK_THRESHOLD } from "./script.js";
import { type JourneyState } from "./state.js";

/**
 * Real-time Conversation Intelligence for the guided move-in journey.
 *
 * The live call is already flowing through Conversation Orchestrator, so an
 * intelligence configuration runs Language Operators against the transcript
 * while she is still talking and posts the results here. Nothing in this module
 * is on the critical path of the call — if it goes quiet the demo carries on,
 * the panel simply says it is waiting.
 */

/* ------------------------------------------------------------------ *
 * Shapes
 * ------------------------------------------------------------------ */

export type SentimentLabel = "positive" | "neutral" | "negative" | "mixed";
export type RiskBand = "low" | "watch" | "elevated" | "high";

export interface CallReasonSignal {
  reason: string;
  confidence: number;
  evidence?: string;
  at: string;
}

export interface SentimentSignal {
  label: SentimentLabel;
  at: string;
}

export interface RetentionRiskSignal {
  score: number;
  band: RiskBand;
  drivers: string[];
  quote?: string;
  trend?: "rising" | "steady" | "falling";
  at: string;
}

export interface NextBestActionSignal {
  recommend: boolean;
  headline: string;
  offer: string;
  rationale?: string;
  policySource?: string;
  urgency?: string;
  at: string;
}

export interface OperatorRun {
  operator: string;
  latencyMs?: number;
  model?: string;
  trigger?: string;
  at: string;
}

export interface JourneyIntel {
  /** Which call these signals belong to, so a new call starts clean. */
  callNumber: number;
  reason?: CallReasonSignal;
  sentiment?: SentimentSignal;
  /** Every sentiment reading through the call, oldest first. */
  sentimentTrail: SentimentSignal[];
  risk?: RetentionRiskSignal;
  /** Score history so the panel can draw the climb. */
  riskTrail: { score: number; at: string }[];
  /** Deliberately only surfaced to the human agent in Flex. */
  nextBestAction?: NextBestActionSignal;
  /**
   * A save offer the operator produced before the tenant had raised leaving.
   * Held back until she actually starts talking about a competitor or moving
   * out — never sent to Flex or the screen from here.
   */
  pendingNextBestAction?: NextBestActionSignal;
  /** The last few operator executions, newest first — proof this is live. */
  runs: OperatorRun[];
  totalRuns: number;
  conversationId?: string;
  updatedAt?: string;
}

export function emptyIntel(callNumber: number): JourneyIntel {
  return {
    callNumber,
    sentimentTrail: [],
    riskTrail: [],
    runs: [],
    totalRuns: 0,
  };
}

/** Start a clean slate for a new call. */
export function resetIntel(state: JourneyState) {
  state.intel = emptyIntel(state.callCount);
}

/* ------------------------------------------------------------------ *
 * Reading the webhook payload
 * ------------------------------------------------------------------ */

const OPERATOR_IDS = {
  reason: () => process.env.CUBESMART_OP_CALL_REASON ?? "",
  risk: () => process.env.CUBESMART_OP_RETENTION_RISK ?? "",
  nba: () => process.env.CUBESMART_OP_NEXT_BEST_ACTION ?? "",
  sentiment: () =>
    process.env.CUBESMART_OP_SENTIMENT ??
    "intelligence_operator_01kcrvw16kfa88qvgrfmr7y151",
};

interface RawOperatorResult {
  operator?: { id?: string; displayName?: string };
  outputFormat?: string;
  result?: Record<string, unknown> | null;
  dateCreated?: string;
  executionDetails?: {
    trigger?: { on?: string };
    channels?: string[];
  };
  metadata?: { system?: { latencyMs?: number; resolvedModel?: string } };
}

export interface RuleExecutionPayload {
  conversationId?: string;
  intelligenceConfiguration?: { id?: string; displayName?: string };
  operatorResults?: RawOperatorResult[];
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function num(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return undefined;
}

function bandFor(score: number): RiskBand {
  if (score >= 75) return "high";
  if (score >= 50) return "elevated";
  if (score >= 25) return "watch";
  return "low";
}

const SENTIMENTS: SentimentLabel[] = ["positive", "neutral", "negative", "mixed"];

function sentimentFor(value: unknown): SentimentLabel | undefined {
  const raw = str(value).toLowerCase();
  return SENTIMENTS.find((s) => raw.includes(s));
}

/* ------------------------------------------------------------------ *
 * When is a save offer allowed to appear?
 * ------------------------------------------------------------------ */

/**
 * The recommendation is a retention play, so it must not appear on a routine
 * call. But it must NOT depend on this app having heard her say it.
 *
 * Once the call is handed to a human in Flex, ConversationRelay is gone and this
 * app stops receiving turns — while Real-Time Transcription keeps feeding the
 * same operators. So the gate is driven by three independent signals, any one of
 * which is enough: her words in the transcript (from either leg), the operators'
 * own quoted evidence, or the retention score itself crossing the store's
 * threshold. That last one is the real safety net — if the risk operator says
 * she is an elevated churn risk, the offer is due regardless of phrasing.
 */
const CANCEL_INTENT =
  /\b(cancel|cancels|cancell?ed|cancell?ing|cancellation|move ?out|moving out|vacate|vacating|end (?:my|the|this) (?:lease|rental|account)|stop (?:my|the|this) (?:lease|rental)|close (?:my|the) (?:lease|account)|not (?:going to )?renew(?:ing)?|don'?t (?:want|need) (?:it|my|the|this) ?(?:unit|storage)?anymore|not worth (?:it|the money|paying)|leave (?:cubesmart|this place)|walk away|get out of (?:my|the) (?:lease|contract)|done with (?:it|this|the unit|cubesmart))\b/i;

/**
 * Competitor pricing and dissatisfaction. Not a cancellation in words, but
 * exactly the moment the store's playbook says a save is owed — and the thing
 * that was silently never matching before.
 */
const DISSATISFACTION =
  /\b(cheaper (?:unit|storage|place|rate)|found (?:a )?(?:cheaper|better) (?:place|deal|rate|unit)|down the street|competitor|another (?:storage )?company|not (?:really )?(?:seeing|getting) (?:any )?(?:value|worth it)|isn'?t worth it|not (?:really )?using (?:it|my unit|the storage)|haven'?t been (?:going|in|using)|waste of money|too expensive|can'?t afford|price (?:went up|increase)|rate (?:went up|increase))\b/i;

function raisesRisk(text: string): boolean {
  if (!text) return false;
  return CANCEL_INTENT.test(text) || DISSATISFACTION.test(text);
}

/**
 * Is a retention save genuinely owed right now?
 *
 * Works on the AI leg and the human leg alike, because none of the three
 * signals depend on this app being the one holding the conversation.
 */
export function retentionRiskRaised(state: JourneyState): boolean {
  const intel = state.intel;

  // 1. The score itself. The most reliable signal, and channel-agnostic.
  if ((intel?.risk?.score ?? 0) >= RETENTION_RISK_THRESHOLD) return true;

  // 2. Her own words, from whichever leg of the call they arrived on.
  if (state.transcript.some((line) => line.role === "member" && raisesRisk(line.text))) {
    return true;
  }

  // 3. What the operators themselves quoted back as evidence.
  if (raisesRisk(intel?.risk?.quote ?? "")) return true;
  if (raisesRisk(intel?.reason?.evidence ?? "")) return true;
  if ((intel?.risk?.drivers ?? []).some(raisesRisk)) return true;

  return false;
}

/**
 * Release a held-back save offer the moment a save becomes owed.
 *
 * Called after every tenant utterance and after every risk result, so the
 * recommendation lands on the agent's screen in the same beat rather than
 * waiting for the operator to run again.
 */
export function releasePendingNextBestAction(state: JourneyState): boolean {
  const intel = state.intel;
  if (!intel?.pendingNextBestAction) return false;
  if (!retentionRiskRaised(state)) return false;

  intel.nextBestAction = intel.pendingNextBestAction;
  intel.pendingNextBestAction = undefined;
  intel.updatedAt = new Date().toISOString();
  pushState(state);
  syncIntelToFlexTask(state);
  return true;
}

/* ------------------------------------------------------------------ *
 * Writing back to her profile
 * ------------------------------------------------------------------ */

/**
 * The operators do not only read. The first time the live score crosses the
 * store's threshold, an event is written to her Unified Profile in Twilio
 * Memory — authored by a Language Operator mid-call, not by anyone clicking a
 * button. Fires at most once per run.
 */
function noteRiskThreshold(state: JourneyState, score: number, drivers: string[]) {
  if (state.riskThresholdAt) return;
  if (score < RETENTION_RISK_THRESHOLD) return;

  state.riskThresholdAt = new Date().toISOString();
  state.riskThresholdScore = score;

  const named = drivers.filter(Boolean).slice(0, 2).join(" and ").toLowerCase();
  const detail = named
    ? `Live call intelligence scored her ${score} of 100 — elevated churn risk driven by ${named}. Save offer released to the store team.`
    : `Live call intelligence scored her ${score} of 100 mid-call — elevated churn risk. Save offer released to the store team.`;

  // Dynamic import: engine imports flex, which imports this module.
  void (async () => {
    try {
      const { fireEvent } = await import("./engine.js");
      await fireEvent(state, EVENTS.RETENTION_RISK_THRESHOLD, detail);
    } catch (err) {
      console.error(
        "[journey/intel] could not record the risk threshold",
        (err as Error).message
      );
    }
  })();
}

/** Which of our four signals is this result? Falls back to the display name. */
function classify(result: RawOperatorResult): "reason" | "sentiment" | "risk" | "nba" | null {
  const id = result.operator?.id ?? "";
  if (id && id === OPERATOR_IDS.reason()) return "reason";
  if (id && id === OPERATOR_IDS.risk()) return "risk";
  if (id && id === OPERATOR_IDS.nba()) return "nba";
  if (id && id === OPERATOR_IDS.sentiment()) return "sentiment";

  const name = (result.operator?.displayName ?? "").toLowerCase();
  if (name.includes("call reason")) return "reason";
  if (name.includes("retention risk")) return "risk";
  if (name.includes("next best")) return "nba";
  if (name.includes("sentiment")) return "sentiment";
  return null;
}

/** Channels that belong to Acts 1 and 2, not to a live call. */
const MESSAGING_CHANNELS = new Set([
  "SMS",
  "MMS",
  "RCS",
  "WHATSAPP",
  "CHAT",
  "MESSENGER",
  "EMAIL",
  "WEB",
]);

/**
 * Apply one rule execution to the live journey state.
 *
 * The same conversation configuration also captures her RCS and SMS turns from
 * Acts 1 and 2, and those are not what this panel is about. But once the call is
 * handed to a human, ConversationRelay is gone and Real-Time Transcription takes
 * over — and it does not always label the channel the same way. Insisting on a
 * literal VOICE label silently threw those results away, which is why the
 * retention meter froze moments after the agent picked up.
 */
export function applyRuleExecution(
  state: JourneyState,
  payload: RuleExecutionPayload
): boolean {
  const results = payload.operatorResults ?? [];
  if (!results.length) return false;

  const channels = results.flatMap((r) =>
    (r.executionDetails?.channels ?? []).map((c) => String(c).toUpperCase())
  );
  const named = results
    .map((r) => r.operator?.displayName ?? r.operator?.id ?? "?")
    .join(", ");

  const isVoice = channels.includes("VOICE");
  const isMessagingOnly =
    channels.length > 0 && channels.every((c) => MESSAGING_CHANNELS.has(c));
  // A call is live from the moment she is connected until the story moves on —
  // which includes the whole human stretch after the Flex handoff.
  const callLive = state.callStatus === "in-call" || state.callStatus === "ringing";

  if (!isVoice && (isMessagingOnly || !callLive)) {
    console.log(
      `[journey/intel] ignoring result from [${channels.join("/") || "no channel"}] — ${named}`
    );
    return false;
  }

  console.log(
    `[journey/intel] applying [${channels.join("/") || "no channel"}] — ${named}`
  );

  if (!state.intel || state.intel.callNumber !== state.callCount) {
    state.intel = emptyIntel(state.callCount);
  }
  const intel = state.intel;
  intel.conversationId = payload.conversationId ?? intel.conversationId;

  let changed = false;

  for (const raw of results) {
    const kind = classify(raw);
    if (!kind) continue;
    const at = raw.dateCreated ?? new Date().toISOString();
    const value = (raw.result ?? {}) as Record<string, unknown>;

    intel.runs.unshift({
      operator: raw.operator?.displayName ?? kind,
      latencyMs: raw.metadata?.system?.latencyMs,
      model: raw.metadata?.system?.resolvedModel,
      trigger: raw.executionDetails?.trigger?.on,
      at,
    });
    intel.runs = intel.runs.slice(0, 6);
    intel.totalRuns += 1;
    changed = true;

    if (kind === "reason") {
      const reason = str(value.reason) || str(value.label);
      if (!reason) continue;
      const confidence = num(value.confidence) ?? 0;
      // Never let a fresh "not clear yet" overwrite a resolved reason.
      const settled = /not clear/i.test(reason) === false;
      if (settled || !intel.reason) {
        intel.reason = { reason, confidence, evidence: str(value.evidence), at };
      }
      continue;
    }

    if (kind === "sentiment") {
      const label = sentimentFor(value.label ?? value.sentiment ?? value.text);
      if (!label) continue;
      const signal: SentimentSignal = { label, at };
      intel.sentiment = signal;
      const last = intel.sentimentTrail[intel.sentimentTrail.length - 1];
      if (!last || last.label !== label) intel.sentimentTrail.push(signal);
      intel.sentimentTrail = intel.sentimentTrail.slice(-12);
      continue;
    }

    if (kind === "risk") {
      const score = num(value.score);
      if (score === undefined) continue;
      const clamped = Math.max(0, Math.min(100, Math.round(score)));
      const drivers = Array.isArray(value.drivers)
        ? (value.drivers as unknown[]).map(str).filter(Boolean)
        : [];
      const bandRaw = str(value.band).toLowerCase() as RiskBand;
      const trendRaw = str(value.trend).toLowerCase();
      intel.risk = {
        score: clamped,
        band: (["low", "watch", "elevated", "high"] as RiskBand[]).includes(bandRaw)
          ? bandRaw
          : bandFor(clamped),
        drivers,
        quote: str(value.quote) || undefined,
        trend:
          trendRaw === "rising" || trendRaw === "falling" || trendRaw === "steady"
            ? trendRaw
            : undefined,
        at,
      };
      intel.riskTrail.push({ score: clamped, at });
      intel.riskTrail = intel.riskTrail.slice(-24);
      console.log(
        `[journey/intel] retention risk ${clamped} (${intel.risk.band})${
          drivers.length ? " — " + drivers.join(", ") : ""
        }`
      );
      // The operators write back: crossing the store's threshold puts an event
      // on her Unified Profile, and makes the save offer due.
      noteRiskThreshold(state, clamped, drivers);
      continue;
    }

    if (kind === "nba") {
      const recommend = value.recommend === true || value.recommend === "true";
      const headline = str(value.headline);
      const offer = str(value.offer);
      if (!recommend || !offer) continue;
      // Never written to the transcript and never pushed to the demo screen —
      // the save offer belongs to the human agent in Flex and nowhere else.
      const signal: NextBestActionSignal = {
        recommend: true,
        headline: headline || "Recommended save",
        offer,
        rationale: str(value.rationale) || undefined,
        policySource: str(value.policy_source) || undefined,
        urgency: str(value.urgency) || undefined,
        at,
      };
      // And it waits: nothing is recommended until a save is genuinely owed.
      if (retentionRiskRaised(state)) {
        intel.nextBestAction = signal;
        intel.pendingNextBestAction = undefined;
        console.log(`[journey/intel] save offer released — ${signal.headline}`);
      } else {
        intel.pendingNextBestAction = signal;
        console.log(`[journey/intel] save offer parked — ${signal.headline}`);
      }
    }
  }

  if (changed) {
    // A risk result in this same batch may have just made a parked offer due.
    releasePendingNextBestAction(state);
    intel.updatedAt = new Date().toISOString();
    pushState(state);
    syncIntelToFlexTask(state);
  }

  return changed;
}

/* ------------------------------------------------------------------ *
 * A compact shape for Flex task attributes
 * ------------------------------------------------------------------ */

export function intelForTask(state: JourneyState): Record<string, unknown> | null {
  const intel = state.intel;
  if (!intel) return null;
  return {
    call_reason: intel.reason?.reason ?? null,
    call_reason_confidence: intel.reason ? Math.round(intel.reason.confidence * 100) : null,
    call_reason_evidence: intel.reason?.evidence ?? null,
    sentiment: intel.sentiment?.label ?? null,
    sentiment_trail: intel.sentimentTrail.map((s) => s.label),
    retention_risk_score: intel.risk?.score ?? null,
    retention_risk_band: intel.risk?.band ?? null,
    retention_risk_drivers: intel.risk?.drivers ?? [],
    retention_risk_quote: intel.risk?.quote ?? null,
    retention_risk_trend: intel.risk?.trend ?? null,
    retention_risk_threshold: RETENTION_RISK_THRESHOLD,
    retention_risk_threshold_crossed: Boolean(state.riskThresholdAt),
    retention_risk_threshold_at: state.riskThresholdAt ?? null,
    next_best_action: intel.nextBestAction
      ? {
          headline: intel.nextBestAction.headline,
          offer: intel.nextBestAction.offer,
          rationale: intel.nextBestAction.rationale ?? null,
          policy_source: intel.nextBestAction.policySource ?? null,
          urgency: intel.nextBestAction.urgency ?? null,
        }
      : null,
    operator_runs: intel.totalRuns,
    last_operator: intel.runs[0]?.operator ?? null,
    last_latency_ms: intel.runs[0]?.latencyMs ?? null,
    updated_at: intel.updatedAt ?? null,
  };
}

/* ------------------------------------------------------------------ *
 * Keep the live Flex task in step
 * ------------------------------------------------------------------ */

let client: ReturnType<typeof twilio> | null = null;
function twilioClient() {
  if (!client) {
    client = twilio(process.env.TWILIO_API_KEY, process.env.TWILIO_API_SECRET, {
      accountSid: process.env.TWILIO_ACCOUNT_SID,
    });
  }
  return client;
}

let syncTimer: ReturnType<typeof setTimeout> | null = null;
let syncPending: JourneyState | null = null;

/**
 * Debounced patch of the intelligence block onto the live task.
 *
 * Results arrive in bursts, so this coalesces them — but unlike a plain lock it
 * always runs a trailing pass, so the newest score can never be the one that
 * gets dropped. That was why the retention meter looked frozen in Flex.
 */
export function syncIntelToFlexTask(state: JourneyState) {
  syncPending = state;
  if (syncTimer) return;
  syncTimer = setTimeout(() => {
    syncTimer = null;
    const next = syncPending;
    syncPending = null;
    if (next) void pushIntelToFlexTask(next);
  }, 1200);
}

/**
 * Patch the intelligence block onto the live TaskRouter task so the agent's
 * panel updates while they are still on the call. Merge-only and silent on
 * failure — this must never disturb a live conversation.
 */
export async function pushIntelToFlexTask(state: JourneyState) {
  const workspaceSid = state.flex?.workspaceSid;
  let taskSid = state.flex?.taskSid;

  // The handoff on record belongs to an earlier call in this run. Writing to it
  // would update a task nobody is looking at, and leave the live agent staring
  // at a frozen score.
  if (state.flex?.callSid && state.callSid && state.flex.callSid !== state.callSid) {
    return;
  }

  // The handoff may have happened before TaskRouter created the task. Find it
  // rather than silently giving up — otherwise nothing ever updates again.
  if (workspaceSid && !taskSid && state.flex?.transferred) {
    const { fetchFlexTask } = await import("./flex.js");
    await fetchFlexTask(state);
    taskSid = state.flex?.taskSid;
  }

  if (!taskSid || !workspaceSid) return;

  const intel = intelForTask(state);
  if (!intel) return;

  try {
    const tr = twilioClient().taskrouter.v1.workspaces(workspaceSid);
    const task = await tr.tasks(taskSid).fetch();
    const current = (() => {
      try {
        return JSON.parse(task.attributes || "{}") as Record<string, unknown>;
      } catch {
        return {} as Record<string, unknown>;
      }
    })();

    // Final guard: the task must be this call's. If it is not, drop it and let
    // the lookup find the right one on the next result.
    const owner = (current.call_sid ?? current.journey_call_sid) as string | undefined;
    const expected = state.flex?.callSid ?? state.callSid;
    if (owner && expected && owner !== expected) {
      const { fetchFlexTask } = await import("./flex.js");
      if (state.flex) state.flex = { ...state.flex, taskSid: undefined };
      await fetchFlexTask(state);
      return;
    }

    const merged = { ...current, intelligence: intel };
    await tr.tasks(taskSid).update({ attributes: JSON.stringify(merged) });

    if (state.flex) state.flex.attributes = merged;
    pushState(state);
  } catch (err) {
    console.error("[journey/intel] could not patch the Flex task", (err as Error).message);
  }
}

/* ------------------------------------------------------------------ *
 * Health
 * ------------------------------------------------------------------ */

export interface IntelHealth {
  configId?: string;
  configName?: string;
  /** True when the configuration exists and is attached to the live conversation config. */
  attached: boolean;
  operators: string[];
  knowledgeBaseId?: string;
  webhookUrl?: string;
  /** True when a result has actually arrived at least once since boot. */
  receiving: boolean;
  lastResultAt?: string;
  ok: boolean;
  problem?: string;
  hint?: string;
  checkedAt: string;
}

let lastResultAt: string | undefined;
export function noteResultReceived() {
  lastResultAt = new Date().toISOString();
}

let healthCache: { value: IntelHealth; at: number } | null = null;
const TTL_MS = 30_000;

export async function checkIntelHealth(force = false): Promise<IntelHealth> {
  if (healthCache && !force && Date.now() - healthCache.at < TTL_MS) {
    return { ...healthCache.value, receiving: Boolean(lastResultAt), lastResultAt };
  }

  const configId = process.env.CUBESMART_INTEL_CONFIG_ID || undefined;
  const health: IntelHealth = {
    configId,
    knowledgeBaseId: process.env.CUBESMART_KNOWLEDGE_BASE_ID || undefined,
    webhookUrl: process.env.TWILIO_VOICE_PUBLIC_DOMAIN
      ? `https://${process.env.TWILIO_VOICE_PUBLIC_DOMAIN}/journey/cintel`
      : undefined,
    attached: false,
    operators: [],
    receiving: Boolean(lastResultAt),
    lastResultAt,
    ok: false,
    checkedAt: new Date().toISOString(),
  };

  if (!configId) {
    health.problem = "No intelligence configuration is set for this demo.";
    health.hint = "Run the provisioning script to create the CubeSmart operators.";
    healthCache = { value: health, at: Date.now() };
    return health;
  }

  const key = process.env.TWILIO_API_KEY;
  const secret = process.env.TWILIO_API_SECRET;
  const auth = "Basic " + Buffer.from(`${key}:${secret}`).toString("base64");

  try {
    const configRes = await fetch(
      `https://intelligence.twilio.com/v3/ControlPlane/Configurations/${configId}`,
      { headers: { Authorization: auth } }
    );
    if (configRes.ok) {
      const body = (await configRes.json()) as {
        displayName?: string;
        rules?: { operators?: { id?: string }[] }[];
      };
      health.configName = body.displayName;
      health.operators = (body.rules ?? []).flatMap((rule) =>
        (rule.operators ?? []).map((o) => o.id ?? "").filter(Boolean)
      );
    }

    const convId = process.env.TWILIO_CONVERSATION_CONFIGURATION_ID;
    if (convId) {
      const convRes = await fetch(
        "https://conversations.twilio.com/v2/ControlPlane/Configurations",
        { headers: { Authorization: auth } }
      );
      if (convRes.ok) {
        const body = (await convRes.json()) as {
          configurations?: { id?: string; intelligenceConfigurationIds?: string[] }[];
        };
        const mine = (body.configurations ?? []).find((c) => c.id === convId);
        health.attached = Boolean(mine?.intelligenceConfigurationIds?.includes(configId));
      }
    }

    if (!health.configName) {
      health.problem = "The intelligence configuration could not be read.";
      health.hint = "Check the API key has access to Conversation Intelligence.";
    } else if (!health.attached) {
      health.problem = "The operators are not attached to the live conversation configuration.";
      health.hint = "Re-run the provisioning script to attach them.";
    } else {
      health.ok = true;
    }
  } catch (err) {
    health.problem = "Could not reach Conversation Intelligence.";
    health.hint = (err as Error).message;
  }

  healthCache = { value: health, at: Date.now() };
  return health;
}

export function invalidateIntelHealth() {
  healthCache = null;
}
