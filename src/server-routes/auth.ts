import { Router } from "express";
import { z } from "zod";
import { ObjectId } from "mongodb";
import { getDb } from "../server-core/database";
import { authMiddleware } from "../server-core/security";
import { config } from "../server-core/config";
import { generateUniqueLinkCode } from "../server-core/linkCode";
import { deleteMemoriesForPatient } from "../server-core/memory";

async function createPrimaryCaregiverSeat(db: import("mongodb").Db, userId: string, patientId: string) {
  await db.collection("seats").insertOne({
    userId,
    patientId,
    role: "primary_caregiver",
    createdAt: new Date().toISOString(),
  });
}

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
        try {
          await createPrimaryCaregiverSeat(db, req.auth!.userId, patientId);
        } catch (err) {
          console.error("Critical: seat insert failed after patient created.", {
            userId: req.auth!.userId, patientId, err
          });
          res.status(500).json({ detail: "Failed to initialize access control" });
          return;
        }
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
      try {
        await createPrimaryCaregiverSeat(db, req.auth!.userId, patientId);
      } catch (err) {
        console.error("Critical: seat insert failed after patient created.", {
          userId: req.auth!.userId, patientId, err
        });
        res.status(500).json({ detail: "Failed to initialize access control" });
        return;
      }
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

// DELETE /api/auth/me — permanent account deletion (Apple 5.1.1(v))
// Cascades: removes user data across all collections, deletes Supabase auth user,
// best-effort cleans Mem0 memories and notifies linked caregivers via push.
router.delete("/me", authMiddleware, async (req, res) => {
  try {
    const supabaseUid = req.auth!.userId;
    const db = getDb();
    const users = db.collection("users");
    const user = await users.findOne({ supabase_uid: supabaseUid });
    if (!user) {
      res.status(404).json({ detail: "User not found" });
      return;
    }

    const userId = String(user._id);
    const patientId = user.patient_id ? String(user.patient_id) : null;
    const isPatientDeletion = user.role === "patient" && patientId;

    if (isPatientDeletion) {
      // Notify linked caregivers — best-effort, never blocks deletion
      try {
        const caregiverTokens = await db
          .collection("pushTokens")
          .find({ patientId })
          .toArray();
        const patientName = user.name ?? "Your patient";
        await Promise.allSettled(
          caregiverTokens
            .filter((t) => t.expoPushToken)
            .map((t) =>
              fetch("https://exp.host/push/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  to: t.expoPushToken,
                  title: "Patient account deleted",
                  body: `${patientName} deleted their Vela Vision account. You will no longer receive updates for them.`,
                  data: { type: "account_deleted", patientId },
                  priority: "high",
                }),
              })
            )
        );
      } catch (err) {
        console.error("[delete account] caregiver notify failed (non-fatal):", err);
      }

      // Cascade across every collection that stores patient-scoped data.
      // Field name varies (patient_id vs patientId), so attempt both.
      const patientCollections = [
        "conversations", "routines", "medications", "reminders",
        "alerts", "helpAlerts", "people", "geofences", "notes",
        "onboarding_progress", "patientPushTokens", "pushTokens",
        "seats", "profiles", "mood", "events", "doctors", "visits",
        "patterns", "stream_sessions",
      ];
      await Promise.allSettled(
        patientCollections.flatMap((name) => [
          db.collection(name).deleteMany({ patient_id: patientId }),
          db.collection(name).deleteMany({ patientId }),
        ])
      );

      try {
        await db.collection("patients").deleteOne({ _id: new ObjectId(patientId) });
      } catch (err) {
        console.error("[delete account] patient doc delete failed:", err);
      }

      // Mem0 cleanup is best-effort — failure here must not block account deletion.
      try {
        await deleteMemoriesForPatient(patientId);
      } catch (err) {
        console.error("[delete account] mem0 cleanup failed (non-fatal):", err);
      }
    } else {
      // Caregiver deletion: drop their seats, push tokens, and unlink from any patient's caregiver_ids.
      await Promise.allSettled([
        db.collection("seats").deleteMany({ userId: supabaseUid }),
        db.collection("pushTokens").deleteMany({ caregiverId: supabaseUid }),
        db.collection("patients").updateMany(
          { caregiver_ids: userId },
          { $pull: { caregiver_ids: userId } as any }
        ),
      ]);
    }

    await users.deleteOne({ _id: user._id });

    // Removing the Supabase auth user is what prevents them from signing back in.
    // If the service role key isn't configured the Mongo cascade still ran, but
    // we surface the failure so it can be fixed before the next deletion.
    if (!config.supabaseServiceRoleKey) {
      console.error("[delete account] SUPABASE_SERVICE_ROLE_KEY not set — Supabase user not deleted");
    } else {
      try {
        const resp = await fetch(
          `${config.supabaseUrl}/auth/v1/admin/users/${supabaseUid}`,
          {
            method: "DELETE",
            headers: {
              apikey: config.supabaseServiceRoleKey,
              Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
            },
          }
        );
        if (!resp.ok) {
          const txt = await resp.text().catch(() => "");
          console.error("[delete account] Supabase admin delete failed:", resp.status, txt);
        }
      } catch (err) {
        console.error("[delete account] Supabase admin delete error:", err);
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error("delete account error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

export default router;
