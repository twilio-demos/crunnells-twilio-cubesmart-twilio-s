import type { FastifyInstance } from "fastify";
import twilio from "twilio";
import { pushState, screenSafeState } from "./bus.js";
import {
  bookClass,
  completeSave,
  escalateToDesk,
  fireEvent,
  sendFuelBar,
  sendPostClass,
  sendReminder,
  sendWelcome,
} from "./engine.js";
import { handleInboundMessage, resetConversationLog } from "./inbound.js";
import { checkFlexHealth, fetchFlexTask, invalidateFlexHealth } from "./flex.js";
import {
  applyRuleExecution,
  checkIntelHealth,
  invalidateIntelHealth,
  noteResultReceived,
  releasePendingNextBestAction,
  type RuleExecutionPayload,
} from "./intel.js";
import { provisionCintel } from "./intel-provision.js";
import { syncConversationTranscript } from "./orchestrator.js";
import { checkRcsHealth, invalidateRcsHealth } from "./rcs-health.js";
import { applyDeliveryFacts } from "./send.js";
import {
  createMemberProfile,
  deleteMemberProfile,
  fetchProfileSnapshot,
  lookupProfileIdByPhone,
  patchMembershipTraits,
} from "./memory-profile.js";
import {
  BEATS,
  BRAND,
  DRINKS,
  EVENTS,
  INSTRUCTORS,
  PERSONA,
  RETENTION_RISK_THRESHOLD,
  SAVE_OFFER,
  buildSchedule,
  nextWeekday,
  slotsForDate,
} from "./script.js";
import {
  activeClasses,
  allStates,
  completeBeat,
  createState,
  deleteState,
  getAnyState,
  getState,
  isBeatUnlocked,
  nextClass,
  normalizePhone,
  type JourneyState,
} from "./state.js";
import { resetVoiceHistory } from "./voice.js";

let client: ReturnType<typeof twilio> | null = null;
function twilioClient() {
  if (!client) {
    client = twilio(process.env.TWILIO_API_KEY, process.env.TWILIO_API_SECRET, {
      accountSid: process.env.TWILIO_ACCOUNT_SID,
    });
  }
  return client;
}

function publicState(state: JourneyState | undefined) {
  if (!state) return null;
  // The save offer is withheld from the demo screen — Flex only.
  const safe = screenSafeState(state);
  return {
    ...safe,
    upcoming: activeClasses(state),
    next: nextClass(state) ?? null,
  };
}

export function registerJourneyRoutes(app: FastifyInstance) {
  // The workspace UI is served from a different origin (Vercel), so allow it.
  app.addHook("onRequest", async (request, reply) => {
    if (!request.url.startsWith("/journey")) return;
    reply.header("Access-Control-Allow-Origin", "*");
    reply.header("Access-Control-Allow-Headers", "content-type");
    reply.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    if (request.method === "OPTIONS") {
      reply.code(204).send();
    }
  });

  /* ---------------- Config ---------------- */

  app.get("/journey/config", async () => ({
    brand: BRAND,
    persona: PERSONA,
    beats: BEATS,
    events: EVENTS,
    drinks: DRINKS,
    instructors: INSTRUCTORS,
    studioPhone: process.env.CUBESMART_STORE_PHONE ?? process.env.TWILIO_PHONE_NUMBER ?? "",
    schedule: buildSchedule(14),
    thursday: nextWeekday("Thursday", 2),
    riskThreshold: RETENTION_RISK_THRESHOLD,
    saveOffer: SAVE_OFFER,
    rcsSender: process.env.CUBESMART_RCS_SENDER_ID ?? "",
    rcs: await checkRcsHealth(),
    flex: await checkFlexHealth(),
    intel: await checkIntelHealth(),
    ready: Boolean(process.env.CUBESMART_MESSAGING_SERVICE_SID),
  }));

  /** Re-check the real-time intelligence wiring, bypassing the cache. */
  app.post("/journey/intel-check", async () => {
    invalidateIntelHealth();
    return { intel: await checkIntelHealth(true) };
  });

  /**
   * One-time setup: creates the CubeSmart Conversation Intelligence operators,
   * knowledge base and configuration on this Twilio account, and attaches it to
   * the live Conversation Orchestrator config. Safe to call more than once —
   * everything is looked up by display name first.
   */
  app.post("/journey/provision-intel", async (_request, reply) => {
    try {
      const result = await provisionCintel();
      invalidateIntelHealth();
      return { ok: true, result };
    } catch (err) {
      return reply.code(500).send({ ok: false, error: (err as Error).message });
    }
  });

  /** Live Flex readiness + the real state of the handoff task. */
  app.get("/journey/flex", async () => {
    const state = getAnyState();
    const [health, task] = await Promise.all([
      checkFlexHealth(),
      state ? fetchFlexTask(state) : Promise.resolve(undefined),
    ]);
    if (state) pushState(state);
    return { flex: health, task: task ?? null };
  });

  /** Re-check Flex, bypassing the cache. Used by the "check again" button. */
  app.post("/journey/flex-check", async () => {
    invalidateFlexHealth();
    const state = getAnyState();
    const [health, task] = await Promise.all([
      checkFlexHealth(true),
      state ? fetchFlexTask(state) : Promise.resolve(undefined),
    ]);
    if (state) pushState(state);
    return { flex: health, task: task ?? null };
  });

  /** Re-run the RCS sender check on demand, bypassing the cache. */
  app.post("/journey/rcs-check", async () => {
    invalidateRcsHealth();
    return { rcs: await checkRcsHealth(true) };
  });

  app.get("/journey/state", async (request) => {
    const query = (request.query as Record<string, string>) || {};
    const state = query.phone ? getState(query.phone) : getAnyState();
    const profile = await fetchProfileSnapshot(state?.profileId);
    return { state: publicState(state), profile };
  });

  app.get("/journey/slots", async (request) => {
    const query = (request.query as Record<string, string>) || {};
    if (!query.date) return { slots: [] };
    return { slots: slotsForDate(query.date) };
  });

  /* ---------------- Act 1 step 1: Lookup + Verify ---------------- */

  app.post("/journey/lookup", async (request, reply) => {
    const body = (request.body as Record<string, string>) || {};
    const phone = normalizePhone(body.phone || "");
    if (!phone || phone.length < 8) {
      return reply.code(400).send({ error: "Enter a mobile number." });
    }

    try {
      const result = await twilioClient()
        .lookups.v2.phoneNumbers(phone)
        .fetch({ fields: "line_type_intelligence" });

      const lti = result.lineTypeIntelligence as Record<string, string> | null;
      const lineType = lti?.type ?? undefined;
      const carrier = lti?.carrier_name ?? (lti?.carrierName as string) ?? undefined;

      return {
        phone,
        valid: Boolean(result.valid),
        nationalFormat: result.nationalFormat ?? undefined,
        countryCode: result.countryCode ?? undefined,
        lineType,
        carrier,
        // Delivery is RCS-first through the CubeSmart sender with automatic
        // SMS fallback. The confirmed channel comes back on the first send.
        rcsEligible: Boolean(result.valid) && lineType === "mobile",
        validationErrors: result.validationErrors ?? [],
      };
    } catch (err) {
      return reply.code(400).send({ error: (err as Error).message });
    }
  });

  app.post("/journey/verify/start", async (request, reply) => {
    const body = (request.body as Record<string, string>) || {};
    const phone = normalizePhone(body.phone || "");
    const serviceSid = process.env.TWILIO_VERIFY_SID;
    if (!serviceSid) return reply.code(500).send({ error: "Verify is not configured." });

    try {
      const verification = await twilioClient()
        .verify.v2.services(serviceSid)
        .verifications.create({ to: phone, channel: "sms" });
      return { status: verification.status, to: phone };
    } catch (err) {
      return reply.code(400).send({ error: (err as Error).message });
    }
  });

  app.post("/journey/verify/check", async (request, reply) => {
    const body = (request.body as Record<string, string>) || {};
    const phone = normalizePhone(body.phone || "");
    const code = (body.code || "").trim();
    const firstName = (body.firstName || "").trim();
    const lastName = (body.lastName || "").trim();
    const serviceSid = process.env.TWILIO_VERIFY_SID;
    if (!serviceSid) return reply.code(500).send({ error: "Verify is not configured." });

    try {
      const check = await twilioClient()
        .verify.v2.services(serviceSid)
        .verificationChecks.create({ to: phone, code });

      if (check.status !== "approved") {
        return reply.code(400).send({ error: "That code didn't match. Try again." });
      }
    } catch (err) {
      return reply.code(400).send({ error: (err as Error).message });
    }

    // Verified — stand up the demo run and the Memory profile.
    const state = createState(phone, firstName, lastName);
    state.verified = true;
    state.consentAt = new Date().toISOString();
    state.lookup = {
      phone,
      valid: true,
      rcsCapable: true,
      lineType: body.lineType,
      carrier: body.carrier,
      nationalFormat: body.nationalFormat,
    };

    let profileId = await createMemberProfile({ firstName, lastName, phone });
    if (!profileId) profileId = await lookupProfileIdByPhone(phone);
    state.profileId = profileId;

    await patchMembershipTraits(profileId!, {
      consentStatus: "Opted in to SMS and RCS at West 7th signup",
      lineType: body.lineType ?? "mobile",
      carrier: body.carrier ?? "unknown",
      rcsCapable: "true",
    });

    await fireEvent(
      state,
      EVENTS.ACCOUNT_CREATED,
      `${firstName} ${lastName} started a lease at ${BRAND.name} ${BRAND.studio}`
    );
    await fireEvent(
      state,
      EVENTS.CONSENT_CAPTURED,
      `Explicit opt-in captured at reservation, ownership confirmed with Twilio Verify`
    );

    completeBeat(state, "signup");
    pushState(state);

    const profile = await fetchProfileSnapshot(profileId);
    return { state: publicState(state), profile };
  });

  /* ---------------- Beat control ---------------- */

  app.post("/journey/advance", async (request, reply) => {
    const body = (request.body as Record<string, string>) || {};
    const beatId = body.beatId;
    const state = getAnyState();
    if (beatId === "setup") {
      // Nothing is created until she signs up — the setup beat is narration only.
      return { ok: true };
    }
    if (!state) return reply.code(400).send({ error: "No active journey." });
    completeBeat(state, beatId);
    pushState(state);
    return { ok: true, state: publicState(state) };
  });

  app.post("/journey/action", async (request, reply) => {
    const body = (request.body as Record<string, string>) || {};
    const action = body.action;
    const state = getAnyState();
    if (!state) return reply.code(400).send({ error: "Start with the signup step first." });

    switch (action) {
      case "send-welcome": {
        if (!isBeatUnlocked(state, "welcome"))
          return reply.code(409).send({ error: "Finish signup first." });
        await sendWelcome(state);
        return { ok: true, state: publicState(state) };
      }
      case "send-reminder": {
        if (!isBeatUnlocked(state, "reminder"))
          return reply.code(409).send({ error: "Book her first class first." });
        const result = await sendReminder(state);
        if (!result.ok) return reply.code(409).send({ error: result.error });
        return { ok: true, state: publicState(state) };
      }
      case "send-fuel": {
        if (!isBeatUnlocked(state, "fuel"))
          return reply.code(409).send({ error: "She needs to confirm the reminder first." });
        await sendFuelBar(state);
        return { ok: true, state: publicState(state) };
      }
      case "send-post-class": {
        if (!isBeatUnlocked(state, "post-class"))
          return reply.code(409).send({ error: "Send the Fuel Bar pre-order first." });
        const result = await sendPostClass(state);
        if (!result.ok) return reply.code(409).send({ error: result.error });
        return { ok: true, state: publicState(state) };
      }
      case "complete-save": {
        if (!isBeatUnlocked(state, "save"))
          return reply.code(409).send({ error: "Hand the call to Flex first." });
        await completeSave(state);
        return { ok: true, state: publicState(state) };
      }
      /**
       * Escape hatch for a live demo. If the voice agent stalls before it reaches
       * the handoff, the operator can perform the real transfer themselves — same
       * live call, same TaskRouter task, same context payload.
       */
      case "force-handoff": {
        const result = await escalateToDesk(
          state,
          "Card on file expired — needs a new payment method",
          `${state.firstName} ${state.lastName} is checking in on her account. The Visa ending ${state.membership.cardLast4} has expired so the rent charge could not be taken. She needs a new card, which cannot be taken on the AI line.`
        );
        if (!result.ok) return reply.code(502).send({ error: result.error });
        return { ok: true, state: publicState(state) };
      }
      default:
        return reply.code(400).send({ error: `Unknown action ${action}` });
    }
  });

  app.post("/journey/book", async (request, reply) => {
    const body = (request.body as Record<string, string>) || {};
    const state = getAnyState();
    if (!state) return reply.code(400).send({ error: "No active journey." });
    const result = await bookClass(state, body.slotId);
    if (!result.ok) return reply.code(400).send({ error: result.error });
    return { ok: true, state: publicState(state) };
  });

  app.post("/journey/desk/claim", async (request) => {
    const body = (request.body as Record<string, string>) || {};
    const state = getAnyState();
    if (!state?.escalation) return { ok: false };
    state.escalation.handledBy = body.agent || "Store team — West 7th";
    pushState(state);
    return { ok: true, state: publicState(state) };
  });

  /* ---------------- Reset ---------------- */

  app.post("/journey/reset", async (request) => {
    const body = (request.body as Record<string, string>) || {};
    const phones = body.phone
      ? [normalizePhone(body.phone)]
      : allStates().map((s) => s.phone);

    const deleted: string[] = [];
    for (const phone of phones) {
      const ok = await deleteMemberProfile(phone);
      if (ok) deleted.push(phone);
      deleteState(phone);
      resetConversationLog(phone);
      resetVoiceHistory(phone);
    }
    pushState(undefined);
    return { ok: true, deletedProfiles: deleted };
  });

  app.post("/journey/profile/delete", async (request, reply) => {
    const body = (request.body as Record<string, string>) || {};
    const phone = normalizePhone(body.phone || "");
    if (!phone) return reply.code(400).send({ error: "Phone number required." });
    const ok = await deleteMemberProfile(phone);
    deleteState(phone);
    resetConversationLog(phone);
    resetVoiceHistory(phone);
    pushState(undefined);
    return { ok, phone };
  });

  /* ---------------- Twilio webhooks ---------------- */

  app.post("/journey/inbound", async (request, reply) => {
    const body = (request.body as Record<string, string>) || {};
    console.log("[journey/inbound]", JSON.stringify(body));

    await handleInboundMessage({
      from: body.From || body.from || "",
      body: body.Body || body.body || "",
      buttonText: body.ButtonText,
      buttonPayload: body.ButtonPayload,
    });

    reply.type("text/xml").send("<Response></Response>");
  });

  /**
   * Real-time Conversation Intelligence results.
   *
   * Twilio posts here every time a rule fires on the live call. Always answer
   * 204 quickly — a slow or failing webhook is not allowed to affect the call.
   */
  app.post("/journey/cintel", async (request, reply) => {
    noteResultReceived();
    const payload = (request.body as RuleExecutionPayload) || {};
    const state = getAnyState();

    // Proving whether results keep arriving through the human stretch of the
    // call is the difference between a five second diagnosis and an hour of
    // guessing, so every delivery is logged.
    const operators = (payload.operatorResults ?? [])
      .map((r) => r.operator?.displayName ?? r.operator?.id ?? "?")
      .join(", ");
    console.log(
      `[journey/cintel] ${payload.operatorResults?.length ?? 0} result(s) [${operators}] conversation ${
        payload.conversationId ?? "unknown"
      }${state ? "" : " — NO LIVE RUN, ignored"}`
    );

    if (state) {
      try {
        applyRuleExecution(state, payload);
      } catch (err) {
        console.error("[journey/cintel] could not apply results", err);
      }

      // The handoff to Flex ends ConversationRelay, but the call keeps matching
      // the account's voice capture rules — so Real-Time Transcription carries
      // on writing to the same conversation. Mirroring it back keeps the screen
      // and the save-offer gate alive during the human stretch of the call.
      const conversationId = payload.conversationId;
      if (conversationId) {
        void syncConversationTranscript(state, conversationId).then((added) => {
          if (added) releasePendingNextBestAction(state);
        });
      }
    }

    reply.code(204).send();
  });

  app.post("/journey/status", async (request, reply) => {    const body = (request.body as Record<string, string>) || {};
    const sid = body.MessageSid || body.SmsSid;
    const status = body.MessageStatus;
    const from = body.From || "";
    const rawError = body.ErrorCode;
    const errorCode = rawError ? Number(rawError) : undefined;
    const state = getAnyState();

    if (state && sid) {
      const message = state.messages.find((m) => m.sid === sid);
      if (message) {
        applyDeliveryFacts(message, { from, status, errorCode });
        // What the handset actually supports is only knowable from a real send.
        if (message.channelConfirmed && state.lookup) {
          state.lookup.rcsCapable = message.channel === "rcs";
        }
        pushState(state);
      }
    }

    reply.code(204).send();
  });
}
