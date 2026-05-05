import { describe, it, expect } from "vitest";
import { deviceCodeSchema } from "./device";

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

  it("accepts exactly 4 chars", () => {
    expect(deviceCodeSchema.safeParse({ device_code: "ABCD" }).success).toBe(true);
  });

  it("accepts exactly 12 chars", () => {
    expect(deviceCodeSchema.safeParse({ device_code: "ABCDEFGHIJKL" }).success).toBe(true);
  });
});
