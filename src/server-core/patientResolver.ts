import { Request, Response, NextFunction } from "express";
import { getDb } from "./database";

// Extend Express Request to include patientId
declare global {
  namespace Express {
    interface Request {
      patientId?: string;
    }
  }
}

export async function resolvePatientId(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const db = getDb();
  const supabaseUid = req.auth?.userId;
  if (!supabaseUid) {
    res.status(401).json({ detail: "Not authenticated" });
    return;
  }

  const user = await db.collection("users").findOne({ supabase_uid: supabaseUid });
  if (!user) {
    res.status(404).json({ detail: "Profile not found. Sign in again." });
    return;
  }

  const patientId = user.patient_id;
  if (!patientId) {
    const msg =
      user.role === "caregiver"
        ? "Ask your patient for their link code."
        : "Account setup incomplete.";
    res.status(404).json({ detail: `No patient linked to your account. ${msg}` });
    return;
  }

  req.patientId = String(patientId);
  next();
}
