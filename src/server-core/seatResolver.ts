import { Db, ObjectId } from "mongodb";
import { Request, Response, NextFunction } from "express";
import { getDb } from "./database";

export type SeatRole = "primary_caregiver" | "sibling" | "paid_aide" | "clinician";

export interface Seat {
  userId: string;
  patientId: string;
  role: SeatRole;
}

declare global {
  namespace Express {
    interface Request { seat?: Seat }
  }
}

export async function resolveSeatForRequest(
  db: Db,
  userId: string,
  patientId: string
): Promise<Seat | null> {
  const seat = await db.collection("seats").findOne({ userId, patientId });
  if (!seat) return null;
  return { userId: seat.userId, patientId: seat.patientId, role: seat.role };
}

// Like requireSeat but also accepts caregivers linked via the legacy caregiver_ids system
export function requirePatientAccess(req: Request, res: Response, next: NextFunction) {
  (async () => {
    const userId = (req as any).auth?.userId;
    const patientId = String(req.params.patientId);
    if (!userId || !patientId) { res.status(401).json({ detail: "Unauthorized" }); return; }
    const db = getDb();

    const seat = await db.collection("seats").findOne({ userId, patientId });
    if (seat) { req.seat = { userId: seat.userId, patientId: seat.patientId, role: seat.role }; next(); return; }

    if (ObjectId.isValid(patientId)) {
      const patient = await db.collection("patients").findOne({ _id: new ObjectId(patientId) });
      if (patient) {
        const ids: string[] = patient.caregiver_ids ?? [];
        if (ids.includes(userId)) { req.seat = { userId, patientId, role: "primary_caregiver" }; next(); return; }
      }
    }

    const user = await db.collection("users").findOne({ supabase_uid: userId });
    if (user && String(user.patient_id) === patientId) { req.seat = { userId, patientId, role: "primary_caregiver" }; next(); return; }

    res.status(403).json({ detail: "No seat on this profile" });
  })();
}

export function requireSeat(req: Request, res: Response, next: NextFunction) {
  (async () => {
    const userId = (req as any).auth?.userId;
    const patientId = req.params.patientId;
    if (!userId || !patientId) { res.status(401).json({ detail: "Unauthorized" }); return; }
    const seat = await resolveSeatForRequest(getDb(), userId, patientId);
    if (!seat) { res.status(403).json({ detail: "No seat on this profile" }); return; }
    req.seat = seat;
    next();
  })();
}
