import { RRule, rrulestr } from "rrule";

const RRULE_WEEKDAYS = [RRule.SU, RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR, RRule.SA];

export function buildDailyRule(): string {
  return new RRule({ freq: RRule.DAILY }).toString();
}

export function buildWeeklyRule(daysOfWeek: number[]): string {
  return new RRule({
    freq: RRule.WEEKLY,
    byweekday: daysOfWeek.map((d) => RRULE_WEEKDAYS[d]),
  }).toString();
}

export function expandOccurrences(
  startAt: string,
  recurrenceRule: string | null,
  rangeStart: string,
  rangeEnd: string
): string[] {
  const start = new Date(startAt);
  const rangeStartDate = new Date(rangeStart);
  const rangeEndDate = new Date(rangeEnd);

  if (!recurrenceRule) {
    return start >= rangeStartDate && start < rangeEndDate ? [startAt] : [];
  }

  const rule = rrulestr(recurrenceRule, { dtstart: start });
  const occurrences = rule.between(rangeStartDate, rangeEndDate, true);
  return occurrences
    .filter((d) => d < rangeEndDate)
    .map((d) => d.toISOString());
}
