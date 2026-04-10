import { Router } from "express";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb } from "../server-core/database";
import { authMiddleware } from "../server-core/security";

const router = Router();

const createSchema = z.object({
  patientId: z.string().min(1),
  text: z.string().min(1, "Text required").max(500).trim(),
  pinned: z.boolean().default(false),
});

function noteOut(doc: any) {
  return {
    id: String(doc._id),
    patientId: String(doc.patientId),
    caregiverId: String(doc.caregiverId),
    caregiverName: doc.caregiverName ?? "",
    text: doc.text,
    pinned: doc.pinned ?? false,
    timestamp: doc.timestamp,
  };
}

// Resolve the requesting user's role + supabaseUid
async function resolveUser(req: any, res: any): Promise<{ supabaseUid: string; role: string; name: string } | null> {
  const db = getDb();
  const supabaseUid = req.auth?.userId;
  if (!supabaseUid) { res.status(401).json({ detail: "Not authenticated" }); return null; }
  const user = await db.collection("users").findOne({ supabase_uid: supabaseUid });
  if (!user) { res.status(404).json({ detail: "Profile not found" }); return null; }
  return { supabaseUid, role: user.role, name: user.name ?? "" };
}

// GET /api/notes?patientId=<id>
router.get("/", authMiddleware, async (req, res) => {
  const { patientId } = req.query;
  if (!patientId || !ObjectId.isValid(String(patientId))) {
    return res.status(400).json({ detail: "Valid patientId required" });
  }
  try {
    const db = getDb();
    const docs = await db.collection("caregiver_notes")
      .find({ patientId: String(patientId) })
      .sort({ timestamp: -1 })
      .limit(50)
      .toArray();
    res.json(docs.map(noteOut));
  } catch (err) {
    console.error("list notes error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

// POST /api/notes
router.post("/", authMiddleware, async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ detail: parsed.error.issues[0].message });
  const { patientId, text, pinned } = parsed.data;
  if (!ObjectId.isValid(patientId)) return res.status(400).json({ detail: "Invalid patientId" });

  const user = await resolveUser(req, res);
  if (!user) return;
  if (user.role !== "caregiver") return res.status(403).json({ detail: "Only caregivers can create notes" });

  try {
    const db = getDb();
    if (pinned) {
      await db.collection("caregiver_notes").updateMany(
        { patientId },
        { $set: { pinned: false } }
      );
    }
    const doc = {
      patientId,
      caregiverId: user.supabaseUid,
      caregiverName: user.name,
      text,
      pinned,
      timestamp: new Date().toISOString(),
    };
    const result = await db.collection("caregiver_notes").insertOne(doc);
    res.status(201).json(noteOut({ _id: result.insertedId, ...doc }));
  } catch (err) {
    console.error("create note error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

// PATCH /api/notes/:id/pin
router.patch("/:id/pin", authMiddleware, async (req, res) => {
  if (!ObjectId.isValid(req.params.id as string)) return res.status(400).json({ detail: "Invalid id" });

  const user = await resolveUser(req, res);
  if (!user) return;
  if (user.role !== "caregiver") return res.status(403).json({ detail: "Only caregivers can pin notes" });

  try {
    const db = getDb();
    const note = await db.collection("caregiver_notes").findOne({ _id: new ObjectId(req.params.id as string) });
    if (!note) return res.status(404).json({ detail: "Note not found" });

    const newPinned = !note.pinned;
    if (newPinned) {
      await db.collection("caregiver_notes").updateMany(
        { patientId: note.patientId },
        { $set: { pinned: false } }
      );
    }
    await db.collection("caregiver_notes").updateOne(
      { _id: new ObjectId(req.params.id as string) },
      { $set: { pinned: newPinned } }
    );
    const updated = await db.collection("caregiver_notes").findOne({ _id: new ObjectId(req.params.id as string) });
    res.json(noteOut(updated));
  } catch (err) {
    console.error("pin note error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

// DELETE /api/notes/:id
router.delete("/:id", authMiddleware, async (req, res) => {
  if (!ObjectId.isValid(req.params.id as string)) return res.status(400).json({ detail: "Invalid id" });

  const user = await resolveUser(req, res);
  if (!user) return;
  if (user.role !== "caregiver") return res.status(403).json({ detail: "Only caregivers can delete notes" });

  try {
    const db = getDb();
    await db.collection("caregiver_notes").deleteOne({ _id: new ObjectId(req.params.id as string) });
    res.status(204).end();
  } catch (err) {
    console.error("delete note error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

export default router;
