import { describe, it, expect } from "vitest";
import { visitCreateSchema } from "./visits";

describe("visitCreateSchema", () => {
  it("accepts valid visit", () => {
    expect(visitCreateSchema.safeParse({
      providerName: "Dr. Patel",
      providerRole: "neurologist",
      scheduledFor: "2026-05-10T14:00:00Z",
      notes: "Quarterly check-in"
    }).success).toBe(true);
  });
  it("rejects empty providerName", () => {
    expect(visitCreateSchema.safeParse({ providerName: "", scheduledFor: "2026-05-10T14:00:00Z" }).success).toBe(false);
  });
});
