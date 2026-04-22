import { describe, it, expect } from "vitest";
import { enforceSeatLimit } from "./subscription";

describe("enforceSeatLimit", () => {
  it("allows adding a seat when under starter cap (2 seats)", () => {
    expect(enforceSeatLimit("starter", 1)).toBe(true);
  });
  it("blocks adding a seat when at starter cap", () => {
    expect(enforceSeatLimit("starter", 2)).toBe(false);
  });
  it("allows unlimited-tier regardless of count", () => {
    expect(enforceSeatLimit("unlimited", 100)).toBe(true);
  });
  it("blocks adding when tier is free (no subscription)", () => {
    expect(enforceSeatLimit("free", 0)).toBe(false);
  });
});
