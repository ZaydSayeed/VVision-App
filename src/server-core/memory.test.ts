import { describe, it, expect, vi } from "vitest";
import { buildMemoryScope } from "./memory";

describe("buildMemoryScope", () => {
  it("returns a scope object keyed by patient_id", () => {
    const scope = buildMemoryScope("patient-42");
    expect(scope.user_id).toBe("patient-42");
  });

  it("throws on empty patient id", () => {
    expect(() => buildMemoryScope("")).toThrow("patientId is required");
  });
});
