import { openai } from "@ai-sdk/openai";
import { generateText, stepCountIs, tool } from "ai";
import { z } from "zod/v4";
import { pushState } from "./bus.js";
import {
  handleDrinkChip,
  handleRatingChip,
  handleReminderChip,
  handleWelcomeChip,
  offerSlots,
  openSlotsForDay,
  rebookTo,
} from "./engine.js";
import { BRAND } from "./script.js";
import { logInbound, sendText } from "./send.js";
import {
  activeClasses,
  completeBeat,
  getAnyState,
  getState,
  normalizePhone,
  type JourneyState,
} from "./state.js";

/**
 * The unit-resizing agent. Deliberately narrow: it knows her live reservation and
 * the real schedule, and the only things it can DO are offer real open move-in
 * slots and move the reservation. Anything else gets steered back to the one job.
 */
function rebookSystemPrompt(state: JourneyState): string {
  const booked = activeClasses(state)
    .map(
      (c) =>
        `${c.className} with ${c.instructor} on ${c.dayName}, ${c.shortDate} at ${c.timeLabel}`
    )
    .join("; ");

  const offered = state.rebook?.offeredSlotIds?.length
    ? `You have already sent her the open times for ${state.rebook.day}. If she names one of those times, call move_booking with it immediately.`
    : "";

  return `You are the messaging assistant for ${BRAND.name} ${BRAND.studio} in ${BRAND.city}. You are texting with ${state.firstName} ${state.lastName}, a CubeSmart tenant.

Her currently booked move-in appointment: ${booked || "none"}.

YOUR ONE JOB IN THIS CONVERSATION: she needs a different unit or time than what she originally booked and needs to move her appointment. Nothing else.

How to run it, in this exact order:
1. If she has not told you which day she wants, acknowledge briefly that you can move it and ask ONE short question: which day works for her.
2. As soon as she names a day (Monday through Sunday, or "tomorrow"/"the weekend"), call show_open_times with that day. Do not list times yourself in prose — the tool sends her tappable options.
3. When she picks a specific time, call move_booking with that exact time. The tool cancels the old appointment, books the new one and sends her the confirmation.

Hard rules:
- Never invent unit types, move-in times or availability. Only ever use show_open_times and move_booking.
- Never confirm a move in prose. Only move_booking is allowed to confirm.
- Keep every reply to one or two short sentences. This is a text message, not an email. No markdown, no bullet points, no emoji.
- If she asks about anything other than moving this appointment — pricing, insurance, discounts, complaints — say one sentence that the West 7th team will follow up, then return to the day question.
- Never mention that you are an AI, and never mention tools or systems.
${offered}`;
}

function buildRebookTools(state: JourneyState) {
  return {
    show_open_times: tool({
      description:
        "Send the tenant the real open move-in times for a given weekday as tappable options. Use this the moment she names a day.",
      inputSchema: z.object({
        day: z
          .string()
          .describe(
            "Weekday name she asked for, e.g. Friday. Use the full English weekday name."
          ),
      }),
      execute: async ({ day }: { day: string }) => {
        const normalized = day.trim().toLowerCase();
        const dayNames = [
          "monday",
          "tuesday",
          "wednesday",
          "thursday",
          "friday",
          "saturday",
          "sunday",
        ];
        const matched = dayNames.find((d) => normalized.includes(d));
        if (!matched) return "Could not understand that day. Ask her again for a weekday.";
        const result = await offerSlots(
          state,
          matched.charAt(0).toUpperCase() + matched.slice(1)
        );
        if (!result.ok) return result.error ?? "No times available.";
        return `Sent her the open ${matched} times. Do not repeat them in text — wait for her to pick one.`;
      },
    }),
    move_booking: tool({
      description:
        "Cancel her current move-in appointment and book the new time she picked. This also sends her the confirmation message, so do not write your own confirmation.",
      inputSchema: z.object({
        day: z.string().describe("The weekday she chose, e.g. Friday."),
        time: z
          .string()
          .describe(
            "The move-in start time she chose exactly as shown to her, e.g. '6:45 PM' or '9:30 AM'."
          ),
      }),
      execute: async ({ day, time }: { day: string; time: string }) => {
        const slots = openSlotsForDay(day, state.rebook?.fromSlotId?.slice(0, 10));
        const wanted = time.replace(/\s+/g, " ").trim().toUpperCase();
        const match =
          slots.find((s) => s.timeLabel.toUpperCase() === wanted) ||
          slots.find((s) => wanted.includes(s.timeLabel.toUpperCase())) ||
          slots.find((s) => s.timeLabel.toUpperCase().startsWith(wanted.split(" ")[0]));
        if (!match) {
          return `No ${day} appointment at ${time}. Call show_open_times for ${day} again and let her pick from those.`;
        }
        const result = await rebookTo(state, match.id);
        if (!result.ok) return result.error ?? "Could not move the booking.";
        return "Moved and confirmed. Say nothing further unless she asks something new.";
      },
    }),
  };
}

const conversationLog = new Map<string, { role: "user" | "assistant"; content: string }[]>();

async function runRebookAgent(state: JourneyState, incoming: string) {
  const key = state.phone;
  const history = conversationLog.get(key) ?? [];
  history.push({ role: "user", content: incoming });

  try {
    const result = await generateText({
      model: openai.chat("gpt-4.1-mini"),
      system: rebookSystemPrompt(state),
      messages: history,
      tools: buildRebookTools(state),
      stopWhen: stepCountIs(4),
    });

    const reply = result.text?.trim();
    if (reply) {
      history.push({ role: "assistant", content: reply });
      await sendText(state, reply);
    }
    conversationLog.set(key, history.slice(-12));
  } catch (err) {
    console.error("[journey/inbound] rebook agent failed", err);
    await sendText(
      state,
      "Sorry — one second. Which day this week works for you and I'll move it?"
    );
  }
}

export function resetConversationLog(phone: string) {
  conversationLog.delete(normalizePhone(phone));
}

/* ------------------------------------------------------------------ *
 * Inbound router
 * ------------------------------------------------------------------ */

const KEYWORD_MAP: Record<string, string> = {
  bring: "wc_bring",
  parking: "wc_parking",
  rules: "wc_etiquette",
  supplies: "wc_fuel",
  book: "wc_schedule",
  confirm: "rem_confirm",
  late: "rem_late",
  reschedule: "rem_cancel",
  boxes: "supply_boxes",
  lock: "supply_lock",
  wrap: "supply_wrap",
};

export async function handleInboundMessage(params: {
  from: string;
  body: string;
  buttonText?: string;
  buttonPayload?: string;
}) {
  const from = normalizePhone(params.from);
  const state = getState(from) ?? getAnyState();
  if (!state) {
    console.warn("[journey/inbound] no active journey for", from);
    return;
  }

  const body = (params.body || "").trim();
  let payload = params.buttonPayload?.trim() || "";

  if (!payload) {
    const keyword = body.toLowerCase().replace(/[^a-z]/g, "");
    if (KEYWORD_MAP[keyword]) payload = KEYWORD_MAP[keyword];
    const rating = /^[1-5]$/.exec(body);
    if (rating && state.beatId === "post-class") payload = `rate_${rating[0]}`;
  }

  logInbound(state, body, params.buttonText || undefined, params.from);

  // Slot picks always win — they can arrive in either the reminder or rebook flow.
  if (payload.startsWith("slot_")) {
    await rebookTo(state, payload.slice(5));
    return;
  }

  if (payload.startsWith("wc_")) {
    if (await handleWelcomeChip(state, payload)) return;
  }
  if (payload.startsWith("rem_")) {
    if (await handleReminderChip(state, payload)) return;
  }
  if (payload.startsWith("supply_")) {
    if (await handleDrinkChip(state, payload)) return;
  }
  if (payload.startsWith("rate_") || payload === "rebook_same") {
    if (await handleRatingChip(state, payload)) return;
  }
  if (payload === "hold_ack") {
    await sendText(
      state,
      `You're all set. Your account picks back up on standard access automatically and rent continues as normal.`
    );
    return;
  }
  if (payload === "hold_change") {
    await sendText(
      state,
      `Sure — give us a call at ${process.env.CUBESMART_STORE_PHONE ?? "the store"} and we'll sort it out.`
    );
    return;
  }

  // Free text. Act 2 step 7 → step 8: her "need a bigger unit" reply is what
  // hands the thread to the AI agent.
  if (state.beatId === "book-2" && activeClasses(state).length > 0) {
    completeBeat(state, "book-2");
    pushState(state);
    await runRebookAgent(state, body);
    return;
  }

  if (state.beatId === "ai-rebook") {
    await runRebookAgent(state, body);
    return;
  }

  // Any other free text: stay in character without advancing the story.
  await sendText(
    state,
    `Thanks ${state.firstName} — the West 7th team will pick this up. If it's about your move-in, reply here and we'll move it for you.`
  );
}
