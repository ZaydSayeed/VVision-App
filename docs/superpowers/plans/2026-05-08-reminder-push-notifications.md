# Reminder Push Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send Expo push notifications to patients when their reminders are due.

**Architecture:** A new cron job runs every 5 minutes, finds reminders due within the next window, and fires Expo push notifications to the patient's device. Patient push tokens are registered on app start (parallel to existing caregiver token registration) and stored in a new `patient_push_tokens` collection.

**Tech Stack:** Express/TypeScript, MongoDB, Expo Push API (https://exp.host/push/send), node-cron, expo-notifications (already installed)

---

## File Structure

- Create: `src/server-jobs/fireReminders.ts` — cron job logic
- Create: `src/server-jobs/fireReminders.test.ts` — unit tests
- Create: `src/server-routes/patientTokens.ts` — `POST /api/notifications/register-patient-token`
- Modify: `src/server-jobs/scheduler.ts` — add 5-min reminder cron
- Modify: `src/server.ts` — mount patientTokens route
- Modify: `src/server-core/database.ts` — add index on `patient_push_tokens`
- Modify: `src/navigation/RootNavigator.tsx` — register patient push token on login

---

### Task 1: Patient push token registration — backend route

**Files:**
- Create: `src/server-routes/patientTokens.ts`
- Modify: `src/server.ts` (add `app.use("/api/notifications", patientTokensRouter)`)
- Modify: `src/server-core/database.ts` (add index)

- [ ] **Step 1: Write the failing test**

```typescript
// src/server-routes/patientTokens.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

vi.mock("../server-core/security", () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.auth = { userId: "user-abc" };
    next();
  },
}));
vi.mock("../server-core/patientResolver", () => ({
  resolvePatientId: (req: any, _res: any, next: any) => {
    req.patientId = "patient-123";
    next();
  },
}));

const mockCol = { updateOne: vi.fn().mockResolvedValue({}) };
vi.mock("../server-core/database", () => ({
  getDb: () => ({ collection: () => mockCol }),
}));

import patientTokensRouter from "./patientTokens";

const app = express();
app.use(express.json());
app.use("/api/notifications", patientTokensRouter);

describe("POST /api/notifications/register-patient-token", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 200 and upserts token", async () => {
    const res = await request(app)
      .post("/api/notifications/register-patient-token")
      .send({ expoPushToken: "ExponentPushToken[abc123]" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(mockCol.updateOne).toHaveBeenCalledWith(
      { userId: "user-abc" },
      expect.objectContaining({
        $set: expect.objectContaining({
          userId: "user-abc",
          patientId: "patient-123",
          expoPushToken: "ExponentPushToken[abc123]",
        }),
      }),
      { upsert: true }
    );
  });

  it("returns 400 when token missing", async () => {
    const res = await request(app)
      .post("/api/notifications/register-patient-token")
      .send({});
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
cd /Users/haadisiddiqui/projects/VVision-App && npx vitest run src/server-routes/patientTokens.test.ts
```
Expected: FAIL (module not found)

- [ ] **Step 3: Create the route**

```typescript
// src/server-routes/patientTokens.ts
import { Router } from "express";
import { getDb } from "../server-core/database";
import { authMiddleware } from "../server-core/security";
import { resolvePatientId } from "../server-core/patientResolver";

const router = Router();

// POST /api/notifications/register-patient-token
// Called by patient app on login to store their Expo push token
router.post("/register-patient-token", authMiddleware, resolvePatientId, async (req, res) => {
  const { expoPushToken } = req.body;
  if (!expoPushToken || typeof expoPushToken !== "string") {
    res.status(400).json({ detail: "expoPushToken required" });
    return;
  }
  try {
    const db = getDb();
    await db.collection("patient_push_tokens").updateOne(
      { userId: req.auth!.userId },
      {
        $set: {
          userId: req.auth!.userId,
          patientId: req.patientId!,
          expoPushToken,
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );
    res.json({ success: true });
  } catch (err) {
    console.error("register-patient-token error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

export default router;
```

- [ ] **Step 4: Add index in database.ts**

In `src/server-core/database.ts`, after the existing `await db.collection("stage_observations")...` line, add:

```typescript
  await db.collection("patient_push_tokens").createIndex({ userId: 1 }, { unique: true });
  await db.collection("patient_push_tokens").createIndex({ patientId: 1 });
```

- [ ] **Step 5: Mount the route in server.ts**

Find the section in `src/server.ts` where other routes are mounted (e.g. `app.use("/api/reminders", remindersRouter)`). Add:

```typescript
import patientTokensRouter from "./server-routes/patientTokens";
// ...
app.use("/api/notifications", patientTokensRouter);
```

- [ ] **Step 6: Run test to verify it passes**

```
cd /Users/haadisiddiqui/projects/VVision-App && npx vitest run src/server-routes/patientTokens.test.ts
```
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/server-routes/patientTokens.ts src/server-core/database.ts src/server.ts
git commit -m "feat: add patient push token registration endpoint"
```

---

### Task 2: Register patient push token in the app

**Files:**
- Modify: `src/navigation/RootNavigator.tsx`

- [ ] **Step 1: Locate the existing push token registration block**

In `src/navigation/RootNavigator.tsx`, find the `useEffect` that starts with:
```typescript
if (!user || user.role !== "caregiver" || pushRegisteredRef.current) return;
```

This is around line 118. A new `useEffect` for patient token registration goes right after this block.

- [ ] **Step 2: Add a patient push token registration ref and effect**

After the `const pushRegisteredRef = useRef(false);` line, add:

```typescript
const patientPushRegisteredRef = useRef(false);
```

After the existing caregiver push registration `useEffect`, add this new effect:

```typescript
// Register Expo push token for patient (for reminder notifications)
useEffect(() => {
  if (!user || user.role !== "patient" || patientPushRegisteredRef.current) return;
  patientPushRegisteredRef.current = true;

  (async () => {
    try {
      const { status: existing } = await Notifications.getPermissionsAsync();
      let finalStatus = existing;
      if (existing !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== "granted") return;

      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ??
        Constants.easConfig?.projectId;
      const tokenData = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined
      );
      await fetch(`${API_BASE_URL}/api/notifications/register-patient-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ expoPushToken: tokenData.data }),
      });
    } catch (err) {
      console.error("Patient push token registration failed (non-fatal):", err);
    }
  })();
}, [user]);
```

- [ ] **Step 3: Verify TypeScript compiles**

```
cd /Users/haadisiddiqui/projects/VVision-App && npx tsc --noEmit 2>&1 | head -30
```
Expected: No new errors related to RootNavigator.tsx

- [ ] **Step 4: Commit**

```bash
git add src/navigation/RootNavigator.tsx
git commit -m "feat: register patient push token on login for reminder notifications"
```

---

### Task 3: Reminder push cron job

**Files:**
- Create: `src/server-jobs/fireReminders.ts`
- Create: `src/server-jobs/fireReminders.test.ts`
- Modify: `src/server-jobs/scheduler.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/server-jobs/fireReminders.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseReminderTime, isReminderDueNow } from "./fireReminders";

describe("parseReminderTime", () => {
  it("parses '8:00 AM' to { hours: 8, minutes: 0 }", () => {
    expect(parseReminderTime("8:00 AM")).toEqual({ hours: 8, minutes: 0 });
  });
  it("parses '8:00 PM' to { hours: 20, minutes: 0 }", () => {
    expect(parseReminderTime("8:00 PM")).toEqual({ hours: 20, minutes: 0 });
  });
  it("parses '12:30 PM' to { hours: 12, minutes: 30 }", () => {
    expect(parseReminderTime("12:30 PM")).toEqual({ hours: 12, minutes: 30 });
  });
  it("parses '12:00 AM' to { hours: 0, minutes: 0 }", () => {
    expect(parseReminderTime("12:00 AM")).toEqual({ hours: 0, minutes: 0 });
  });
  it("returns null for unparseable strings", () => {
    expect(parseReminderTime("morning")).toBeNull();
    expect(parseReminderTime("")).toBeNull();
    expect(parseReminderTime(null)).toBeNull();
  });
});

describe("isReminderDueNow", () => {
  it("returns true when reminder time is within 5-minute window", () => {
    // 8:02 AM now, reminder at 8:00 AM
    const now = new Date("2026-05-08T08:02:00Z");
    expect(isReminderDueNow({ hours: 8, minutes: 0 }, now)).toBe(true);
  });
  it("returns false when reminder time is outside 5-minute window", () => {
    const now = new Date("2026-05-08T08:10:00Z");
    expect(isReminderDueNow({ hours: 8, minutes: 0 }, now)).toBe(false);
  });
  it("returns false when reminder is in the future", () => {
    const now = new Date("2026-05-08T07:55:00Z");
    expect(isReminderDueNow({ hours: 8, minutes: 0 }, now)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
cd /Users/haadisiddiqui/projects/VVision-App && npx vitest run src/server-jobs/fireReminders.test.ts
```
Expected: FAIL (module not found)

- [ ] **Step 3: Implement fireReminders.ts**

```typescript
// src/server-jobs/fireReminders.ts
import { Db } from "mongodb";

export function parseReminderTime(time: string | null | undefined): { hours: number; minutes: number } | null {
  if (!time) return null;
  const match = time.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3].toUpperCase();
  if (period === "AM") {
    if (hours === 12) hours = 0;
  } else {
    if (hours !== 12) hours += 12;
  }
  return { hours, minutes };
}

export function isReminderDueNow(
  parsed: { hours: number; minutes: number },
  now: Date,
  windowMinutes = 5
): boolean {
  const reminderMinutes = parsed.hours * 60 + parsed.minutes;
  const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const diff = nowMinutes - reminderMinutes;
  return diff >= 0 && diff < windowMinutes;
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
    console.error("[fireReminders] push delivery error:", ticket.details);
  }
}

export async function fireRemindersForAll(db: Db): Promise<void> {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  const reminders = await db
    .collection("reminders")
    .find({ time: { $exists: true, $ne: null } })
    .toArray();

  for (const reminder of reminders) {
    const parsed = parseReminderTime(reminder.time);
    if (!parsed) continue;
    if (!isReminderDueNow(parsed, now)) continue;

    // Skip if already notified today
    if (reminder.notified_date === today) continue;

    const tokenDoc = await db
      .collection("patient_push_tokens")
      .findOne({ patientId: reminder.patient_id });
    if (!tokenDoc?.expoPushToken) continue;

    try {
      await sendExpoPush(
        tokenDoc.expoPushToken,
        "Reminder",
        reminder.text,
        { reminderId: String(reminder._id), type: "reminder" }
      );
      await db.collection("reminders").updateOne(
        { _id: reminder._id },
        { $set: { notified_date: today } }
      );
    } catch (err) {
      console.error("[fireReminders] failed for reminder", reminder._id, err);
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```
cd /Users/haadisiddiqui/projects/VVision-App && npx vitest run src/server-jobs/fireReminders.test.ts
```
Expected: PASS (5 tests)

- [ ] **Step 5: Add to scheduler**

In `src/server-jobs/scheduler.ts`, add the reminder cron:

```typescript
import cron from "node-cron";
import { getDb } from "../server-core/database";
import { runInferenceAll } from "./inferPatterns";
import { fireRemindersForAll } from "./fireReminders";

export function startCron() {
  // Nightly 03:00 UTC — pattern inference
  cron.schedule("0 3 * * *", async () => {
    try { await runInferenceAll(getDb()); } catch (e) { console.error("nightly inference:", e); }
  });

  // Every 5 minutes — fire due reminders
  cron.schedule("*/5 * * * *", async () => {
    try { await fireRemindersForAll(getDb()); } catch (e) { console.error("fireReminders:", e); }
  });

  console.log("cron scheduled");
}
```

- [ ] **Step 6: Verify TypeScript compiles**

```
cd /Users/haadisiddiqui/projects/VVision-App && npx tsc --noEmit 2>&1 | head -30
```
Expected: No new errors

- [ ] **Step 7: Run all tests**

```
cd /Users/haadisiddiqui/projects/VVision-App && npx vitest run
```
Expected: All existing tests still pass, new tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/server-jobs/fireReminders.ts src/server-jobs/fireReminders.test.ts src/server-jobs/scheduler.ts
git commit -m "feat: add reminder push notification cron job (every 5 min)"
```
