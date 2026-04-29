import express from "express";
import cors from "cors";
import { config } from "./server-core/config";
import { connectDb, closeDb } from "./server-core/database";

import authRoutes from "./server-routes/auth";
import patientRoutes from "./server-routes/patients";
import peopleRoutes from "./server-routes/people";
import alertRoutes from "./server-routes/alerts";
import routineRoutes from "./server-routes/routines";
import medicationRoutes from "./server-routes/medications";
import helpAlertRoutes from "./server-routes/helpAlerts";
import caregiverProfileRoutes from "./server-routes/caregiverProfiles";
import streamRoutes from "./server-routes/stream";
import streamSessionRoutes from "./server-routes/streamSessions";

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/patients", patientRoutes);
app.use("/api/people", peopleRoutes);
app.use("/api/alerts", alertRoutes);
app.use("/api/routines", routineRoutes);
app.use("/api/medications", medicationRoutes);
app.use("/api/help-alerts", helpAlertRoutes);
app.use("/api/caregiver-profiles", caregiverProfileRoutes);
app.use("/stream", streamRoutes);
app.use("/api/stream", streamSessionRoutes);

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

async function start() {
  try {
    await connectDb();
    console.log("MongoDB connected");

    app.listen(config.port, "0.0.0.0", () => {
      console.log(`Server running on http://0.0.0.0:${config.port}`);
    });
  } catch (err) {
    console.error("Failed to start:", err);
    process.exit(1);
  }
}

process.on("SIGINT", async () => {
  await closeDb();
  process.exit(0);
});

start();
