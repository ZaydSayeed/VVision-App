import { Frequency, rrulestr } from "rrule";

// This app only ever generates two recurrence shapes (see src/server-core/recurrence.ts:
// buildDailyRule() -> FREQ=DAILY, buildWeeklyRule() -> FREQ=WEEKLY;BYDAY=...). This module
// converts those stored iCal RRULE strings into the shape expo-calendar's
// createEventAsync/updateEventAsync expect, which is NOT a raw RRULE string but its own
// RecurrenceRule object (see node_modules/expo-calendar/build/Calendar.d.ts).
//
// Kept free of any "expo-calendar" import (even type-only) so it can be unit tested under
// vitest without pulling in react-native, which expo-calendar transitively imports and which
// vitest's transformer cannot parse (Flow syntax). The literal string/number values below are
// chosen to exactly match expo-calendar's own enum values at runtime:
//   Frequency.DAILY = "daily", Frequency.WEEKLY = "weekly"
//   DayOfTheWeek: Sunday = 1, Monday = 2, Tuesday = 3, Wednesday = 4, Thursday = 5, Friday = 6, Saturday = 7

export type ExpoDayOfWeek = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type ExpoRecurrenceRule = {
  frequency: "daily" | "weekly";
  daysOfTheWeek?: { dayOfTheWeek: ExpoDayOfWeek }[];
};

// rrule's own Weekday numbering (verified in node_modules/rrule/dist/esm/rrule.js):
//   RRule.MO = new Weekday(0), TU = 1, WE = 2, TH = 3, FR = 4, SA = 5, SU = 6
// expo-calendar's DayOfTheWeek numbering: Sunday = 1 .. Saturday = 7
// So: expoDay = ((rruleWeekday + 1) % 7) + 1
//   MO(0) -> 2 (Monday), TU(1) -> 3 (Tuesday), ..., SA(5) -> 7 (Saturday), SU(6) -> 1 (Sunday)
function rruleWeekdayToExpoDay(rruleWeekday: number): ExpoDayOfWeek {
  return (((rruleWeekday + 1) % 7) + 1) as ExpoDayOfWeek;
}

export function toExpoCalendarRecurrenceRule(
  rrule: string | null | undefined
): ExpoRecurrenceRule | undefined {
  if (!rrule) return undefined;

  let parsed;
  try {
    parsed = rrulestr(rrule);
  } catch (err) {
    console.warn("[appleCalendarSync] failed to parse recurrence rule, syncing as one-off:", err);
    return undefined;
  }

  const freq = parsed.options.freq;

  if (freq === Frequency.WEEKLY) {
    const byweekday = parsed.options.byweekday ?? [];
    const daysOfTheWeek = byweekday.map((wd: any) =>
      rruleWeekdayToExpoDay(typeof wd === "number" ? wd : wd.weekday)
    );
    return {
      frequency: "weekly",
      ...(daysOfTheWeek.length > 0 ? { daysOfTheWeek: daysOfTheWeek.map((d) => ({ dayOfTheWeek: d })) } : {}),
    };
  }

  if (freq === Frequency.DAILY) {
    return { frequency: "daily" };
  }

  // This app never generates MONTHLY/YEARLY/etc. rules. Rather than throwing on an
  // unrecognized frequency, fall back to daily so the event still syncs (with a warning),
  // instead of silently dropping recurrence entirely.
  console.warn(`[appleCalendarSync] unsupported recurrence frequency (${freq}), falling back to daily`);
  return { frequency: "daily" };
}
