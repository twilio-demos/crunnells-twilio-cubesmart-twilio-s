import { BEATS, EVENTS, PERSONA, type ClassSlot } from "./script.js";
import type { JourneyIntel } from "./intel.js";

export interface JourneyMessage {
  id: string;
  direction: "outbound" | "inbound";
  channel: "rcs" | "sms" | "voice";
  kind: "text" | "carousel" | "card" | "system";
  body?: string;
  cards?: {
    title: string;
    body: string;
    media?: string;
    buttons: { title: string; payload: string }[];
  }[];
  buttons?: { title: string; payload: string }[];
  timestamp: string;
  sid?: string;
  /**
   * False until Twilio tells us which channel actually carried the message.
   * Outbound sends start optimistic ("rcs") and are corrected on the delivery
   * receipt, so the thread must not claim RCS until this flips to true.
   */
  channelConfirmed?: boolean;
  /** Real Twilio delivery status: queued | sent | delivered | read | undelivered | failed. */
  deliveryStatus?: string;
  /** True when RCS was attempted but the message actually went out over SMS. */
  fellBackToSms?: boolean;
  /** Twilio error code from the delivery receipt, e.g. 63035. */
  errorCode?: number;
  /** Plain-English reason the RCS attempt did not stick. */
  fallbackReason?: string;
}

export interface JourneyEvent {
  id: string;
  name: string;
  detail?: string;
  timestamp: string;
}

export interface BookedClass {
  slotId: string;
  className: string;
  instructor: string;
  dateISO: string;
  timeLabel: string;
  dayName: string;
  shortDate: string;
  duration: number;
  room: string;
  status: "booked" | "cancelled" | "attended";
  bookedAt: string;
}

export interface TranscriptLine {
  id: string;
  role: "member" | "agent" | "tool" | "system";
  text: string;
  timestamp: string;
}

export interface LookupResult {
  phone: string;
  valid: boolean;
  nationalFormat?: string;
  lineType?: string;
  carrier?: string;
  countryCode?: string;
  rcsCapable: boolean;
  smsPumpingRisk?: number | null;
  raw?: Record<string, unknown>;
}

export interface FlexHandoff {
  /** Real TaskRouter task SID once Flex has created the task. */
  taskSid?: string;
  /** Live task assignment status: pending | reserved | assigned | wrapping | completed | canceled. */
  status?: string;
  /** Name of the Flex worker who accepted it. */
  worker?: string;
  queue?: string;
  workflowSid?: string;
  workspaceSid?: string;
  /** The exact attribute payload handed to Flex. */
  attributes?: Record<string, unknown>;
  /** True once the live call has actually been redirected into the Flex queue. */
  transferred: boolean;
  transferredAt?: string;
  /**
   * The call this handoff belongs to. A demo can be run more than once, and a
   * task from a previous run must never be mistaken for the live one — that is
   * how the agent ends up staring at a frozen retention score.
   */
  callSid?: string;
  error?: string;
  /**
   * How the human leg actually happened. "flex" is the real TaskRouter path;
   * "forwarded" means no Flex agent was available so the live call was dialled
   * straight to the store team's fallback phone instead.
   */
  mode?: "flex" | "forwarded";
  /** The number the call was forwarded to, when mode is "forwarded". */
  forwardedTo?: string;
}

export interface JourneyState {
  phone: string;
  firstName: string;
  lastName: string;
  createdAt: string;
  beatId: string;
  /** Beats that have fully completed. */
  completed: string[];
  profileId?: string;
  lookup?: LookupResult;
  verified: boolean;
  verificationSent: boolean;
  consentAt?: string;
  classes: BookedClass[];
  /** Which booking slot the member is currently being asked to pick. */
  bookingRound: 1 | 2;
  reminderSlotId?: string;
  reminderResponse?: "confirmed" | "late" | "cancelled";
  fuelOrder?: { name: string; calories: number; protein: number; orderedAt: string };
  instructorRating?: number;
  rebook?: { day?: string; offeredSlotIds?: string[]; fromSlotId?: string; toSlotId?: string };
  membership: {
    tier: string;
    status: "active" | "on-hold";
    holdStart?: string;
    holdEnd?: string;
    holdDays?: number;
    paymentStatus: "current" | "expired";
    cardLast4: string;
    cardExpiry: string;
    failedChargeAmount?: string;
    failedChargeAt?: string;
  };
  messages: JourneyMessage[];
  events: JourneyEvent[];
  transcript: TranscriptLine[];
  callStatus: "idle" | "ringing" | "in-call" | "ended";
  callCount: number;
  /** Call SID of the live inbound call, captured on the ConversationRelay setup frame. */
  callSid?: string;
  /**
   * The call whose per-call flags (transcript, goodbye, transfer) are currently
   * loaded. Comparing this to `callSid` is how a brand new call is recognised.
   *
   * Deliberately NOT derived from `callStatus`: that only becomes "ended" if the
   * previous call's teardown was reported, and it never is when the call left
   * for Flex or dropped abruptly. A run stuck mid-call answers every later call
   * with silence.
   */
  activeCallSid?: string;
  /** The greeting the caller actually heard when the agent picked up. */
  greeting?: string;
  /** True from the moment the call is being redirected into Flex. */
  transferring?: boolean;
  /** True once a goodbye has been spoken and the line is about to be closed. */
  hangingUp?: boolean;
  /**
   * Which call number the payment method was checked on, so a repeat run never
   * makes the agent think it has already broken the news on THIS call.
   */
  paymentCheckedOnCall?: number;
  escalation?: {
    reason: string;
    summary: string;
    createdAt: string;
    handledBy?: string;
  };
  flex?: FlexHandoff;
  /** Live Conversation Intelligence signals for the call in progress. */
  intel?: JourneyIntel;
  /**
   * Set the first time the live retention risk score crosses the studio's
   * threshold, so the event is only ever written to her profile once.
   */
  riskThresholdAt?: string;
  /** The score that tripped the threshold, kept for the on-screen summary. */
  riskThresholdScore?: number;
  /**
   * Communication ids already mirrored into the transcript from Conversation
   * Orchestrator, so the human leg of the call never double-posts a line.
   */
  seenCommunicationIds?: string[];
  /** The save the front desk actually made, once it has been recorded. */
  save?: {
    offer: string;
    classCredit: string;
    coaching: string;
    cardLast4: string;
    cardExpiry: string;
    completedAt: string;
  };
}

const states = new Map<string, JourneyState>();

let seq = 0;
export function nid(prefix = "id"): string {
  seq += 1;
  return `${prefix}_${Date.now().toString(36)}${seq.toString(36)}`;
}

export function normalizePhone(input: string): string {
  const digits = (input || "").replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

export function createState(
  phone: string,
  firstName: string,
  lastName: string
): JourneyState {
  const state: JourneyState = {
    phone,
    firstName: firstName || PERSONA.firstName,
    lastName: lastName || PERSONA.lastName,
    createdAt: new Date().toISOString(),
    beatId: "signup",
    completed: ["setup"],
    verified: false,
    verificationSent: false,
    classes: [],
    bookingRound: 1,
    membership: {
      tier: "10x10 Climate-Controlled Unit",
      status: "active",
      paymentStatus: "current",
      cardLast4: "4417",
      cardExpiry: "09/26",
    },
    messages: [],
    events: [],
    transcript: [],
    callStatus: "idle",
    callCount: 0,
  };
  states.set(phone, state);
  return state;
}

export function getState(phone: string): JourneyState | undefined {
  return states.get(normalizePhone(phone));
}

/** The single active demo run, if there is one. Used by voice + inbound webhooks. */
export function getAnyState(): JourneyState | undefined {
  let newest: JourneyState | undefined;
  for (const s of states.values()) {
    if (!newest || s.createdAt > newest.createdAt) newest = s;
  }
  return newest;
}

export function deleteState(phone: string) {
  states.delete(normalizePhone(phone));
}

export function allStates(): JourneyState[] {
  return Array.from(states.values());
}

/* ------------------------------------------------------------------ *
 * Mutations
 * ------------------------------------------------------------------ */

export function addMessage(
  state: JourneyState,
  message: Omit<JourneyMessage, "id" | "timestamp">
): JourneyMessage {
  const entry: JourneyMessage = {
    ...message,
    id: nid("msg"),
    timestamp: new Date().toISOString(),
  };
  state.messages.push(entry);
  return entry;
}

export function addTranscript(
  state: JourneyState,
  role: TranscriptLine["role"],
  text: string
): TranscriptLine {
  const clean = (text ?? "").trim();

  // Safety net against a line arriving twice from two different sources — the
  // live relay turn and Conversation Orchestrator's copy of the same call. Short
  // confirmations like "yes" are left alone, since she may genuinely repeat them.
  const last = state.transcript[state.transcript.length - 1];
  if (
    last &&
    clean.length > 3 &&
    last.role === role &&
    last.text.trim() === clean &&
    Date.now() - Date.parse(last.timestamp) < 8000
  ) {
    return last;
  }

  const line: TranscriptLine = {
    id: nid("tl"),
    role,
    text: clean,
    timestamp: new Date().toISOString(),
  };
  state.transcript.push(line);
  return line;
}

export function addEvent(
  state: JourneyState,
  name: string,
  detail?: string
): JourneyEvent {
  const event: JourneyEvent = {
    id: nid("evt"),
    name,
    detail,
    timestamp: new Date().toISOString(),
  };
  state.events.push(event);
  return event;
}

export function completeBeat(state: JourneyState, beatId: string) {
  if (!state.completed.includes(beatId)) state.completed.push(beatId);
  const idx = BEATS.findIndex((b) => b.id === beatId);
  const next = BEATS[idx + 1];
  if (next) state.beatId = next.id;
}

export function isBeatUnlocked(state: JourneyState, beatId: string): boolean {
  const idx = BEATS.findIndex((b) => b.id === beatId);
  if (idx <= 0) return true;
  return state.completed.includes(BEATS[idx - 1].id);
}

export function activeClasses(state: JourneyState): BookedClass[] {
  return state.classes.filter((c) => c.status === "booked");
}

export function nextClass(state: JourneyState): BookedClass | undefined {
  return activeClasses(state)
    .slice()
    .sort((a, b) =>
      `${a.dateISO}${a.timeLabel}`.localeCompare(`${b.dateISO}${b.timeLabel}`)
    )[0];
}

export function bookSlot(
  state: JourneyState,
  slot: ClassSlot
): BookedClass {
  const booked: BookedClass = {
    slotId: slot.id,
    className: slot.className,
    instructor: slot.instructor,
    dateISO: slot.dateISO,
    timeLabel: slot.timeLabel,
    dayName: slot.dayName,
    shortDate: slot.shortDate,
    duration: slot.duration,
    room: slot.room,
    status: "booked",
    bookedAt: new Date().toISOString(),
  };
  state.classes.push(booked);
  return booked;
}

export function cancelSlot(state: JourneyState, slotId: string) {
  const found = state.classes.find(
    (c) => c.slotId === slotId && c.status === "booked"
  );
  if (found) found.status = "cancelled";
  return found;
}

export const EVENT_NAMES = EVENTS;
