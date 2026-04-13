import { describe, it, expect } from "vitest";
import { memoryAddSchema } from "./memories";

describe("memoryAddSchema", () => {
  it("accepts valid content + metadata", () => {
    const res = memoryAddSchema.safeParse({
      content: "Mom asked about Dad 12 times today",
      metadata: { source: "check_in", mood: "anxious" },
    });
    expect(res.success).toBe(true);
  });

  it("rejects empty content", () => {
    const res = memoryAddSchema.safeParse({ content: "" });
    expect(res.success).toBe(false);
  });

  it("rejects content over 5000 chars", () => {
    const res = memoryAddSchema.safeParse({ content: "x".repeat(5001) });
    expect(res.success).toBe(false);
  });
});
