import crypto from "crypto";

/**
 * Short-lived HMAC-signed token authorizing a single Gemini Live WebSocket
 * connection (SEC-01). Minted by the authenticated /api/live/session endpoint
 * and validated at the WS upgrade so the live AI relay is no longer open to the
 * world. Stateless (no shared store); fails closed when no secret is configured.
 */
export const LIVE_TOKEN_TTL_MS = 60_000; // only needs to survive the WS open

export interface LivePayload {
  patientId: string;
  userId: string;
}

export function signLiveToken(payload: LivePayload, secret: string, now: number = Date.now()): string {
  if (!secret) return "";
  const body = JSON.stringify({ patientId: payload.patientId, userId: payload.userId, exp: now + LIVE_TOKEN_TTL_MS });
  const b64 = Buffer.from(body).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(b64).digest("base64url");
  return `${b64}.${sig}`;
}

export function verifyLiveToken(token: string, secret: string, now: number = Date.now()): LivePayload | null {
  if (!secret || !token) return null;
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const b64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  const expected = crypto.createHmac("sha256", secret).update(b64).digest("base64url");
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(b64, "base64url").toString());
    if (typeof parsed.exp !== "number" || parsed.exp < now) return null;
    if (typeof parsed.patientId !== "string" || typeof parsed.userId !== "string") return null;
    return { patientId: parsed.patientId, userId: parsed.userId };
  } catch {
    return null;
  }
}
