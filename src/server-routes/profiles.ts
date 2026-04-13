import { Router } from "express";
import { z } from "zod";

const stageEnum = z.enum(["mild", "moderate", "severe"]);

const medicationSchema = z.object({
  name: z.string().min(1).max(200),
  dose: z.string().max(100),
  schedule: z.string().max(200),
  prescriber: z.string().max(200).optional(),
});

const providerSchema = z.object({
  name: z.string().min(1).max(200),
  role: z.string().max(100),
  phone: z.string().max(40).optional(),
});

export const profileUpdateSchema = z.object({
  stage: stageEnum.optional(),
  history: z.string().max(5000).optional(),
  triggers: z.array(z.string().max(200)).max(50).optional(),
  routines_summary: z.string().max(5000).optional(),
  medications: z.array(medicationSchema).max(50).optional(),
  providers: z.array(providerSchema).max(20).optional(),
});

const router = Router();
export default router;
