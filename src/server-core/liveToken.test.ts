import { describe, it, expect } from "vitest";
import { signLiveToken, verifyLiveToken, LIVE_TOKEN_TTL_MS } from "./liveToken";

const SECRET = "test-secret";
const payload = { patientId: "p1", userId: "u1" };

describe("live WS token", () => {
  it("round-trips a freshly signed token", () => {
    const now = 1_000_000;
    const token = signLiveToken(payload, SECRET, now);
    expect(verifyLiveToken(token, SECRET, now)).toEqual(payload);
  });

  it("rejects an expired token", () => {
    const now = 1_000_000;
    const token = signLiveToken(payload, SECRET, now);
    expect(verifyLiveToken(token, SECRET, now + LIVE_TOKEN_TTL_MS + 1)).toBeNull();
  });

  it("rejects a tampered payload", () => {
    const now = 1_000_000;
    const token = signLiveToken(payload, SECRET, now);
    const [b64] = token.split(".");
    const forged = `${b64}.deadbeef`;
    expect(verifyLiveToken(forged, SECRET, now)).toBeNull();
  });

  it("rejects a token signed with a different secret", () => {
    const now = 1_000_000;
    const token = signLiveToken(payload, SECRET, now);
    expect(verifyLiveToken(token, "other-secret", now)).toBeNull();
  });

  it("fails closed when no secret is configured", () => {
    expect(verifyLiveToken("anything", "", Date.now())).toBeNull();
    expect(verifyLiveToken("", SECRET, Date.now())).toBeNull();
  });
});
