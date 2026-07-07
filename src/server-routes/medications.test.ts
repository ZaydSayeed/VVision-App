import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

vi.mock("../server-core/security", () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.auth = { userId: "user-caregiver" };
    next();
  },
}));

vi.mock("../server-core/patientResolver", () => ({
  resolvePatientId: (req: any, _res: any, next: any) => {
    req.patientId = "patient-own";
    next();
  },
}));

const mockUsersCol = {
  findOne: vi.fn().mockResolvedValue({ patient_id: "patient-own" }),
};
const mockMedicationsCol = {
  find: vi.fn().mockReturnValue({
    limit: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) }),
  }),
};
const mockSeatsCol = { findOne: vi.fn() };
const mockPatientsCol = { findOne: vi.fn() };

vi.mock("../server-core/database", () => ({
  getDb: () => ({
    collection: (name: string) => {
      if (name === "users") return mockUsersCol;
      if (name === "medications") return mockMedicationsCol;
      if (name === "seats") return mockSeatsCol;
      if (name === "patients") return mockPatientsCol;
      throw new Error("unexpected collection " + name);
    },
  }),
}));

vi.mock("../server-core/seatResolver", () => ({
  userHasPatientAccess: vi.fn(),
}));

import { userHasPatientAccess } from "../server-core/seatResolver";

import medicationRoutes from "./medications";
const app = express();
app.use(express.json());
app.use("/api/medications", medicationRoutes);

describe("GET /api/medications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsersCol.findOne.mockResolvedValue({ patient_id: "patient-own" });
    mockMedicationsCol.find.mockReturnValue({
      limit: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) }),
    });
  });

  it("with no patientId param, queries the caller's own linked patient (unchanged behavior)", async () => {
    await request(app).get("/api/medications");
    expect(mockMedicationsCol.find).toHaveBeenCalledWith({ patient_id: "patient-own" });
  });

  it("with a patientId param and access granted via seat, queries that patient", async () => {
    vi.mocked(userHasPatientAccess).mockResolvedValue("primary_caregiver");

    const res = await request(app).get("/api/medications").query({ patientId: "patient-other" });

    expect(res.status).toBe(200);
    expect(mockMedicationsCol.find).toHaveBeenCalledWith({ patient_id: "patient-other" });
    expect(userHasPatientAccess).toHaveBeenCalledWith(expect.anything(), "user-caregiver", "patient-other");
  });

  it("with a patientId param and no access, returns 403 and does not query medications", async () => {
    vi.mocked(userHasPatientAccess).mockResolvedValue(null);

    const res = await request(app).get("/api/medications").query({ patientId: "patient-other" });

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ detail: "No access to this profile" });
    expect(mockMedicationsCol.find).not.toHaveBeenCalled();
    expect(userHasPatientAccess).toHaveBeenCalledWith(expect.anything(), "user-caregiver", "patient-other");
  });
});
