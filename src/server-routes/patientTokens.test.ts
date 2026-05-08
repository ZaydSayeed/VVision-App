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

const mockCol = { updateOne: vi.fn().mockResolvedValue({}) };
vi.mock("../server-core/database", () => ({
  getDb: () => ({ collection: () => mockCol }),
}));

import patientTokensRouter from "./patientTokens";

const app = express();
app.use(express.json());
app.use("/api/notifications", patientTokensRouter);

describe("POST /api/notifications/register-patient-token", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 200 and upserts token", async () => {
    const res = await request(app)
      .post("/api/notifications/register-patient-token")
      .send({ expoPushToken: "ExponentPushToken[abc123]" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(mockCol.updateOne).toHaveBeenCalledWith(
      { userId: "user-abc" },
      expect.objectContaining({
        $set: expect.objectContaining({
          userId: "user-abc",
          patientId: "patient-123",
          expoPushToken: "ExponentPushToken[abc123]",
        }),
      }),
      { upsert: true }
    );
  });

  it("returns 400 when token missing", async () => {
    const res = await request(app)
      .post("/api/notifications/register-patient-token")
      .send({});
    expect(res.status).toBe(400);
  });

  it("returns 400 for non-Expo token format", async () => {
    const res = await request(app)
      .post("/api/notifications/register-patient-token")
      .send({ expoPushToken: "not-a-valid-expo-token" });
    expect(res.status).toBe(400);
  });
});
