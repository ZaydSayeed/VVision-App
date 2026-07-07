import { describe, it, expect, vi } from "vitest";
import { migrateVisitsToCalendarEvents } from "./migrateVisitsToCalendarEvents";

describe("migrateVisitsToCalendarEvents", () => {
  it("converts each visit into a calendar_events document and returns the count", async () => {
    const visits = [
      { _id: "v1", patientId: "patient-123", providerName: "Dr. Smith", providerRole: "Neurologist", scheduledFor: "2026-07-15T15:00:00.000Z", notes: "Bring meds list" },
    ];
    const inserted: any[] = [];
    const db = {
      collection: (name: string) => {
        if (name === "visits") return { find: () => ({ toArray: () => Promise.resolve(visits) }) };
        if (name === "calendar_events") return { insertMany: (docs: any[]) => { inserted.push(...docs); return Promise.resolve({}); } };
        throw new Error("unexpected collection " + name);
      },
    } as any;

    const count = await migrateVisitsToCalendarEvents(db);

    expect(count).toBe(1);
    expect(inserted[0]).toMatchObject({
      patientId: "patient-123",
      title: "Dr. Smith",
      category: "medical",
      startAt: "2026-07-15T15:00:00.000Z",
      endAt: "2026-07-15T15:30:00.000Z",
      notes: "Neurologist — Bring meds list",
      createdBy: "migrated",
      recurrenceRule: null,
      completedDates: [],
    });
  });

  it("returns 0 and inserts nothing when there are no visits", async () => {
    const db = {
      collection: (name: string) => {
        if (name === "visits") return { find: () => ({ toArray: () => Promise.resolve([]) }) };
        if (name === "calendar_events") return { insertMany: vi.fn() };
        throw new Error("unexpected collection " + name);
      },
    } as any;

    const count = await migrateVisitsToCalendarEvents(db);
    expect(count).toBe(0);
  });
});
