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
        if (name === "calendar_events") {
          return {
            find: () => ({ toArray: () => Promise.resolve([]) }),
            insertMany: (docs: any[]) => { inserted.push(...docs); return Promise.resolve({}); },
          };
        }
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
      migratedFrom: "v1",
      recurrenceRule: null,
      completedDates: [],
    });
  });

  it("returns 0 and inserts nothing when there are no visits", async () => {
    const db = {
      collection: (name: string) => {
        if (name === "visits") return { find: () => ({ toArray: () => Promise.resolve([]) }) };
        if (name === "calendar_events") return { find: () => ({ toArray: () => Promise.resolve([]) }), insertMany: vi.fn() };
        throw new Error("unexpected collection " + name);
      },
    } as any;

    const count = await migrateVisitsToCalendarEvents(db);
    expect(count).toBe(0);
  });

  it("is idempotent: a second run with the same visits inserts nothing new", async () => {
    const visits = [
      { _id: "v1", patientId: "patient-123", providerName: "Dr. Smith", providerRole: "Neurologist", scheduledFor: "2026-07-15T15:00:00.000Z", notes: "Bring meds list" },
      { _id: "v2", patientId: "patient-123", providerName: "Dr. Jones", scheduledFor: "2026-08-01T10:00:00.000Z", notes: null },
    ];
    // Simulate that v1 was already migrated in a prior run.
    const existingMigrated = [{ migratedFrom: "v1" }];
    const insertManyMock = vi.fn().mockResolvedValue({});
    const db = {
      collection: (name: string) => {
        if (name === "visits") return { find: () => ({ toArray: () => Promise.resolve(visits) }) };
        if (name === "calendar_events") {
          return {
            find: () => ({ toArray: () => Promise.resolve(existingMigrated) }),
            insertMany: insertManyMock,
          };
        }
        throw new Error("unexpected collection " + name);
      },
    } as any;

    const count = await migrateVisitsToCalendarEvents(db);

    expect(count).toBe(1);
    expect(insertManyMock).toHaveBeenCalledTimes(1);
    expect(insertManyMock.mock.calls[0][0]).toHaveLength(1);
    expect(insertManyMock.mock.calls[0][0][0]).toMatchObject({ migratedFrom: "v2" });
  });

  it("returns 0 and skips insertMany when every visit was already migrated", async () => {
    const visits = [
      { _id: "v1", patientId: "patient-123", providerName: "Dr. Smith", scheduledFor: "2026-07-15T15:00:00.000Z", notes: null },
    ];
    const existingMigrated = [{ migratedFrom: "v1" }];
    const insertManyMock = vi.fn();
    const db = {
      collection: (name: string) => {
        if (name === "visits") return { find: () => ({ toArray: () => Promise.resolve(visits) }) };
        if (name === "calendar_events") {
          return {
            find: () => ({ toArray: () => Promise.resolve(existingMigrated) }),
            insertMany: insertManyMock,
          };
        }
        throw new Error("unexpected collection " + name);
      },
    } as any;

    const count = await migrateVisitsToCalendarEvents(db);
    expect(count).toBe(0);
    expect(insertManyMock).not.toHaveBeenCalled();
  });
});
