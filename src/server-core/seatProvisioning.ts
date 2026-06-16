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

  // A patient self-signup creates a primary_caregiver seat for the patient's OWN
  // user. That self-seat must not block the first real caregiver from becoming
  // primary (otherwise the paying caregiver can never invite — they'd be a
  // sibling). Exclude it when checking whether a caregiver primary already exists.
  const patientUser = await db
    .collection("users")
    .findOne({ patient_id: patientId, role: "patient" });
  const patientUid = patientUser?.supabase_uid ?? null;

  const hasCaregiverPrimary = await db
    .collection("seats")
    .findOne({ patientId, role: "primary_caregiver", userId: { $ne: patientUid } });
  const role: SeatRole = hasCaregiverPrimary ? "sibling" : "primary_caregiver";

  await db.collection("seats").insertOne({
    userId,
    patientId,
    role,
    createdAt: new Date().toISOString(),
  });
  return role;
}
