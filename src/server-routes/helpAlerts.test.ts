import { describe, it, expect } from "vitest";
import { alertOut } from "./helpAlerts";

describe("alertOut — acknowledgement fields", () => {
  it("defaults acknowledged state to false/null when absent", () => {
    const out = alertOut({ _id: "x", patient_id: "p1", timestamp: "t" });
    expect(out.acknowledged).toBe(false);
    expect(out.acknowledged_at).toBeNull();
  });

  it("passes through a recorded acknowledgement (who-is-responding state)", () => {
    const out = alertOut({
      _id: "x",
      patient_id: "p1",
      timestamp: "t",
      acknowledged: true,
      acknowledged_at: "2026-06-16T10:00:00Z",
    });
    expect(out.acknowledged).toBe(true);
    expect(out.acknowledged_at).toBe("2026-06-16T10:00:00Z");
  });
});
