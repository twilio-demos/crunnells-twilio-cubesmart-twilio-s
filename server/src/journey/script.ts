/**
 * CubeSmart — guided move-in journey script.
 *
 * This file is the single source of truth for the narrative. Every beat, every
 * piece of copy, every unit-tour slot in the schedule and every RCS card lives
 * here so the demo always runs exactly as written.
 */

export const BRAND = {
  name: "CubeSmart",
  studio: "West 7th",
  studioFull: "CubeSmart — West 7th, Fort Worth",
  address: "2600 W 7th St, Fort Worth, TX 76107",
  city: "Fort Worth",
  timeZone: "America/Chicago",
  hours: "Office: Mon–Sat 9:30a–6:00p, Sun 12:00p–5:00p · Gate access 6:00a–9:00p daily",
  fuelBar: "the Move-In Supply Shop",
};

export const PERSONA = {
  firstName: "Maya",
  lastName: "Ellison",
  age: 31,
  blurb:
    "31, just moved to Fort Worth from Denver. Reserves a storage unit at the West 7th store while her new apartment gets ready.",
};

/**
 * How long an emergency after-hours gate access extension lasts, in days. Offered
 * out loud by the voice agent when a tenant is locked out after the office closes.
 */
export const HOLD_OPTIONS = [1, 7, 30] as const;
export type HoldOption = (typeof HOLD_OPTIONS)[number];

/**
 * The live retention risk score at which the store treats a tenant as a real
 * churn risk. Crossing it writes an event to her Unified Profile and releases
 * the recommended save offer to the human agent.
 */
export const RETENTION_RISK_THRESHOLD = 60;

/** The save the store team is authorised to make once risk crosses the line. */
export const SAVE_OFFER = {
  classCredit: "20% off monthly rent for the next 3 months",
  coaching: "Free move to a smaller 5x10 unit, if she'd rather downsize",
  label: "20% discount for 3 months, or a downsize to a smaller unit",
};

/** Canonical event names. These are what appear on screen and in Memory. */
export const EVENTS = {
  ACCOUNT_CREATED: "New Lease Started",
  CONSENT_CAPTURED: "Consent Captured",
  CLASS_BOOKED: "Unit Reserved",
  CLASS_CANCELLED: "Reservation Changed",
  FUEL_ORDER: "Moving Supplies Ordered",
  MEMBERSHIP_PAUSED: "Gate Access Extended",
  FLEX_ESCALATION: "Flex Escalation",
  RETENTION_RISK_THRESHOLD: "Retention Risk Threshold Reached",
  MEMBERSHIP_REACTIVATED: "Autopay Recovered & Lease Retained",
} as const;

/* ------------------------------------------------------------------ *
 * Move-in appointment schedule
 * ------------------------------------------------------------------ */

export interface ClassSlot {
  id: string;
  dateISO: string;
  time: string;
  hour24: number;
  minute: number;
  dayName: string;
  shortDate: string;
  timeLabel: string;
  label: string;
  className: string;
  instructor: string;
  duration: number;
  room: string;
  spotsLeft: number;
}

const CLASS_TYPES: { className: string; duration: number; room: string }[] = [
  { className: "10x10 Climate-Controlled — Move-In Tour", duration: 20, room: "Building A" },
  { className: "10x15 Drive-Up Access — Move-In Tour", duration: 20, room: "Building C" },
  { className: "5x10 Wardrobe Unit — Move-In Tour", duration: 15, room: "Building A" },
  { className: "5x5 Compact Unit — Move-In Tour", duration: 15, room: "Building B" },
  { className: "10x20 Vehicle & Boat — Move-In Tour", duration: 20, room: "Building D" },
];

export const INSTRUCTORS = [
  "Nina Okafor",
  "Marcus Bell",
  "Priya Raman",
  "Devon Cole",
  "Sasha Lindqvist",
];

const TIMES: { hour24: number; minute: number }[] = [
  { hour24: 6, minute: 0 },
  { hour24: 9, minute: 30 },
  { hour24: 12, minute: 15 },
  { hour24: 17, minute: 30 },
  { hour24: 18, minute: 45 },
];

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** Today's date in the store's timezone, as YYYY-MM-DD. */
export function studioToday(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BRAND.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return parts;
}

function addDays(dateISO: string, days: number): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function dayOfWeek(dateISO: string): number {
  const [y, m, d] = dateISO.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function shortDate(dateISO: string): string {
  const [, m, d] = dateISO.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]} ${d}`;
}

function timeLabel(hour24: number, minute: number): string {
  const suffix = hour24 >= 12 ? "PM" : "AM";
  const h = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${h}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function pseudoSpots(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) % 9973;
  return 2 + (hash % 12);
}

function buildSlot(dateISO: string, timeIndex: number, dayIndex: number): ClassSlot {
  const { hour24, minute } = TIMES[timeIndex];
  const type = CLASS_TYPES[(dayIndex + timeIndex) % CLASS_TYPES.length];
  const instructor = INSTRUCTORS[(dayIndex * 2 + timeIndex) % INSTRUCTORS.length];
  const id = `${dateISO}-${String(hour24).padStart(2, "0")}${String(minute).padStart(2, "0")}`;
  const dayName = DAY_NAMES[dayOfWeek(dateISO)];
  const sd = shortDate(dateISO);
  const tl = timeLabel(hour24, minute);
  return {
    id,
    dateISO,
    time: `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
    hour24,
    minute,
    dayName,
    shortDate: sd,
    timeLabel: tl,
    label: `${dayName.slice(0, 3)}, ${sd} · ${tl}`,
    className: type.className,
    instructor,
    duration: type.duration,
    room: type.room,
    spotsLeft: pseudoSpots(id),
  };
}

/** The full bookable schedule, starting tomorrow so nothing is ever in the past. */
export function buildSchedule(days = 14): ClassSlot[] {
  const today = studioToday();
  const slots: ClassSlot[] = [];
  for (let offset = 1; offset <= days; offset++) {
    const dateISO = addDays(today, offset);
    for (let t = 0; t < TIMES.length; t++) {
      slots.push(buildSlot(dateISO, t, offset));
    }
  }
  return slots;
}

/** The next occurrence of a given weekday name, at least `minOffset` days out. */
export function nextWeekday(dayName: string, minOffset = 1): string {
  const target = DAY_NAMES.findIndex(
    (d) => d.toLowerCase() === dayName.toLowerCase()
  );
  const today = studioToday();
  for (let offset = minOffset; offset <= minOffset + 13; offset++) {
    const candidate = addDays(today, offset);
    if (dayOfWeek(candidate) === target) return candidate;
  }
  return addDays(today, minOffset);
}

export function slotsForDate(dateISO: string): ClassSlot[] {
  const today = studioToday();
  const offset = Math.round(
    (Date.parse(`${dateISO}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000
  );
  return TIMES.map((_, t) => buildSlot(dateISO, t, offset));
}

export function slotById(id: string): ClassSlot | undefined {
  const dateISO = id.slice(0, 10);
  return slotsForDate(dateISO).find((s) => s.id === id);
}

export function describeSlot(slot: ClassSlot): string {
  return `${slot.className} with ${slot.instructor.split(" ")[0]} ${slot.instructor
    .split(" ")[1]
    .charAt(0)}. — ${slot.dayName}, ${slot.shortDate} at ${slot.timeLabel}`;
}

export function addDaysISO(dateISO: string, days: number): string {
  return addDays(dateISO, days);
}

export function longDate(dateISO: string): string {
  const dayName = DAY_NAMES[dayOfWeek(dateISO)];
  return `${dayName}, ${shortDate(dateISO)}`;
}

/* ------------------------------------------------------------------ *
 * Welcome RCS carousel
 * ------------------------------------------------------------------ */

export interface WelcomeCard {
  key: string;
  title: string;
  body: string;
  media: string;
  buttonTitle: string;
  payload: string;
  /** What the store replies with when she taps the chip. */
  reply: string;
}

export const WELCOME_CARDS: WelcomeCard[] = [
  {
    key: "bring",
    title: "What to Bring on Move-In Day",
    body: "Just a photo ID. Bring your own disc lock, or grab one at the Supply Shop.",
    media:
      "https://images.pexels.com/photos/2985875/pexels-photo-2985875.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
    buttonTitle: "What do I need?",
    payload: "wc_bring",
    reply:
      "Bring a photo ID and a disc lock — grab one at the Supply Shop if you don't have one. We'll have a dolly ready at the gate for your first visit.",
  },
  {
    key: "parking",
    title: "Parking & Loading Dock",
    body: "Free loading-dock parking right by Building A, no time limit while you move in.",
    media:
      "https://images.pexels.com/photos/5759145/pexels-photo-5759145.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
    buttonTitle: "Where do I park?",
    payload: "wc_parking",
    reply:
      "Pull right up to the Building A loading dock — no time limit while you're moving in. Overflow parking runs along the west fence line.",
  },
  {
    key: "etiquette",
    title: "Storage Rules & Insurance",
    body: "No perishables or hazardous materials, and tenant insurance is required — we can set you up in seconds.",
    media:
      "https://images.pexels.com/photos/38573375/pexels-photo-38573375.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
    buttonTitle: "House rules",
    payload: "wc_etiquette",
    reply:
      "Three things: no perishables or hazardous materials in the unit, keep the aisle clear for other tenants, and tenant insurance is required — I can add it to your account right now if you don't already have your own policy.",
  },
  {
    key: "fuel",
    title: "Get Packing Supplies",
    body: "Boxes, locks and wrap kits. Pre-order mid-move and it's waiting at the Supply Shop counter.",
    media:
      "https://images.pexels.com/photos/7217904/pexels-photo-7217904.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
    buttonTitle: "See the supplies",
    payload: "wc_fuel",
    reply:
      "The Supply Shop carries box bundles, disc locks and furniture wrap kits — we'll text you mid-move so your order is waiting at the counter.",
  },
  {
    key: "schedule",
    title: "Schedule Your Move-In",
    body: "Book your move-in appointment in a couple of taps. Reserve up to 8 days out.",
    media:
      "https://images.pexels.com/photos/5759037/pexels-photo-5759037.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
    buttonTitle: "Book my move-in",
    payload: "wc_schedule",
    reply:
      "Opening the West 7th move-in schedule for you now — grab any time in the next two weeks and I'll confirm it here.",
  },
];

/* ------------------------------------------------------------------ *
 * Move-In Supply Shop
 * ------------------------------------------------------------------ */

export interface Drink {
  key: string;
  name: string;
  body: string;
  media: string;
  payload: string;
  calories: number;
  protein: number;
}

export const DRINKS: Drink[] = [
  {
    key: "boxes",
    name: "Box Bundle (10 boxes + tape)",
    body: "10 medium boxes, 2 rolls of packing tape, permanent marker · $24.99",
    media:
      "https://images.pexels.com/photos/7217904/pexels-photo-7217904.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
    payload: "supply_boxes",
    calories: 2499,
    protein: 10,
  },
  {
    key: "lock",
    name: "Disc Lock + Weatherproof Cover",
    body: "High-security disc lock and a weatherproof unit cover · $19.99",
    media:
      "https://images.pexels.com/photos/38573375/pexels-photo-38573375.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
    payload: "supply_lock",
    calories: 1999,
    protein: 1,
  },
  {
    key: "wrap",
    name: "Furniture Wrap Kit",
    body: "Stretch wrap, moving pads and bubble wrap · $34.99",
    media:
      "https://images.pexels.com/photos/7217846/pexels-photo-7217846.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
    payload: "supply_wrap",
    calories: 3499,
    protein: 1,
  },
];

/* ------------------------------------------------------------------ *
 * Beats — the narrative spine
 * ------------------------------------------------------------------ */

export type BeatStage =
  | "narration"
  | "signup"
  | "thread"
  | "booking"
  | "call-prompt"
  | "call-live"
  | "desk"
  | "save";

export interface Beat {
  id: string;
  act: string;
  actLabel: string;
  step: string;
  title: string;
  /** Said out loud by the demo lead. */
  narration: string;
  /** What is actually happening underneath. */
  mechanic: string;
  stage: BeatStage;
  /** Label on the single primary button, when it is the operator's turn. */
  action?: string;
  /** Shown while we wait on the tenant's handset. */
  waiting?: string;
  events?: string[];
}

export const BEATS: Beat[] = [
  {
    id: "setup",
    act: "0",
    actLabel: "Act 0 — Setup",
    step: "Say this, don't demo it",
    title: "Meet Maya",
    narration:
      "Maya, 31, just moved to Fort Worth. She's between apartments and needs somewhere to put her things — she finds the West 7th CubeSmart on her phone and reserves a unit before she's even parked.",
    mechanic:
      "Real Twilio infrastructure end to end: Lookup and Verify at reservation, branded RCS on her handset, Twilio Memory as the profile of record, a voice AI agent on the store line, and a live Flex handoff to a human at the finish.",
    stage: "narration",
    action: "Begin the journey",
  },
  {
    id: "signup",
    act: "1",
    actLabel: "Act 1 — Booking & move-in",
    step: "1",
    title: "Reservation & consent capture",
    narration:
      "She gives us her name and her number, and explicitly opts in to text messages. Nothing goes out until we know two things: that this is a real mobile line she can actually receive rich messages on, and that it's genuinely hers.",
    mechanic:
      "Twilio Lookup validates the line type and carrier and checks RCS capability. Twilio Verify sends a real 6-digit code she has to enter. Only then do we create her profile in Twilio Memory.",
    stage: "signup",
    waiting: "Complete the reservation form on the stage",
    events: [EVENTS.ACCOUNT_CREATED, EVENTS.CONSENT_CAPTURED],
  },
  {
    id: "welcome",
    act: "1",
    actLabel: "Act 1 — Booking & move-in",
    step: "2",
    title: "Welcome RCS",
    narration:
      "Her first message from us isn't a grey SMS from a random number. It's a branded, verified sender with our logo, our colour and a carousel she can actually use.",
    mechanic:
      "A twilio/carousel Content Template sent over RCS from the verified CubeSmart sender. Five cards: What to Bring, Parking & Loading Dock, Storage Rules & Insurance, Get Packing Supplies, Schedule Your Move-In.",
    stage: "thread",
    action: "Send Welcome RCS",
    waiting: "Tap through the carousel on your phone — then tap “Book my move-in”",
  },
  {
    id: "book-1",
    act: "1",
    actLabel: "Act 1 — Booking & move-in",
    step: "3",
    title: "Books move-in appointment #1",
    narration:
      "She taps Schedule Your Move-In and books straight from the thread. No app download, no password reset.",
    mechanic:
      "The booking surface writes the reservation to her record and immediately sends a real confirmation message.",
    stage: "booking",
    waiting: "Pick a move-in time on the stage to book it",
    events: [EVENTS.CLASS_BOOKED],
  },
  {
    id: "reminder",
    act: "1",
    actLabel: "Act 1 — Booking & move-in",
    step: "4",
    title: "Reminder cadence",
    narration:
      "The day before move-in, she gets a reminder she can act on in one tap — Confirm, Running late, or Reschedule. No calling the store. Tap Confirm for this beat; resizing her unit from the thread is demonstrated later, in Act 2.",
    mechanic:
      "A twilio/card with three quick replies, addressed to whichever move-in appointment is actually next on her record. Her tap comes back as a button payload and we answer it in-thread.",
    stage: "thread",
    action: "Send RCS Reminder for Next Move-In",
    waiting:
      "Tap Confirm on your phone — not Reschedule. Resizing her unit is demonstrated in Act 2.",
  },
  {
    id: "fuel",
    act: "1",
    actLabel: "Act 1 — Booking & move-in",
    step: "5",
    title: "Mid-move packing supplies pre-order",
    narration:
      "While she's loading the truck, she gets three supply bundles to choose from. She taps one and it's on the counter with her name on it before she's finished unloading.",
    mechanic:
      "A three-card RCS carousel with real photography. Her tap places the order and we confirm it's waiting at the Supply Shop.",
    stage: "thread",
    action: "Send Supply Shop Pre-Order",
    waiting: "Tap a bundle on your phone",
    events: [EVENTS.FUEL_ORDER],
  },
  {
    id: "post-class",
    act: "1",
    actLabel: "Act 1 — Booking & move-in",
    step: "6",
    title: "Post move-in follow-up",
    narration:
      "After move-in: how it went, and one tap to rate the experience.",
    mechanic:
      "A move-in recap, a 1–5 star staff rating as an RCS chip list, and a one-tap option to reserve another unit. The rating lands on her profile.",
    stage: "thread",
    action: "Send Post-Move-In Follow-Up",
    waiting: "Rate the move-in on your phone",
  },
  {
    id: "book-2",
    act: "2",
    actLabel: "Act 2 — She needs a bigger unit",
    step: "7",
    title: "Books unit #2 — then life happens",
    narration:
      "A week in she books a second move-in appointment. Then it turns out she has more stuff than expected. She doesn't open an app or call us — she just replies to the confirmation text like a human.",
    mechanic:
      "Same booking surface, same real confirmation. Then a free-text inbound reply lands on the same thread and the AI agent picks it up.",
    stage: "booking",
    waiting:
      "Book Thursday on the stage, then reply on your phone: “turns out I need a bigger unit, what's open?”",
    events: [EVENTS.CLASS_BOOKED],
  },
  {
    id: "ai-rebook",
    act: "2",
    actLabel: "Act 2 — She needs a bigger unit",
    step: "8",
    title: "AI agent handles it in-thread",
    narration:
      "The agent understands what she means, asks which day works, gives her the open unit options as taps, moves the reservation and confirms it. Nobody at the store touched this.",
    mechanic:
      "The agent is scoped to this one job with her live reservation state and the real open schedule. It can only offer real slots and can only cancel and rebook — it cannot wander off script.",
    stage: "thread",
    waiting: "Answer the agent on your phone — say Friday, then pick a slot",
    events: [EVENTS.CLASS_CANCELLED, EVENTS.CLASS_BOOKED],
  },
  {
    id: "after-hours",
    act: "3",
    actLabel: "Act 3 — Locked out after hours",
    step: "9",
    title: "8pm. The store is closed.",
    narration:
      "Two months later she's moving more boxes in after work and gets locked out at the gate. She calls the store at 8pm. We're closed. This is exactly the moment a frustrated tenant starts looking at a competitor down the street.",
    mechanic:
      "Her call lands on the store's real number and is answered by the voice AI agent. Nothing rings at the front desk.",
    stage: "call-prompt",
    waiting: "Call the store from your phone",
  },
  {
    id: "voice-hold",
    act: "3",
    actLabel: "Act 3 — Locked out after hours",
    step: "10",
    title: "Voice AI resets gate access",
    narration:
      "She says she's locked out and needs access tonight. The agent verifies her, resets the gate code, and the RCS confirmation — with a QR code and gate directions — is on her phone before she's hung up.",
    mechanic:
      "The voice agent has her profile and exactly two tools in this beat: reset access, and send the confirmation. It offers standing options and reads the window back before it commits anything.",
    stage: "call-live",
    waiting: "Ask for your gate code to be reset, then hang up",
    events: [EVENTS.MEMBERSHIP_PAUSED],
  },
  {
    id: "voice-callback",
    act: "4",
    actLabel: "Act 4 — The save",
    step: "11",
    title: "She calls back about a declined charge",
    narration:
      "Sixty days later she calls back. The agent greets her by name, already knows her gate access was extended, and when she mentions her autopay it tells her that's great she called — then has to tell her the card on file has expired.",
    mechanic:
      "Same number, same agent, her profile already loaded. The agent acknowledges her first, then checks the payment method, finds the expired card, and knows it cannot take card details itself.",
    stage: "call-prompt",
    waiting: "Call back and ask about your account",
  },
  {
    id: "flex",
    act: "4",
    actLabel: "Act 4 — The save",
    step: "12",
    title: "Warm handoff into Flex",
    narration:
      "The agent asks if it can bring in someone from the store team, then hands her to a human with everything already on screen — her unit history, the access window, the failed charge and the last sixty seconds of what she just said. She doesn't repeat herself. That's the save.",
    mechanic:
      "The live call is handed to Twilio Flex as a real TaskRouter voice task with her full context in the task attributes. A Flex agent accepts and is bridged straight to her.",
    stage: "desk",
    waiting: "The agent is transferring — accept the task in Flex",
    events: [EVENTS.FLEX_ESCALATION],
  },
  {
    id: "save",
    act: "4",
    actLabel: "Act 4 — The save",
    step: "13",
    title: "Coached in real time, then saved",
    narration:
      "While she's giving the store team her new card she starts venting — she found a cheaper unit down the street and isn't sure it's worth staying. The operators are still listening, her risk score climbs past sixty, and the recommended save appears on the agent's screen mid-sentence: 20% off for three months, or a downsize to a smaller unit. She takes the discount, gives the card, and stays.",
    mechanic:
      "The handoff did not end the conversation. Real-Time Transcription takes over from ConversationRelay on the same call, so the same operators keep scoring the human conversation. Crossing the risk threshold writes an event straight to her Unified Profile and releases the offer to Flex — the operators are writing back, not just reading.",
    stage: "save",
    action: "New card taken — complete the save",
    waiting:
      "In Flex: read her the recommended offer, then take the new card. Say you found a cheaper unit down the street and aren't sure it's worth staying, to drive the score up.",
    events: [EVENTS.RETENTION_RISK_THRESHOLD, EVENTS.MEMBERSHIP_REACTIVATED],
  },
];

export function beatIndex(id: string): number {
  return BEATS.findIndex((b) => b.id === id);
}
