import { Router } from "express";
import crypto from "crypto";
import { ObjectId } from "mongodb";
import { getDb } from "../server-core/database";
import { authMiddleware } from "../server-core/security";
import { config } from "../server-core/config";

const router = Router();

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function generateLinkCode(length = 6): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += ALPHABET[crypto.randomInt(ALPHABET.length)];
  }
  return code;
}

function userOut(user: any) {
  return {
    id: String(user._id),
    email: user.email || "",
    name: user.name || "",
    role: user.role || "caregiver",
    patient_id: user.patient_id ? String(user.patient_id) : null,
  };
}

// POST /api/auth/sync
router.post("/sync", authMiddleware, async (req, res) => {
  try {
    const { name, role } = req.body;
    if (!name || !["patient", "caregiver"].includes(role)) {
      res.status(400).json({ detail: "name and role (patient|caregiver) required" });
      return;
    }

    const supabaseUid = req.auth!.userId;
    const db = getDb();
    const users = db.collection("users");

    // Check if user already exists
    const existing = await users.findOne({ supabase_uid: supabaseUid });
    if (existing) {
      res.json(userOut(existing));
      return;
    }

    // Get email from Supabase
    let email = "";
    try {
      const resp = await fetch(`${config.supabaseUrl}/auth/v1/user`, {
        headers: {
          Authorization: `Bearer ${req.auth!.token}`,
          apikey: config.supabaseAnonKey,
        },
      });
      if (resp.status === 200) {
        const data = (await resp.json()) as { email?: string };
        email = data.email || "";
      }
    } catch {}

    // Create user doc
    const userDoc = {
      supabase_uid: supabaseUid,
      email,
      name,
      role,
      patient_id: null as string | null,
    };
    const result = await users.insertOne(userDoc);
    const userId = String(result.insertedId);

    let patientId: string | null = null;

    // If patient, auto-create patient record with link code
    if (role === "patient") {
      let linkCode = generateLinkCode();
      while (await db.collection("patients").findOne({ link_code: linkCode })) {
        linkCode = generateLinkCode();
      }

      const patientDoc = {
        name,
        age: null,
        diagnosis: null,
        notes: "",
        caregiver_id: "",
        caregiver_ids: [] as string[],
        link_code: linkCode,
      };
      const patientResult = await db.collection("patients").insertOne(patientDoc);
      patientId = String(patientResult.insertedId);

      await users.updateOne(
        { _id: new ObjectId(userId) },
        { $set: { patient_id: patientId } }
      );
    }

    res.json({
      id: userId,
      email,
      name,
      role,
      patient_id: patientId,
    });
  } catch (err) {
    console.error("sync error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

// GET /api/auth/me
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const db = getDb();
    const user = await db.collection("users").findOne({ supabase_uid: req.auth!.userId });
    if (!user) {
      res.status(404).json({ detail: "Profile not synced yet. Call /api/auth/sync first." });
      return;
    }
    res.json(userOut(user));
  } catch (err) {
    console.error("me error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

export default router;
