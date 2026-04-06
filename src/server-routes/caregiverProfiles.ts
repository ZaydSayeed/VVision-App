import { Router } from "express";
import { ObjectId } from "mongodb";
import { getDb } from "../server-core/database";
import { authMiddleware } from "../server-core/security";
import { resolvePatientId } from "../server-core/patientResolver";

const router = Router();

// GET /api/caregiver-profiles
router.get("/", authMiddleware, resolvePatientId, async (req, res) => {
  try {
    const db = getDb();
    const patient = await db.collection("patients").findOne({ _id: new ObjectId(req.patientId!) });
    if (!patient) {
      res.status(404).json({ detail: "Patient not found" });
      return;
    }

    const caregiverIds: string[] = patient.caregiver_ids || [];
    if (caregiverIds.length === 0) {
      res.json([]);
      return;
    }

    const objectIds = caregiverIds.map((cid) => new ObjectId(cid));
    const users = await db.collection("users").find({ _id: { $in: objectIds } }).toArray();
    const caregivers = users.map((user) => ({
      id: String(user._id),
      name: user.name,
      email: user.email,
    }));

    res.json(caregivers);
  } catch (err) {
    console.error("list caregiver profiles error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

export default router;
