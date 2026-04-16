import { Router, Request, Response, NextFunction } from "express";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { authMiddleware } from "../server-core/security";
import { addMemory, searchMemory } from "../server-core/memory";
import { getDb } from "../server-core/database";
import { GoogleGenAI } from "@google/genai";
import { config } from "../server-core/config";

// Accepts caregivers linked via seats OR via the legacy caregiver_ids link system
async function requirePatientAccess(req: Request, res: Response, next: NextFunction) {
  const userId = (req as any).auth?.userId;
  const patientId = String(req.params.patientId);
  if (!userId || !patientId) { res.status(401).json({ detail: "Unauthorized" }); return; }
  const db = getDb();

  // Check seats first (Plan A invite system)
  const seat = await db.collection("seats").findOne({ userId, patientId });
  if (seat) {
    req.seat = { userId: seat.userId, patientId: seat.patientId, role: seat.role };
    next(); return;
  }

  // Fall back to legacy caregiver_ids link
  if (ObjectId.isValid(patientId)) {
    const patient = await db.collection("patients").findOne({ _id: new ObjectId(patientId) });
    if (patient) {
      const ids: string[] = patient.caregiver_ids ?? [];
      if (ids.includes(userId)) {
        req.seat = { userId, patientId, role: "primary_caregiver" };
        next(); return;
      }
    }
  }

  // Fall back to users.patient_id link (same mechanism /api/patients/linked uses)
  const user = await db.collection("users").findOne({ supabase_uid: userId });
  if (user && String(user.patient_id) === patientId) {
    req.seat = { userId, patientId, role: "primary_caregiver" };
    next(); return;
  }

  res.status(403).json({ detail: "No access to this profile" });
}

export const memoryAddSchema = z.object({
  content: z.string().min(1).max(5000),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const memorySearchSchema = z.object({
  q: z.string().min(1).max(500),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

const router = Router();

// POST /api/profiles/:patientId/memory
router.post("/:patientId/memory", authMiddleware, requirePatientAccess, async (req, res) => {
  const parsed = memoryAddSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ detail: parsed.error.issues[0].message }); return; }
  try {
    const metadata = { ...parsed.data.metadata, author_user_id: req.seat!.userId };
    const result = await addMemory({ patientId: String(req.params.patientId), content: parsed.data.content, metadata });

    // Persist raw check-in text in MongoDB for the logs view
    const source = parsed.data.metadata?.source as string | undefined;
    if (source === "voice_check_in" || source === "text_check_in") {
      const db = getDb();
      await db.collection("checkin_logs").insertOne({
        patientId: String(req.params.patientId),
        content: parsed.data.content,
        source,
        capturedAt: (parsed.data.metadata?.capturedAt as string) ?? new Date().toISOString(),
        createdAt: new Date().toISOString(),
        authorUserId: req.seat!.userId,
      });
    }

    res.status(201).json({ ok: true, result });
  } catch (err: any) {
    console.error("memory add error:", err);
    res.status(500).json({ detail: err.message || "Internal server error" });
  }
});

// GET /api/profiles/:patientId/memory/logs
router.get("/:patientId/memory/logs", authMiddleware, requirePatientAccess, async (req, res) => {
  try {
    const db = getDb();
    const logs = await db.collection("checkin_logs")
      .find({ patientId: String(req.params.patientId) })
      .sort({ capturedAt: -1 })
      .limit(200)
      .toArray();
    res.json({ logs: logs.map(l => ({ id: String(l._id), content: l.content, source: l.source, capturedAt: l.capturedAt })) });
  } catch (err: any) {
    console.error("list logs error:", err);
    res.status(500).json({ detail: err.message || "Internal server error" });
  }
});

const summarizeSchema = z.object({
  logId: z.string(),
  content: z.string().min(1).max(5000),
  capturedAt: z.string(),
});

// POST /api/profiles/:patientId/memory/logs/summarize
router.post("/:patientId/memory/logs/summarize", authMiddleware, requirePatientAccess, async (req, res) => {
  const parsed = summarizeSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ detail: parsed.error.issues[0].message }); return; }
  if (!config.geminiApiKey) { res.status(503).json({ detail: "Gemini API key not configured" }); return; }
  try {
    const db = getDb();
    // Get up to 30 recent logs (excluding the current one) for trend context
    const recentLogs = await db.collection("checkin_logs")
      .find({ patientId: String(req.params.patientId), capturedAt: { $lt: parsed.data.capturedAt } })
      .sort({ capturedAt: -1 })
      .limit(30)
      .toArray();

    const historyText = recentLogs.length > 0
      ? recentLogs.map(l => {
          const d = new Date(l.capturedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
          return `[${d}]: ${l.content}`;
        }).join("\n\n")
      : "No previous check-in history available.";

    const logDate = new Date(parsed.data.capturedAt).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

    const prompt = `You are a dementia care assistant helping caregivers understand their patient's condition over time.

Check-in note from ${logDate}:
"${parsed.data.content}"

Recent check-in history (most recent first):
${historyText}

Respond with a JSON object with exactly two fields:
- "bullets": an array of 3-5 concise bullet strings summarizing today's note
- "trend": a 1-2 sentence observation about how the patient is doing relative to the history. If there isn't enough history, say so briefly but still make it helpful.

Return ONLY the JSON object, no markdown or other text.`;

    const genai = new GoogleGenAI({ apiKey: config.geminiApiKey });
    const response = await genai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    const raw = response.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    let result: { bullets: string[]; trend: string };
    try {
      result = JSON.parse(cleaned);
    } catch {
      result = { bullets: ["Unable to parse summary."], trend: "" };
    }

    res.json(result);
  } catch (err: any) {
    console.error("summarize error:", err);
    res.status(500).json({ detail: err.message || "Internal server error" });
  }
});

// GET /api/profiles/:patientId/memory/search?q=...
router.get("/:patientId/memory/search", authMiddleware, requirePatientAccess, async (req, res) => {
  const parsed = memorySearchSchema.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ detail: parsed.error.issues[0].message }); return; }
  try {
    const result = await searchMemory({
      patientId: String(req.params.patientId),
      query: parsed.data.q,
      limit: parsed.data.limit,
    });
    res.json({ results: result });
  } catch (err: any) {
    console.error("memory search error:", err);
    res.status(500).json({ detail: err.message || "Internal server error" });
  }
});

export default router;
