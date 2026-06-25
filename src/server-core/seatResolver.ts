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

// Resolves whether `userId` may access `patientId` via any of the supported
// mechanisms — a seat, the legacy caregiver_ids array, or the user's own
// patient_id — returning the effective role, or null if there is no access.
// Use this anywhere a route authorizes against a patientId that does NOT come
// from a requireSeat/requirePatientAccess-guarded :patientId path param.
export async function userHasPatientAccess(
  db: Db,
  userId: string,
  patientId: string
): Promise<SeatRole | null> {
  const seat = await db.collection("seats").findOne({ userId, patientId });
  if (seat) return seat.role as SeatRole;

  if (ObjectId.isValid(patientId)) {
    const patient = await db.collection("patients").findOne({ _id: new ObjectId(patientId) });
    const ids: string[] = patient?.caregiver_ids ?? [];
    if (ids.includes(userId)) return "primary_caregiver";
  }

  const user = await db.collection("users").findOne({ supabase_uid: userId });
  if (user && String(user.patient_id) === patientId) return "primary_caregiver";

  return null;
}

// Like requireSeat but also accepts caregivers linked via the legacy caregiver_ids system
export function requirePatientAccess(req: Request, res: Response, next: NextFunction): void {
  const run = async () => {
    const userId = (req as any).auth?.userId;
    const patientId = String(req.params.patientId);
    if (!userId || !patientId) { res.status(401).json({ detail: "Unauthorized" }); return; }

    const role = await userHasPatientAccess(getDb(), userId, patientId);
    if (!role) { res.status(403).json({ detail: "No seat on this profile" }); return; }

    req.seat = { userId, patientId, role };
    next();
  };
  run().catch(next);
}

export function requireSeat(req: Request, res: Response, next: NextFunction): void {
  const run = async () => {
    const userId = (req as any).auth?.userId;
    const patientId = String(req.params.patientId);
    if (!userId || !patientId) { res.status(401).json({ detail: "Unauthorized" }); return; }
    const seat = await resolveSeatForRequest(getDb(), userId, patientId);
    if (!seat) { res.status(403).json({ detail: "No seat on this profile" }); return; }
    req.seat = seat;
    next();
  };
  run().catch(next);
}
