import { describe, it, expect } from "vitest";
import { onboardingProgressSchema } from "./onboarding";

describe("onboardingProgressSchema", () => {
  it("accepts known steps with boolean values", () => {
    expect(onboardingProgressSchema.safeParse({
      profile_basics: true, profile_story: true, siblings: false,
      smart_home: false, caller_setup: false, paywall: false,
    }).success).toBe(true);
  });
  it("rejects unknown keys", () => {
    expect(onboardingProgressSchema.safeParse({ unknown: true }).success).toBe(false);
  });
});
