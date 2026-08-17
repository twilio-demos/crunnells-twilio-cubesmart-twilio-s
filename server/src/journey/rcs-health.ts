/**
 * RCS health check.
 *
 * The demo's whole point is that these messages render as rich RCS on a real
 * handset. Twilio's Messaging Service will silently fall back to SMS the moment
 * an RCS attempt fails, which makes a misconfigured sender look like a working
 * one. This module answers, before anything is sent: is the configured RCS
 * sender real, and is it actually attached to the Messaging Service we send
 * through?
 *
 * The one thing it cannot check is whether the recipient's handset has accepted
 * the tester invite for that sender — Twilio exposes no API for the RBM tester
 * list. That failure shows up as error 63035 on the delivery receipt, which is
 * why every outbound message also records its real resolved channel.
 */

const MESSAGING_BASE = "https://messaging.twilio.com";

export interface RcsHealth {
  /** The sender id the app is configured to use, e.g. rcs:my_brand_agent. */
  senderId: string;
  /** Brand name a tenant sees in their messaging app. */
  displayName?: string;
  /** Twilio sender lifecycle status — DRAFT is fine for allowlisted testers. */
  senderStatus?: string;
  /** True when this sender is attached to the Messaging Service we send through. */
  inSenderPool: boolean;
  /** True when nothing is obviously misconfigured. */
  ok: boolean;
  /** Plain-English problem, when there is one. */
  problem?: string;
  /** What the operator should do about it. */
  hint?: string;
  checkedAt: string;
}

function authHeader(): string {
  const key = process.env.TWILIO_API_KEY ?? "";
  const secret = process.env.TWILIO_API_SECRET ?? "";
  return `Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}`;
}

async function getJson(url: string): Promise<Record<string, unknown> | undefined> {
  try {
    const res = await fetch(url, { headers: { Authorization: authHeader() } });
    if (!res.ok) return undefined;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

let cached: { value: RcsHealth; at: number } | undefined;
const TTL_MS = 60_000;

export async function checkRcsHealth(force = false): Promise<RcsHealth> {
  if (!force && cached && Date.now() - cached.at < TTL_MS) return cached.value;

  const senderId = process.env.CUBESMART_RCS_SENDER_ID ?? "";
  const serviceSid = process.env.CUBESMART_MESSAGING_SERVICE_SID ?? "";
  const base: RcsHealth = {
    senderId,
    inSenderPool: false,
    ok: false,
    checkedAt: new Date().toISOString(),
  };

  if (!senderId) {
    const value: RcsHealth = {
      ...base,
      problem: "No RCS sender is configured.",
      hint: "Set CUBESMART_RCS_SENDER_ID to an RCS sender your test handset has accepted.",
    };
    cached = { value, at: Date.now() };
    return value;
  }

  if (!serviceSid) {
    const value: RcsHealth = {
      ...base,
      problem: "No Messaging Service is configured.",
      hint: "Set CUBESMART_MESSAGING_SERVICE_SID so RCS-first sending with SMS fallback can work.",
    };
    cached = { value, at: Date.now() };
    return value;
  }

  const [sendersRes, poolRes] = await Promise.all([
    getJson(`${MESSAGING_BASE}/v2/Channels/Senders?Channel=rcs&PageSize=50`),
    getJson(`${MESSAGING_BASE}/v1/Services/${serviceSid}/ChannelSenders?PageSize=50`),
  ]);

  const senders = (sendersRes?.senders as Record<string, unknown>[] | undefined) ?? [];
  const match = senders.find((s) => s.sender_id === senderId);
  const profile = (match?.profile as Record<string, unknown> | undefined) ?? undefined;

  const pool = (poolRes?.senders as Record<string, unknown>[] | undefined) ?? [];
  const inSenderPool = pool.some((s) => s.sender === senderId);

  const health: RcsHealth = {
    ...base,
    displayName:
      (profile?.name as string | undefined) ?? (match?.friendly_name as string | undefined),
    senderStatus: match?.status as string | undefined,
    inSenderPool,
  };

  if (!match) {
    health.problem = "That RCS sender does not exist on this Twilio account.";
    health.hint = "Pick a sender from Messaging → RCS → Senders in the Twilio Console.";
  } else if (!inSenderPool) {
    health.problem = "The RCS sender is not attached to the CubeSmart Messaging Service.";
    health.hint =
      "Every send would go out over SMS. Add the sender to the Messaging Service sender pool.";
  } else {
    health.ok = true;
  }

  cached = { value: health, at: Date.now() };
  return health;
}

export function invalidateRcsHealth() {
  cached = undefined;
}
