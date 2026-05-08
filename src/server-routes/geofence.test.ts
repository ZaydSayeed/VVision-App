// src/server-routes/geofence.test.ts
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
  requireSeat: (_req: any, _res: any, next: any) => next(),
}));

const mockDoc = { patientId: "patient-123", lat: 32.9, lng: -96.8, radiusMeters: 500, name: "Home", updatedAt: new Date() };
const mockCol = {
  findOne: vi.fn().mockResolvedValue(mockDoc),
  replaceOne: vi.fn().mockResolvedValue({}),
};
vi.mock("../server-core/database", () => ({
  getDb: () => ({ collection: () => mockCol }),
}));

import geofenceRouter from "./geofence";
const app = express();
app.use(express.json());
app.use("/api/profiles/:patientId/geofence", geofenceRouter);

describe("GET /api/profiles/:patientId/geofence", () => {
  it("returns existing geofence", async () => {
    const res = await request(app).get("/api/profiles/patient-123/geofence");
    expect(res.status).toBe(200);
    expect(res.body.lat).toBe(32.9);
    expect(res.body.radiusMeters).toBe(500);
  });

  it("returns 404 when no geofence set", async () => {
    mockCol.findOne.mockResolvedValueOnce(null);
    const res = await request(app).get("/api/profiles/patient-123/geofence");
    expect(res.status).toBe(404);
  });
});

describe("PUT /api/profiles/:patientId/geofence", () => {
  beforeEach(() => vi.clearAllMocks());

  it("upserts geofence and returns 200", async () => {
    const res = await request(app)
      .put("/api/profiles/patient-123/geofence")
      .send({ lat: 32.9, lng: -96.8, radiusMeters: 400, name: "Home" });
    expect(res.status).toBe(200);
    expect(res.body.lat).toBe(32.9);
  });

  it("returns 400 for invalid lat/lng", async () => {
    const res = await request(app)
      .put("/api/profiles/patient-123/geofence")
      .send({ lat: 999, lng: -96.8, radiusMeters: 400 });
    expect(res.status).toBe(400);
  });
});
