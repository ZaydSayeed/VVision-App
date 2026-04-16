import { Router, Request, Response } from "express";
import { z } from "zod";
import { ObjectId } from "mongodb";
import { getDb } from "../server-core/database";
import { authMiddleware } from "../server-core/security";
import { requirePatientAccess } from "../server-core/seatResolver";

export const METRICS = ["steps", "heart_rate", "active_minutes", "sleep"] as const;
export type Metric = typeof METRICS[number];

const readingSchema = z.object({
  metric: z.enum(METRICS),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  value: z.number().min(0),
  unit: z.string().min(1).max(16),
});

export const syncSchema = z.object({
  readings: z.array(readingSchema).min(1).max(500),
});

const router = Router();

export default router;
