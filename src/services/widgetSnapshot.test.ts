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

    const snapshot = buildWidgetSnapshot("patient-123", "Mom", events, reminders as any);

    expect(snapshot.patientId).toBe("patient-123");
    expect(snapshot.patientName).toBe("Mom");
    expect(snapshot.checklist).toEqual([
      { id: "rem-1", label: "Use restroom", completed: false },
      { id: "rem-2", label: "Take Adderall", completed: true },
    ]);
    expect(snapshot.appointments).toHaveLength(1);
    expect(snapshot.appointments[0]).toMatchObject({ id: "evt-1", title: "Dr. Smith" });
    expect(snapshot.appointments[0].time).toMatch(/\d{1,2}:\d{2}\s?(AM|PM)/);
  });

  it("produces an empty checklist and appointments array when there is nothing today", () => {
    const snapshot = buildWidgetSnapshot("patient-123", "Mom", [], []);
    expect(snapshot.checklist).toEqual([]);
    expect(snapshot.appointments).toEqual([]);
  });
});
