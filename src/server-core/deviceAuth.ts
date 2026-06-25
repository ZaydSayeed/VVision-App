import { Request, Response, NextFunction } from "express";
import { ObjectId } from "mongodb";
import crypto from "crypto";
import { getDb } from "./database";

// Constant-time string comparison — avoids leaking the shared token via timing.
function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

const DEVICE_CODE_RE = /^[A-Z0-9-]{4,12}$/;

// True iff the request carries the shared glasses device token. Used to branch
// between device-token auth and caregiver-JWT auth on dual-mode routes.
export function isDeviceTokenRequest(req: Request): boolean {
  const expected = process.env.DVISION_PATIENT_TOKEN;
  const provided = req.headers.authorization?.replace("Bearer ", "") ?? "";
  return !!expected && constantTimeEqual(provided, expected);
}

// Authenticates a hardware device (glasses) using the shared DVISION_PATIENT_TOKEN
// AND the device's own per-patient `device_code`. The patient the request is
// allowed to act on is resolved SERVER-SIDE from the device_links binding
// (device_code -> patient_id) and written to req.patientId — it is NEVER taken
// from a request-supplied patientId. This closes two holes that previously let any
// holder of the shared token act on arbitrary patients:
//   1. cross-patient access (the shared token was not bound to any patient), and
//   2. NoSQL operator injection via a patientId object like {"$ne": null}.
export async function deviceTokenAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!isDeviceTokenRequest(req)) {
    res.status(401).json({ detail: "Invalid device token" });
    return;
  }

  // device_code may arrive via header (preferred), body, or query — always coerce
  // to a string and validate shape so it can't smuggle a query operator.
  const deviceCode = String(
    req.headers["x-device-code"] ?? (req.body as any)?.device_code ?? req.query.device_code ?? ""
  )
    .trim()
    .toUpperCase();
  if (!DEVICE_CODE_RE.test(deviceCode)) {
    res.status(400).json({ detail: "Valid device_code required" });
    return;
  }

  try {
    const link = await getDb().collection("device_links").findOne({ device_code: deviceCode });
    const patientId = link?.patient_id != null ? String(link.patient_id) : null;
    if (!patientId || !ObjectId.isValid(patientId)) {
      res.status(403).json({ detail: "Device not linked to a patient" });
      return;
    }
    req.patientId = patientId;
    next();
  } catch (err) {
    next(err);
  }
}
