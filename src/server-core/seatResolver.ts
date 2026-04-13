import { Db } from "mongodb";
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
