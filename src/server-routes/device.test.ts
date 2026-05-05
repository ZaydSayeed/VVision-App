import { describe, it, expect } from "vitest";
import { z } from "zod";

const deviceCodeSchema = z.object({
  device_code: z
    .string()
    .min(4)
    .max(12)
    .regex(/^[A-Z0-9-]+$/, "device_code must be uppercase alphanumeric with optional dashes"),
});

describe("deviceCodeSchema", () => {
  it("accepts valid code", () => {
    expect(deviceCodeSchema.safeParse({ device_code: "VELA1234" }).success).toBe(true);
  });

  it("accepts code with dash", () => {
    expect(deviceCodeSchema.safeParse({ device_code: "VELA-1234" }).success).toBe(true);
  });

  it("rejects lowercase", () => {
    expect(deviceCodeSchema.safeParse({ device_code: "vela1234" }).success).toBe(false);
  });

  it("rejects too short", () => {
    expect(deviceCodeSchema.safeParse({ device_code: "AB" }).success).toBe(false);
  });

  it("rejects too long", () => {
    expect(deviceCodeSchema.safeParse({ device_code: "ABCDEFGHIJKLMN" }).success).toBe(false);
  });

  it("rejects special chars", () => {
    expect(deviceCodeSchema.safeParse({ device_code: "VELA@123" }).success).toBe(false);
  });
});
