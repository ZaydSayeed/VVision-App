import { describe, it, expect } from "vitest";
import { seatRoleEnum, seatCreateSchema } from "./seats";

describe("seatCreateSchema", () => {
  it("accepts a valid seat creation payload", () => {
    const res = seatCreateSchema.safeParse({
      email: "sister@example.com",
      role: "sibling",
    });
    expect(res.success).toBe(true);
  });

  it("rejects unknown role", () => {
    const res = seatCreateSchema.safeParse({
      email: "x@y.com",
      role: "stranger",
    });
    expect(res.success).toBe(false);
  });

  it("enumerates the four allowed roles", () => {
    expect(seatRoleEnum.options).toEqual([
      "primary_caregiver",
      "sibling",
      "paid_aide",
      "clinician",
    ]);
  });
});
