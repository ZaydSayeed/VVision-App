import http from "http";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { config, validateConfig } from "./server-core/config";
import { connectDb, closeDb } from "./server-core/database";
import { attachLiveBridge } from "./server-core/liveBridge";
import { startCron } from "./server-jobs/scheduler";

import authRoutes from "./server-routes/auth";
import patientRoutes from "./server-routes/patients";
import peopleRoutes from "./server-routes/people";
import alertRoutes from "./server-routes/alerts";
import routineRoutes from "./server-routes/routines";
import medicationRoutes from "./server-routes/medications";
import helpAlertRoutes from "./server-routes/helpAlerts";
import caregiverProfileRoutes from "./server-routes/caregiverProfiles";
import streamRoutes from "./server-routes/stream";
import reminderRoutes from "./server-routes/reminders";
import conversationRoutes from "./server-routes/conversations";
import assistantRoutes from "./server-routes/assistant";
import noteRoutes from "./server-routes/notes";
import profileRoutes from "./server-routes/profiles";
import seatRoutes from "./server-routes/seats";
import memoryRoutes from "./server-routes/memories";
import liveRoutes from "./server-routes/live";
import patternRoutes from "./server-routes/patterns";
import visitRoutes from "./server-routes/visits";
import eventRoutes from "./server-routes/events";
import doctorRoutes from "./server-routes/doctors";
import reportRoutes from "./server-routes/reports";
import healthRoutes from "./server-routes/health";
import subscriptionRoutes from "./server-routes/subscription";
import revenueCatWebhookRoutes from "./server-routes/revenueCatWebhook";
import onboardingRoutes from "./server-routes/onboarding";
import streamSessionRoutes from "./server-routes/streamSessions";
import deviceRoutes from "./server-routes/device";
import patientTokensRouter from "./server-routes/patientTokens";
import moodRouter from "./server-routes/mood";
import geofenceRouter, { patientGeofenceRouter } from "./server-routes/geofence";
import cronRoutes from "./server-routes/cron";

const app = express();

// Security headers
app.use(helmet());

// CORS — native app requests have no Origin header (always allowed); browser
// origins are restricted to local dev and the velavision.org domain.
function isAllowedOrigin(origin: string): boolean {
  if (origin.startsWith("exp://")) return true; // Expo Go
  try {
    const { protocol, hostname } = new URL(origin);
    if (protocol !== "http:" && protocol !== "https:") return false;
    if (hostname === "localhost" || hostname === "127.0.0.1") return true;
    return hostname === "velavision.org" || hostname.endsWith(".velavision.org");
  } catch {
    return false;
  }
}

app.use(cors({
  origin: (origin, cb) => {
    // No origin = native mobile app / curl / server-to-server — allow.
    if (!origin || isAllowedOrigin(origin)) {
      cb(null, true);
    } else {
      cb(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// Body parsing with size limit
app.use(express.json({ limit: "1mb" }));

// Request logging — method, path, status, and latency (logged on response
// finish). Keeps prod debuggable without an APM; add a structured logger /
// Sentry breadcrumb here later if needed.
app.use((req, res, next) => {
  const startedAt = Date.now();
  res.on("finish", () => {
    console.log(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - startedAt}ms`);
  });
  next();
});

// Rate limiting — strict on auth & link endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { detail: "Too many requests. Please try again later." },
});

const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { detail: "Too many requests. Please slow down." },
});

app.use("/api/auth", authLimiter);
app.use("/api/patients/link", authLimiter);
app.use("/api/webhooks", revenueCatWebhookRoutes);
// Cron trigger is hit ~every minute by an external scheduler — mount it before
// the general rate limiter (it has its own shared-secret auth).
app.use("/api/internal", cronRoutes);
app.use("/api", generalLimiter);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/patients", patientRoutes);
app.use("/api/profiles", profileRoutes);
app.use("/api/profiles", seatRoutes);
app.use("/api/profiles", memoryRoutes);
app.use("/api/people", peopleRoutes);
app.use("/api/alerts", alertRoutes);
app.use("/api/routines", routineRoutes);
app.use("/api/medications", medicationRoutes);
app.use("/api/help-alerts", helpAlertRoutes);
app.use("/api/caregiver-profiles", caregiverProfileRoutes);
app.use("/stream", streamRoutes);
app.use("/api/reminders", reminderRoutes);
app.use("/api/notes", noteRoutes);
app.use("/api/conversations", conversationRoutes);
app.use("/api/assistant", assistantRoutes);
app.use("/api/live", liveRoutes);
app.use("/api/profiles", patternRoutes);
app.use("/api/profiles", visitRoutes);
app.use("/api/profiles", eventRoutes);
app.use("/api/profiles", doctorRoutes);
app.use("/api/profiles", reportRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/profiles", healthRoutes);
app.use("/api/profiles", subscriptionRoutes);
app.use("/api/profiles", onboardingRoutes);
app.use("/api/profiles", deviceRoutes);
app.use("/api/device", deviceRoutes);
app.use("/api/stream", streamSessionRoutes);
app.use("/api/notifications", patientTokensRouter);
app.use("/api/mood", moodRouter);
app.use("/api/profiles/mine/geofence-check", patientGeofenceRouter);
app.use("/api/profiles/:patientId/geofence", geofenceRouter);

// Health check — always returns 200 (process is alive)
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Readiness check — verifies DB is reachable
app.get("/ready", async (_req, res) => {
  try {
    const { getDb } = await import("./server-core/database");
    await getDb().command({ ping: 1 });
    res.json({ status: "ready" });
  } catch {
    res.status(503).json({ status: "unavailable" });
  }
});

// Global error handler — catches any unhandled errors from routes
app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  console.error(`Unhandled error: ${req.method} ${req.path} —`, err?.stack || err);
  if (res.headersSent) return;
  res.status(500).json({ detail: "Internal server error" });
});

// Catch unhandled promise rejections so server doesn't crash silently
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
});

async function start() {
  try {
    validateConfig();
    await connectDb();
    console.log("MongoDB connected");
    startCron();

    const server = http.createServer(app);
    attachLiveBridge(server);
    server.listen(config.port, "0.0.0.0", () => {
      console.log(`Server running on http://0.0.0.0:${config.port}`);
    });

    async function shutdown(signal: string) {
      console.log(`${signal} received — shutting down gracefully`);
      server.close(async () => {
        await closeDb();
        process.exit(0);
      });
      setTimeout(() => process.exit(1), 10000);
    }

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  } catch (err) {
    console.error("Failed to start:", err);
    process.exit(1);
  }
}

start();
