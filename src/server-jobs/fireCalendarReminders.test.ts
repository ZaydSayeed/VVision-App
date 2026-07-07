import { describe, it, expect, vi } from "vitest";
import { fireCalendarReminders } from "./fireCalendarReminders";

vi.mock("../server-core/push", () => ({
  getCaregiverPushTokens: vi.fn().mockResolvedValue(["ExponentPushToken[caregiver]"]),
  getPatientPushToken: vi.fn().mockResolvedValue("ExponentPushToken[patient]"),
  sendExpoPush: vi.fn().mockResolvedValue([]),
}));

describe("fireCalendarReminders", () => {
  it("notifies for an event starting within the lead window and marks it notified", async () => {
    const now = new Date("2026-07-10T12:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const doc = {
      _id: "event-1",
      patientId: "patient-123",
      title: "Dr. Smith checkup",
      startAt: "2026-07-10T12:20:00.000Z", // 20 min from now, inside default 30-min lead
      endAt: "2026-07-10T12:50:00.000Z",
      recurrenceRule: null,
      notifiedOccurrences: [],
    };
    const updateOne = vi.fn().mockResolvedValue({});
    const db = {
      collection: (name: string) => {
        if (name === "calendar_events") return { find: () => ({ toArray: () => Promise.resolve([doc]) }), updateOne };
        throw new Error("unexpected collection " + name);
      },
    } as any;

    const count = await fireCalendarReminders(db);

    expect(count).toBe(1);
    expect(updateOne).toHaveBeenCalledWith(
      { _id: "event-1" },
      { $addToSet: { notifiedOccurrences: "event-1:2026-07-10T12:20:00.000Z" } }
    );
    vi.useRealTimers();
  });

  it("does not re-notify an occurrence already in notifiedOccurrences", async () => {
    const now = new Date("2026-07-10T12:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const doc = {
      _id: "event-1",
      patientId: "patient-123",
      title: "Dr. Smith checkup",
      startAt: "2026-07-10T12:20:00.000Z",
      endAt: "2026-07-10T12:50:00.000Z",
      recurrenceRule: null,
      notifiedOccurrences: ["event-1:2026-07-10T12:20:00.000Z"],
    };
    const db = {
      collection: (name: string) => ({ find: () => ({ toArray: () => Promise.resolve([doc]) }), updateOne: vi.fn() }),
    } as any;

    const count = await fireCalendarReminders(db);
    expect(count).toBe(0);
    vi.useRealTimers();
  });
});
