import { describe, it, expect, beforeEach } from "vitest";
import { ensureCaregiverSeat } from "./seatProvisioning";

describe("ensureCaregiverSeat", () => {
  const db = () => globalThis.__TEST_DB__;

  beforeEach(async () => {
    await db().collection("seats").deleteMany({});
  });

  it("makes the first caregiver on a profile the primary_caregiver", async () => {
    const role = await ensureCaregiverSeat(db(), "user-1", "patient-1");
    expect(role).toBe("primary_caregiver");

    const seat = await db().collection("seats").findOne({ userId: "user-1", patientId: "patient-1" });
    expect(seat?.role).toBe("primary_caregiver");
  });

  it("makes a second, different caregiver a sibling (not a second primary)", async () => {
    await ensureCaregiverSeat(db(), "user-1", "patient-1");
    const role = await ensureCaregiverSeat(db(), "user-2", "patient-1");
    expect(role).toBe("sibling");

    const primaries = await db()
      .collection("seats")
      .countDocuments({ patientId: "patient-1", role: "primary_caregiver" });
    expect(primaries).toBe(1);
  });

  it("is idempotent for the same caregiver — no duplicate seat, same role returned", async () => {
    const first = await ensureCaregiverSeat(db(), "user-1", "patient-1");
    const second = await ensureCaregiverSeat(db(), "user-1", "patient-1");
    expect(first).toBe("primary_caregiver");
    expect(second).toBe("primary_caregiver");

    const count = await db().collection("seats").countDocuments({ userId: "user-1", patientId: "patient-1" });
    expect(count).toBe(1);
  });
});
