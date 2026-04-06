import { Router } from "express";
import { ObjectId } from "mongodb";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { getDb } from "../server-core/database";
import { authMiddleware } from "../server-core/security";
import { resolvePatientId } from "../server-core/patientResolver";

const router = Router();

const UPLOAD_DIR = path.resolve("uploads/faces");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const upload = multer({
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      cb(new Error("Only JPEG, PNG, and WebP images are allowed."));
      return;
    }
    cb(null, true);
  },
  limits: { fileSize: MAX_FILE_SIZE },
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, _file, cb) => {
      cb(null, `${crypto.randomUUID()}.jpg`);
    },
  }),
});

const enrollSchema = z.object({
  name: z.string().min(1, "Name required").max(200).trim(),
  relation: z.string().min(1, "Relation required").max(100).trim(),
});

function personOut(doc: any) {
  return {
    id: String(doc._id),
    name: doc.name,
    relation: doc.relation || "",
    last_seen: doc.last_seen ?? null,
    seen_count: doc.seen_count ?? 0,
    notes: doc.notes || "",
    interactions: doc.interactions || [],
  };
}

function validId(id: string | string[], res: any): boolean {
  if (!ObjectId.isValid(String(id))) {
    res.status(400).json({ detail: "Invalid ID" });
    return false;
  }
  return true;
}

// GET /api/people
router.get("/", authMiddleware, resolvePatientId, async (req, res) => {
  try {
    const db = getDb();
    const docs = await db
      .collection("people")
      .find({ patient_id: req.patientId! }, { projection: { embedding: 0 } })
      .limit(500)
      .toArray();
    res.json(docs.map(personOut));
  } catch (err) {
    console.error("list people error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

// GET /api/people/:personId
router.get("/:personId", authMiddleware, resolvePatientId, async (req, res) => {
  if (!validId(req.params.personId, res)) return;
  try {
    const db = getDb();
    const doc = await db
      .collection("people")
      .findOne(
        { _id: new ObjectId(String(req.params.personId)), patient_id: req.patientId! },
        { projection: { embedding: 0 } }
      );
    if (!doc) {
      res.status(404).json({ detail: "Person not found" });
      return;
    }
    res.json(personOut(doc));
  } catch (err) {
    console.error("get person error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

// PATCH /api/people/:personId
router.patch("/:personId", authMiddleware, resolvePatientId, async (req, res) => {
  if (!validId(req.params.personId, res)) return;
  try {
    const db = getDb();
    const { relation, notes } = req.body;
    const updates: any = {};
    if (relation !== undefined) updates.relation = String(relation).slice(0, 100);
    if (notes !== undefined) updates.notes = String(notes).slice(0, 5000);

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ detail: "No fields to update" });
      return;
    }

    const result = await db.collection("people").updateOne(
      { _id: new ObjectId(String(req.params.personId)), patient_id: req.patientId! },
      { $set: { ...updates, updated_at: new Date().toISOString() } }
    );
    if (result.matchedCount === 0) {
      res.status(404).json({ detail: "Person not found" });
      return;
    }

    const doc = await db
      .collection("people")
      .findOne({ _id: new ObjectId(String(req.params.personId)) }, { projection: { embedding: 0 } });
    if (!doc) {
      res.status(404).json({ detail: "Person not found" });
      return;
    }
    res.json(personOut(doc));
  } catch (err) {
    console.error("update person error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

// POST /api/people/:personId/notes
router.post("/:personId/notes", authMiddleware, resolvePatientId, async (req, res) => {
  if (!validId(req.params.personId, res)) return;
  try {
    const db = getDb();
    const notes = String(req.body.notes ?? "").slice(0, 5000);
    const result = await db.collection("people").updateOne(
      { _id: new ObjectId(String(req.params.personId)), patient_id: req.patientId! },
      { $set: { notes, updated_at: new Date().toISOString() } }
    );
    if (result.matchedCount === 0) {
      res.status(404).json({ detail: "Person not found" });
      return;
    }

    const doc = await db
      .collection("people")
      .findOne({ _id: new ObjectId(String(req.params.personId)) }, { projection: { embedding: 0 } });
    if (!doc) {
      res.status(404).json({ detail: "Person not found" });
      return;
    }
    res.json(personOut(doc));
  } catch (err) {
    console.error("update notes error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

// POST /api/people/enroll
router.post("/enroll", authMiddleware, resolvePatientId, upload.single("photo"), async (req, res) => {
  // Validate text fields
  const parsed = enrollSchema.safeParse(req.body);
  if (!parsed.success) {
    if (req.file) {
      try { fs.unlinkSync(req.file.path); } catch {}
    }
    res.status(400).json({ detail: parsed.error.issues[0].message });
    return;
  }

  try {
    const db = getDb();
    const doc = {
      name: parsed.data.name,
      relation: parsed.data.relation,
      notes: "",
      embedding: [],
      last_seen: null,
      seen_count: 0,
      interactions: [],
      patient_id: req.patientId!,
      photo_path: req.file?.path || "",
      created_at: new Date().toISOString(),
    };
    const result = await db.collection("people").insertOne(doc);
    res.status(201).json(personOut({ ...doc, _id: result.insertedId }));
  } catch (err) {
    if (req.file) {
      try { fs.unlinkSync(req.file.path); } catch {}
    }
    console.error("enroll error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

// DELETE /api/people/:personId
router.delete("/:personId", authMiddleware, resolvePatientId, async (req, res) => {
  if (!validId(req.params.personId, res)) return;
  try {
    const db = getDb();
    const doc = await db.collection("people").findOne({
      _id: new ObjectId(String(req.params.personId)),
      patient_id: req.patientId!,
    });
    if (!doc) {
      res.status(404).json({ detail: "Person not found" });
      return;
    }
    if (doc.photo_path) {
      try { fs.unlinkSync(doc.photo_path); } catch (err) {
        console.error("Failed to delete photo file:", err);
      }
    }

    await db.collection("people").deleteOne({ _id: doc._id });
    res.status(204).send();
  } catch (err) {
    console.error("delete person error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

export default router;
