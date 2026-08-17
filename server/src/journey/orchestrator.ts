import { pushState } from "./bus.js";
import { addTranscript, normalizePhone, type JourneyState } from "./state.js";

/**
 * Mirror the live conversation from Conversation Orchestrator into the demo's
 * own transcript.
 *
 * This is what keeps Act 4 honest. When the call is handed to a human in Flex,
 * ConversationRelay tears down — so the agent-side transcript this app builds
 * itself simply stops. But the call is still matching the account's VOICE
 * capture rules, so Conversation Orchestrator switches to Real-Time
 * Transcription and keeps writing communications to the SAME conversation.
 *
 * Twilio's own words: "The full interaction — AI portion and human portion —
 * lives in one conversation."
 *
 * Reading those communications back gives us two things that were previously
 * impossible after the handoff:
 *   1. The screen keeps showing what she is actually saying to the human.
 *   2. The gate on the recommended save offer can be driven by her real words
 *      during the human conversation, not just the AI stretch.
 */

const BASE = "https://conversations.twilio.com/v2";

function authHeader(): string {
  const key = process.env.TWILIO_API_KEY ?? "";
  const secret = process.env.TWILIO_API_SECRET ?? "";
  return "Basic " + Buffer.from(`${key}:${secret}`).toString("base64");
}

interface RawCommunication {
  id?: string;
  occurredAt?: string;
  createdAt?: string;
  author?: { address?: string; channel?: string };
  content?: { type?: string; text?: string };
}

/** Utterances that are just noise rather than something worth showing. */
function isMeaningful(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 2) return false;
  return /[a-z0-9]/i.test(trimmed);
}

let inFlight = false;

/**
 * Pull the newest transcription communications and append anything we have not
 * already shown. Silent on failure and never awaited by the call path.
 *
 * IMPORTANT: this only ever mirrors the member's speech from AFTER the call was
 * handed to a human. During the AI stretch this app already has the
 * authoritative transcript from the ConversationRelay turns, and Conversation
 * Orchestrator's copy is not one-to-one with it — each text-to-speech reply is
 * split into three to five separate communications, and her utterances arrive
 * fragmented and punctuated differently. Mirroring that on top of the relay
 * transcript is what produced duplicated lines in the live call panel.
 */
export async function syncConversationTranscript(
  state: JourneyState,
  conversationId: string
): Promise<boolean> {
  if (!conversationId || inFlight) return false;
  if (!process.env.TWILIO_API_KEY || !process.env.TWILIO_API_SECRET) return false;

  // Nothing to mirror until the humans have taken over.
  const transferredAt = state.flex?.transferred ? state.flex.transferredAt : undefined;
  if (!transferredAt) return false;

  // A little after the redirect, so the AI's own "connecting you" line — which is
  // already in the transcript — is never picked up a second time.
  const from = Date.parse(transferredAt) + 2000;
  if (!Number.isFinite(from)) return false;

  inFlight = true;
  try {
    const res = await fetch(
      `${BASE}/Conversations/${conversationId}/Communications?PageSize=40`,
      { headers: { Authorization: authHeader() } }
    );
    if (!res.ok) return false;

    const body = (await res.json()) as { communications?: RawCommunication[] };
    const items = body.communications ?? [];
    if (!items.length) return false;

    const seen = new Set(state.seenCommunicationIds ?? []);
    const member = normalizePhone(state.phone);

    // The API returns newest first; the transcript reads oldest first.
    const ordered = items.slice().reverse();
    let added = false;

    for (const item of ordered) {
      const id = item.id;
      const text = (item.content?.text ?? "").trim();
      if (!id || seen.has(id)) continue;
      if ((item.content?.type ?? "").toUpperCase() !== "TRANSCRIPTION") continue;

      const at = Date.parse(item.occurredAt ?? item.createdAt ?? "");
      if (!Number.isFinite(at) || at < from) {
        // Older than the handoff: mark it seen so we never reconsider it.
        seen.add(id);
        continue;
      }

      // Only her side of the human conversation is captured on this leg, and it
      // is the only side that drives the retention signals.
      if (normalizePhone(item.author?.address ?? "") !== member) {
        seen.add(id);
        continue;
      }

      seen.add(id);
      if (!isMeaningful(text)) continue;

      const duplicate = state.transcript.some(
        (line) => line.role === "member" && line.text.trim() === text
      );
      if (duplicate) continue;

      addTranscript(state, "member", text);
      added = true;
    }

    state.seenCommunicationIds = Array.from(seen).slice(-200);

    if (added) pushState(state);
    return added;
  } catch (err) {
    console.error(
      "[journey/orchestrator] could not read the live conversation",
      (err as Error).message
    );
    return false;
  } finally {
    inFlight = false;
  }
}
