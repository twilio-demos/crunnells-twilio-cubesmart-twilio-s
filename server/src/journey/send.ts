import twilio from "twilio";
import { pushState } from "./bus.js";
import { addMessage, type JourneyMessage, type JourneyState } from "./state.js";

let client: ReturnType<typeof twilio> | null = null;

function twilioClient() {
  if (!client) {
    client = twilio(process.env.TWILIO_API_KEY, process.env.TWILIO_API_SECRET, {
      accountSid: process.env.TWILIO_ACCOUNT_SID,
    });
  }
  return client;
}

function messagingServiceSid(): string | undefined {
  return process.env.CUBESMART_MESSAGING_SERVICE_SID;
}

function statusCallbackUrl(): string | undefined {
  const domain = process.env.TWILIO_VOICE_PUBLIC_DOMAIN;
  if (!domain) return undefined;
  const base = domain.startsWith("http") ? domain : `https://${domain}`;
  return `${base}/journey/status`;
}

/** Turn a Twilio error code on an RCS attempt into something a human can act on. */
export function fallbackReasonFor(errorCode?: number): string | undefined {
  switch (errorCode) {
    case 63035:
      return "The handset has not accepted the tester invite for this RCS sender.";
    case 63036:
      return "The handset could not be reached over RCS — offline, or RCS is switched off.";
    case 63106:
      return "That number is not RCS capable, so it was delivered as SMS.";
    case 63034:
      return "A card image was too large for RCS.";
    default:
      return errorCode ? `RCS attempt failed with Twilio error ${errorCode}.` : undefined;
  }
}

/**
 * Record the channel that actually carried a message.
 * `from` is `rcs:<sender>` for real RCS and `+1...` for an SMS fallback.
 */
export function applyDeliveryFacts(
  message: JourneyMessage,
  facts: { from?: string | null; status?: string; errorCode?: number | null }
) {
  const { from, status, errorCode } = facts;

  if (typeof from === "string" && from.startsWith("rcs:")) {
    message.channel = "rcs";
    message.channelConfirmed = true;
    message.fellBackToSms = false;
    message.fallbackReason = undefined;
  } else if (typeof from === "string" && from.startsWith("+")) {
    message.channel = "sms";
    message.channelConfirmed = true;
    message.fellBackToSms = true;
    message.fallbackReason =
      message.fallbackReason ??
      fallbackReasonFor(errorCode ?? undefined) ??
      "RCS was not used for this message — it went out over SMS.";
  }

  if (status) message.deliveryStatus = status;
  if (typeof errorCode === "number") {
    message.errorCode = errorCode;
    message.fallbackReason = message.fallbackReason ?? fallbackReasonFor(errorCode);
  }
}

/**
 * Delivery receipts are the fast path, but if the webhook can't reach us we'd
 * never learn the real channel — so poll the message once, briefly, as a backstop.
 */
function pollForChannel(state: JourneyState, message: JourneyMessage) {
  const sid = message.sid;
  if (!sid) return;

  const attempt = async (delayMs: number) => {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    if (message.channelConfirmed) return true;
    try {
      const fetched = await twilioClient().messages(sid).fetch();
      applyDeliveryFacts(message, {
        from: fetched.from,
        status: fetched.status,
        errorCode: fetched.errorCode,
      });
      if (message.channelConfirmed) {
        pushState(state);
        return true;
      }
    } catch {
      /* best effort only */
    }
    return false;
  };

  void (async () => {
    for (const delay of [4000, 6000, 10000]) {
      if (await attempt(delay)) return;
    }
    pushState(state);
  })();
}

interface SendOptions {
  /** How the message should be drawn in the mirrored thread. */
  mirror: Omit<JourneyMessage, "id" | "timestamp" | "direction" | "channel" | "sid">;
}

async function dispatch(
  state: JourneyState,
  payload: Record<string, unknown>,
  options: SendOptions
): Promise<JourneyMessage> {
  const entry = addMessage(state, {
    direction: "outbound",
    // Optimistic — corrected the moment Twilio tells us what really happened.
    channel: "rcs",
    channelConfirmed: false,
    deliveryStatus: "queued",
    ...options.mirror,
  });

  const serviceSid = messagingServiceSid();
  if (!serviceSid) {
    entry.kind = "system";
    entry.body = "Nothing was sent — no Messaging Service is configured for this demo.";
    entry.deliveryStatus = "failed";
    console.warn("[journey/send] CUBESMART_MESSAGING_SERVICE_SID is not set — nothing sent");
    pushState(state);
    return entry;
  }

  try {
    const callback = statusCallbackUrl();
    const message = await twilioClient().messages.create({
      messagingServiceSid: serviceSid,
      to: state.phone,
      ...(callback ? { statusCallback: callback } : {}),
      ...payload,
    } as Parameters<ReturnType<typeof twilio>["messages"]["create"]>[0]);

    entry.sid = message.sid;
    applyDeliveryFacts(entry, {
      from: message.from,
      status: message.status,
      errorCode: message.errorCode,
    });
    pollForChannel(state, entry);
  } catch (err) {
    console.error("[journey/send] send failed", err);
    entry.kind = "system";
    entry.deliveryStatus = "failed";
    entry.body = `Send failed: ${(err as Error).message}`;
  }

  pushState(state);
  return entry;
}

export async function sendText(state: JourneyState, body: string) {
  return dispatch(state, { body }, { mirror: { kind: "text", body } });
}

export async function sendTemplate(
  state: JourneyState,
  contentSid: string,
  variables: Record<string, string>,
  mirror: SendOptions["mirror"]
) {
  return dispatch(
    state,
    { contentSid, contentVariables: JSON.stringify(variables) },
    { mirror }
  );
}

export function logInbound(
  state: JourneyState,
  body: string,
  buttonText?: string,
  from?: string
): JourneyMessage {
  const entry = addMessage(state, {
    direction: "inbound",
    // Inbound tells us the truth directly: an rcs: address means she replied over RCS.
    channel: from?.startsWith("rcs:") ? "rcs" : from ? "sms" : "rcs",
    channelConfirmed: Boolean(from),
    kind: "text",
    body: buttonText ? buttonText : body,
  });
  pushState(state);
  return entry;
}
