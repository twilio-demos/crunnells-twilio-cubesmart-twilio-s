import { openai } from "@ai-sdk/openai";
import { generateText, stepCountIs, tool } from "ai";
import twilio from "twilio";
import { z } from "zod/v4";
import { pushState } from "./bus.js";
import {
  escalateToDesk,
  flagExpiredPayment,
  pauseMembership,
  sendHoldConfirmation,
} from "./engine.js";
import { BRAND, HOLD_OPTIONS, addDaysISO, longDate, studioToday } from "./script.js";
import { releasePendingNextBestAction, resetIntel } from "./intel.js";
import { fetchProfileSnapshot, lookupProfileIdByPhone } from "./memory-profile.js";
import {
  activeClasses,
  addTranscript,
  completeBeat,
  getAnyState,
  getState,
  normalizePhone,
  type JourneyState,
} from "./state.js";

export function journeyStateForCaller(phone?: string): JourneyState | undefined {
  if (!phone) return getAnyState();
  return getState(normalizePhone(phone)) ?? getAnyState();
}

/**
 * The very first thing the caller hears.
 *
 * The tenant is resolved BEFORE the greeting is spoken — from the live demo run
 * if there is one, otherwise from their Twilio Memory profile by phone number —
 * so the agent opens with their first name instead of a generic script.
 */
export async function buildGreeting(phone?: string): Promise<string> {
  const fallback =
    process.env.CUBESMART_VOICE_GREETING ??
    `Thank you for calling CubeSmart on ${BRAND.studio}. How can I help you today?`;

  const state = phone ? getState(normalizePhone(phone)) : getAnyState();
  let firstName = state?.firstName?.trim();

  if (!firstName && phone) {
    firstName = (await lookupFirstNameByPhone(normalizePhone(phone))) ?? undefined;
  }

  if (!firstName) return fallback;

  const greeting =
    state?.membership.status === "on-hold"
      ? `Hi ${firstName}, thanks for calling CubeSmart on ${BRAND.studio} — good to hear from you. What can I do for you?`
      : `Hi ${firstName}, thanks for calling CubeSmart on ${BRAND.studio}. How can I help you tonight?`;

  if (state) state.greeting = greeting;
  return greeting;
}

/** Look the caller's first name up in Twilio Memory when there is no live run. */
async function lookupFirstNameByPhone(phone: string): Promise<string | undefined> {
  try {
    const profileId = await lookupProfileIdByPhone(phone);
    if (!profileId) return undefined;
    const snapshot = await fetchProfileSnapshot(profileId);
    const trait = snapshot.traits.find(
      (t) => t.group.toLowerCase() === "contact" && t.name === "firstName"
    );
    const value = typeof trait?.value === "string" ? trait.value.trim() : "";
    return value || undefined;
  } catch {
    return undefined;
  }
}

function profileBrief(state: JourneyState): string {
  const classes = state.classes
    .map(
      (c) =>
        `${c.className} with ${c.instructor} on ${c.dayName} ${c.shortDate} at ${c.timeLabel} (${c.status})`
    )
    .join("; ");

  const lines = [
    `Tenant: ${state.firstName} ${state.lastName}`,
    `Home store: CubeSmart ${BRAND.studio}, ${BRAND.city}`,
    `Unit: ${state.membership.tier}, account currently ${
      state.membership.status === "on-hold" ? "on extended gate access" : "on standard access"
    }`,
    state.membership.holdStart && state.membership.holdEnd
      ? `Extended gate access on file: ${longDate(state.membership.holdStart)} through ${longDate(
          state.membership.holdEnd
        )}`
      : "",
    `Payment method: Visa ending ${state.membership.cardLast4}, expiry ${state.membership.cardExpiry}, status ${state.membership.paymentStatus}`,
    classes ? `Reservation history: ${classes}` : "Reservation history: none yet",
    state.fuelOrder ? `Usual supply order: ${state.fuelOrder.name}` : "",
    state.instructorRating
      ? `Last staff rating she gave: ${state.instructorRating} out of 5`
      : "",
  ].filter(Boolean);

  return lines.join("\n");
}

const VOICE_STYLE = `You are the voice of CubeSmart ${BRAND.studio} in ${BRAND.city}, answering the store's main line. Speak like a warm, efficient leasing and store team lead. Plain spoken sentences only — no markdown, no asterisks, no bullet points, no lists, no emoji, no special characters, and never spell out punctuation. Keep every turn to one or two sentences. Never say you are an AI, an assistant, a bot, or mention tools, systems or profiles.`;

/** The style block plus a reminder of the exact greeting the caller already heard. */
function styleFor(state: JourneyState): string {
  const greeting = state.greeting;
  return `${VOICE_STYLE}

IMPORTANT: the caller has ALREADY been greeted by name before your first turn. ${
    greeting ? `They heard exactly this: "${greeting}"` : "They have already been welcomed by name."
  } Never greet them again, never re-introduce the store, never say their name as an opening, and never ask how you can help. Go straight to answering what they just said.${alreadySaid(state)}`;
}

/**
 * Everything the agent has already said out loud on this call.
 *
 * Without this the model will happily open with the same line every turn — the
 * classic symptom being it repeating "I can see your gate access is extended
 * and set to end on…" over and over while the conversation goes nowhere.
 */
function alreadySaid(state: JourneyState): string {
  const lines = state.transcript
    .filter((line) => line.role === "agent")
    .slice(-6)
    .map((line) => `- "${line.text}"`);

  if (!lines.length) return "";

  return `

YOU HAVE ALREADY SAID THE FOLLOWING ON THIS CALL. Do not say any of it again, and do not say anything that means the same thing. Move the conversation FORWARD to the next step instead:
${lines.join("\n")}`;
}

function holdPrompt(state: JourneyState): string {
  const today = studioToday();
  const options = HOLD_OPTIONS.map((days) => {
    const label = days === 1 ? "tonight only" : days === 7 ? "this week" : `a standing ${days} days`;
    return `${label}, which would take her through ${longDate(addDaysISO(today, days))}`;
  }).join("; ");

  return `${styleFor(state)}

It is after 8pm. The store office is closed, so you are the only one answering. ${state.firstName} is calling.

Here is what you already know about her. Use it, do not ask her to repeat it:
${profileBrief(state)}

Today's date is ${today}.

YOUR ONE JOB ON THIS CALL: she is locked out after hours and needs her gate access reset. Nothing else. But she has to ASK for it first — you do not know why she is calling until she tells you.

Run it in this exact order:
1. Your very first turn must mention, in the same breath, that the office is closed for the night but you can help her from here. What comes after that depends entirely on what she just said:
   - If she has ALREADY said she is locked out, can't get in, needs her gate code, or something that means the same thing, then handle it right there in that same first turn. Never make her repeat a request she already made. Say it as one flowing reply: the office is closed for the night, but you can take care of that from here, and you can grant extended access for tonight only, this week, or a standing thirty days — which works best? Two short sentences maximum.
   - If she has NOT actually asked for anything yet, then your first turn is ONLY the neutral line that the office is closed but you can help her from here. Nothing else. Do NOT name a reason for her call, do NOT mention gate codes, lockouts, access, or billing, and do NOT guess what she wants. Then stop and wait.
2. If she has not said what she needs yet, let her tell you in her own words. If what you heard was unclear, cut off, or does not contain an actual request, say one short line asking her to say that again — never fill in the blank for her.
3. Once she has clearly said she is locked out or needs her gate access reset, acknowledge it in one short sentence and offer her the three windows the store supports — tonight only, this week, or a standing thirty days — then ask which she wants. Say it like "Of course, I can take care of that — I can extend your access for tonight only, this week, or a standing thirty days. Which works best?" If you already did this in step 1, do not repeat it.
4. Once she picks a window, confirm it back out loud with the actual end date and ask her to confirm that is right. For reference, starting today: ${options}.
5. Only after she says yes, call reset_gate_access with the number of days she chose.
6. After the tool succeeds, confirm it in one or two sentences: that her gate access is reset, how long the window runs for, the end date, that her new code is being sent to her phone now, and that standard rent still applies.
7. Then ask, in one short line, if there is anything else you can help her with.
8. If she says no, nope, that's it, that's all, I'm good, nothing else, or anything that means the same: say ONE short warm goodbye and call end_call in that same turn. Do not ask her anything else. Do not wait for her to speak again.

Hard rules:
- NEVER be the first one to bring up a lockout, a gate code, access, billing or her card. She raises it, not you. If she has not asked for anything yet, your only job is to listen.
- But the moment she HAS asked, answer it immediately in that same turn. Never acknowledge her request in one turn and then offer the windows in a later turn, and never ask her to repeat something she already told you clearly.
- The "office is closed" line is a courtesy, not a stalling tactic. It never replaces answering her — if she has told you what she needs, both belong in the same reply.
- If you are not certain she asked for access help, you have not heard her ask. Ask her to repeat herself instead of assuming.
- Only tonight-only, this-week, or a standing thirty-day window are available. If she asks for a different length, say those are the three options and steer her to the closest one.
- Never reset access, change or extend a window without reading the dates back and getting a yes first.
- Never ask "is there anything else" twice. Once she has said no, say goodbye and end the call.
- Do not offer to cancel her lease. If she raises leaving outright, listen and say the West 7th team will follow up.
- Do not offer her a discount, a fee waiver, a free unit upgrade or a refund. You are not authorised to.
- Do not discuss pricing changes, refunds or anything you have no tool for. Say the West 7th team will follow up.`;
}

/**
 * Ways the tenant asks about her account being back to normal — in her own
 * words.
 *
 * When any of these show up we stop trusting the model to sequence the call and
 * hand it an explicit instruction for that single turn instead. Left to its own
 * devices it invents detours, the worst being offering to "take a message for
 * the store team" rather than surfacing the expired card and asking to bring in
 * a human.
 */
const REACTIVATION_REQUEST =
  /\b(come (?:back|off)|off (?:of )?(?:the |account )?(?:extended )?access|take (?:it|me|my account) off (?:extended )?access|lift (?:the )?(?:extended )?access|end (?:the )?(?:extended )?access|back to normal|reactivate|re-?activate|restart|resume|un-?pause|un-?freeze|start (?:it|things|my account|back)|get (?:back |going )?(?:started|back)|back (?:in|at it)|check (?:on|in) (?:my|the) account|ready to (?:come|start|get) back|everything (?:okay|alright|fine) (?:with|on) my account)\b/i;

/**
 * The one thing the agent must do on THIS turn.
 *
 * Everything in STAGE 2 has to land in a single spoken reply. Splitting it
 * across turns leaves dead air on the line and blocks the handoff.
 */
function reactivationDirective(state: JourneyState, message: string): string {
  if (!REACTIVATION_REQUEST.test(message || "")) return "";

  const cardChecked = state.paymentCheckedOnCall === state.callCount;

  if (cardChecked) {
    return `

THIS TURN: she has raised checking on her account again and you have already checked the card on this call. Do NOT check it again. If you have not yet asked permission to bring in the West 7th team, ask that now in one short line. If she has already agreed, call transfer_to_store_team right now and say nothing else.`;
  }

  return `

THIS TURN — DO ALL OF THIS NOW, IN THIS ONE SINGLE REPLY. Nothing else:
  1. Call the check_payment_method tool immediately.
  2. Then say one short warm line that you're glad she called and everything looks fine on the access side.
  3. Then say plainly that the card on file has expired, so this month's rent charge did not go through.
  4. Then say you are not able to take card details on this line, and ask if it is alright to bring in someone at the West 7th store who can sort it out on the spot.
Ask her NO other question. Do NOT offer to take a message, leave a note, pass anything along, add anything to her file, or have anyone call her back. Do NOT ask her what she would like the store team to know. The store team joins this call live — there is no message to take.`;
}

function callbackPrompt(state: JourneyState, message: string): string {
  const today = studioToday();
  const holdEnd = state.membership.holdEnd ? longDate(state.membership.holdEnd) : null;
  const cardChecked = state.paymentCheckedOnCall === state.callCount;

  return `${styleFor(state)}

${state.firstName} is calling the store back. She had extended gate access granted after being locked out.

Here is what you already know about her. Use it, do not ask her to repeat it:
${profileBrief(state)}

Today's date is ${today}.

YOUR ONE JOB ON THIS CALL is to check in on her account, discover the card on file has expired, and hand her to a human at the store who can take a new one. Work through these stages. Each stage happens ONCE and then you never return to it.

STAGE 1 — orient her. ONLY on your very first turn, tell her you can see her gate access is still extended${
    holdEnd ? ` and give the end date out loud: ${holdEnd}` : ""
  }. Say it once. ${
    holdEnd
      ? `You must NEVER state the access end date more than once on this call. If you have already said "${holdEnd}" you are past this stage forever.`
      : ""
  }

STAGE 2 — the account check. The moment she asks whether her account is back to normal, wants to reactivate anything, or is just checking in, do ALL of this in ONE single turn, in this order, without waiting for her to speak again:
  a. React warmly in one short sentence — glad she called, happy to check.
  b. Call the check_payment_method tool. Do this in the same turn. Do NOT end your turn after the warm sentence.
  c. Then tell her plainly, in one or two sentences, that everything looks fine on the access side, but the card on file has expired so this month's rent charge did not go through.
  d. Then say you are not able to take card details on this line, and ask if it is alright to bring in someone at the West 7th store who can sort it out on the spot.
${
  cardChecked
    ? "  You have ALREADY checked the payment method on this call. Do not call check_payment_method again. If you have not yet told her about the expired card, tell her now and ask permission to bring in the store team."
    : ""
}

STAGE 3 — the handoff. As soon as she agrees, says yes, sure, okay, that's fine, or anything that means the same, call transfer_to_store_team immediately. Then say nothing at all — the transfer message plays for her automatically.

Hard rules:
- There is NO message to take and NO callback to arrange. The West 7th store team joins THIS call, live, while she stays on the line. Never offer to take a message, leave a note, pass something along, add a note to her account, log a request, have someone call or text her back, or ask her what she would like the store team to know. If you catch yourself asking her to word anything, stop — ask permission to bring in the store team instead.
- Never ask her to help you summarise, describe or explain her own situation to anyone. You already know everything you need from what is above and from this call.
- NEVER repeat a sentence, or the meaning of a sentence, you have already said on this call. If you catch yourself about to restate the access window or its end date, move to the next stage instead.
- If she says something you do not understand, or says nothing useful, do NOT restate the access window. Ask her in one short line what she would like help with today.
- Never ask her for a card number, CVV, expiry or billing address. Never repeat card digits back beyond the last four.
- Never tell her to call back later or during business hours.
- Do not attempt to re-run the payment yourself.
- Do not say the words hold up, unfortunately or bad news. Lead with the good news, then the blocker.
- If she says she found a cheaper unit down the street, is not sure it is worth the money, or is thinking about moving out: acknowledge it warmly and specifically in one sentence, in her own words, and say the West 7th team will make it right. Then carry straight on with the stage you were on — do not lose your place. You must NOT offer her a discount, a fee waiver, a unit downsize or any kind of goodwill gesture — you are not authorised to, and the person at the store is. Never mention that anything is being recommended to anyone.
- Never make promises about pricing you have no tool for.${reactivationDirective(state, message)}`;
}

/**
 * Did the tenant actually ask for gate access help, in her own words?
 *
 * A noisy room can put stray words in front of the agent, and a helpful model
 * will happily run with them. Access is only ever reset if a real request is
 * present in what she said on this call.
 */
const ACCESS_REQUEST =
  /\b(locked out|lock ?out|can'?t get in|can'?t (?:open|access) the gate|gate (?:code|access)|access code|forgot my code|need (?:my )?(?:gate )?code|reset (?:my )?(?:gate )?code|stuck at the gate|need access|let me in|get in tonight|not letting me in)\b/i;

function memberAskedForHold(state: JourneyState): boolean {
  return state.transcript.some(
    (line) => line.role === "member" && ACCESS_REQUEST.test(line.text)
  );
}

/** Utterances that are just room noise rather than a person talking to us. */
const NOISE_ONLY = /^[\s.,!?—–-]*$/;
const FILLER_ONLY = /^(?:uh|um|umm|erm|hmm+|mm+|mhm+|ah|oh|eh|huh|hm)[\s.,!?]*$/i;

function isNoise(message: string): boolean {
  const trimmed = (message || "").trim();
  if (!trimmed) return true;
  if (NOISE_ONLY.test(trimmed)) return true;
  return FILLER_ONLY.test(trimmed);
}

/* ------------------------------------------------------------------ *
 * Ending the call properly
 * ------------------------------------------------------------------ */

let restClient: ReturnType<typeof twilio> | null = null;
function twilioClient() {
  if (!restClient) {
    restClient = twilio(process.env.TWILIO_API_KEY, process.env.TWILIO_API_SECRET, {
      accountSid: process.env.TWILIO_ACCOUNT_SID,
    });
  }
  return restClient;
}

/**
 * Hang up shortly after the goodbye.
 *
 * The farewell is spoken by ConversationRelay's text-to-speech after this turn
 * returns, so the call cannot be cut immediately or she would hear nothing. A
 * short delay lets the line play out and then closes the call properly instead
 * of leaving her holding a silent phone.
 */
function hangUpAfterGoodbye(state: JourneyState, delayMs = 6500) {
  const callSid = state.callSid;
  if (!callSid || state.hangingUp) return;
  state.hangingUp = true;

  setTimeout(() => {
    void (async () => {
      try {
        await twilioClient().calls(callSid).update({ status: "completed" });
      } catch (err) {
        console.error("[journey/voice] could not end the call", (err as Error).message);
      }
    })();
  }, delayMs);
}

function buildVoiceTools(state: JourneyState, turn: { paymentChecked: boolean }) {
  return {
    reset_gate_access: tool({
      description:
        "Grant extended gate access for 1 (tonight only), 7 (this week) or 30 (standing) days. Only call this after the tenant has asked for access help in her own words, you have offered the three windows, and she has confirmed the dates you read back.",
      inputSchema: z.object({
        days: z
          .union([z.literal(1), z.literal(7), z.literal(30)])
          .describe("Length of the extended access window in days. Must be one of 1, 7 or 30."),
        member_asked_in_their_words: z
          .string()
          .describe(
            "Quote what the tenant actually said that asked for access help. Leave empty if she never asked."
          ),
        confirmed_out_loud: z
          .boolean()
          .describe("True only if you already read the dates back and she said yes."),
      }),
      execute: async ({
        days,
        member_asked_in_their_words,
        confirmed_out_loud,
      }: {
        days: number;
        member_asked_in_their_words: string;
        confirmed_out_loud: boolean;
      }) => {
        if (!memberAskedForHold(state) || !(member_asked_in_their_words || "").trim()) {
          return "She has not actually asked for access help on this call yet. Do not reset anything and do not bring it up. Ask her what she is calling about, or ask her to say that again if you did not catch it.";
        }
        if (!HOLD_OPTIONS.includes(days as (typeof HOLD_OPTIONS)[number])) {
          return "Only 1, 7 or 30 day windows are available. Offer those three and ask her to pick one.";
        }
        if (!confirmed_out_loud) {
          return "Do not reset access yet. Read the start and end dates back to her and get a yes first.";
        }
        const result = await pauseMembership(state, studioToday(), days);
        addTranscript(
          state,
          "tool",
          `Extended gate access granted — ${result.days} days, ${longDate(result.startISO)} to ${longDate(
            result.endISO
          )}`
        );
        pushState(state);
        return `Access reset for ${result.days} days, from ${longDate(
          result.startISO
        )} through ${longDate(
          result.endISO
        )}. Confirm that back to her with the end date and the window length, say her new code is coming to her phone now and standard rent still applies, and then ask if there is anything else you can help with.`;
      },
    }),
    check_payment_method: tool({
      description:
        "Check the payment method on file when a tenant checks in on her account. Always call this after you have reacted warmly and before promising anything is fine.",
      inputSchema: z.object({}),
      execute: async () => {
        await flagExpiredPayment(state);
        state.paymentCheckedOnCall = state.callCount;
        turn.paymentChecked = true;
        pushState(state);
        return `The Visa ending ${state.membership.cardLast4} expired ${state.membership.cardExpiry}. This month's rent charge of ${state.membership.failedChargeAmount} was declined. Tell her now, in this same turn, that everything looks fine on the access side but the card on file has expired so the charge did not go through. Then say you cannot take card details on this line and ask if you can bring in the West 7th team. Do not end your turn without saying both of those things. Do not offer to take a message, note or callback instead — the store team joins this call live.`;
      },
    }),
    transfer_to_store_team: tool({
      description:
        "Hand the live call to a human at the West 7th store in Twilio Flex, passing the full context of what has happened so far. Only call this after you have told her about the expired card and she has agreed to be transferred. You write the reason and summary yourself from this call — never ask the tenant for them, and never read them out loud.",
      inputSchema: z.object({
        reason: z
          .string()
          .optional()
          .describe(
            "One short line on why you are transferring. Written by you, never asked of the tenant."
          ),
        summary: z
          .string()
          .optional()
          .describe(
            "Two or three sentences a store team member can read in five seconds: who she is, what she wants, and what is blocking it. Written by you from this call, never asked of the tenant."
          ),
      }),
      execute: async ({ reason, summary }: { reason?: string; summary?: string }) => {
        state.transferring = true;
        const fallbackReason = "Expired card on file — needs a new one taken to keep the lease active.";
        const fallbackSummary = `${state.firstName} ${state.lastName} is a tenant in a ${state.membership.tier} checking in on her account. The Visa ending ${state.membership.cardLast4} expired ${state.membership.cardExpiry}, so the ${state.membership.failedChargeAmount} rent charge was declined. She needs a new card taken so her lease stays active.`;
        const result = await escalateToDesk(
          state,
          (reason || "").trim() || fallbackReason,
          (summary || "").trim() || fallbackSummary
        );
        if (!result.ok) {
          state.transferring = false;
          return `The transfer did not go through: ${result.error}. Tell her the store will call her straight back on this number, and apologise once.`;
        }
        return "Transfer complete. Say nothing further — she is already being connected.";
      },
    }),
    end_call: tool({
      description:
        "End the call politely. Call this once the tenant has confirmed there is nothing else you can help with. Say your one-line goodbye in the same turn — it will be spoken to her before the line closes.",
      inputSchema: z.object({
        she_said_nothing_else: z
          .string()
          .describe(
            "Quote what she said that means she is done, for example 'no that's it' or 'nope, I'm good'."
          ),
      }),
      execute: async ({ she_said_nothing_else }: { she_said_nothing_else: string }) => {
        if (!(she_said_nothing_else || "").trim()) {
          return "Do not end the call yet. Ask her if there is anything else you can help with first.";
        }
        hangUpAfterGoodbye(state);
        addTranscript(state, "tool", "Call ending — nothing further needed.");
        pushState(state);
        return "The line will close right after you speak. Say ONE short warm goodbye now and nothing else — no questions, no offers.";
      },
    }),
  };
}

const callHistory = new Map<string, { role: "user" | "assistant"; content: string }[]>();

export function resetVoiceHistory(phone: string) {
  callHistory.delete(normalizePhone(phone));
}

/**
 * Remember which call we are on. Captured from the ConversationRelay setup frame
 * so the Flex handoff can redirect the exact live call later.
 */
export function recordCallSid(phone: string | undefined, callSid: string) {
  const state = journeyStateForCaller(phone);
  if (!state) return;
  beginCall(state, callSid);
  pushState(state);
}

/**
 * Start a call from a clean slate.
 *
 * Keyed on the call's own SID, which arrives on the relay setup frame at the
 * start of EVERY call. The previous version reset on `callStatus !== "in-call"`,
 * which quietly failed whenever the last call ended by transferring into Flex or
 * dropped without a teardown event — leaving `transferring` or `hangingUp` set,
 * so every later call was answered with silence.
 *
 * Only per-call things are cleared. Her lease, reservations, profile, events,
 * story progress and the Flex handoff record all survive, because the demo's
 * later beats read them.
 */
function beginCall(state: JourneyState, callSid: string) {
  if (state.activeCallSid === callSid) {
    // Same call, a later frame. Just make sure the SID is on record.
    state.callSid = callSid;
    return;
  }

  state.activeCallSid = callSid;
  state.callSid = callSid;
  state.callStatus = "ringing";
  state.callCount += 1;
  state.transcript = [];
  state.transferring = false;
  state.hangingUp = false;
  state.paymentCheckedOnCall = undefined;
  resetIntel(state);
  callHistory.delete(state.phone);

  console.log(
    `[journey/voice] call ${state.callCount} started (${callSid}) — beat ${state.beatId}, account ${state.membership.status}`
  );
}

/**
 * The expired-card line, written out longhand.
 *
 * The model is asked to check the card and break the news in a single reply.
 * Occasionally it spends its whole turn on the tool call and comes back with no
 * words at all, which used to leave the caller listening to silence at the most
 * important moment of the demo. This is the exact line she should hear, so the
 * turn can never be empty.
 */
function expiredCardLine(state: JourneyState): string {
  const card = state.membership;
  return `Glad you called, ${state.firstName} — everything looks fine on the access side. Though the Visa ending ${card.cardLast4} on file expired ${card.cardExpiry}, so this month's rent charge didn't go through. I'm not able to take card details on this line — is it alright if I bring in someone at the West 7th store to sort it out on the spot?`;
}

/** Called by TAC for every tenant utterance on a journey call. */
export async function handleJourneyVoiceTurn(
  state: JourneyState,
  message: string
): Promise<string | undefined> {
  // Room noise transcribed as a word or two is not the tenant talking. Stay
  // quiet rather than answering something she never said.
  if (isNoise(message)) return undefined;

  // A brand new call, recognised by its own SID. This MUST run before the quiet
  // guards below — otherwise a leftover flag from the last call silences this
  // one too, which is exactly how a whole call ended up with no agent at all.
  if (!state.activeCallSid || state.activeCallSid !== state.callSid) {
    beginCall(state, state.callSid ?? `local-${Date.now()}`);
  }

  // A goodbye has already been spoken on THIS call and the line is closing.
  // Anything picked up in that last second or two is not a new request.
  if (state.hangingUp) {
    console.log("[journey/voice] staying quiet — goodbye already spoken");
    return undefined;
  }

  // First utterance of a call moves the story forward.
  if (state.callStatus !== "in-call") {
    state.callStatus = "in-call";
    if (state.beatId === "after-hours") completeBeat(state, "after-hours");
    if (state.beatId === "voice-hold" && state.membership.status === "on-hold") {
      completeBeat(state, "voice-hold");
    }
    pushState(state);
  }

  addTranscript(state, "member", message);
  // A save offer is held back until she raises leaving — check that the moment
  // she speaks, so the agent's screen moves with the conversation.
  releasePendingNextBestAction(state);
  pushState(state);

  const onCallback =
    state.beatId === "voice-callback" ||
    state.beatId === "flex" ||
    state.membership.status === "on-hold";

  const system = onCallback ? callbackPrompt(state, message) : holdPrompt(state);

  console.log(
    `[journey/voice] turn on call ${state.callCount} (${onCallback ? "callback" : "gate access"}) — "${message}"`
  );

  const history = callHistory.get(state.phone) ?? [];
  history.push({ role: "user", content: message });

  const turn = { paymentChecked: false };

  try {
    const result = await generateText({
      model: openai.chat("gpt-4.1-mini"),
      system,
      messages: history,
      tools: buildVoiceTools(state, turn),
      stopWhen: stepCountIs(6),
    });

    let reply = (result.text || "").trim();

    // The card check ran but the model came back speechless. Say the line
    // ourselves rather than leaving her on a silent line.
    if (!reply && turn.paymentChecked && !state.transferring && !state.hangingUp) {
      reply = expiredCardLine(state);
    }

    // Last resort. She said something real, the agent is not deliberately quiet,
    // and yet there are no words — usually the model spent its whole turn on a
    // tool. Dead air on a live demo is the worst possible outcome, so ask her to
    // say it again instead.
    if (!reply && !state.transferring && !state.hangingUp) {
      console.warn(
        `[journey/voice] no words produced for "${message}" — falling back to a recovery line`
      );
      reply = "Sorry, could you say that once more for me?";
    }

    if (reply) {
      history.push({ role: "assistant", content: reply });
      addTranscript(state, "agent", reply);
    }
    callHistory.set(state.phone, history.slice(-16));
    pushState(state);

    // Once the call has been redirected into Flex the relay session is gone —
    // Twilio is already speaking the connect line, so stay quiet.
    if (state.transferring) {
      console.log("[journey/voice] staying quiet — call handed to Flex");
      return undefined;
    }

    console.log(
      `[journey/voice] ${onCallback ? "callback" : "gate access"} turn replied (${reply.length} chars)`
    );
    return reply || undefined;
  } catch (err) {
    console.error("[journey/voice] agent failed", err);
    const fallback =
      "Sorry, I lost you there for a second. Could you say that once more?";
    addTranscript(state, "agent", fallback);
    pushState(state);
    return fallback;
  }
}

export async function handleJourneyCallEnded(state: JourneyState) {
  // A Flex transfer also ends the ConversationRelay session, but she is still on
  // the phone — the call has simply moved to a human. Do not mark it ended.
  if (state.transferring) {
    pushState(state);
    return;
  }

  state.callStatus = "ended";
  pushState(state);

  // Act 3 step 10: the RCS confirmation lands as she hangs up.
  if (
    state.membership.status === "on-hold" &&
    !state.messages.some((m) => m.body?.includes("gate access at"))
  ) {
    await sendHoldConfirmation(state);
  }

  if (state.beatId === "voice-hold" && state.membership.status === "on-hold") {
    completeBeat(state, "voice-hold");
    pushState(state);
  }
}

export function upcomingClassSummary(state: JourneyState): string {
  const list = activeClasses(state);
  if (!list.length) return "No upcoming move-in appointments";
  return list
    .map((c) => `${c.className} · ${c.dayName} ${c.shortDate} · ${c.timeLabel}`)
    .join(" | ");
}
