// MongoDB TTL index required on stream_sessions.expiresAt (expireAfterSeconds: 0)
// Run once: db.stream_sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })

import { Router, Request, Response, NextFunction } from "express";
import { getDb } from "../server-core/database";
import { authMiddleware } from "../server-core/security";
import { resolvePatientId } from "../server-core/patientResolver";

const router = Router();

// ── Patient device token auth ─────────────────────────────────────────────
// Used by glasses (no Supabase). DVISION_PATIENT_TOKEN must match .env on glasses.
function deviceTokenAuth(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env.DVISION_PATIENT_TOKEN;
  const provided = req.headers.authorization?.replace("Bearer ", "");
  if (!expected || provided !== expected) {
    res.status(401).json({ detail: "Invalid device token" });
    return;
  }
  req.patientId = (req.params?.patientId ?? req.query.patientId ?? req.body?.patientId) as string;
  if (!req.patientId) {
    res.status(400).json({ detail: "patientId required" });
    return;
  }
  next();
}

// ── Either auth (caregiver JWT or glasses device token) ───────────────────
function eitherAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization ?? "";
  const expectedDevice = process.env.DVISION_PATIENT_TOKEN;
  const isDeviceToken =
    expectedDevice && authHeader === `Bearer ${expectedDevice}`;

  if (isDeviceToken) {
    deviceTokenAuth(req, res, next);
    return;
  }
  authMiddleware(req, res, () => resolvePatientId(req, res, next));
}

// ── Daily.co helpers ──────────────────────────────────────────────────────
const DAILY_BASE = "https://api.daily.co/v1";

async function dailyRequest(method: string, path: string, body?: object) {
  const res = await fetch(`${DAILY_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.DAILY_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Daily API ${method} ${path} failed: ${text}`);
  }
  return method === "DELETE" ? null : res.json();
}

async function createDailyRoom(patientId: string): Promise<{ name: string; url: string }> {
  const name = `vela-${patientId}-${Date.now()}`;
  const room = await dailyRequest("POST", "/rooms", {
    name,
    privacy: "private",
    properties: { exp: Math.floor(Date.now() / 1000) + 7200 },
  });
  return { name: room.name, url: room.url };
}

async function createDailyToken(roomName: string, isOwner: boolean): Promise<string> {
  const result = await dailyRequest("POST", "/meeting-tokens", {
    properties: {
      room_name: roomName,
      is_owner: isOwner,
      exp: Math.floor(Date.now() / 1000) + 3600,
    },
  });
  return result.token;
}

async function deleteDailyRoom(roomName: string): Promise<void> {
  await dailyRequest("DELETE", `/rooms/${roomName}`).catch(() => {});
}

async function setupDailySession(patientId: string): Promise<{
  roomName: string;
  roomUrl: string;
  glassesToken: string;
  caregiverToken: string;
}> {
  const { name: roomName, url: roomUrl } = await createDailyRoom(patientId);
  const glassesToken = await createDailyToken(roomName, false);
  const caregiverToken = await createDailyToken(roomName, true);
  return { roomName, roomUrl, glassesToken, caregiverToken };
}

// ── Session doc helper ─────────────────────────────────────────────────────
function sessionDoc(patientId: string, caregiverId: string | null, status: string, initiatedBy: string) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  return {
    patientId,
    caregiverId,
    status,
    initiatedBy,
    dailyRoomName: null as string | null,
    dailyRoomUrl: null as string | null,
    glassesToken: null as string | null,
    caregiverToken: null as string | null,
    requestedAt: now,
    approvedAt: null as Date | null,
    endedAt: null as Date | null,
    expiresAt,
  };
}

// ── Routes ────────────────────────────────────────────────────────────────

// POST /api/stream/request — caregiver asks to see patient's view
router.post("/request", authMiddleware, resolvePatientId, async (req, res) => {
  try {
    const db = getDb();
    const caregiverId = req.auth?.userId ?? null;
    const doc = sessionDoc(req.patientId!, caregiverId, "requested", "caregiver");
    await db.collection("stream_sessions").replaceOne(
      { patientId: req.patientId },
      doc,
      { upsert: true }
    );
    res.json({ status: "requested" });
  } catch (err) {
    console.error("stream/request error:", err);
    res.status(500).json({ detail: "Server error" });
  }
});

// POST /api/stream/register-push-token — caregiver registers their Expo push token
router.post("/register-push-token", authMiddleware, resolvePatientId, async (req, res) => {
  try {
    const { expoPushToken } = req.body;
    if (!expoPushToken) {
      res.status(400).json({ detail: "expoPushToken required" });
      return;
    }
    const db = getDb();
    await db.collection("pushTokens").updateOne(
      { patientId: req.patientId },
      { $set: { patientId: req.patientId, expoPushToken, updatedAt: new Date() } },
      { upsert: true }
    );
    res.json({ success: true });
  } catch (err) {
    console.error("stream/register-push-token error:", err);
    res.status(500).json({ detail: "Server error" });
  }
});

// POST /api/stream/invite — patient wants caregiver to join (glasses calls this)
router.post("/invite", deviceTokenAuth, async (req, res) => {
  try {
    const db = getDb();
    const { caregiverId } = req.body;
    const patientId = req.patientId!;
    const doc = sessionDoc(patientId, caregiverId ?? null, "invited", "patient");
    await db.collection("stream_sessions").replaceOne(
      { patientId },
      doc,
      { upsert: true }
    );

    // Send push notification to caregiver
    try {
      const tokenDoc = await db.collection("pushTokens").findOne({ patientId });
      if (tokenDoc?.expoPushToken) {
        const pushRes = await fetch("https://exp.host/push/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: tokenDoc.expoPushToken,
            title: "Live View Request",
            body: "Your patient is requesting a live view session.",
            data: { patientId, type: "livestream_invite" },
            android: { channelId: "livestream" },
          }),
        });
        if (!pushRes.ok) {
          console.error("Expo push failed:", await pushRes.text());
        }
        const pushBody = await pushRes.json();
        const ticket = pushBody?.data?.[0];
        if (ticket?.status === "error") {
          console.error("[stream/invite] Push delivery error:", ticket.details);
          if (ticket.details?.error === "DeviceNotRegistered") {
            // Remove stale token
            await db.collection("pushTokens").deleteOne({ patientId });
          }
        }
      }
    } catch (pushErr) {
      console.error("Push notification error (non-fatal):", pushErr);
    }

    res.json({ status: "invited" });
  } catch (err) {
    console.error("stream/invite error:", err);
    res.status(500).json({ detail: "Server error" });
  }
});

// POST /api/stream/approve — patient says "allow" (glasses calls this)
router.post("/approve", deviceTokenAuth, async (req, res) => {
  try {
    const db = getDb();
    const session = await db
      .collection("stream_sessions")
      .findOne({ patientId: req.patientId, status: "requested" });
    if (!session) {
      res.status(404).json({ detail: "No pending request" });
      return;
    }

    const { roomName, roomUrl, glassesToken, caregiverToken } = await setupDailySession(req.patientId!);

    await db.collection("stream_sessions").updateOne(
      { patientId: req.patientId },
      {
        $set: {
          status: "approved",
          dailyRoomName: roomName,
          dailyRoomUrl: roomUrl,
          glassesToken,
          caregiverToken,
          approvedAt: new Date(),
        },
      }
    );

    res.json({ status: "approved", roomUrl, glassesToken });
  } catch (err) {
    console.error("stream/approve error:", err);
    res.status(503).json({ detail: "Couldn't start stream, try again" });
  }
});

// POST /api/stream/deny — patient says "deny" (glasses calls this)
router.post("/deny", deviceTokenAuth, async (req, res) => {
  try {
    const db = getDb();
    await db.collection("stream_sessions").updateOne(
      { patientId: req.patientId, status: { $in: ["requested", "invited"] } },
      { $set: { status: "denied", endedAt: new Date() } }
    );
    res.json({ status: "denied" });
  } catch (err) {
    console.error("stream/deny error:", err);
    res.status(500).json({ detail: "Server error" });
  }
});

// GET /api/stream/status/:patientId — poll session state (both sides)
router.get("/status/:patientId", eitherAuth, async (req, res) => {
  try {
    const db = getDb();
    const patientId = req.patientId;
    const session = await db
      .collection("stream_sessions")
      .findOne({ patientId }, { projection: { _id: 0 } });
    if (!session) {
      res.json({ status: null });
      return;
    }
    const isDeviceCaller = req.headers.authorization === `Bearer ${process.env.DVISION_PATIENT_TOKEN}`;
    const response: Record<string, unknown> = {
      status: session.status,
      initiatedBy: session.initiatedBy,
      dailyRoomUrl: session.dailyRoomUrl,
      approvedAt: session.approvedAt,
    };
    if (isDeviceCaller) response.glassesToken = session.glassesToken;
    else response.caregiverToken = session.caregiverToken;
    res.json(response);
  } catch (err) {
    console.error("stream/status error:", err);
    res.status(500).json({ detail: "Server error" });
  }
});

// POST /api/stream/end — either side ends the session
router.post("/end", eitherAuth, async (req, res) => {
  try {
    const db = getDb();
    const patientId = req.patientId;
    if (!patientId) {
      res.status(400).json({ detail: "patientId could not be resolved" });
      return;
    }
    const session = await db
      .collection("stream_sessions")
      .findOne({ patientId });

    if (session?.dailyRoomName) {
      await deleteDailyRoom(session.dailyRoomName);
    }

    await db.collection("stream_sessions").updateOne(
      { patientId },
      { $set: { status: "ended", endedAt: new Date() } }
    );

    res.json({ status: "ended" });
  } catch (err) {
    console.error("stream/end error:", err);
    res.status(500).json({ detail: "Server error" });
  }
});

// POST /api/stream/accept — caregiver accepts patient-initiated invite (creates Daily room)
router.post("/accept", authMiddleware, resolvePatientId, async (req, res) => {
  try {
    const db = getDb();
    const session = await db
      .collection("stream_sessions")
      .findOne({ patientId: req.patientId, status: "invited" });
    if (!session) {
      res.status(404).json({ detail: "No pending invite" });
      return;
    }

    const { roomName, roomUrl, glassesToken, caregiverToken } = await setupDailySession(req.patientId!);

    await db.collection("stream_sessions").updateOne(
      { patientId: req.patientId },
      {
        $set: {
          status: "approved",
          dailyRoomName: roomName,
          dailyRoomUrl: roomUrl,
          glassesToken,
          caregiverToken,
          approvedAt: new Date(),
        },
      }
    );

    res.json({ status: "approved", roomUrl, caregiverToken });
  } catch (err) {
    console.error("stream/accept error:", err);
    res.status(503).json({ detail: "Couldn't start stream, try again" });
  }
});

export default router;
