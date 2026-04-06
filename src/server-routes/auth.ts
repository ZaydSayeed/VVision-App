import { Router } from "express";
import { z } from "zod";
import { getDb } from "../server-core/database";
import { authMiddleware } from "../server-core/security";
import { config } from "../server-core/config";
import { generateUniqueLinkCode } from "../server-core/linkCode";

const router = Router();

const syncSchema = z.object({
  name: z.string().min(1, "Name required").max(200).trim(),
  role: z.enum(["patient", "caregiver"], { message: "Role must be patient or caregiver" }),
});

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
  const parsed = syncSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ detail: parsed.error.issues[0].message });
    return;
  }
  const { name, role } = parsed.data;

  try {
    const supabaseUid = req.auth!.userId;
    const db = getDb();
    const users = db.collection("users");

    const existing = await users.findOne({ supabase_uid: supabaseUid });
    if (existing) {
      // Auto-heal: patient role but missing patient_id
      if (existing.role === "patient" && !existing.patient_id) {
        const linkCode = await generateUniqueLinkCode(db);
        const patientDoc = {
          name: existing.name,
          age: null,
          diagnosis: null,
          notes: "",
          caregiver_id: "",
          caregiver_ids: [] as string[],
          link_code: linkCode,
          created_at: new Date().toISOString(),
        };
        const patientResult = await db.collection("patients").insertOne(patientDoc);
        const patientId = String(patientResult.insertedId);
        await users.updateOne({ _id: existing._id }, { $set: { patient_id: patientId } });
        existing.patient_id = patientId;
      }
      res.json(userOut(existing));
      return;
    }

    // Fetch email from Supabase
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
    } catch (err) {
      console.error("Failed to fetch email from Supabase:", err);
    }

    const userDoc = {
      supabase_uid: supabaseUid,
      email,
      name,
      role,
      patient_id: null as string | null,
      created_at: new Date().toISOString(),
    };
    const result = await users.insertOne(userDoc);

    let patientId: string | null = null;
    if (role === "patient") {
      const linkCode = await generateUniqueLinkCode(db);
      const patientDoc = {
        name,
        age: null,
        diagnosis: null,
        notes: "",
        caregiver_id: "",
        caregiver_ids: [] as string[],
        link_code: linkCode,
        created_at: new Date().toISOString(),
      };
      const patientResult = await db.collection("patients").insertOne(patientDoc);
      patientId = String(patientResult.insertedId);
      await users.updateOne({ _id: result.insertedId }, { $set: { patient_id: patientId } });
    }

    res.json({
      id: String(result.insertedId),
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
