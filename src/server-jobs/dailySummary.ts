import { Db } from "mongodb";
import { GoogleGenAI } from "@google/genai";
import { config } from "../server-core/config";

interface SummaryInput {
  patientName: string;
  sleepHours: number | null;
  steps: number | null;
  medsDoneCount: number;
  medsTotalCount: number;
  helpAlertsCount: number;
}

export function buildSummaryContext(input: SummaryInput): string {
  const sleepStr = input.sleepHours != null ? `${input.sleepHours}h sleep` : "no sleep data";
  const stepsStr = input.steps != null ? `${input.steps} steps` : "no step data";
  const medsStr = input.medsTotalCount > 0
    ? `${input.medsDoneCount}/${input.medsTotalCount} medications taken`
    : "no medications scheduled";
  const helpStr = `${input.helpAlertsCount} help alert${input.helpAlertsCount !== 1 ? "s" : ""}`;
  return `Patient: ${input.patientName}. Last 24h: ${sleepStr}, ${stepsStr}, ${medsStr}, ${helpStr}.`;
}

async function generateOneLiner(context: string): Promise<string> {
  if (!config.geminiApiKey) return context;
  const genai = new GoogleGenAI({ apiKey: config.geminiApiKey });
  const result = await genai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: `You are writing a one-line morning summary for a family caregiver about their loved one with dementia. Be warm, concise (under 20 words), and factual. No emojis. Data: ${context}`,
  });
  return (result.text ?? context).trim().replace(/\.$/, "");
}

async function sendExpoPush(
  token: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  const res = await fetch("https://exp.host/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to: token, title, body, data: data ?? {} }),
  });
  const json = await res.json();
  const ticket = json?.data?.[0];
  if (ticket?.status === "error") {
    console.error("[dailySummary] push delivery error:", ticket.details);
  }
}

export async function runDailySummaries(db: Db): Promise<void> {
  const since24h = new Date(Date.now() - 24 * 3600_000).toISOString();
  const today = new Date().toISOString().slice(0, 10);

  const tokenDocs = await db.collection("pushTokens").find({}).toArray();
  if (tokenDocs.length === 0) return;

  for (const tokenDoc of tokenDocs) {
    const { patientId, expoPushToken } = tokenDoc;
    if (!patientId || !expoPushToken) continue;

    try {
      const user = await db.collection("users").findOne({ patient_id: patientId });
      const patientName = user?.name ?? "Your patient";

      const sleepDoc = await db.collection("patient_health_readings").findOne({
        patientId: String(patientId),
        metric: "sleep",
        date: today,
      });

      const stepsDoc = await db.collection("patient_health_readings").findOne({
        patientId: String(patientId),
        metric: "steps",
        date: today,
      });

      const meds = await db.collection("medications").find({ patient_id: patientId }).toArray();
      const medsDoneCount = meds.filter((m: any) => m.taken_date === today).length;

      const helpCount = await db.collection("help_alerts").countDocuments({
        patient_id: patientId,
        timestamp: { $gte: since24h },
      });

      const ctx = buildSummaryContext({
        patientName,
        sleepHours: sleepDoc?.value ?? null,
        steps: stepsDoc?.value ?? null,
        medsDoneCount,
        medsTotalCount: meds.length,
        helpAlertsCount: helpCount,
      });

      const summaryLine = await generateOneLiner(ctx);

      await sendExpoPush(
        expoPushToken,
        `Good morning — ${patientName}`,
        summaryLine,
        { patientId: String(patientId), type: "daily_summary" }
      );
    } catch (err) {
      console.error("[dailySummary] failed for patient", patientId, err);
    }
  }
}
