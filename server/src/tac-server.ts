import { TAC, TACConfig, TACServer, VoiceChannel, SMSChannel } from "twilio-agent-connect";
import { WebSocketServer } from "ws";
import twilio from "twilio";
import { generateId } from "./utils.js";
import { generateAgentResponse } from "./agent.js";
import { addCommunication, closeConversation, createChatConversation, ensureChatParticipants, findActiveConversationForUser } from "./conversations-v2.js";
import { getProfileEmail, lookupProfileByPhone } from "./memory.js";
import { setupJourneyWebSocket } from "./journey/bus.js";
import { registerJourneyRoutes } from "./journey/routes.js";
import {
  FLEX_PLUGIN_BUNDLE,
  FLEX_PLUGIN_PATH,
  FLEX_PLUGIN_UNIQUE_NAME,
  FLEX_PLUGIN_VERSION,
} from "./flex-plugin/bundle.js";
import {
  buildGreeting,
  handleJourneyCallEnded,
  handleJourneyVoiceTurn,
  journeyStateForCaller,
  recordCallSid,
} from "./journey/voice.js";
import { trackConversationStarted, trackMessageSent, trackConversationEnded } from "./segment.js";
import {
  broadcastForConversation,
  ConversationInfo,
  conversations,
  getConnectedUserEmail,
  setChatMessageHandler,
  setEndConversationHandler,
  setupWebSocket,
  TranscriptEntry,
} from "./transcript-server.js";

async function endConversation(conversationId: string) {
  const conv = conversations.get(conversationId);
  if (!conv || conv.status === "ended") return;

  conv.status = "ended";
  conv.endedAt = new Date().toISOString();
  broadcastForConversation({
    type: "conversation_ended",
    conversationId,
    endedAt: conv.endedAt,
  }, conversationId);

  // Calculate duration and tool calls for analytics
  const durationMs = new Date(conv.endedAt).getTime() - new Date(conv.startedAt).getTime();
  const durationSeconds = Math.round(durationMs / 1000);
  const toolEntries = conv.transcript.filter((t) => t.role === "tool");
  const toolCallsUsed = toolEntries.map((t) => t.toolName || "unknown");
  const channel = conv.transcript.find((t) => t.channel)?.channel || "chat";
  trackConversationEnded(conv.userEmail, channel, conversationId, durationSeconds, toolCallsUsed);

  // Close the Conversations V2 conversation if one was created
  if (conv.conversationsV2Sid) {
    await closeConversation(conv.conversationsV2Sid);
  }
}

export async function startTACServer(port: number) {
  const tac = await TAC.create({ config: TACConfig.fromEnv() });
  const voiceChannel = new VoiceChannel(tac);
  tac.registerChannel(voiceChannel);

  const smsChannel = tac.isOrchestratorEnabled() ? new SMSChannel(tac) : null;
  if (smsChannel) {
    tac.registerChannel(smsChannel);
    console.log("[tac] SMS channel registered");
  } else {
    console.warn("[tac] SMS channel NOT registered — TWILIO_CONVERSATION_CONFIGURATION_ID is not set, so the Conversation Orchestrator is disabled. SMS requires the orchestrator.");
  }

  // Capture the live call SID as soon as ConversationRelay connects, so a later
  // Flex handoff can redirect this exact call.
  voiceChannel.on("setup", (data: { callSid: string; from: string; to: string }) => {
    recordCallSid(data?.from, data?.callSid);
  });

  tac.onConversationEnded(async ({ session }: any) => {
    const callerPhone: string | undefined = session?.authorInfo?.address;
    const journey = journeyStateForCaller(callerPhone);
    if (journey && session?.channel !== "chat") {
      await handleJourneyCallEnded(journey);
    }
    await endConversation(session.conversationId);
  });

  tac.onMessageReady(async ({ conversationId, session, message, author }) => {
    console.log(`[onMessageReady] session: ${JSON.stringify(session)}`);
    console.log(`[onMessageReady] author: ${author}`);

    const sessionChannel: "voice" | "sms" | "chat" =
      session?.channel === "sms" ? "sms" : session?.channel === "chat" ? "chat" : "voice";

    // CubeSmart guided move-in journey owns every voice call from the demo tenant.
    if (sessionChannel === "voice") {
      const journey = journeyStateForCaller(session?.authorInfo?.address);
      if (journey) {
        const reply = await handleJourneyVoiceTurn(journey, message);
        // The journey owns this call from end to end. Returning null means
        // "say nothing" — it must NEVER fall through to the generic concierge
        // below, which knows nothing about the studio and starts asking the
        // caller for their email address and phone number.
        return reply ?? null;
      }
    }

    let callerEmail: string | undefined = getConnectedUserEmail();
    const callerPhone: string | undefined = session?.authorInfo?.address;

    // For SMS, look up the user's email by phone so the conversation routes
    // to the right logged-in client (and so we have an email for memory + summary)
    if (sessionChannel === "sms" && callerPhone) {
      const profileId = await lookupProfileByPhone(callerPhone);
      if (profileId) {
        const lookedUpEmail = await getProfileEmail(profileId);
        if (lookedUpEmail) {
          console.log(`[onMessageReady] SMS — resolved phone ${callerPhone} to email ${lookedUpEmail}`);
          callerEmail = lookedUpEmail;
        }
      }
    }

    console.log(`[onMessageReady] channel: ${sessionChannel}, callerEmail: ${callerEmail}, callerPhone: ${callerPhone}`);

    if (!conversations.has(conversationId)) {
      console.log(`[onMessageReady] New ${sessionChannel} conversation ${conversationId}, callerEmail: ${callerEmail}, callerPhone: ${callerPhone}`);
      const info: ConversationInfo = {
        id: conversationId,
        startedAt: new Date().toISOString(),
        status: "active",
        transcript: [],
        userEmail: callerEmail,
        userPhone: callerPhone,
      };
      conversations.set(conversationId, info);
      broadcastForConversation({ type: "conversation_started", conversation: info }, conversationId);
      trackConversationStarted(callerEmail, sessionChannel, conversationId);
    } else {
      const conv = conversations.get(conversationId)!;
      let updated = false;
      if (!conv.userEmail && callerEmail) {
        conv.userEmail = callerEmail;
        updated = true;
      }
      if (!conv.userPhone && callerPhone) {
        conv.userPhone = callerPhone;
        updated = true;
      }
      if (updated) {
        broadcastForConversation({ type: "conversation_started", conversation: conv }, conversationId);
      }
    }

    const userEntry: TranscriptEntry = {
      id: generateId(),
      conversationId,
      role: "user",
      text: message,
      timestamp: new Date().toISOString(),
      channel: sessionChannel,
    };

    const conv = conversations.get(conversationId)!;
    conv.transcript.push(userEntry);
    broadcastForConversation({ type: "transcript", entry: userEntry }, conversationId);
    trackMessageSent(conv.userEmail, sessionChannel, conversationId, "user");

    console.log({ userEmail: conv.userEmail });

    return await generateAgentResponse(conversationId);
  });

  const server = new TACServer(tac, {
    port,
    fastify: { trustProxy: true },
    voiceChannel,
    messagingChannels: smsChannel ? [smsChannel] : [],
    // TAC's own TwiML endpoint moves aside so we can own `/twiml` and resolve
    // the caller's first name before the greeting is spoken.
    webhookPaths: { twiml: "/tac-twiml" },
    conversationRelayConfig: {
      welcomeGreetingInterruptible: "none",
      interruptible: "speech",
      // Demo rooms are noisy. Without these, a cough or a nearby conversation
      // gets transcribed as if the caller had spoken.
      interruptSensitivity: "low",
      reportInputDuringAgentSpeech: false,
    },
  });

  // The studio phone number points here. We look the caller up first, then hand
  // ConversationRelay a greeting that already uses their name.
  server.fastify.post("/twiml", async (request, reply) => {
    const body = (request.body as Record<string, string>) || {};
    const from = body.From || body.from;

    const proto = (request.headers["x-forwarded-proto"] as string) || "https";
    const host =
      (request.headers["x-forwarded-host"] as string) ||
      (request.headers.host as string) ||
      process.env.TWILIO_VOICE_PUBLIC_DOMAIN ||
      "";

    const welcomeGreeting = await buildGreeting(from);

    try {
      const twiml = voiceChannel.handleIncomingCall({
        actionUrl: `${proto}://${host}/conversation-relay-callback`,
        conversationRelayConfig: {
          url: `${proto === "http" ? "ws" : "wss"}://${host}/ws`,
          welcomeGreeting,
          welcomeGreetingInterruptible: "none",
          interruptible: "speech",
          interruptSensitivity: "low",
          reportInputDuringAgentSpeech: false,
        },
      });
      reply.type("application/xml").send(twiml);
    } catch (error) {
      console.error("[tac] /twiml generation failed", error);
      const fallback = new twilio.twiml.VoiceResponse();
      fallback.say("We are unable to take your call right now. Please try again shortly.");
      reply.type("text/xml").send(fallback.toString());
    }
  });

  // Handle ending chat conversations
  setEndConversationHandler(async (conversationId: string) => {
    await endConversation(conversationId);
  });

  // Handle text chat messages from the frontend
  setChatMessageHandler(
    async (conversationId: string | null, text: string, userEmail?: string) => {
      let convId = conversationId;

      // If no conversation or conversation ended, create a new one
      if (
        !convId ||
        !conversations.has(convId) ||
        conversations.get(convId)?.status === "ended"
      ) {
        convId = generateId();
        const info: ConversationInfo = {
          id: convId,
          startedAt: new Date().toISOString(),
          status: "active",
          transcript: [],
          userEmail,
        };
        conversations.set(convId, info);
        broadcastForConversation({ type: "conversation_started", conversation: info }, convId);
        trackConversationStarted(userEmail, "chat", convId);

        // Create a Conversations V2 conversation for memory tracking
        if (userEmail) {
          const v2Result = await createChatConversation(userEmail, `Chat - ${convId}`);
          if (v2Result) {
            info.conversationsV2Sid = v2Result.conversationSid;
            info.customerParticipantId = v2Result.customerParticipantId;
            info.agentParticipantId = v2Result.agentParticipantId;
            console.log(`[chat] Linked V2 conversation ${v2Result.conversationSid} to ${convId} (customer: ${v2Result.customerParticipantId}, agent: ${v2Result.agentParticipantId})`);
          }
        }
      }

      const conv = conversations.get(convId)!;
      if (userEmail) conv.userEmail = userEmail;

      // Add user message
      const userEntry: TranscriptEntry = {
        id: generateId(),
        conversationId: convId,
        role: "user",
        text,
        timestamp: new Date().toISOString(),
        channel: "chat",
      };
      conv.transcript.push(userEntry);
      broadcastForConversation({ type: "transcript", entry: userEntry }, convId);
      trackMessageSent(conv.userEmail, "chat", convId, "user");

      // If no V2 conversation linked yet, try to find the one TAC created (e.g. for voice calls)
      if (!conv.conversationsV2Sid && userEmail) {
        console.log(`🔍 [voice→chat] No V2 conversation linked for ${convId}`);
        console.log(`🔍 [voice→chat] Looking up active V2 conversation for user: ${userEmail}`);
        const existing = await findActiveConversationForUser(userEmail, conv.userPhone);
        if (existing) {
          conv.conversationsV2Sid = existing.conversationSid;
          console.log(`✅ [voice→chat] Found & linked V2 conversation: ${existing.conversationSid}`);

          // Add CHAT channel participants so we can post messages with email/assistant addresses
          const chatParts = await ensureChatParticipants(existing.conversationSid, userEmail);
          conv.customerParticipantId = chatParts.chatCustomerParticipantId;
          conv.agentParticipantId = chatParts.chatAgentParticipantId;
          console.log(`✅ [voice→chat] CHAT customer participant: ${conv.customerParticipantId}`);
          console.log(`✅ [voice→chat] CHAT agent participant: ${conv.agentParticipantId}`);
        } else {
          console.log(`⚠️ [voice→chat] No active V2 conversation found for ${userEmail} — message won't be persisted to V2`);
        }
      }

      // Send user message to Conversations V2
      if (conv.conversationsV2Sid && userEmail) {
        await addCommunication(
          conv.conversationsV2Sid,
          userEmail,
          "assistant",
          text,
          conv.customerParticipantId,
          conv.agentParticipantId
        );
      }

      const agentResponse = await generateAgentResponse(convId);
      if (agentResponse) {
        trackMessageSent(conv.userEmail, "chat", convId, "assistant");
      }

      // Send agent response to Conversations V2
      if (agentResponse && conv.conversationsV2Sid && userEmail) {
        await addCommunication(
          conv.conversationsV2Sid,
          "assistant",
          userEmail,
          agentResponse,
          conv.agentParticipantId,
          conv.customerParticipantId
        );
      }
    }
  );

  server.fastify.get("/health", async () => ({ status: "ok", mode: "full" }));
  server.fastify.get("/conversations", async () =>
    Array.from(conversations.values())
  );

  // TwiML webhook for the browser "softphone" demo (Twilio Voice Client SDK).
  // The client dials a real number via Device.connect({ params: { To } }); Twilio
  // POSTs that here and we simply bridge the call out to the real PSTN number.
  server.fastify.post("/outbound-dial", async (request, reply) => {
    const body = (request.body as Record<string, string>) || {};
    const to = body.To || body.to;
    const callerId = process.env.TWILIO_PHONE_NUMBER;

    const twiml = new twilio.twiml.VoiceResponse();
    if (to) {
      twiml.dial({ callerId }, to);
    } else {
      twiml.say("No destination number was provided.");
    }

    reply.type("text/xml").send(twiml.toString());
  });

  // CubeSmart guided move-in journey
  registerJourneyRoutes(server.fastify);

  // Twilio Flex plugin bundle. Flex fetches this URL directly, which is why it
  // is served from here (publicly reachable) rather than from the Next.js app.
  const serveFlexPlugin = async (
    _request: unknown,
    reply: { header: (k: string, v: string) => unknown; type: (t: string) => { send: (b: string) => unknown } }
  ) => {
    reply.header("Access-Control-Allow-Origin", "*");
    reply.header("Cache-Control", "public, max-age=300");
    return reply.type("application/javascript; charset=utf-8").send(FLEX_PLUGIN_BUNDLE);
  };

  server.fastify.get(FLEX_PLUGIN_PATH, serveFlexPlugin);
  // Stable alias, handy for local testing and cache-busting checks.
  server.fastify.get("/flex-plugin/emerald-member-context.js", serveFlexPlugin);
  server.fastify.get("/flex-plugin", async () => ({
    uniqueName: FLEX_PLUGIN_UNIQUE_NAME,
    version: FLEX_PLUGIN_VERSION,
    bundlePath: FLEX_PLUGIN_PATH,
    bytes: FLEX_PLUGIN_BUNDLE.length,
  }));

  const wss = new WebSocketServer({ noServer: true });
  setupWebSocket(wss);

  const journeyWss = new WebSocketServer({ noServer: true });
  setupJourneyWebSocket(journeyWss);

  await server.start();

  // Route upgrade requests: /ws/transcripts and /ws/journey go to our own
  // WebSocket servers, everything else stays with TAC.
  const rawServer = server.fastify.server;
  const existingUpgradeListeners = rawServer.listeners("upgrade").slice();
  rawServer.removeAllListeners("upgrade");

  rawServer.on("upgrade", (request, socket, head) => {
    if (request.url?.startsWith("/ws/journey")) {
      journeyWss.handleUpgrade(request, socket, head, (ws) => {
        journeyWss.emit("connection", ws, request);
      });
    } else if (request.url?.startsWith("/ws/transcripts")) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    } else {
      for (const listener of existingUpgradeListeners) {
        (listener as (...args: unknown[]) => void).call(rawServer, request, socket, head);
      }
    }
  });
}
