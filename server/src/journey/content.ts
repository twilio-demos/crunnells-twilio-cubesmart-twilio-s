import { DRINKS, WELCOME_CARDS } from "./script.js";

const CONTENT_BASE = "https://content.twilio.com/v1/Content";

function authHeader(): string {
  const key = process.env.TWILIO_API_KEY!;
  const secret = process.env.TWILIO_API_SECRET!;
  return "Basic " + Buffer.from(`${key}:${secret}`).toString("base64");
}

function headers() {
  return { "Content-Type": "application/json", Authorization: authHeader() };
}

/**
 * Content Templates are IMMUTABLE — once created, the media URLs and copy are
 * frozen. `ensure()` reuses a template by friendly name, so changing artwork or
 * copy in script.ts has no effect until the version suffix here is bumped,
 * which creates a brand new template.
 *
 * These are fresh v1 templates for the CubeSmart guided move-in journey — the
 * fitness-era templates from the previous version of this demo are unrelated
 * and left alone.
 */
export const TEMPLATE_NAMES = {
  welcome: "cubesmart_welcome_carousel_v1",
  reminder: "cubesmart_movein_reminder_v1",
  fuel: "cubesmart_supply_shop_v1",
  postClass: "cubesmart_post_movein_v1",
  slotPicker: "cubesmart_slot_picker_v1",
  holdConfirm: "cubesmart_access_confirm_v1",
} as const;

const cache = new Map<string, string>();

async function findExisting(friendlyName: string): Promise<string | undefined> {
  let url: string | null = `${CONTENT_BASE}?PageSize=100`;
  let pages = 0;
  while (url && pages < 6) {
    const res = await fetch(url, { headers: headers() });
    if (!res.ok) return undefined;
    const data = (await res.json()) as {
      contents?: { sid: string; friendly_name: string }[];
      meta?: { next_page_url?: string | null };
    };
    const hit = data.contents?.find((c) => c.friendly_name === friendlyName);
    if (hit) return hit.sid;
    url = data.meta?.next_page_url || null;
    pages += 1;
  }
  return undefined;
}

async function createContent(body: Record<string, unknown>): Promise<string | undefined> {
  const res = await fetch(CONTENT_BASE, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    console.error("[journey/content] create failed", res.status, await res.text());
    return undefined;
  }
  const data = (await res.json()) as { sid?: string };
  return data.sid;
}

async function ensure(
  friendlyName: string,
  build: () => Record<string, unknown>
): Promise<string | undefined> {
  const cached = cache.get(friendlyName);
  if (cached) return cached;

  const existing = await findExisting(friendlyName);
  if (existing) {
    cache.set(friendlyName, existing);
    return existing;
  }

  const sid = await createContent({ friendly_name: friendlyName, language: "en", ...build() });
  if (sid) cache.set(friendlyName, sid);
  return sid;
}

/* ------------------------------------------------------------------ *
 * Templates
 * ------------------------------------------------------------------ */

export function welcomeTemplate() {
  return ensure(TEMPLATE_NAMES.welcome, () => ({
    variables: { "1": "John" },
    types: {
      "twilio/carousel": {
        body: "Welcome to CubeSmart West 7th, {{1}}!",
        cards: WELCOME_CARDS.map((card) => ({
          title: card.title,
          body: card.body,
          media: card.media,
          actions: [
            { type: "QUICK_REPLY", title: card.buttonTitle, id: card.payload },
          ],
        })),
      },
      "twilio/text": {
        body:
          "Welcome to CubeSmart West 7th, {{1}}! Reply BRING, PARKING, RULES, SUPPLIES or BOOK and we'll take it from there.",
      },
    },
  }));
}

export function reminderTemplate() {
  return ensure(TEMPLATE_NAMES.reminder, () => ({
    variables: { "1": "Your 10x10 Climate-Controlled move-in tour is tomorrow at 6:45 PM." },
    types: {
      "twilio/card": {
        body: "{{1}}",
        actions: [
          { type: "QUICK_REPLY", title: "Confirm", id: "rem_confirm" },
          { type: "QUICK_REPLY", title: "Running late", id: "rem_late" },
          { type: "QUICK_REPLY", title: "Reschedule", id: "rem_cancel" },
        ],
      },
      "twilio/text": { body: "{{1}} Reply CONFIRM, LATE or RESCHEDULE." },
    },
  }));
}

export function fuelTemplate() {
  return ensure(TEMPLATE_NAMES.fuel, () => ({
    variables: {},
    types: {
      "twilio/carousel": {
        body: "Moving in? Pre-order and it'll be waiting at the Supply Shop.",
        cards: DRINKS.map((drink) => ({
          title: drink.name,
          body: drink.body,
          media: drink.media,
          actions: [
            { type: "QUICK_REPLY", title: "Order this", id: drink.payload },
          ],
        })),
      },
      "twilio/text": {
        body:
          "Moving in? Pre-order at the Supply Shop — reply BOXES, LOCK or WRAP and it'll be ready when you arrive.",
      },
    },
  }));
}

export function postClassTemplate() {
  return ensure(TEMPLATE_NAMES.postClass, () => ({
    variables: { "1": "Welcome in — you're all moved in.", "2": "Nina" },
    types: {
      "twilio/card": {
        body: "{{1}}\n\nHow did {{2}} do getting you set up?",
        actions: [
          { type: "QUICK_REPLY", title: "★☆☆☆☆", id: "rate_1" },
          { type: "QUICK_REPLY", title: "★★☆☆☆", id: "rate_2" },
          { type: "QUICK_REPLY", title: "★★★☆☆", id: "rate_3" },
          { type: "QUICK_REPLY", title: "★★★★☆", id: "rate_4" },
          { type: "QUICK_REPLY", title: "★★★★★", id: "rate_5" },
          { type: "QUICK_REPLY", title: "Reserve another unit", id: "rebook_same" },
        ],
      },
      "twilio/text": { body: "{{1}}\n\nHow did {{2}} do getting you set up? Reply 1-5." },
    },
  }));
}

/** Reusable slot picker: five open move-in times, titles and payloads come from variables. */
export function slotPickerTemplate() {
  return ensure(TEMPLATE_NAMES.slotPicker, () => ({
    variables: {
      "1": "Here's what's open Friday:",
      "2": "6:00 AM 10x10 Unit",
      "3": "slot_a",
      "4": "9:30 AM 10x15 Unit",
      "5": "slot_b",
      "6": "12:15 PM 5x10 Unit",
      "7": "slot_c",
      "8": "5:30 PM 10x10 Unit",
      "9": "slot_d",
      "10": "6:45 PM 10x15 Unit",
      "11": "slot_e",
    },
    types: {
      "twilio/card": {
        body: "{{1}}",
        actions: [
          { type: "QUICK_REPLY", title: "{{2}}", id: "{{3}}" },
          { type: "QUICK_REPLY", title: "{{4}}", id: "{{5}}" },
          { type: "QUICK_REPLY", title: "{{6}}", id: "{{7}}" },
          { type: "QUICK_REPLY", title: "{{8}}", id: "{{9}}" },
          { type: "QUICK_REPLY", title: "{{10}}", id: "{{11}}" },
        ],
      },
      "twilio/text": {
        body: "{{1}}\n1. {{2}}\n2. {{4}}\n3. {{6}}\n4. {{8}}\n5. {{10}}",
      },
    },
  }));
}

export function holdConfirmTemplate() {
  return ensure(TEMPLATE_NAMES.holdConfirm, () => ({
    variables: { "1": "your gate access has been reset", "2": "West 7th" },
    types: {
      "twilio/card": {
        body: "{{1}}",
        actions: [
          { type: "QUICK_REPLY", title: "Got it", id: "hold_ack" },
          { type: "QUICK_REPLY", title: "Need more help", id: "hold_change" },
        ],
      },
      "twilio/text": { body: "{{1}}" },
    },
  }));
}

export function resetTemplateCache() {
  cache.clear();
}
