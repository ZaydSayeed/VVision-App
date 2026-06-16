import { describe, it, expect } from "vitest";
import { isAuthorizedCronRequest } from "./cron";

describe("isAuthorizedCronRequest", () => {
  it("rejects when no secret is configured, even if a value is provided", () => {
    expect(isAuthorizedCronRequest("", "")).toBe(false);
    expect(isAuthorizedCronRequest(undefined, "")).toBe(false);
    expect(isAuthorizedCronRequest("anything", "")).toBe(false);
  });

  it("rejects a missing or wrong secret", () => {
    expect(isAuthorizedCronRequest(undefined, "s3cret")).toBe(false);
    expect(isAuthorizedCronRequest("nope", "s3cret")).toBe(false);
  });

  it("accepts the exact configured secret", () => {
    expect(isAuthorizedCronRequest("s3cret", "s3cret")).toBe(true);
  });
});
