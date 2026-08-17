import { pushState } from "./bus.js";
import {
  fuelTemplate,
  postClassTemplate,
  reminderTemplate,
  slotPickerTemplate,
  welcomeTemplate,
} from "./content.js";
import { transferCallToFlex } from "./flex.js";
import { patchMembershipTraits, writeObservation } from "./memory-profile.js";
import {
  BRAND,
  DRINKS,
  EVENTS,
  SAVE_OFFER,
  WELCOME_CARDS,
  addDaysISO,
  describeSlot,
  longDate,
  slotById,
  slotsForDate,
  type ClassSlot,
} from "./script.js";
import { sendTemplate, sendText } from "./send.js";
import {
  addEvent,
  addTranscript,
  bookSlot,
  cancelSlot,
  completeBeat,
  nextClass,
  type BookedClass,
  type JourneyState,
} from "./state.js";

/* ------------------------------------------------------------------ *
 * Events
 * ------------------------------------------------------------------ */

export async function fireEvent(
  state: JourneyState,
  name: string,
  detail?: string
) {
  addEvent(state, name, detail);
  pushState(state);
  await writeObservation(
    state.profileId,
    detail ? `${name} — ${detail}` : name,
    "CubeSmart"
  );
}

function shortInstructor(full: string): string {
  const [first, last] = full.split(" ");
  return last ? `${first} ${last.charAt(0)}.` : first;
}

/* ------------------------------------------------------------------ *
 * Act 1 — Welcome RCS
 * ------------------------------------------------------------------ */

export async function sendWelcome(state: JourneyState) {
  const sid = await welcomeTemplate();
  if (!sid) {
    await sendText(
      state,
      `Welcome to ${BRAND.name} ${BRAND.studio}, ${state.firstName}!`
    );
    return;
  }
  await sendTemplate(
    state,
    sid,
    { "1": state.firstName },
    {
      kind: "carousel",
      body: `Welcome to ${BRAND.name} ${BRAND.studio}, ${state.firstName}!`,
      cards: WELCOME_CARDS.map((card) => ({
        title: card.title,
        body: card.body,
        media: card.media,
        buttons: [{ title: card.buttonTitle, payload: card.payload }],
      })),
    }
  );
}

export async function handleWelcomeChip(state: JourneyState, payload: string) {
  const card = WELCOME_CARDS.find((c) => c.payload === payload);
  if (!card) return false;
  await sendText(state, card.reply);
  if (card.key === "schedule") {
    state.bookingRound = 1;
    completeBeat(state, "welcome");
    pushState(state);
  }
  return true;
}

/* ------------------------------------------------------------------ *
 * Act 1 / Act 2 — Move-in appointments
 * ------------------------------------------------------------------ */

export async function bookClass(state: JourneyState, slotId: string) {
  const slot = slotById(slotId);
  if (!slot) return { ok: false, error: "That move-in time is no longer on the schedule." };

  const booked = bookSlot(state, slot);
  const round = state.bookingRound;

  await sendText(
    state,
    `You're booked. ${slot.className} with ${shortInstructor(slot.instructor)} — ${slot.dayName}, ${slot.shortDate} at ${slot.timeLabel}, ${slot.room} at ${BRAND.name} ${BRAND.studio}. Bring a photo ID — we'll have your gate code ready when you arrive. Reply here if anything changes.`
  );

  await fireEvent(state, EVENTS.CLASS_BOOKED, describeSlot(slot));

  const bookedCount = state.classes.filter((c) => c.status !== "cancelled").length;
  await patchMembershipTraits(state.profileId!, {
    classesBooked: String(bookedCount),
    lastClassBooked: describeSlot(slot),
  });

  if (round === 1) {
    state.reminderSlotId = booked.slotId;
    completeBeat(state, "book-1");
  } else {
    // Act 2 step 7: the booking lands, but the beat isn't done until she
    // replies in free text that she needs a bigger unit.
    state.rebook = { fromSlotId: booked.slotId };
  }

  pushState(state);
  return { ok: true, booked };
}

/* ------------------------------------------------------------------ *
 * Act 1 — Reminder cadence
 * ------------------------------------------------------------------ */

export async function sendReminder(state: JourneyState) {
  const upcoming = nextClass(state);
  if (!upcoming) return { ok: false, error: "No move-in appointment is currently booked." };

  state.reminderSlotId = upcoming.slotId;

  const line = `Reminder: your ${upcoming.className} move-in tour with ${shortInstructor(
    upcoming.instructor
  )} is ${upcoming.dayName}, ${upcoming.shortDate} at ${upcoming.timeLabel} at ${upcoming.room}.`;

  const sid = await reminderTemplate();
  if (!sid) {
    await sendText(state, `${line} Reply CONFIRM, LATE or RESCHEDULE.`);
  } else {
    await sendTemplate(
      state,
      sid,
      { "1": line },
      {
        kind: "card",
        body: line,
        buttons: [
          { title: "Confirm", payload: "rem_confirm" },
          { title: "Running late", payload: "rem_late" },
          { title: "Reschedule", payload: "rem_cancel" },
        ],
      }
    );
  }
  return { ok: true, slotId: upcoming.slotId };
}

export async function handleReminderChip(state: JourneyState, payload: string) {
  const upcoming = state.classes.find(
    (c) => c.slotId === state.reminderSlotId && c.status === "booked"
  );
  if (!upcoming) return false;

  if (payload === "rem_confirm") {
    state.reminderResponse = "confirmed";
    await sendText(
      state,
      `You're confirmed for the ${upcoming.className} tour on ${upcoming.dayName} at ${upcoming.timeLabel}. Your gate code and a dolly will be ready. See you at ${upcoming.room}.`
    );
    if (state.beatId === "reminder") completeBeat(state, "reminder");
    pushState(state);
    return true;
  }

  if (payload === "rem_late") {
    state.reminderResponse = "late";
    await sendText(
      state,
      `No problem — we'll hold your move-in appointment for 15 minutes past the start. Head straight to the gate; call the store line if the code hasn't reached you yet.`
    );
    pushState(state);
    return true;
  }

  if (payload === "rem_cancel") {
    state.reminderResponse = "cancelled";
    cancelSlot(state, upcoming.slotId);
    await sendText(
      state,
      `Rescheduled — ${upcoming.className} on ${upcoming.dayName} at ${upcoming.timeLabel} is released, no fee. Want me to find you another time this week?`
    );
    await fireEvent(state, EVENTS.CLASS_CANCELLED, describeSlot(slotById(upcoming.slotId)!));
    pushState(state);
    return true;
  }

  return false;
}

/* ------------------------------------------------------------------ *
 * Act 1 — Move-In Supply Shop
 * ------------------------------------------------------------------ */

export async function sendFuelBar(state: JourneyState) {
  const sid = await fuelTemplate();
  if (!sid) {
    await sendText(
      state,
      "Moving in? Reply BOXES, LOCK or WRAP and it'll be waiting at the Supply Shop."
    );
    return { ok: true };
  }
  await sendTemplate(
    state,
    sid,
    {},
    {
      kind: "carousel",
      body: "Moving in? Pre-order and it'll be waiting at the Supply Shop.",
      cards: DRINKS.map((drink) => ({
        title: drink.name,
        body: drink.body,
        media: drink.media,
        buttons: [{ title: "Order this", payload: drink.payload }],
      })),
    }
  );
  return { ok: true };
}

export async function handleDrinkChip(state: JourneyState, payload: string) {
  const drink = DRINKS.find((d) => d.payload === payload);
  if (!drink) return false;

  state.fuelOrder = {
    name: drink.name,
    calories: drink.calories,
    protein: drink.protein,
    orderedAt: new Date().toISOString(),
  };

  await sendText(
    state,
    `Ordered: ${drink.name}. It'll be on the counter at ${BRAND.fuelBar} under ${state.firstName} when you arrive. Charged to your CubeSmart account.`
  );

  await fireEvent(state, EVENTS.FUEL_ORDER, `${drink.name} — ready for pickup at the Supply Shop`);
  await patchMembershipTraits(state.profileId!, { usualSupplyOrder: drink.name });

  if (state.beatId === "fuel") completeBeat(state, "fuel");
  pushState(state);
  return true;
}

/* ------------------------------------------------------------------ *
 * Act 1 — Post move-in follow-up
 * ------------------------------------------------------------------ */

export async function sendPostClass(state: JourneyState) {
  const attended =
    state.classes.find((c) => c.slotId === state.reminderSlotId) ||
    state.classes.find((c) => c.status === "booked");
  if (!attended) return { ok: false, error: "No move-in to follow up on." };

  attended.status = "attended";

  const recap = `Welcome in, ${state.firstName}. Your ${attended.className} tour is complete — gate code activated, and ${attended.room} is ready to go. That's your first unit at ${BRAND.studio} in the books.`;

  const sid = await postClassTemplate();
  if (!sid) {
    await sendText(state, `${recap}\n\nHow did ${attended.instructor.split(" ")[0]} do getting you set up? Reply 1-5.`);
  } else {
    await sendTemplate(
      state,
      sid,
      { "1": recap, "2": attended.instructor.split(" ")[0] },
      {
        kind: "card",
        body: `${recap}\n\nHow did ${attended.instructor.split(" ")[0]} do getting you set up?`,
        buttons: [
          { title: "★☆☆☆☆", payload: "rate_1" },
          { title: "★★☆☆☆", payload: "rate_2" },
          { title: "★★★☆☆", payload: "rate_3" },
          { title: "★★★★☆", payload: "rate_4" },
          { title: "★★★★★", payload: "rate_5" },
          { title: "Reserve another unit", payload: "rebook_same" },
        ],
      }
    );
  }
  pushState(state);
  return { ok: true };
}

export async function handleRatingChip(state: JourneyState, payload: string) {
  if (payload === "rebook_same") {
    const last =
      state.classes.find((c) => c.status === "attended") || state.classes[0];
    if (!last) return false;
    const nextWeekSameSlot = slotsForDate(addDaysISO(last.dateISO, 7)).find(
      (s) => s.time === slotById(last.slotId)?.time
    );
    if (nextWeekSameSlot) {
      state.bookingRound = 2;
      await bookClass(state, nextWeekSameSlot.id);
    }
    return true;
  }

  const match = /^rate_([1-5])$/.exec(payload);
  if (!match) return false;

  const rating = Number(match[1]);
  state.instructorRating = rating;

  const attended =
    state.classes.find((c) => c.status === "attended") || state.classes[0];
  const specialist = attended ? attended.instructor.split(" ")[0] : "your move-in specialist";

  await sendText(
    state,
    rating >= 4
      ? `${"★".repeat(rating)} — thank you. ${specialist} will see that. We'll keep an eye out for move-in tours with ${specialist} when we suggest times.`
      : `${"★".repeat(rating)} — thanks for being honest. The store manager at ${BRAND.studio} will follow up with you directly.`
  );

  await patchMembershipTraits(state.profileId!, {
    lastInstructorRating: `${rating}/5 for ${attended?.instructor ?? "the move-in specialist"}`,
  });

  if (state.beatId === "post-class") {
    state.bookingRound = 2;
    completeBeat(state, "post-class");
  }
  pushState(state);
  return true;
}

/* ------------------------------------------------------------------ *
 * Act 2 — Slot offers and resizing
 * ------------------------------------------------------------------ */

export function openSlotsForDay(dayName: string, afterDateISO?: string): ClassSlot[] {
  const from = afterDateISO ?? new Date().toISOString().slice(0, 10);
  for (let offset = 0; offset <= 14; offset++) {
    const candidate = addDaysISO(from, offset);
    const slots = slotsForDate(candidate);
    if (
      slots.length &&
      slots[0].dayName.toLowerCase() === dayName.toLowerCase() &&
      candidate > from
    ) {
      return slots;
    }
  }
  return [];
}

export async function offerSlots(state: JourneyState, dayName: string) {
  const from = state.rebook?.fromSlotId?.slice(0, 10);
  const slots = openSlotsForDay(dayName, from);
  if (!slots.length) return { ok: false, error: `No ${dayName} move-in times on the schedule.` };

  state.rebook = { ...(state.rebook || {}), day: dayName, offeredSlotIds: slots.map((s) => s.id) };

  const intro = `Here's what's still open ${slots[0].dayName}, ${slots[0].shortDate} at ${BRAND.studio}:`;
  const sid = await slotPickerTemplate();

  const titles = slots.map((s) => `${s.timeLabel} ${s.className}`.slice(0, 20));

  if (!sid) {
    await sendText(state, `${intro}\n${titles.map((t, i) => `${i + 1}. ${t}`).join("\n")}`);
  } else {
    const variables: Record<string, string> = { "1": intro };
    slots.forEach((slot, i) => {
      variables[String(2 + i * 2)] = titles[i];
      variables[String(3 + i * 2)] = `slot_${slot.id}`;
    });
    await sendTemplate(state, sid, variables, {
      kind: "card",
      body: intro,
      buttons: slots.map((slot, i) => ({
        title: titles[i],
        payload: `slot_${slot.id}`,
      })),
    });
  }

  pushState(state);
  return { ok: true, slots };
}

export async function rebookTo(state: JourneyState, slotId: string) {
  const slot = slotById(slotId);
  if (!slot) return { ok: false, error: "That time isn't on the schedule." };

  const fromId = state.rebook?.fromSlotId;
  let cancelled: BookedClass | undefined;
  if (fromId) {
    cancelled = cancelSlot(state, fromId);
    if (cancelled) {
      await fireEvent(
        state,
        EVENTS.CLASS_CANCELLED,
        `${cancelled.className} — ${cancelled.dayName}, ${cancelled.shortDate} at ${cancelled.timeLabel}`
      );
    }
  }

  bookSlot(state, slot);
  state.rebook = { ...(state.rebook || {}), toSlotId: slot.id };

  await sendText(
    state,
    `Done — you're moved to ${slot.className} with ${shortInstructor(slot.instructor)} on ${slot.dayName}, ${slot.shortDate} at ${slot.timeLabel}. ${
      cancelled ? `${cancelled.dayName} is released, no fee. ` : ""
    }See you at ${slot.room}.`
  );

  await fireEvent(state, EVENTS.CLASS_BOOKED, describeSlot(slot));
  await patchMembershipTraits(state.profileId!, { lastClassBooked: describeSlot(slot) });

  if (state.beatId === "ai-rebook") completeBeat(state, "ai-rebook");
  pushState(state);
  return { ok: true };
}

/* ------------------------------------------------------------------ *
 * Act 3 — Extended after-hours gate access
 * ------------------------------------------------------------------ */

export async function pauseMembership(
  state: JourneyState,
  startISO: string,
  days = 30
) {
  const endISO = addDaysISO(startISO, days);
  state.membership.status = "on-hold";
  state.membership.holdStart = startISO;
  state.membership.holdEnd = endISO;
  state.membership.holdDays = days;

  await patchMembershipTraits(state.profileId!, {
    membershipStatus: "extended-access",
    holdStartDate: startISO,
    holdEndDate: endISO,
  });

  await fireEvent(
    state,
    EVENTS.MEMBERSHIP_PAUSED,
    `${days}-day extended gate access, ${longDate(startISO)} through ${longDate(endISO)}`
  );

  pushState(state);
  return { startISO, endISO, days };
}

export async function sendHoldConfirmation(state: JourneyState) {
  const { holdStart, holdEnd } = state.membership;
  if (!holdStart || !holdEnd) return { ok: false };
  await sendText(
    state,
    `Confirmed, ${state.firstName} — your gate access at ${BRAND.studio} has been reset with a fresh code, good through ${longDate(
      holdEnd
    )}. Standard rent still applies and nothing changes with your unit. Show this text at the gate keypad if you need it again tonight.`
  );
  if (state.beatId === "voice-hold") completeBeat(state, "voice-hold");
  pushState(state);
  return { ok: true };
}

/* ------------------------------------------------------------------ *
 * Act 4 — Expired card + escalation
 * ------------------------------------------------------------------ */

export async function flagExpiredPayment(state: JourneyState) {
  state.membership.paymentStatus = "expired";
  state.membership.cardExpiry = "09/26";
  state.membership.failedChargeAmount = "$149.00";
  state.membership.failedChargeAt = new Date().toISOString();

  await patchMembershipTraits(state.profileId!, {
    paymentStatus: "expired",
    cardOnFile: `Visa •••• ${state.membership.cardLast4} exp ${state.membership.cardExpiry} (expired)`,
  });

  addTranscript(
    state,
    "system",
    `Autopay declined — Visa •••• ${state.membership.cardLast4}, expired ${state.membership.cardExpiry}. This month's rent charge of ${state.membership.failedChargeAmount} could not be processed.`
  );

  // Deliberately does NOT advance the beat — she is still on the call, and the
  // story only moves to the desk once the transfer actually happens.
  pushState(state);
  return { ok: true };
}

/**
 * Hand the live call to a real human in Twilio Flex.
 *
 * This performs an actual call redirect into the account's Flex TaskRouter
 * workflow with the tenant's full context on the task attributes.
 */
export async function escalateToDesk(
  state: JourneyState,
  reason: string,
  summary: string
) {
  state.escalation = {
    reason,
    summary,
    createdAt: new Date().toISOString(),
  };

  const result = await transferCallToFlex(state, reason, summary);

  if (result.ok) {
    addTranscript(
      state,
      "system",
      `Live call handed to Twilio Flex — ${reason}. Task created in the ${BRAND.studio} workflow with her Unified Profile attached.`
    );
  } else {
    state.flex = {
      ...(state.flex ?? {}),
      transferred: false,
      error: result.error,
    };
    addTranscript(
      state,
      "system",
      `Flex handoff could not be completed — ${result.error ?? "unknown error"}.`
    );
  }

  await fireEvent(state, EVENTS.FLEX_ESCALATION, reason);

  // Land on the Flex beat and stay there. The story only moves on to the save
  // once a real agent has actually accepted the task.
  if (state.beatId === "voice-callback") completeBeat(state, "voice-callback");
  pushState(state);
  return result;
}

/* ------------------------------------------------------------------ *
 * Act 4 step 13 — the save actually lands
 * ------------------------------------------------------------------ */

/**
 * Record the save the store team made: the new card, the reinstated lease,
 * and the offer the Next Best Action operator recommended mid-call.
 *
 * The risk threshold event is deliberately NOT fired here. That one is written
 * by the operators while she is still talking — this step only records what the
 * human did with it.
 */
export async function completeSave(state: JourneyState) {
  const cardLast4 = "8821";
  const cardExpiry = "11/29";

  state.membership.status = "active";
  state.membership.paymentStatus = "current";
  state.membership.cardLast4 = cardLast4;
  state.membership.cardExpiry = cardExpiry;
  state.membership.failedChargeAmount = undefined;
  state.membership.failedChargeAt = undefined;

  state.save = {
    offer: SAVE_OFFER.label,
    classCredit: SAVE_OFFER.classCredit,
    coaching: SAVE_OFFER.coaching,
    cardLast4,
    cardExpiry,
    completedAt: new Date().toISOString(),
  };

  await patchMembershipTraits(state.profileId!, {
    membershipStatus: "active",
    paymentStatus: "current",
    cardOnFile: `Visa •••• ${cardLast4} exp ${cardExpiry}`,
    saveOfferApplied: SAVE_OFFER.label,
    classCreditBalance: "1",
  });

  addTranscript(
    state,
    "system",
    `Store team updated the card on file to Visa •••• ${cardLast4} and reinstated the lease. Save applied: ${SAVE_OFFER.label}.`
  );

  await fireEvent(
    state,
    EVENTS.MEMBERSHIP_REACTIVATED,
    `Autopay recovered and card updated at the store. Save applied: ${SAVE_OFFER.label.toLowerCase()}`
  );

  await sendText(
    state,
    `All set, ${state.firstName} — your CubeSmart lease is active again and the new card is on file. We've also applied 20% off your rent for the next 3 months, on us. Reserve packing supplies anytime.`
  );

  state.callStatus = "ended";
  if (state.beatId === "save") completeBeat(state, "save");
  pushState(state);
  return { ok: true as const };
}
