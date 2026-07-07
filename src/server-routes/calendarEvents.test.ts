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

const mockCol: {
  insertOne: ReturnType<typeof vi.fn>;
  find: ReturnType<typeof vi.fn>;
  findOne: ReturnType<typeof vi.fn>;
  updateOne: ReturnType<typeof vi.fn>;
  deleteOne: ReturnType<typeof vi.fn>;
} = {
  insertOne: vi.fn().mockResolvedValue({ insertedId: { toString: () => "event-1" } }),
  find: vi.fn(),
  findOne: vi.fn(),
  updateOne: vi.fn(),
  deleteOne: vi.fn(),
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

  it("returns a non-recurring one-off event with matching startAt/endAt", async () => {
    mockCol.find = vi.fn().mockReturnValue({
      toArray: vi.fn().mockResolvedValue([
        {
          _id: { toString: () => "event-2" },
          patientId: "patient-123",
          title: "Dr. Smith checkup",
          category: "medical",
          startAt: "2026-07-15T15:00:00.000Z",
          endAt: "2026-07-15T15:30:00.000Z",
          recurrenceRule: null,
          notes: "Routine checkup",
          createdBy: "user-caregiver",
          completedDates: [],
        },
      ]),
    });

    const res = await request(app)
      .get("/api/profiles/patient-123/calendar-events")
      .query({ from: "2026-07-15T00:00:00.000Z", to: "2026-07-16T00:00:00.000Z" });

    expect(res.status).toBe(200);
    expect(res.body.events).toHaveLength(1);
    expect(res.body.events[0]).toMatchObject({
      id: "event-2",
      title: "Dr. Smith checkup",
      occurrenceAt: "2026-07-15T15:00:00.000Z",
      endAt: "2026-07-15T15:30:00.000Z",
      completed: false,
      recurrenceRule: null,
    });
  });

  it("excludes docs with zero matching occurrences in the requested range", async () => {
    mockCol.find = vi.fn().mockReturnValue({
      toArray: vi.fn().mockResolvedValue([
        {
          _id: { toString: () => "event-3" },
          patientId: "patient-123",
          title: "Past appointment",
          category: "medical",
          startAt: "2026-07-01T10:00:00.000Z",
          endAt: "2026-07-01T10:30:00.000Z",
          recurrenceRule: null,
          notes: null,
          createdBy: "user-caregiver",
          completedDates: [],
        },
      ]),
    });

    const res = await request(app)
      .get("/api/profiles/patient-123/calendar-events")
      .query({ from: "2026-07-15T00:00:00.000Z", to: "2026-07-20T00:00:00.000Z" });

    expect(res.status).toBe(200);
    expect(res.body.events).toHaveLength(0);
  });

  it("merges and sorts multiple docs chronologically", async () => {
    mockCol.find = vi.fn().mockReturnValue({
      toArray: vi.fn().mockResolvedValue([
        {
          _id: { toString: () => "event-4" },
          patientId: "patient-123",
          title: "Evening medication",
          category: "medication",
          startAt: "2026-07-15T19:00:00.000Z",
          endAt: "2026-07-15T19:05:00.000Z",
          recurrenceRule: null,
          notes: null,
          createdBy: "user-caregiver",
          completedDates: [],
        },
        {
          _id: { toString: () => "event-5" },
          patientId: "patient-123",
          title: "Morning medication",
          category: "medication",
          startAt: "2026-07-15T08:00:00.000Z",
          endAt: "2026-07-15T08:05:00.000Z",
          recurrenceRule: null,
          notes: null,
          createdBy: "user-caregiver",
          completedDates: [],
        },
      ]),
    });

    const res = await request(app)
      .get("/api/profiles/patient-123/calendar-events")
      .query({ from: "2026-07-15T00:00:00.000Z", to: "2026-07-16T00:00:00.000Z" });

    expect(res.status).toBe(200);
    expect(res.body.events).toHaveLength(2);
    expect(res.body.events[0]).toMatchObject({
      occurrenceAt: "2026-07-15T08:00:00.000Z",
      title: "Morning medication",
    });
    expect(res.body.events[1]).toMatchObject({
      occurrenceAt: "2026-07-15T19:00:00.000Z",
      title: "Evening medication",
    });
  });

  it("returns 400 when from/to query params are malformed dates", async () => {
    const res = await request(app)
      .get("/api/profiles/patient-123/calendar-events")
      .query({ from: "not-a-date", to: "2026-07-20T00:00:00.000Z" });

    expect(res.status).toBe(400);
    expect(res.body.detail).toBe("Invalid from/to date");
  });

  it("returns 400 when to query param is a malformed date", async () => {
    const res = await request(app)
      .get("/api/profiles/patient-123/calendar-events")
      .query({ from: "2026-07-10T00:00:00.000Z", to: "invalid-date" });

    expect(res.status).toBe(400);
    expect(res.body.detail).toBe("Invalid from/to date");
  });
});

describe("PATCH /api/profiles/:patientId/calendar-events/:id", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates an event the caller created", async () => {
    const { ObjectId } = await import("mongodb");
    const id = new ObjectId().toString();
    mockCol.findOne = vi.fn().mockResolvedValue({ _id: new ObjectId(id), patientId: "patient-123", createdBy: "user-caregiver" });
    mockCol.updateOne = vi.fn().mockResolvedValue({ matchedCount: 1 });

    const res = await request(app)
      .patch(`/api/profiles/patient-123/calendar-events/${id}`)
      .send({ title: "Updated title" });

    expect(res.status).toBe(200);
    expect(mockCol.updateOne).toHaveBeenCalledWith(
      { _id: expect.anything() },
      { $set: { title: "Updated title" } }
    );
  });

  it("returns 403 when the caller did not create the event", async () => {
    const { ObjectId } = await import("mongodb");
    const id = new ObjectId().toString();
    mockCol.findOne = vi.fn().mockResolvedValue({ _id: new ObjectId(id), patientId: "patient-123", createdBy: "someone-else" });

    const res = await request(app)
      .patch(`/api/profiles/patient-123/calendar-events/${id}`)
      .send({ title: "Updated title" });

    expect(res.status).toBe(403);
  });

  it("returns 404 when the event does not exist", async () => {
    const { ObjectId } = await import("mongodb");
    const id = new ObjectId().toString();
    mockCol.findOne = vi.fn().mockResolvedValue(null);

    const res = await request(app)
      .patch(`/api/profiles/patient-123/calendar-events/${id}`)
      .send({ title: "Updated title" });

    expect(res.status).toBe(404);
  });

  it("returns 404 when the id is malformed", async () => {
    const res = await request(app)
      .patch("/api/profiles/patient-123/calendar-events/not-a-valid-id")
      .send({ title: "Updated title" });

    expect(res.status).toBe(404);
    expect(res.body.detail).toBe("Event not found");
  });

  it("strips createdBy and patientId from update payload", async () => {
    const { ObjectId } = await import("mongodb");
    const id = new ObjectId().toString();
    mockCol.findOne = vi.fn().mockResolvedValue({ _id: new ObjectId(id), patientId: "patient-123", createdBy: "user-caregiver" });
    mockCol.updateOne = vi.fn().mockResolvedValue({ matchedCount: 1 });

    const res = await request(app)
      .patch(`/api/profiles/patient-123/calendar-events/${id}`)
      .send({
        title: "Updated title",
        createdBy: "someone-else",
        patientId: "different-patient",
      });

    expect(res.status).toBe(200);
    expect(mockCol.updateOne).toHaveBeenCalledWith(
      { _id: expect.anything() },
      { $set: { title: "Updated title" } }
    );
  });

  it("accepts an empty update body and calls updateOne with empty $set", async () => {
    const { ObjectId } = await import("mongodb");
    const id = new ObjectId().toString();
    mockCol.findOne = vi.fn().mockResolvedValue({ _id: new ObjectId(id), patientId: "patient-123", createdBy: "user-caregiver" });
    mockCol.updateOne = vi.fn().mockResolvedValue({ matchedCount: 1 });

    const res = await request(app)
      .patch(`/api/profiles/patient-123/calendar-events/${id}`)
      .send({});

    expect(res.status).toBe(200);
    expect(mockCol.updateOne).toHaveBeenCalledWith(
      { _id: expect.anything() },
      { $set: {} }
    );
  });

  it("clears an existing recurrence rule when recurrenceRule is explicitly null", async () => {
    const { ObjectId } = await import("mongodb");
    const id = new ObjectId().toString();
    mockCol.findOne = vi.fn().mockResolvedValue({
      _id: new ObjectId(id),
      patientId: "patient-123",
      createdBy: "user-caregiver",
      recurrenceRule: "FREQ=DAILY",
    });
    mockCol.updateOne = vi.fn().mockResolvedValue({ matchedCount: 1 });

    const res = await request(app)
      .patch(`/api/profiles/patient-123/calendar-events/${id}`)
      .send({ recurrenceRule: null });

    expect(res.status).toBe(200);
    expect(mockCol.updateOne).toHaveBeenCalledWith(
      { _id: expect.anything() },
      { $set: { recurrenceRule: null } }
    );
  });
});

describe("DELETE /api/profiles/:patientId/calendar-events/:id", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes an event the caller created", async () => {
    const { ObjectId } = await import("mongodb");
    const id = new ObjectId().toString();
    mockCol.findOne = vi.fn().mockResolvedValue({ _id: new ObjectId(id), patientId: "patient-123", createdBy: "user-caregiver" });
    mockCol.deleteOne = vi.fn().mockResolvedValue({ deletedCount: 1 });

    const res = await request(app).delete(`/api/profiles/patient-123/calendar-events/${id}`);
    expect(res.status).toBe(200);
    expect(mockCol.deleteOne).toHaveBeenCalled();
  });

  it("returns 403 when the caller did not create the event", async () => {
    const { ObjectId } = await import("mongodb");
    const id = new ObjectId().toString();
    mockCol.findOne = vi.fn().mockResolvedValue({ _id: new ObjectId(id), patientId: "patient-123", createdBy: "someone-else" });

    const res = await request(app).delete(`/api/profiles/patient-123/calendar-events/${id}`);
    expect(res.status).toBe(403);
  });

  it("returns 404 when the event does not exist", async () => {
    const { ObjectId } = await import("mongodb");
    const id = new ObjectId().toString();
    mockCol.findOne = vi.fn().mockResolvedValue(null);

    const res = await request(app).delete(`/api/profiles/patient-123/calendar-events/${id}`);
    expect(res.status).toBe(404);
    expect(res.body.detail).toBe("Event not found");
  });

  it("returns 404 when the id is malformed", async () => {
    const res = await request(app).delete("/api/profiles/patient-123/calendar-events/not-a-valid-id");
    expect(res.status).toBe(404);
    expect(res.body.detail).toBe("Event not found");
  });
});

describe("POST /api/profiles/:patientId/calendar-events/:id/complete", () => {
  beforeEach(() => vi.clearAllMocks());

  it("marks an occurrence complete regardless of who created it", async () => {
    const { ObjectId } = await import("mongodb");
    const id = new ObjectId().toString();
    mockCol.findOne = vi.fn().mockResolvedValue({ _id: new ObjectId(id), patientId: "patient-123", createdBy: "someone-else", completedDates: [] });
    mockCol.updateOne = vi.fn().mockResolvedValue({ matchedCount: 1 });

    const res = await request(app)
      .post(`/api/profiles/patient-123/calendar-events/${id}/complete`)
      .send({ date: "2026-07-10" });

    expect(res.status).toBe(200);
    expect(mockCol.updateOne).toHaveBeenCalledWith(
      { _id: expect.anything() },
      { $addToSet: { completedDates: "2026-07-10" } }
    );
  });

  it("returns 404 when the event does not exist", async () => {
    const { ObjectId } = await import("mongodb");
    const id = new ObjectId().toString();
    mockCol.findOne = vi.fn().mockResolvedValue(null);

    const res = await request(app)
      .post(`/api/profiles/patient-123/calendar-events/${id}/complete`)
      .send({ date: "2026-07-10" });

    expect(res.status).toBe(404);
    expect(res.body.detail).toBe("Event not found");
  });

  it("returns 404 when the id is malformed", async () => {
    const res = await request(app)
      .post("/api/profiles/patient-123/calendar-events/not-a-valid-id/complete")
      .send({ date: "2026-07-10" });

    expect(res.status).toBe(404);
    expect(res.body.detail).toBe("Event not found");
  });

  it("returns 400 when the date is malformed", async () => {
    const { ObjectId } = await import("mongodb");
    const id = new ObjectId().toString();

    const res = await request(app)
      .post(`/api/profiles/patient-123/calendar-events/${id}/complete`)
      .send({ date: "invalid-date" });

    expect(res.status).toBe(400);
  });
});
