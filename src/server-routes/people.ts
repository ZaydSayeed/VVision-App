import { Router } from "express";
import { ObjectId } from "mongodb";
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

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || ".jpg";
      cb(null, `${crypto.randomUUID()}${ext}`);
    },
  }),
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
  try {
    const db = getDb();
    const doc = await db
      .collection("people")
      .findOne({ _id: new ObjectId(req.params.personId as string), patient_id: req.patientId! }, { projection: { embedding: 0 } });
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
  try {
    const db = getDb();
    const { relation, notes } = req.body;
    const updates: any = {};
    if (relation !== undefined) updates.relation = relation;
    if (notes !== undefined) updates.notes = notes;

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ detail: "No fields to update" });
      return;
    }

    const result = await db.collection("people").updateOne(
      { _id: new ObjectId(req.params.personId as string), patient_id: req.patientId! },
      { $set: updates }
    );
    if (result.matchedCount === 0) {
      res.status(404).json({ detail: "Person not found" });
      return;
    }

    const doc = await db
      .collection("people")
      .findOne({ _id: new ObjectId(req.params.personId as string) }, { projection: { embedding: 0 } });
    res.json(personOut(doc));
  } catch (err) {
    console.error("update person error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

// POST /api/people/:personId/notes
router.post("/:personId/notes", authMiddleware, resolvePatientId, async (req, res) => {
  try {
    const db = getDb();
    const result = await db.collection("people").updateOne(
      { _id: new ObjectId(req.params.personId as string), patient_id: req.patientId! },
      { $set: { notes: req.body.notes } }
    );
    if (result.matchedCount === 0) {
      res.status(404).json({ detail: "Person not found" });
      return;
    }

    const doc = await db
      .collection("people")
      .findOne({ _id: new ObjectId(req.params.personId as string) }, { projection: { embedding: 0 } });
    res.json(personOut(doc));
  } catch (err) {
    console.error("update notes error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

// POST /api/people/enroll
router.post("/enroll", authMiddleware, resolvePatientId, upload.single("photo"), async (req, res) => {
  try {
    const db = getDb();
    const doc = {
      name: req.body.name,
      relation: req.body.relation || "",
      notes: "",
      embedding: [],
      last_seen: null,
      seen_count: 0,
      interactions: [],
      patient_id: req.patientId!,
      photo_path: req.file?.path || "",
    };
    const result = await db.collection("people").insertOne(doc);
    res.status(201).json(personOut({ ...doc, _id: result.insertedId }));
  } catch (err) {
    console.error("enroll error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

// DELETE /api/people/:personId
router.delete("/:personId", authMiddleware, resolvePatientId, async (req, res) => {
  try {
    const db = getDb();
    const doc = await db.collection("people").findOne({ _id: new ObjectId(req.params.personId as string), patient_id: req.patientId! });
    if (!doc) {
      res.status(404).json({ detail: "Person not found" });
      return;
    }
    if (doc.photo_path) {
      try { fs.unlinkSync(doc.photo_path); } catch {}
    }

    const result = await db.collection("people").deleteOne({ _id: doc._id });
    if (result.deletedCount === 0) {
      res.status(404).json({ detail: "Person not found" });
      return;
    }
    res.status(204).send();
  } catch (err) {
    console.error("delete person error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});


export default router;
