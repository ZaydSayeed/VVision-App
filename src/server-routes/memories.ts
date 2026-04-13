import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "../server-core/security";
import { requireSeat } from "../server-core/seatResolver";
import { addMemory, searchMemory } from "../server-core/memory";

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
router.post("/:patientId/memory", authMiddleware, requireSeat, async (req, res) => {
  const parsed = memoryAddSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ detail: parsed.error.issues[0].message }); return; }
  try {
    const result = await addMemory({
      patientId: req.params.patientId,
      content: parsed.data.content,
      metadata: { ...parsed.data.metadata, author_user_id: req.seat!.userId },
    });
    res.status(201).json({ ok: true, result });
  } catch (err: any) {
    console.error("memory add error:", err);
    res.status(500).json({ detail: err.message || "Internal server error" });
  }
});

// GET /api/profiles/:patientId/memory/search?q=...
router.get("/:patientId/memory/search", authMiddleware, requireSeat, async (req, res) => {
  const parsed = memorySearchSchema.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ detail: parsed.error.issues[0].message }); return; }
  try {
    const result = await searchMemory({
      patientId: req.params.patientId,
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
