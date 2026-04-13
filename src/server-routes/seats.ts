import { Router } from "express";
import { z } from "zod";

export const seatRoleEnum = z.enum([
  "primary_caregiver",
  "sibling",
  "paid_aide",
  "clinician",
]);

export const seatCreateSchema = z.object({
  email: z.string().email().max(200),
  role: seatRoleEnum,
});

const router = Router();
export default router;
