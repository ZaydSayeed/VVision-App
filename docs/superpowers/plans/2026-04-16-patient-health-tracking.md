# Patient Health Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a patient-side Health tab fed by Apple HealthKit (Steps, Heart Rate, Active Minutes, Sleep) with line-chart trends, surface the data on the caregiver side (Today's Health strip + Health screen), and remove the obsolete caregiver-side gait/typing sensor capture.

**Architecture:** Patient phone reads HealthKit via `react-native-health` (Expo config plugin). Background `HKObserverQuery` + on-app-open both POST batched readings to a new `/api/profiles/:patientId/health/sync` endpoint that upserts into a `patient_health_readings` MongoDB collection (deduped by patientId+metric+date). Patient and caregiver apps read aggregates via `/summary` and `/trends`. Existing `requirePatientAccess` middleware handles auth for both roles.

**Tech Stack:** Express + MongoDB + Vitest (backend); React Native + Expo + react-navigation + `react-native-health` + `react-native-gifted-charts` + `react-native-svg` (mobile).

**Spec:** `docs/superpowers/specs/2026-04-16-patient-health-tracking-design.md`

---

## File Structure

**Backend (new):**
- `src/server-routes/health.ts` — sync, summary, trends endpoints
- `src/server-routes/health.test.ts` — schema tests

**Backend (modified):**
- `src/server.ts` — mount the new router
- `src/server-core/database.ts` — register indexes for `patient_health_readings`

**Patient/shared mobile (new):**
- `src/services/healthkit.ts` — wrapper around react-native-health (queries, observer registration, permission request)
- `src/services/healthSync.ts` — orchestrates on-open + background sync; calls API
- `src/api/health.ts` — API client functions
- `src/hooks/useHealthSummary.ts` — fetch today's summary
- `src/hooks/useHealthTrends.ts` — fetch trend series
- `src/components/health/MetricCard.tsx` — line chart card
- `src/components/health/RangeToggle.tsx` — 7d/30d/90d toggle
- `src/components/health/PatientHealthStrip.tsx` — caregiver Today's Health strip
- `src/screens/patient/HealthScreen.tsx` — patient Health tab
- `src/screens/patient/HealthOnboardingScreen.tsx` — first-time HealthKit permission onboarding
- `src/screens/caregiver/CaregiverHealthScreen.tsx` — caregiver health view

**Mobile (modified):**
- `src/navigation/PatientTabNavigator.tsx` — add Health tab
- `src/navigation/RootNavigator.tsx` — register CaregiverHealthScreen + remove SensorSettings registration
- `src/screens/caregiver/PatientDetailScreen.tsx` — add Health button
- `src/screens/caregiver/PatientsDashboardScreen.tsx` — add `<PatientHealthStrip>` to each patient card
- `src/components/SideDrawer.tsx` — remove Sensors row
- `src/screens/caregiver/CheckInScreen.tsx` — remove gait capture
- `src/screens/caregiver/CheckInTextScreen.tsx` — remove typing capture
- `App.tsx` — register HealthKit observers on patient login
- `app.json` — add react-native-health config plugin + Info.plist keys + UIBackgroundModes

**Mobile (deleted):**
- `src/screens/caregiver/SensorSettingsScreen.tsx`
- `src/hooks/useSensorPrefs.ts` (only after confirming no other consumers)
- Any `useGaitCapture` / `useTypingCapture` hook files

---

## Phase 1 — Backend foundation

### Task 1: Add Mongo indexes for `patient_health_readings`

**Files:**
- Modify: `src/server-core/database.ts`

- [ ] **Step 1: Find the existing index registration block**

Open `src/server-core/database.ts` and locate the function that creates indexes on startup (look for `createIndex` calls on other collections). All new indexes go in the same function.

- [ ] **Step 2: Add the indexes**

In the index-creation function, add:

```typescript
const healthReadings = db.collection("patient_health_readings");
await healthReadings.createIndex(
  { patientId: 1, metric: 1, date: 1 },
  { unique: true, name: "patient_metric_date_unique" }
);
await healthReadings.createIndex(
  { patientId: 1, metric: 1, date: -1 },
  { name: "patient_metric_date_desc" }
);
```

- [ ] **Step 3: Restart the dev server and verify no errors**

Run: `npm run dev:server` (or whatever script the repo uses; check package.json). Expected: server starts, no Mongo errors. Stop the server.

- [ ] **Step 4: Commit**

```bash
git add src/server-core/database.ts
git commit -m "feat(health): add indexes for patient_health_readings collection"
```

---

### Task 2: Create the health route file with the sync schema and a passing schema test

**Files:**
- Create: `src/server-routes/health.ts`
- Create: `src/server-routes/health.test.ts`

- [ ] **Step 1: Write the failing schema test**

Create `src/server-routes/health.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { syncSchema } from "./health";

describe("syncSchema", () => {
  it("accepts a valid batch", () => {
    const r = syncSchema.safeParse({
      readings: [
        { metric: "steps", date: "2026-04-16", value: 4821, unit: "count" },
        { metric: "heart_rate", date: "2026-04-16", value: 72, unit: "bpm" },
      ],
    });
    expect(r.success).toBe(true);
  });
  it("rejects unknown metric", () => {
    const r = syncSchema.safeParse({
      readings: [{ metric: "nope", date: "2026-04-16", value: 1, unit: "count" }],
    });
    expect(r.success).toBe(false);
  });
  it("rejects empty batch", () => {
    expect(syncSchema.safeParse({ readings: [] }).success).toBe(false);
  });
  it("rejects bad date format", () => {
    const r = syncSchema.safeParse({
      readings: [{ metric: "steps", date: "04/16/2026", value: 1, unit: "count" }],
    });
    expect(r.success).toBe(false);
  });
  it("rejects negative value", () => {
    const r = syncSchema.safeParse({
      readings: [{ metric: "steps", date: "2026-04-16", value: -5, unit: "count" }],
    });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test, expect failure**

Run: `npx vitest run src/server-routes/health.test.ts`
Expected: FAIL — module `./health` does not exist.

- [ ] **Step 3: Create the route file with just the schema**

Create `src/server-routes/health.ts`:

```typescript
import { Router, Request, Response } from "express";
import { z } from "zod";
import { ObjectId } from "mongodb";
import { getDb } from "../server-core/database";
import { authMiddleware } from "../server-core/security";
import { requirePatientAccess } from "../server-core/seatResolver";

export const METRICS = ["steps", "heart_rate", "active_minutes", "sleep"] as const;
export type Metric = typeof METRICS[number];

const readingSchema = z.object({
  metric: z.enum(METRICS),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  value: z.number().min(0),
  unit: z.string().min(1).max(16),
});

export const syncSchema = z.object({
  readings: z.array(readingSchema).min(1).max(500),
});

const router = Router();

export default router;
```

- [ ] **Step 4: Run the test, expect pass**

Run: `npx vitest run src/server-routes/health.test.ts`
Expected: PASS — all 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/server-routes/health.ts src/server-routes/health.test.ts
git commit -m "feat(health): add sync request schema with tests"
```

---

### Task 3: Implement the `/sync` endpoint

**Files:**
- Modify: `src/server-routes/health.ts`

- [ ] **Step 1: Add the POST /sync route**

In `src/server-routes/health.ts`, after the schemas and before `export default router;`, add:

```typescript
router.post("/:patientId/health/sync", authMiddleware, requirePatientAccess, async (req: Request, res: Response) => {
  const parsed = syncSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ detail: parsed.error.issues[0].message });
    return;
  }
  try {
    const db = getDb();
    const col = db.collection("patient_health_readings");
    const patientId = String(req.params.patientId);
    const now = new Date();
    const ops = parsed.data.readings.map((r) => ({
      updateOne: {
        filter: { patientId, metric: r.metric, date: r.date },
        update: {
          $set: { value: r.value, unit: r.unit, source: "healthkit", syncedAt: now },
          $setOnInsert: { patientId, metric: r.metric, date: r.date },
        },
        upsert: true,
      },
    }));
    const result = await col.bulkWrite(ops, { ordered: false });
    res.json({ written: result.upsertedCount + result.modifiedCount });
  } catch (err) {
    console.error("[health/sync]", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});
```

- [ ] **Step 2: Run the existing test suite to confirm nothing broke**

Run: `npx vitest run src/server-routes/health.test.ts`
Expected: PASS — schema tests still green.

- [ ] **Step 3: Commit**

```bash
git add src/server-routes/health.ts
git commit -m "feat(health): add POST /sync endpoint with bulk upsert"
```

---

### Task 4: Implement the `/summary` endpoint

**Files:**
- Modify: `src/server-routes/health.ts`

- [ ] **Step 1: Add the GET /summary route**

In `src/server-routes/health.ts`, before `export default router;`, add:

```typescript
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

router.get("/:patientId/health/summary", authMiddleware, requirePatientAccess, async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const col = db.collection("patient_health_readings");
    const patientId = String(req.params.patientId);
    const today = todayIso();
    const rows = await col.find({ patientId, date: today }).toArray();
    const byMetric: Record<string, { value: number; unit: string }> = {};
    for (const r of rows) byMetric[r.metric] = { value: r.value, unit: r.unit };
    res.json({
      date: today,
      steps: byMetric.steps ?? null,
      heartRate: byMetric.heart_rate ?? null,
      activeMinutes: byMetric.active_minutes ?? null,
      sleep: byMetric.sleep ?? null,
    });
  } catch (err) {
    console.error("[health/summary]", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});
```

- [ ] **Step 2: Verify test suite still green**

Run: `npx vitest run src/server-routes/health.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/server-routes/health.ts
git commit -m "feat(health): add GET /summary endpoint"
```

---

### Task 5: Implement the `/trends` endpoint

**Files:**
- Modify: `src/server-routes/health.ts`

- [ ] **Step 1: Add the GET /trends route**

In `src/server-routes/health.ts`, before `export default router;`, add:

```typescript
const trendsQuerySchema = z.object({
  metric: z.enum(METRICS),
  range: z.enum(["7d", "30d", "90d"]).default("30d"),
});

router.get("/:patientId/health/trends", authMiddleware, requirePatientAccess, async (req: Request, res: Response) => {
  const parsed = trendsQuerySchema.safeParse({
    metric: req.query.metric,
    range: req.query.range,
  });
  if (!parsed.success) {
    res.status(400).json({ detail: parsed.error.issues[0].message });
    return;
  }
  try {
    const db = getDb();
    const col = db.collection("patient_health_readings");
    const patientId = String(req.params.patientId);
    const days = parsed.data.range === "7d" ? 7 : parsed.data.range === "30d" ? 30 : 90;
    const since = new Date();
    since.setDate(since.getDate() - days + 1);
    const sinceIso = since.toISOString().slice(0, 10);
    const rows = await col
      .find({ patientId, metric: parsed.data.metric, date: { $gte: sinceIso } })
      .sort({ date: 1 })
      .toArray();
    res.json({
      metric: parsed.data.metric,
      range: parsed.data.range,
      points: rows.map((r) => ({ date: r.date, value: r.value })),
    });
  } catch (err) {
    console.error("[health/trends]", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});
```

- [ ] **Step 2: Add a schema test for the trends query**

Append to `src/server-routes/health.test.ts`:

```typescript
import { trendsQuerySchema } from "./health";

describe("trendsQuerySchema", () => {
  it("accepts valid metric + range", () => {
    expect(trendsQuerySchema.safeParse({ metric: "steps", range: "7d" }).success).toBe(true);
  });
  it("defaults range to 30d when omitted", () => {
    const r = trendsQuerySchema.safeParse({ metric: "steps" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.range).toBe("30d");
  });
  it("rejects unknown range", () => {
    expect(trendsQuerySchema.safeParse({ metric: "steps", range: "1y" }).success).toBe(false);
  });
});
```

You will also need to export `trendsQuerySchema` from `health.ts` — change its declaration to `export const trendsQuerySchema = ...`.

- [ ] **Step 3: Run tests, expect pass**

Run: `npx vitest run src/server-routes/health.test.ts`
Expected: PASS — 8 tests total.

- [ ] **Step 4: Commit**

```bash
git add src/server-routes/health.ts src/server-routes/health.test.ts
git commit -m "feat(health): add GET /trends endpoint with range query"
```

---

### Task 6: Mount the health router

**Files:**
- Modify: `src/server.ts`

- [ ] **Step 1: Add the import**

In `src/server.ts`, in the import block where other route files are imported, add:

```typescript
import healthRoutes from "./server-routes/health";
```

- [ ] **Step 2: Mount the router**

In `src/server.ts`, in the section where routes are mounted (look for other `app.use("/api/profiles", ...)` lines), add:

```typescript
app.use("/api/profiles", healthRoutes);
```

- [ ] **Step 3: Smoke-test the endpoints**

Start the server: `npm run dev:server`. In another terminal, with a known caregiver auth token (replace `<TOKEN>` and `<PATIENT_ID>`):

```bash
curl -s -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"readings":[{"metric":"steps","date":"2026-04-16","value":4821,"unit":"count"}]}' \
  http://localhost:3000/api/profiles/<PATIENT_ID>/health/sync
```

Expected response: `{"written":1}`.

Then:
```bash
curl -s -H "Authorization: Bearer <TOKEN>" \
  http://localhost:3000/api/profiles/<PATIENT_ID>/health/summary
```

Expected: JSON with `steps: { value: 4821, unit: "count" }`.

If you don't have a token handy, skip the curl test and rely on the schema tests + later end-to-end testing from the app.

- [ ] **Step 4: Commit**

```bash
git add src/server.ts
git commit -m "feat(health): mount health router on /api/profiles"
```

---

## Phase 2 — Patient-side HealthKit integration

### Task 7: Install dependencies and configure Expo

**Files:**
- Modify: `package.json` (via npm)
- Modify: `app.json`

- [ ] **Step 1: Install runtime packages**

```bash
npm install react-native-health react-native-gifted-charts react-native-svg
```

- [ ] **Step 2: Add the HealthKit Expo config plugin**

Open `app.json`. Inside `expo.plugins` (create the array if missing), add the entry below. If `expo.plugins` already exists, append this object to it:

```json
[
  "react-native-health",
  {
    "isClinicalDataEnabled": false,
    "healthSharePermission": "Vela uses your health data (steps, heart rate, sleep, activity) to help your care team monitor your wellbeing.",
    "healthUpdatePermission": "Vela does not write to your health data."
  }
]
```

- [ ] **Step 3: Add background mode for HealthKit observers**

In `app.json`, under `expo.ios.infoPlist`, add (merging with whatever is already there):

```json
"UIBackgroundModes": ["fetch", "processing"],
"NSHealthShareUsageDescription": "Vela uses your health data (steps, heart rate, sleep, activity) to help your care team monitor your wellbeing.",
"NSHealthUpdateUsageDescription": "Vela does not write to your health data."
```

- [ ] **Step 4: Rebuild the dev client**

```bash
npx expo prebuild --clean
```

Then create a new dev build (the user will run this on their device — flag if you can't): `eas build --profile development --platform ios` OR `npx expo run:ios` if building locally.

If the user is testing in Expo Go, stop here and inform them: HealthKit requires a custom dev build. The plan continues but live testing of HealthKit will only work on the dev build.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json app.json
git commit -m "feat(health): add react-native-health, charts, and HealthKit Info.plist config"
```

---

### Task 8: Create the HealthKit service wrapper

**Files:**
- Create: `src/services/healthkit.ts`

- [ ] **Step 1: Create the service**

Create `src/services/healthkit.ts`:

```typescript
import AppleHealthKit, { HealthInputOptions, HealthKitPermissions } from "react-native-health";
import { Platform } from "react-native";

const PERMS = AppleHealthKit.Constants.Permissions;

export const healthKitPermissions: HealthKitPermissions = {
  permissions: {
    read: [PERMS.StepCount, PERMS.HeartRate, PERMS.AppleExerciseTime, PERMS.SleepAnalysis],
    write: [],
  },
};

export type Reading = {
  metric: "steps" | "heart_rate" | "active_minutes" | "sleep";
  date: string; // YYYY-MM-DD
  value: number;
  unit: string;
};

export function isAvailable(): boolean {
  return Platform.OS === "ios";
}

export function requestPermissions(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!isAvailable()) return reject(new Error("HealthKit only available on iOS"));
    AppleHealthKit.initHealthKit(healthKitPermissions, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export async function getReadingsSince(since: Date): Promise<Reading[]> {
  if (!isAvailable()) return [];
  const out: Reading[] = [];
  const startDate = startOfDay(since).toISOString();
  const endDate = new Date().toISOString();

  // Steps — daily totals
  await new Promise<void>((resolve) => {
    AppleHealthKit.getDailyStepCountSamples({ startDate, endDate } as HealthInputOptions, (err, results) => {
      if (!err && results) {
        for (const s of results) {
          out.push({ metric: "steps", date: isoDate(new Date(s.startDate)), value: Math.round(s.value), unit: "count" });
        }
      }
      resolve();
    });
  });

  // Heart rate — latest reading per day (use average of samples that day)
  await new Promise<void>((resolve) => {
    AppleHealthKit.getHeartRateSamples({ startDate, endDate, limit: 5000 } as HealthInputOptions, (err, results) => {
      if (!err && results && results.length) {
        const byDay = new Map<string, number[]>();
        for (const s of results) {
          const d = isoDate(new Date(s.startDate));
          if (!byDay.has(d)) byDay.set(d, []);
          byDay.get(d)!.push(s.value);
        }
        for (const [date, vals] of byDay.entries()) {
          const avg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
          out.push({ metric: "heart_rate", date, value: avg, unit: "bpm" });
        }
      }
      resolve();
    });
  });

  // Active minutes (Apple Exercise Time) — daily totals
  await new Promise<void>((resolve) => {
    AppleHealthKit.getAppleExerciseTime({ startDate, endDate } as HealthInputOptions, (err, results) => {
      if (!err && results) {
        for (const s of results) {
          out.push({ metric: "active_minutes", date: isoDate(new Date(s.startDate)), value: Math.round(s.value), unit: "min" });
        }
      }
      resolve();
    });
  });

  // Sleep — total hours per day (sum of all asleep samples that ended that day)
  await new Promise<void>((resolve) => {
    AppleHealthKit.getSleepSamples({ startDate, endDate, limit: 5000 } as HealthInputOptions, (err, results) => {
      if (!err && results && results.length) {
        const byDay = new Map<string, number>();
        for (const s of results) {
          if (s.value !== "ASLEEP" && s.value !== "INBED") continue;
          const ms = new Date(s.endDate).getTime() - new Date(s.startDate).getTime();
          const hrs = ms / 1000 / 60 / 60;
          const date = isoDate(new Date(s.endDate));
          byDay.set(date, (byDay.get(date) ?? 0) + hrs);
        }
        for (const [date, hrs] of byDay.entries()) {
          out.push({ metric: "sleep", date, value: Math.round(hrs * 10) / 10, unit: "hr" });
        }
      }
      resolve();
    });
  });

  return out;
}

export function enableBackgroundDelivery(): void {
  if (!isAvailable()) return;
  // Observers fire when new HealthKit data is written. Register one per metric type.
  // The actual event listener is wired in healthSync.ts via NativeEventEmitter.
  const types = [PERMS.StepCount, PERMS.HeartRate, PERMS.AppleExerciseTime, PERMS.SleepAnalysis];
  for (const t of types) {
    AppleHealthKit.setObserver({ type: t });
  }
}
```

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit`
Expected: no errors related to `healthkit.ts`. If `react-native-health` lacks types for any constant used, install `@types/react-native-health` if available, or add a small declaration shim in `src/types/`.

- [ ] **Step 3: Commit**

```bash
git add src/services/healthkit.ts
git commit -m "feat(health): add HealthKit service wrapper with per-metric readers"
```

---

### Task 9: Create the sync orchestration layer

**Files:**
- Create: `src/services/healthSync.ts`

- [ ] **Step 1: Create the sync service**

Create `src/services/healthSync.ts`:

```typescript
import { NativeEventEmitter, NativeModules } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getReadingsSince, enableBackgroundDelivery, isAvailable, Reading } from "./healthkit";
import { syncReadings } from "../api/health";

const LAST_SYNC_KEY = "@vela/health/lastSyncedAt";
const DEFAULT_LOOKBACK_DAYS = 1;

async function getLastSync(): Promise<Date> {
  const raw = await AsyncStorage.getItem(LAST_SYNC_KEY);
  if (raw) return new Date(raw);
  const d = new Date();
  d.setDate(d.getDate() - DEFAULT_LOOKBACK_DAYS);
  return d;
}

async function setLastSync(d: Date): Promise<void> {
  await AsyncStorage.setItem(LAST_SYNC_KEY, d.toISOString());
}

export async function syncNow(patientId: string): Promise<number> {
  if (!isAvailable()) return 0;
  const since = await getLastSync();
  const readings: Reading[] = await getReadingsSince(since);
  if (readings.length === 0) return 0;
  const result = await syncReadings(patientId, readings);
  await setLastSync(new Date());
  return result.written;
}

let observerSubscription: { remove: () => void } | null = null;

export function startBackgroundObservers(patientId: string): void {
  if (!isAvailable()) return;
  enableBackgroundDelivery();
  // Subscribe to HealthKit events emitted by react-native-health
  const emitter = new NativeEventEmitter(NativeModules.AppleHealthKit);
  observerSubscription = emitter.addListener("healthKit:sampleUpdated", () => {
    syncNow(patientId).catch((e) => console.warn("[healthSync] background sync failed", e));
  });
}

export function stopBackgroundObservers(): void {
  observerSubscription?.remove();
  observerSubscription = null;
}
```

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/services/healthSync.ts
git commit -m "feat(health): add sync orchestration with background observers + on-open"
```

---

### Task 10: Create the API client

**Files:**
- Create: `src/api/health.ts`

- [ ] **Step 1: Create the client**

Create `src/api/health.ts`:

```typescript
import { authFetch } from "./authFetch";

export type Reading = {
  metric: "steps" | "heart_rate" | "active_minutes" | "sleep";
  date: string;
  value: number;
  unit: string;
};

export async function syncReadings(
  patientId: string,
  readings: Reading[]
): Promise<{ written: number }> {
  const r = await authFetch(`/api/profiles/${patientId}/health/sync`, {
    method: "POST",
    body: JSON.stringify({ readings }),
  });
  if (!r.ok) throw new Error((await r.json()).detail);
  return r.json();
}

export type Summary = {
  date: string;
  steps: { value: number; unit: string } | null;
  heartRate: { value: number; unit: string } | null;
  activeMinutes: { value: number; unit: string } | null;
  sleep: { value: number; unit: string } | null;
};

export async function getSummary(patientId: string): Promise<Summary> {
  const r = await authFetch(`/api/profiles/${patientId}/health/summary`);
  if (!r.ok) throw new Error("summary load failed");
  return r.json();
}

export type TrendPoint = { date: string; value: number };
export type Trend = { metric: string; range: string; points: TrendPoint[] };

export async function getTrend(
  patientId: string,
  metric: Reading["metric"],
  range: "7d" | "30d" | "90d"
): Promise<Trend> {
  const r = await authFetch(
    `/api/profiles/${patientId}/health/trends?metric=${metric}&range=${range}`
  );
  if (!r.ok) throw new Error("trend load failed");
  return r.json();
}
```

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/api/health.ts
git commit -m "feat(health): add API client for sync, summary, trends"
```

---

### Task 11: Wire patient login → start observers + initial sync

**Files:**
- Modify: `App.tsx`

- [ ] **Step 1: Find the patient-login side effect**

Open `App.tsx`. Locate the `useEffect` (or context provider) that runs when a user becomes authenticated and their role is determined. We need to hook in there.

If there is no obvious hook point, search for `setAuthToken` or auth context state changes and pick the place where `user.role === "patient"` first becomes known.

- [ ] **Step 2: Add the sync hook**

In the appropriate file (likely `App.tsx` or wherever the auth-state effect lives), add:

```typescript
import { useEffect } from "react";
import { AppState } from "react-native";
import { syncNow, startBackgroundObservers, stopBackgroundObservers } from "./src/services/healthSync";

// Inside the component, after user is determined:
useEffect(() => {
  if (!user || user.role !== "patient" || !user.patientId) return;
  const pid = user.patientId;

  // Initial sync on login
  syncNow(pid).catch((e) => console.warn("[health] initial sync failed", e));

  // Background observers
  startBackgroundObservers(pid);

  // Sync on foreground transition
  const sub = AppState.addEventListener("change", (state) => {
    if (state === "active") syncNow(pid).catch(() => {});
  });

  return () => {
    sub.remove();
    stopBackgroundObservers();
  };
}, [user]);
```

Adjust the destructured field names (`user.role`, `user.patientId`) to match the actual auth context type — grep for how patient screens currently get the patient ID and copy the same access pattern.

- [ ] **Step 3: TypeScript check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add App.tsx
git commit -m "feat(health): trigger HealthKit sync + observers on patient login"
```

---

## Phase 3 — Patient Health UI

### Task 12: Build the metric card component

**Files:**
- Create: `src/components/health/MetricCard.tsx`

- [ ] **Step 1: Create the card**

Create `src/components/health/MetricCard.tsx`:

```typescript
import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { LineChart } from "react-native-gifted-charts";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../config/theme";
import type { TrendPoint } from "../../api/health";

interface Props {
  title: string;
  value: string | number;
  unit?: string;
  trend: TrendPoint[];
  emptyHint?: string;
}

export function MetricCard({ title, value, unit, trend, emptyHint }: Props) {
  const { colors } = useTheme();
  const data = useMemo(() => trend.map((p) => ({ value: p.value, label: p.date.slice(5) })), [trend]);
  const isEmpty = trend.length === 0;

  const styles = StyleSheet.create({
    card: {
      backgroundColor: colors.warm,
      borderRadius: 18,
      padding: 18,
      marginBottom: 14,
      shadowColor: colors.coral,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 10,
    },
    title: { ...fonts.medium, fontSize: 13, color: colors.violet, textTransform: "uppercase", letterSpacing: 1.2 },
    valueRow: { flexDirection: "row", alignItems: "baseline", marginTop: 6 },
    value: { ...fonts.regular, fontSize: 32, color: colors.text },
    unit: { ...fonts.regular, fontSize: 14, color: colors.muted, marginLeft: 6 },
    chartWrap: { marginTop: 12, marginLeft: -16 },
    empty: { ...fonts.regular, fontSize: 14, color: colors.muted, marginTop: 16, lineHeight: 20 },
  });

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      {isEmpty ? (
        <Text style={styles.empty}>{emptyHint ?? "No data yet."}</Text>
      ) : (
        <>
          <View style={styles.valueRow}>
            <Text style={styles.value}>{value}</Text>
            {unit ? <Text style={styles.unit}>{unit}</Text> : null}
          </View>
          <View style={styles.chartWrap}>
            <LineChart
              data={data}
              areaChart
              startFillColor={colors.violet}
              endFillColor={colors.warm}
              startOpacity={0.4}
              endOpacity={0.05}
              color={colors.violet}
              thickness={2}
              hideDataPoints
              hideRules
              hideYAxisText
              xAxisLabelTextStyle={{ color: colors.muted, fontSize: 10 }}
              initialSpacing={0}
              endSpacing={0}
              spacing={26}
              height={120}
              curved
            />
          </View>
        </>
      )}
    </View>
  );
}
```

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit`
Expected: clean. If `react-native-gifted-charts` types don't expose `areaChart`, use `as any` on the prop or add a type assertion — the runtime prop is supported.

- [ ] **Step 3: Commit**

```bash
git add src/components/health/MetricCard.tsx
git commit -m "feat(health): add MetricCard with gradient line chart"
```

---

### Task 13: Build the range toggle component

**Files:**
- Create: `src/components/health/RangeToggle.tsx`

- [ ] **Step 1: Create the toggle**

Create `src/components/health/RangeToggle.tsx`:

```typescript
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../config/theme";

export type Range = "7d" | "30d" | "90d";

interface Props {
  value: Range;
  onChange: (r: Range) => void;
}

export function RangeToggle({ value, onChange }: Props) {
  const { colors } = useTheme();
  const ranges: Range[] = ["7d", "30d", "90d"];

  const styles = StyleSheet.create({
    row: { flexDirection: "row", backgroundColor: colors.warm, borderRadius: 12, padding: 4, alignSelf: "center", marginBottom: 14 },
    pill: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 8 },
    pillActive: { backgroundColor: colors.violet },
    label: { ...fonts.medium, fontSize: 13, color: colors.muted },
    labelActive: { color: "#FFFFFF" },
  });

  return (
    <View style={styles.row}>
      {ranges.map((r) => (
        <TouchableOpacity
          key={r}
          style={[styles.pill, r === value && styles.pillActive]}
          onPress={() => onChange(r)}
          activeOpacity={0.7}
        >
          <Text style={[styles.label, r === value && styles.labelActive]}>{r}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
```

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/health/RangeToggle.tsx
git commit -m "feat(health): add RangeToggle component (7d/30d/90d)"
```

---

### Task 14: Build the patient hooks

**Files:**
- Create: `src/hooks/useHealthSummary.ts`
- Create: `src/hooks/useHealthTrends.ts`

- [ ] **Step 1: Create useHealthSummary**

Create `src/hooks/useHealthSummary.ts`:

```typescript
import { useEffect, useState, useCallback } from "react";
import { getSummary, Summary } from "../api/health";

export function useHealthSummary(patientId: string | null) {
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    setError(null);
    try {
      setData(await getSummary(patientId));
    } catch (e: any) {
      setError(e.message ?? "load failed");
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => { refresh(); }, [refresh]);

  return { data, loading, error, refresh };
}
```

- [ ] **Step 2: Create useHealthTrends**

Create `src/hooks/useHealthTrends.ts`:

```typescript
import { useEffect, useState, useCallback } from "react";
import { getTrend, Trend } from "../api/health";
import type { Range } from "../components/health/RangeToggle";

type Metric = "steps" | "heart_rate" | "active_minutes" | "sleep";

export function useHealthTrends(patientId: string | null, range: Range) {
  const [trends, setTrends] = useState<Record<Metric, Trend | null>>({
    steps: null, heart_rate: null, active_minutes: null, sleep: null,
  });
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    try {
      const metrics: Metric[] = ["steps", "heart_rate", "active_minutes", "sleep"];
      const results = await Promise.all(metrics.map((m) => getTrend(patientId, m, range)));
      setTrends({
        steps: results[0], heart_rate: results[1], active_minutes: results[2], sleep: results[3],
      });
    } catch (e) {
      console.warn("[useHealthTrends]", e);
    } finally {
      setLoading(false);
    }
  }, [patientId, range]);

  useEffect(() => { refresh(); }, [refresh]);

  return { trends, loading, refresh };
}
```

- [ ] **Step 3: TypeScript check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useHealthSummary.ts src/hooks/useHealthTrends.ts
git commit -m "feat(health): add summary + trends hooks"
```

---

### Task 15: Build the HealthKit onboarding screen

**Files:**
- Create: `src/screens/patient/HealthOnboardingScreen.tsx`

- [ ] **Step 1: Create the screen**

Create `src/screens/patient/HealthOnboardingScreen.tsx`:

```typescript
import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../config/theme";
import { requestPermissions } from "../../services/healthkit";

const ONBOARDED_KEY = "@vela/health/onboarded";

export async function isHealthOnboarded(): Promise<boolean> {
  return (await AsyncStorage.getItem(ONBOARDED_KEY)) === "1";
}

export function HealthOnboardingScreen() {
  const { colors } = useTheme();
  const nav = useNavigation<any>();
  const [busy, setBusy] = useState(false);

  const onConnect = async () => {
    setBusy(true);
    try {
      await requestPermissions();
      await AsyncStorage.setItem(ONBOARDED_KEY, "1");
      nav.replace("PatientHealth");
    } catch (e: any) {
      Alert.alert("Couldn't connect", e.message ?? "Try again from iPhone Settings → Health → Apps → Vela.");
    } finally {
      setBusy(false);
    }
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg, padding: 24, justifyContent: "center" },
    iconWrap: { alignSelf: "center", marginBottom: 28 },
    title: { ...fonts.regular, fontSize: 28, color: colors.text, textAlign: "center", marginBottom: 14 },
    body: { ...fonts.regular, fontSize: 16, color: colors.muted, textAlign: "center", lineHeight: 24, marginBottom: 32 },
    bullet: { ...fonts.regular, fontSize: 15, color: colors.text, marginBottom: 8 },
    button: { borderRadius: 16, overflow: "hidden", marginTop: 28 },
    buttonInner: { paddingVertical: 16, alignItems: "center" },
    buttonLabel: { ...fonts.medium, fontSize: 17, color: "#FFFFFF" },
  });

  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Ionicons name="pulse" size={64} color={colors.violet} />
      </View>
      <Text style={styles.title}>Connect your Health data</Text>
      <Text style={styles.body}>
        Vela uses Apple Health to show your steps, heart rate, sleep, and activity over time — and to keep your care team in the loop.
      </Text>
      <Text style={styles.bullet}>• We only read — we never write to your Health data.</Text>
      <Text style={styles.bullet}>• You can change this anytime in iPhone Settings.</Text>
      <TouchableOpacity style={styles.button} onPress={onConnect} disabled={busy} activeOpacity={0.8}>
        <LinearGradient colors={[colors.violet, "#7B6BE0"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.buttonInner}>
          {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonLabel}>Connect</Text>}
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}
```

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/screens/patient/HealthOnboardingScreen.tsx
git commit -m "feat(health): add patient HealthKit onboarding screen"
```

---

### Task 16: Build the patient Health screen

**Files:**
- Create: `src/screens/patient/HealthScreen.tsx`

- [ ] **Step 1: Create the screen**

Create `src/screens/patient/HealthScreen.tsx`:

```typescript
import React, { useEffect, useState } from "react";
import { View, ScrollView, Text, StyleSheet, RefreshControl } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../config/theme";
import { useCurrentProfile } from "../../hooks/useCurrentProfile";
import { useHealthSummary } from "../../hooks/useHealthSummary";
import { useHealthTrends } from "../../hooks/useHealthTrends";
import { MetricCard } from "../../components/health/MetricCard";
import { RangeToggle, Range } from "../../components/health/RangeToggle";
import { isHealthOnboarded } from "./HealthOnboardingScreen";
import { syncNow } from "../../services/healthSync";

const EMPTY_HINT = "No data yet — connect a wearable in the iPhone Health app.";

export function HealthScreen() {
  const { colors } = useTheme();
  const nav = useNavigation<any>();
  const profile = useCurrentProfile();
  const patientId = profile.patientId ?? null;
  const [range, setRange] = useState<Range>("30d");
  const summary = useHealthSummary(patientId);
  const trends = useHealthTrends(patientId, range);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    isHealthOnboarded().then((ok) => { if (!ok) nav.replace("HealthOnboarding"); });
  }, [nav]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (patientId) await syncNow(patientId).catch(() => {});
    await Promise.all([summary.refresh(), trends.refresh()]);
    setRefreshing(false);
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    content: { padding: 16, paddingBottom: 40 },
    header: { ...fonts.regular, fontSize: 28, color: colors.text, marginBottom: 4 },
    sub: { ...fonts.regular, fontSize: 14, color: colors.muted, marginBottom: 18 },
  });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.violet} />}
    >
      <Text style={styles.header}>Health</Text>
      <Text style={styles.sub}>Your trends over time</Text>
      <RangeToggle value={range} onChange={setRange} />
      <MetricCard
        title="Steps"
        value={summary.data?.steps?.value ?? "—"}
        unit={summary.data?.steps ? "today" : undefined}
        trend={trends.trends.steps?.points ?? []}
        emptyHint="No data yet — keep your iPhone with you to count steps."
      />
      <MetricCard
        title="Heart Rate"
        value={summary.data?.heartRate?.value ?? "—"}
        unit={summary.data?.heartRate?.unit}
        trend={trends.trends.heart_rate?.points ?? []}
        emptyHint={EMPTY_HINT}
      />
      <MetricCard
        title="Active Minutes"
        value={summary.data?.activeMinutes?.value ?? "—"}
        unit={summary.data?.activeMinutes ? "today" : undefined}
        trend={trends.trends.active_minutes?.points ?? []}
        emptyHint={EMPTY_HINT}
      />
      <MetricCard
        title="Sleep"
        value={summary.data?.sleep?.value ?? "—"}
        unit={summary.data?.sleep?.unit}
        trend={trends.trends.sleep?.points ?? []}
        emptyHint={EMPTY_HINT}
      />
    </ScrollView>
  );
}
```

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit`
Expected: clean. If `useCurrentProfile` doesn't expose `patientId`, adapt the access — match the existing patient screen patterns (e.g. how `TodayScreen` gets the patient id).

- [ ] **Step 3: Commit**

```bash
git add src/screens/patient/HealthScreen.tsx
git commit -m "feat(health): add patient Health screen with 4 metric cards + range toggle"
```

---

### Task 17: Add Health to the patient bottom tab navigator

**Files:**
- Modify: `src/navigation/PatientTabNavigator.tsx`
- Modify: `src/navigation/RootNavigator.tsx`

- [ ] **Step 1: Add the import and tab**

In `src/navigation/PatientTabNavigator.tsx`:

Add import at top (with other screen imports):
```typescript
import { HealthScreen } from "../screens/patient/HealthScreen";
```

Add Health to the icon map:
```typescript
const iconNames: Record<string, keyof typeof Ionicons.glyphMap> = {
  Home: "home",
  Faces: "people",
  Help: "hand-left",
  Health: "pulse",
};
```

Inside the `<Tab.Navigator>` JSX, add a new `<Tab.Screen>` after the Faces tab:
```typescript
<Tab.Screen name="Health" component={HealthScreen} />
```

- [ ] **Step 2: Register the onboarding screen at root nav level**

The Health tab itself uses `nav.replace("HealthOnboarding")` to bounce to onboarding. That target needs to exist in the root stack.

In `src/navigation/RootNavigator.tsx`, add:
```typescript
import { HealthOnboardingScreen } from "../screens/patient/HealthOnboardingScreen";
```

Inside the root Stack, add (near other patient stack screens):
```typescript
<Stack.Screen name="HealthOnboarding" component={HealthOnboardingScreen} options={{ headerShown: false }} />
```

Also register `PatientHealth` as a route name that points back to the tab if the bounce target ("PatientHealth") isn't already reachable. If `nav.replace("PatientHealth")` would be ambiguous, change the onboarding `nav.replace` target to `nav.goBack()` instead.

- [ ] **Step 3: TypeScript check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Manual smoke test**

Run the app on the dev build (iOS device). Log in as a patient. Tap the Health tab. Expected: bounces to onboarding screen if not yet onboarded, otherwise shows the Health screen with empty cards (until HealthKit data flows).

- [ ] **Step 5: Commit**

```bash
git add src/navigation/PatientTabNavigator.tsx src/navigation/RootNavigator.tsx
git commit -m "feat(health): add Health tab + onboarding screen registration"
```

---

## Phase 4 — Caregiver UI

### Task 18: Build the patient health strip component

**Files:**
- Create: `src/components/health/PatientHealthStrip.tsx`

- [ ] **Step 1: Create the strip**

Create `src/components/health/PatientHealthStrip.tsx`:

```typescript
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../config/theme";
import { useHealthSummary } from "../../hooks/useHealthSummary";

interface Props { patientId: string; }

export function PatientHealthStrip({ patientId }: Props) {
  const { colors } = useTheme();
  const { data } = useHealthSummary(patientId);

  const hasAny = data && (data.steps || data.heartRate || data.sleep);
  if (!hasAny) return null;

  const styles = StyleSheet.create({
    row: { flexDirection: "row", alignItems: "center", gap: 14, marginTop: 8 },
    chip: { flexDirection: "row", alignItems: "center", gap: 4 },
    icon: {},
    label: { ...fonts.medium, fontSize: 13, color: colors.muted },
  });

  return (
    <View style={styles.row}>
      {data.steps && (
        <View style={styles.chip}>
          <Ionicons name="footsteps" size={14} color={colors.violet} />
          <Text style={styles.label}>{data.steps.value.toLocaleString()}</Text>
        </View>
      )}
      {data.heartRate && (
        <View style={styles.chip}>
          <Ionicons name="heart" size={14} color={colors.coral} />
          <Text style={styles.label}>{data.heartRate.value} bpm</Text>
        </View>
      )}
      {data.sleep && (
        <View style={styles.chip}>
          <Ionicons name="moon" size={14} color={colors.violet} />
          <Text style={styles.label}>{data.sleep.value}h</Text>
        </View>
      )}
    </View>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/health/PatientHealthStrip.tsx
git commit -m "feat(health): add caregiver Today's Health strip component"
```

---

### Task 19: Add the strip to the caregiver patient dashboard

**Files:**
- Modify: `src/screens/caregiver/PatientsDashboardScreen.tsx`

- [ ] **Step 1: Find the patient card render**

Open `src/screens/caregiver/PatientsDashboardScreen.tsx`. Locate the JSX block that renders a single patient card inside the list (look for where the patient's name is rendered). Identify where to insert the strip (typically right under the name/status row).

- [ ] **Step 2: Insert the strip**

Add the import:
```typescript
import { PatientHealthStrip } from "../../components/health/PatientHealthStrip";
```

In the per-patient card JSX, after the name/status row, add:
```tsx
<PatientHealthStrip patientId={String(patient._id ?? patient.id)} />
```

Use whichever id field the patient object actually exposes — match how the existing card already references the patient id elsewhere.

- [ ] **Step 3: Manual smoke test**

Open the app as a caregiver. Expected: under each linked patient, you see a strip with steps · bpm · sleep IF the patient has synced data. If the patient has no data yet, the strip is hidden (no clutter).

- [ ] **Step 4: Commit**

```bash
git add src/screens/caregiver/PatientsDashboardScreen.tsx
git commit -m "feat(health): show Today's Health strip on caregiver patient cards"
```

---

### Task 20: Build the caregiver health screen

**Files:**
- Create: `src/screens/caregiver/CaregiverHealthScreen.tsx`

- [ ] **Step 1: Create the screen**

Create `src/screens/caregiver/CaregiverHealthScreen.tsx`:

```typescript
import React, { useState } from "react";
import { View, ScrollView, Text, StyleSheet, RefreshControl } from "react-native";
import { useRoute } from "@react-navigation/native";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../config/theme";
import { useHealthSummary } from "../../hooks/useHealthSummary";
import { useHealthTrends } from "../../hooks/useHealthTrends";
import { MetricCard } from "../../components/health/MetricCard";
import { RangeToggle, Range } from "../../components/health/RangeToggle";

const EMPTY_HINT = "No data yet — patient hasn't connected a wearable.";

export function CaregiverHealthScreen() {
  const { colors } = useTheme();
  const route = useRoute<any>();
  const patientId: string = route.params?.patientId;
  const patientName: string = route.params?.patientName ?? "Patient";
  const [range, setRange] = useState<Range>("30d");
  const summary = useHealthSummary(patientId);
  const trends = useHealthTrends(patientId, range);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([summary.refresh(), trends.refresh()]);
    setRefreshing(false);
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    content: { padding: 16, paddingBottom: 40 },
    header: { ...fonts.regular, fontSize: 28, color: colors.text, marginBottom: 4 },
    sub: { ...fonts.regular, fontSize: 14, color: colors.muted, marginBottom: 18 },
  });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.violet} />}
    >
      <Text style={styles.header}>{patientName}'s Health</Text>
      <Text style={styles.sub}>Trends from connected devices</Text>
      <RangeToggle value={range} onChange={setRange} />
      <MetricCard
        title="Steps"
        value={summary.data?.steps?.value?.toLocaleString() ?? "—"}
        unit={summary.data?.steps ? "today" : undefined}
        trend={trends.trends.steps?.points ?? []}
        emptyHint={EMPTY_HINT}
      />
      <MetricCard
        title="Heart Rate"
        value={summary.data?.heartRate?.value ?? "—"}
        unit={summary.data?.heartRate?.unit}
        trend={trends.trends.heart_rate?.points ?? []}
        emptyHint={EMPTY_HINT}
      />
      <MetricCard
        title="Active Minutes"
        value={summary.data?.activeMinutes?.value ?? "—"}
        unit={summary.data?.activeMinutes ? "today" : undefined}
        trend={trends.trends.active_minutes?.points ?? []}
        emptyHint={EMPTY_HINT}
      />
      <MetricCard
        title="Sleep"
        value={summary.data?.sleep?.value ?? "—"}
        unit={summary.data?.sleep?.unit}
        trend={trends.trends.sleep?.points ?? []}
        emptyHint={EMPTY_HINT}
      />
    </ScrollView>
  );
}
```

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/screens/caregiver/CaregiverHealthScreen.tsx
git commit -m "feat(health): add CaregiverHealthScreen with full trend view"
```

---

### Task 21: Add Health button to PatientDetailScreen + register screen in nav

**Files:**
- Modify: `src/screens/caregiver/PatientDetailScreen.tsx`
- Modify: `src/navigation/RootNavigator.tsx`

- [ ] **Step 1: Find the Visit Reports button in PatientDetailScreen**

Open `src/screens/caregiver/PatientDetailScreen.tsx`. Locate the existing "Visit Reports" button (search for "Visit Reports" or `VisitReports`). The Health button mirrors that pattern.

- [ ] **Step 2: Add the Health button**

Right next to the Visit Reports button, add a Health button:

```tsx
<TouchableOpacity
  style={styles.actionButton}  // reuse the same style used by Visit Reports
  onPress={() => navigation.navigate("CaregiverHealth", { patientId: String(patient._id), patientName: patient.name })}
  activeOpacity={0.7}
>
  <Ionicons name="pulse" size={20} color={colors.violet} />
  <Text style={styles.actionLabel}>Health</Text>
</TouchableOpacity>
```

Match the exact style names and patient field access already used by the Visit Reports button — copy and adapt.

- [ ] **Step 3: Register CaregiverHealthScreen in the root stack**

In `src/navigation/RootNavigator.tsx`, add:
```typescript
import { CaregiverHealthScreen } from "../screens/caregiver/CaregiverHealthScreen";
```

Inside the root Stack (near the other caregiver screens like `VisitReportsScreen`):
```tsx
<Stack.Screen
  name="CaregiverHealth"
  component={CaregiverHealthScreen}
  options={{ headerShown: true, title: "Health", headerBackTitle: "Back" }}
/>
```

- [ ] **Step 4: TypeScript check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Manual smoke test**

Open the caregiver app → Patients tab → tap a patient → tap Health. Expected: opens the CaregiverHealthScreen with the patient's name in the header and four metric cards.

- [ ] **Step 6: Commit**

```bash
git add src/screens/caregiver/PatientDetailScreen.tsx src/navigation/RootNavigator.tsx
git commit -m "feat(health): add Health button on Patient Detail + register screen"
```

---

## Phase 5 — Remove the obsolete caregiver-side sensors

### Task 22: Remove the Sensors row from the side drawer

**Files:**
- Modify: `src/components/SideDrawer.tsx`

- [ ] **Step 1: Delete the Sensors block**

Open `src/components/SideDrawer.tsx`. Find the block we added last session (search for `SensorSettings` or "Sensors"). Delete the entire `{/* Sensors (caregiver only) */}` block including its surrounding `<View>`.

- [ ] **Step 2: Commit**

```bash
git add src/components/SideDrawer.tsx
git commit -m "refactor(health): remove Sensors entry from caregiver side drawer"
```

---

### Task 23: Remove gait capture from voice check-in

**Files:**
- Modify: `src/screens/caregiver/CheckInScreen.tsx`

- [ ] **Step 1: Find the gait capture usage**

Open `src/screens/caregiver/CheckInScreen.tsx`. Search for `useGaitCapture` (or similar — check for accelerometer usage from `expo-sensors` if the hook name differs). Identify the import, the hook call, and any start/stop side effects.

- [ ] **Step 2: Delete all gait-related lines**

Remove:
- The `import { useGaitCapture }` line
- The `useGaitCapture(...)` call
- Any `start()` / `stop()` references to the gait capture
- Any related state vars used only for gait

Leave the rest of the check-in logic untouched.

- [ ] **Step 3: TypeScript check**

Run: `npx tsc --noEmit`
Expected: clean (or surface any remaining unused imports — remove those too).

- [ ] **Step 4: Commit**

```bash
git add src/screens/caregiver/CheckInScreen.tsx
git commit -m "refactor(health): remove gait capture from voice check-in"
```

---

### Task 24: Remove typing capture from text check-in

**Files:**
- Modify: `src/screens/caregiver/CheckInTextScreen.tsx`

- [ ] **Step 1: Find the typing capture usage**

Open `src/screens/caregiver/CheckInTextScreen.tsx`. Search for `useTypingCapture` (or whatever the hook is named — check imports).

- [ ] **Step 2: Delete all typing-related lines**

Remove the import, the hook call, any handlers wired to text input changes that exist solely to feed typing capture, and any unused state.

- [ ] **Step 3: TypeScript check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/screens/caregiver/CheckInTextScreen.tsx
git commit -m "refactor(health): remove typing capture from text check-in"
```

---

### Task 25: Delete the SensorSettings screen + its registration + dead hooks

**Files:**
- Delete: `src/screens/caregiver/SensorSettingsScreen.tsx`
- Modify: `src/navigation/RootNavigator.tsx`
- Possibly delete: `src/hooks/useSensorPrefs.ts` (and any `useGaitCapture.ts`, `useTypingCapture.ts`)

- [ ] **Step 1: Confirm useSensorPrefs has no other consumers**

Run: `grep -r "useSensorPrefs\|useGaitCapture\|useTypingCapture" src/ --include="*.tsx" --include="*.ts"`
Expected: only references in files about to be deleted (SensorSettingsScreen, the two check-in screens already cleaned, and the hook files themselves). If anything else uses them, leave that hook file in place.

- [ ] **Step 2: Delete the screen file**

```bash
rm src/screens/caregiver/SensorSettingsScreen.tsx
```

- [ ] **Step 3: Delete dead hook files (only those with no consumers per Step 1)**

```bash
rm src/hooks/useSensorPrefs.ts  # only if no consumers remain
# rm src/hooks/useGaitCapture.ts useTypingCapture.ts if they exist as separate files with no consumers
```

- [ ] **Step 4: Remove the SensorSettings registration**

In `src/navigation/RootNavigator.tsx`, find and delete:
- The `import` line for `SensorSettingsScreen`
- The `<Stack.Screen name="SensorSettings" ... />` JSX

- [ ] **Step 5: TypeScript check**

Run: `npx tsc --noEmit`
Expected: clean. If TS surfaces a remaining reference to anything you deleted, find and remove it.

- [ ] **Step 6: Run all tests**

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor(health): delete SensorSettings screen and orphaned sensor hooks"
```

---

## Phase 6 — End-to-end manual verification

### Task 26: Live test on device

**No file changes — verification only.**

- [ ] **Step 1: Build and install the dev client on a real iOS device**

```bash
npx expo run:ios --device
```

(or use the existing EAS dev build the user already has installed if it picked up the new config plugin via OTA — most likely a fresh build is required because `react-native-health` is a native module).

- [ ] **Step 2: Patient flow**

- Log in as a patient
- Tap Health tab → see onboarding → tap Connect → grant all four HealthKit permissions in iOS sheet
- Verify Health screen shows: Steps with data (always — iPhone alone), Heart Rate / Active Minutes / Sleep with data if Apple Watch is paired, otherwise empty hints
- Pull to refresh → values update

- [ ] **Step 3: Background sync verification**

- Close the app fully
- Take a short walk (or wait for the watch to log new heart rate data)
- Reopen the app
- Verify new data has appeared without you doing anything (background observer fired) OR appears immediately on open (foreground sync fallback covers this)

- [ ] **Step 4: Caregiver flow**

- Log in as the caregiver of that patient
- Patients tab → see "Today's Health" strip on the patient card
- Tap patient → tap Health → see the full Health screen with 4 cards and range toggle
- Switch between 7d / 30d / 90d → graphs update

- [ ] **Step 5: Removal verification**

- Caregiver side drawer no longer shows "Sensors"
- Voice check-in completes normally (no gait sensor warnings)
- Text check-in completes normally (no typing sensor warnings)
- Patterns card on Timeline still loads (just doesn't get new gait/typing events)

- [ ] **Step 6: Final commit (if any tweaks were needed during verification)**

```bash
git add -A
git commit -m "chore(health): end-to-end verification adjustments"
```

---

## Done

At this point:
- Patient has a Health tab pulling steps/HR/active minutes/sleep from HealthKit, syncing in background and on open
- Caregiver sees a quick health strip per patient + a full health screen with trends
- Old caregiver-side gait/typing capture is gone
- Patterns + Visit Reports continue to work (no regressions)
