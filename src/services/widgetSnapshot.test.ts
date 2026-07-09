import { describe, it, expect } from "vitest";
import { buildWidgetSnapshot } from "./widgetSnapshot";
import type { CalendarEventOccurrence } from "./calendarApi";

describe("buildWidgetSnapshot", () => {
  it("builds a checklist from reminders and an appointments list from calendar events", () => {
    const events: CalendarEventOccurrence[] = [
      {
        id: "evt-1", title: "Dr. Smith", category: "medical",
        startAt: "2026-07-10T15:00:00.000Z",
        occurrenceAt: "2026-07-10T15:00:00.000Z", endAt: "2026-07-10T15:30:00.000Z",
        notes: null, recurrenceRule: null, createdBy: "caregiver-1", completed: false,
      },
    ];
    const reminders = [
      { id: "rem-1", text: "Use restroom", completed_date: null },
      { id: "rem-2", text: "Take Adderall", completed_date: "2026-07-10" },
    ];
    const medications = [
      { id: "med-1", name: "Donepezil", dosage: "10mg", taken_date: null },
    ];

    const snapshot = buildWidgetSnapshot("patient-123", "Mom", events, reminders as any, medications as any);

    expect(snapshot.patientId).toBe("patient-123");
    expect(snapshot.patientName).toBe("Mom");
    expect(snapshot.checklist).toEqual([
      { id: "rem-1", label: "Use restroom", completed: false },
      { id: "rem-2", label: "Take Adderall", completed: true },
      { id: "med-1", label: "Take Donepezil (10mg)", completed: false },
    ]);
    expect(snapshot.appointments).toHaveLength(1);
    expect(snapshot.appointments[0]).toMatchObject({ id: "evt-1", title: "Dr. Smith" });
    expect(snapshot.appointments[0].time).toMatch(/\d{1,2}:\d{2}\s?(AM|PM)/);
  });

  it("produces an empty checklist and appointments array when there is nothing today", () => {
    const snapshot = buildWidgetSnapshot("patient-123", "Mom", [], [], []);
    expect(snapshot.checklist).toEqual([]);
    expect(snapshot.appointments).toEqual([]);
    expect(snapshot.monthEventDays).toEqual([]);
  });

  it("derives monthEventDays as sorted, deduplicated local-date strings from monthEvents", () => {
    const monthEvents: CalendarEventOccurrence[] = [
      {
        id: "evt-1", title: "Dr. Smith", category: "medical",
        startAt: "2026-07-15T15:00:00.000Z",
        occurrenceAt: "2026-07-15T15:00:00.000Z", endAt: "2026-07-15T15:30:00.000Z",
        notes: null, recurrenceRule: null, createdBy: "caregiver-1", completed: false,
      },
      {
        id: "evt-2", title: "Dentist", category: "medical",
        startAt: "2026-07-15T18:00:00.000Z",
        occurrenceAt: "2026-07-15T18:00:00.000Z", endAt: "2026-07-15T18:30:00.000Z",
        notes: null, recurrenceRule: null, createdBy: "caregiver-1", completed: false,
      },
      {
        id: "evt-3", title: "Physical Therapy", category: "medical",
        startAt: "2026-07-03T14:00:00.000Z",
        occurrenceAt: "2026-07-03T14:00:00.000Z", endAt: "2026-07-03T14:30:00.000Z",
        notes: null, recurrenceRule: null, createdBy: "caregiver-1", completed: false,
      },
    ];

    const snapshot = buildWidgetSnapshot("patient-123", "Mom", [], [], [], monthEvents);

    // Two same-day events (evt-1, evt-2) collapse to one date key; sorted ascending.
    expect(snapshot.monthEventDays).toEqual(["2026-07-03", "2026-07-15"]);
  });
});
