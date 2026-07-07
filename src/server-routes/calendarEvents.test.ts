import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

vi.mock("../server-core/security", () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.auth = { userId: "user-caregiver" };
    next();
  },
}));
vi.mock("../server-core/seatResolver", () => ({
  requirePatientAccess: (req: any, _res: any, next: any) => {
    req.seat = { userId: "user-caregiver", patientId: req.params.patientId, role: "primary_caregiver" };
    next();
  },
}));

const mockCol = {
  insertOne: vi.fn().mockResolvedValue({ insertedId: { toString: () => "event-1" } }),
};
vi.mock("../server-core/database", () => ({
  getDb: () => ({ collection: () => mockCol }),
}));

import calendarEventsRouter from "./calendarEvents";
const app = express();
app.use(express.json());
app.use("/api/profiles", calendarEventsRouter);

describe("POST /api/profiles/:patientId/calendar-events", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a one-off event and returns its id", async () => {
    const res = await request(app)
      .post("/api/profiles/patient-123/calendar-events")
      .send({
        title: "Dr. Smith checkup",
        category: "medical",
        startAt: "2026-07-15T15:00:00.000Z",
        endAt: "2026-07-15T15:30:00.000Z",
      });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe("event-1");
    expect(mockCol.insertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        patientId: "patient-123",
        title: "Dr. Smith checkup",
        category: "medical",
        createdBy: "user-caregiver",
        completedDates: [],
      })
    );
  });

  it("rejects an invalid category", async () => {
    const res = await request(app)
      .post("/api/profiles/patient-123/calendar-events")
      .send({ title: "X", category: "not-a-real-category", startAt: "2026-07-15T15:00:00.000Z", endAt: "2026-07-15T15:30:00.000Z" });
    expect(res.status).toBe(400);
  });

  it("rejects a missing title", async () => {
    const res = await request(app)
      .post("/api/profiles/patient-123/calendar-events")
      .send({ category: "medical", startAt: "2026-07-15T15:00:00.000Z", endAt: "2026-07-15T15:30:00.000Z" });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/profiles/:patientId/calendar-events", () => {
  beforeEach(() => vi.clearAllMocks());

  it("expands a recurring event into one entry per occurrence", async () => {
    mockCol.find = vi.fn().mockReturnValue({
      toArray: vi.fn().mockResolvedValue([
        {
          _id: { toString: () => "event-1" },
          patientId: "patient-123",
          title: "Morning Adderall",
          category: "medication",
          startAt: "2026-07-10T13:00:00.000Z",
          endAt: "2026-07-10T13:05:00.000Z",
          recurrenceRule: "FREQ=DAILY",
          notes: null,
          createdBy: "user-caregiver",
          completedDates: ["2026-07-10"],
        },
      ]),
    });

    const res = await request(app)
      .get("/api/profiles/patient-123/calendar-events")
      .query({ from: "2026-07-10T00:00:00.000Z", to: "2026-07-12T00:00:00.000Z" });

    expect(res.status).toBe(200);
    expect(res.body.events).toHaveLength(2);
    expect(res.body.events[0]).toMatchObject({ occurrenceAt: "2026-07-10T13:00:00.000Z", completed: true });
    expect(res.body.events[1]).toMatchObject({ occurrenceAt: "2026-07-11T13:00:00.000Z", completed: false });
  });
});
