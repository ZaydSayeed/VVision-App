import { Db } from "mongodb";
import { SeatRole } from "./seatResolver";

/**
 * Ensure a caregiver has a seat on a patient profile.
 *
 * The first caregiver on a profile becomes the primary_caregiver; any
 * subsequent caregiver who links becomes a sibling (so there is never more
 * than one primary). Idempotent: if the caregiver already has a seat, it is
 * left unchanged and its existing role is returned.
 *
 * Without this, caregivers who join via a link code get `caregiver_ids` but no
 * seat row, so every `requireSeat`-gated profile feature returns 403 (CARE-3).
 */
export async function ensureCaregiverSeat(
  db: Db,
  userId: string,
  patientId: string
): Promise<SeatRole> {
  const existing = await db.collection("seats").findOne({ userId, patientId });
  if (existing) return existing.role as SeatRole;

  const hasPrimary = await db
    .collection("seats")
    .findOne({ patientId, role: "primary_caregiver" });
  const role: SeatRole = hasPrimary ? "sibling" : "primary_caregiver";

  await db.collection("seats").insertOne({
    userId,
    patientId,
    role,
    createdAt: new Date().toISOString(),
  });
  return role;
}
