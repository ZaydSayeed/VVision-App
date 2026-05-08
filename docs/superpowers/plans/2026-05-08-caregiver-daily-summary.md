# Caregiver Daily Morning Summary Push Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every morning at 8am UTC, caregivers receive a push notification summarizing how their patient did overnight — sleep, medication completion, and any help alerts.

**Architecture:** A new server job queries the `seats` collection to find all caregivers, collects each patient's last 24h health data (from `patient_health_readings`) + medication completion + help alerts, generates a one-line Gemini summary, and sends via Expo Push to the caregiver's token from the `pushTokens` collection. One push per caregiver–patient pair.

**Tech Stack:** Express/TypeScript, MongoDB, Google Gemini API (`gemini-2.0-flash`), Expo Push API, node-cron

**Prerequisite:** `GEMINI_API_KEY` must be set in environment (already used by other jobs). The `pushTokens` collection stores caregiver tokens keyed by `patientId` (already registered by RootNavigator for caregivers).

---

## File Structure

- Create: `src/server-jobs/dailySummary.ts` — job logic
- Create: `src/server-jobs/dailySummary.test.ts` — unit tests
- Modify: `src/server-jobs/scheduler.ts` — add 8am UTC cron

---

### Task 1: Build the daily summary job

**Files:**
- Create: `src/server-jobs/dailySummary.ts`
- Create: `src/server-jobs/dailySummary.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/server-jobs/dailySummary.test.ts
import { describe, it, expect, vi } from "vitest";
import { buildSummaryContext } from "./dailySummary";

describe("buildSummaryContext", () => {
  it("returns a context string with all fields when data is present", () => {
    const ctx = buildSummaryContext({
      patientName: "Margaret",
      sleepHours: 7.5,
      steps: 1200,
      medsDoneCount: 2,
      medsTotalCount: 3,
      helpAlertsCount: 0,
    });
    expect(ctx).toContain("Margaret");
    expect(ctx).toContain("7.5");
    expect(ctx).toContain("2/3");
    expect(ctx).toContain("0 help");
  });

  it("handles missing health data gracefully", () => {
    const ctx = buildSummaryContext({
      patientName: "Bob",
      sleepHours: null,
      steps: null,
      medsDoneCount: 0,
      medsTotalCount: 0,
      helpAlertsCount: 1,
    });
    expect(ctx).toContain("Bob");
    expect(ctx).toContain("no sleep data");
    expect(ctx).toContain("1 help");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
cd /Users/haadisiddiqui/projects/VVision-App && npx vitest run src/server-jobs/dailySummary.test.ts
```
Expected: FAIL (module not found)

- [ ] **Step 3: Implement dailySummary.ts**

```typescript
// src/server-jobs/dailySummary.ts
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
    if (ticket.details?.error === "DeviceNotRegistered") {
      return; // caller handles cleanup
    }
  }
}

export async function runDailySummaries(db: Db): Promise<void> {
  const since24h = new Date(Date.now() - 24 * 3600_000).toISOString();
  const today = new Date().toISOString().slice(0, 10);

  // Get all caregiver tokens keyed by patientId
  const tokenDocs = await db.collection("pushTokens").find({}).toArray();
  if (tokenDocs.length === 0) return;

  for (const tokenDoc of tokenDocs) {
    const { patientId, expoPushToken, caregiverId } = tokenDoc;
    if (!patientId || !expoPushToken) continue;

    try {
      // Get patient name
      const patient = await db.collection("patients").findOne({ _id: patientId });
      const user = await db.collection("users").findOne({ patient_id: patientId });
      const patientName = user?.name ?? "Your patient";

      // Sleep hours for today
      const sleepDoc = await db.collection("patient_health_readings").findOne({
        patientId: String(patientId),
        metric: "sleep",
        date: today,
      });

      // Steps for today
      const stepsDoc = await db.collection("patient_health_readings").findOne({
        patientId: String(patientId),
        metric: "steps",
        date: today,
      });

      // Meds completion today
      const meds = await db.collection("medications").find({ patient_id: patientId }).toArray();
      const medsDoneCount = meds.filter((m: any) => m.taken_date === today).length;

      // Help alerts in last 24h
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
```

- [ ] **Step 4: Run test to verify it passes**

```
cd /Users/haadisiddiqui/projects/VVision-App && npx vitest run src/server-jobs/dailySummary.test.ts
```
Expected: PASS (2 tests)

- [ ] **Step 5: Add to scheduler at 8am UTC**

In `src/server-jobs/scheduler.ts`, add:

```typescript
import { runDailySummaries } from "./dailySummary";

export function startCron() {
  // Nightly 03:00 UTC — pattern inference
  cron.schedule("0 3 * * *", async () => {
    try { await runInferenceAll(getDb()); } catch (e) { console.error("nightly inference:", e); }
  });

  // Every 5 minutes — fire due reminders
  cron.schedule("*/5 * * * *", async () => {
    try { await fireRemindersForAll(getDb()); } catch (e) { console.error("fireReminders:", e); }
  });

  // 8am UTC — caregiver daily summary push
  cron.schedule("0 8 * * *", async () => {
    try { await runDailySummaries(getDb()); } catch (e) { console.error("dailySummary:", e); }
  });

  console.log("cron scheduled");
}
```

**Note:** The scheduler.ts shown above assumes the reminder cron from plan `2026-05-08-reminder-push-notifications.md` is already merged. If it is not, include only the existing nightly inference line plus the new 8am line.

- [ ] **Step 6: Verify TypeScript compiles**

```
cd /Users/haadisiddiqui/projects/VVision-App && npx tsc --noEmit 2>&1 | head -30
```
Expected: No new errors

- [ ] **Step 7: Run all tests**

```
cd /Users/haadisiddiqui/projects/VVision-App && npx vitest run
```
Expected: All tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/server-jobs/dailySummary.ts src/server-jobs/dailySummary.test.ts src/server-jobs/scheduler.ts
git commit -m "feat: add caregiver daily morning summary push at 8am UTC"
```
