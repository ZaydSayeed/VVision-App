import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

vi.mock("../server-core/security", () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.auth = { userId: "user-abc" };
    next();
  },
}));
vi.mock("../server-core/patientResolver", () => ({
  resolvePatientId: (req: any, _res: any, next: any) => {
    req.patientId = "patient-123";
    next();
  },
}));

const mockDoc = { _id: "id1", patient_id: "patient-123", mood: "happy", date: "2026-05-08", created_at: "2026-05-08T10:00:00.000Z" };
const mockCol = {
  findOne: vi.fn().mockResolvedValue(null),
  insertOne: vi.fn().mockResolvedValue({ insertedId: "id1" }),
  find: vi.fn().mockReturnValue({ sort: vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([mockDoc]) }) }) }),
};
vi.mock("../server-core/database", () => ({
  getDb: () => ({ collection: () => mockCol }),
}));

import moodRouter from "./mood";

const app = express();
app.use(express.json());
app.use("/api/mood", moodRouter);

describe("POST /api/mood", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a mood entry and returns 201", async () => {
    const res = await request(app)
      .post("/api/mood")
      .send({ mood: "happy" });
    expect(res.status).toBe(201);
    expect(res.body.mood).toBe("happy");
  });

  it("returns 409 when already submitted today", async () => {
    mockCol.findOne.mockResolvedValueOnce(mockDoc);
    const res = await request(app)
      .post("/api/mood")
      .send({ mood: "tired" });
    expect(res.status).toBe(409);
  });

  it("returns 400 for invalid mood value", async () => {
    const res = await request(app)
      .post("/api/mood")
      .send({ mood: "angry" });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/mood", () => {
  it("returns array of recent moods", async () => {
    const res = await request(app).get("/api/mood");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].mood).toBe("happy");
  });
});
