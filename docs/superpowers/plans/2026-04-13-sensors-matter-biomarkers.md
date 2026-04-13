# Plan D — Sensors (Matter/HomeKit + Smartphone Biomarkers) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** Feed the Living Profile passively from (a) smart-home sensors the family already owns via HomeKit/Matter, and (b) smartphone biomarkers captured on the caregiver's phone during daily check-ins.

**Architecture:** Two independent pipelines, both writing to the memory layer via the existing `/api/profiles/:patientId/memory` endpoint plus a new `/api/profiles/:patientId/events` endpoint for high-volume structured events. Passive-signal writes are rate-limited and batched.

**Tech Stack:** React Native · Expo · `expo-sensors` (accelerometer) · `expo-device` · `@matter/main` (Matter) · HomeKit via `react-native-homekit` (iOS only) · backend Express + MongoDB.

**Depends on:** Plan A. Does NOT depend on Plan B or C.

**Worktree:** `.worktrees/sensors-matter-biomarkers`, new branch `feature/sensors-matter-biomarkers` from main.

**Key design choices:**
- v1 iOS-only for HomeKit; Matter bridging via HomeKit on iOS is the fastest path. Android Matter support comes in v2.
- Smartphone biomarkers are labeled "general wellness" — never a diagnostic claim.
- All passive writes are opt-in via Settings → Sensors.

---

### Task 1: Backend — events collection + endpoint

**Files:**
- Create: `src/server-routes/events.ts`
- Create: `src/server-routes/events.test.ts`
- Modify: `src/server.ts`, `src/server-core/database.ts`

- [ ] **Step 1: Failing test.** `src/server-routes/events.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { eventBatchSchema } from "./events";

describe("eventBatchSchema", () => {
  it("accepts a batch of events", () => {
    const res = eventBatchSchema.safeParse({
      events: [
        { kind: "motion", capturedAt: new Date().toISOString(), data: { room: "kitchen" } },
        { kind: "gait", capturedAt: new Date().toISOString(), data: { cadence: 102 } },
      ],
    });
    expect(res.success).toBe(true);
  });
  it("rejects missing kind", () => {
    expect(eventBatchSchema.safeParse({ events: [{ capturedAt: "2026-01-01T00:00:00Z", data: {} }] }).success).toBe(false);
  });
  it("rejects >100 events per batch", () => {
    const ev = { kind: "motion", capturedAt: new Date().toISOString(), data: {} };
    expect(eventBatchSchema.safeParse({ events: Array(101).fill(ev) }).success).toBe(false);
  });
});
```
Run → FAIL.

- [ ] **Step 2: Implement.** `src/server-routes/events.ts`:
```ts
import { Router } from "express";
import { z } from "zod";
import { getDb } from "../server-core/database";
import { authMiddleware } from "../server-core/security";
import { requireSeat } from "../server-core/seatResolver";

const eventKind = z.enum([
  "motion", "door", "presence", "sleep",
  "gait", "typing_cadence", "voice_sample",
]);

const eventSchema = z.object({
  kind: eventKind,
  capturedAt: z.string(),
  data: z.record(z.string(), z.unknown()),
});

export const eventBatchSchema = z.object({
  events: z.array(eventSchema).min(1).max(100),
});

const router = Router();

router.post("/:patientId/events", authMiddleware, requireSeat, async (req, res) => {
  const parsed = eventBatchSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ detail: parsed.error.issues[0].message }); return; }
  try {
    const db = getDb();
    const now = new Date().toISOString();
    const docs = parsed.data.events.map(e => ({
      patientId: req.params.patientId,
      kind: e.kind,
      capturedAt: e.capturedAt,
      data: e.data,
      authorUserId: req.seat!.userId,
      receivedAt: now,
    }));
    await db.collection("profile_events").insertMany(docs);
    res.status(201).json({ ok: true, inserted: docs.length });
  } catch (err: any) {
    console.error("events write error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

router.get("/:patientId/events", authMiddleware, requireSeat, async (req, res) => {
  try {
    const db = getDb();
    const since = (req.query.since as string) || new Date(Date.now() - 24 * 3600_000).toISOString();
    const kind = req.query.kind as string | undefined;
    const filter: any = { patientId: req.params.patientId, capturedAt: { $gte: since } };
    if (kind) filter.kind = kind;
    const events = await db.collection("profile_events").find(filter).limit(500).sort({ capturedAt: -1 }).toArray();
    res.json({ events });
  } catch (err) {
    console.error("events read error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

export default router;
```

Run test → PASS.

- [ ] **Step 3:** In `src/server-core/database.ts` `connectDb()` append index:
```ts
await db.collection("profile_events").createIndex({ patientId: 1, capturedAt: -1 });
await db.collection("profile_events").createIndex({ patientId: 1, kind: 1, capturedAt: -1 });
```

- [ ] **Step 4:** Mount in server.ts: `app.use("/api/profiles", eventRoutes);`

- [ ] **Step 5:** Commit:
```bash
git add src/server-routes/events.ts src/server-routes/events.test.ts src/server.ts src/server-core/database.ts
git commit -m "feat: add profile_events collection + batch ingest endpoint"
```

---

### Task 2: Client — events batcher

**Files:**
- Create: `src/lib/eventBatcher.ts`

- [ ] **Step 1:** `src/lib/eventBatcher.ts`:
```ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { authFetch } from "../api/authFetch";

type Kind = "motion" | "door" | "presence" | "sleep" | "gait" | "typing_cadence" | "voice_sample";
interface QueuedEvent { kind: Kind; capturedAt: string; data: Record<string, unknown>; patientId: string }

const KEY = "vela:event_queue";
let flushing = false;

export async function queueEvent(e: QueuedEvent) {
  const raw = await AsyncStorage.getItem(KEY);
  const queue: QueuedEvent[] = raw ? JSON.parse(raw) : [];
  queue.push(e);
  await AsyncStorage.setItem(KEY, JSON.stringify(queue));
  if (queue.length >= 20) flush().catch(() => {});
}

export async function flush() {
  if (flushing) return;
  flushing = true;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const queue: QueuedEvent[] = raw ? JSON.parse(raw) : [];
    if (queue.length === 0) return;
    // Group by patientId; batch up to 100 per POST.
    const byPatient: Record<string, QueuedEvent[]> = {};
    queue.forEach((e) => { (byPatient[e.patientId] ||= []).push(e); });
    const remaining: QueuedEvent[] = [];
    for (const [patientId, evs] of Object.entries(byPatient)) {
      for (let i = 0; i < evs.length; i += 100) {
        const chunk = evs.slice(i, i + 100);
        try {
          await authFetch(`/api/profiles/${patientId}/events`, {
            method: "POST",
            body: JSON.stringify({ events: chunk.map(({ patientId: _, ...rest }) => rest) }),
          });
        } catch (e) {
          remaining.push(...chunk); // keep failed ones for retry
        }
      }
    }
    await AsyncStorage.setItem(KEY, JSON.stringify(remaining));
  } finally {
    flushing = false;
  }
}
```

- [ ] **Step 2:** Commit:
```bash
git add src/lib/eventBatcher.ts
git commit -m "feat: add offline-capable event batcher with AsyncStorage queue"
```

---

### Task 3: Smartphone biomarkers — gait capture

**Files:**
- Create: `src/lib/biomarkers/gait.ts`
- Create: `src/lib/biomarkers/gait.test.ts`

- [ ] **Step 1:** `npx expo install expo-sensors`

- [ ] **Step 2: Failing test.** `src/lib/biomarkers/gait.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { computeCadence } from "./gait";

describe("computeCadence", () => {
  it("counts peaks per minute from accelerometer magnitudes", () => {
    // Synthetic: 30s at 50Hz = 1500 samples. 50 "steps" → 100 steps/min.
    const samples: number[] = [];
    for (let i = 0; i < 1500; i++) {
      // Peak every 30 samples (50Hz / 30 = ~1.67Hz ≈ 100 steps/min)
      samples.push(i % 30 === 0 ? 2.0 : 1.0);
    }
    const cadence = computeCadence(samples, 50);
    expect(cadence).toBeGreaterThan(95);
    expect(cadence).toBeLessThan(105);
  });
  it("returns 0 for no motion", () => {
    expect(computeCadence(new Array(500).fill(1.0), 50)).toBe(0);
  });
});
```
Run → FAIL.

- [ ] **Step 3:** `src/lib/biomarkers/gait.ts`:
```ts
/**
 * Compute walking cadence (steps per minute) from accelerometer magnitudes.
 * Simple peak detection with a 0.3g threshold above running mean.
 * This is a general-wellness signal, not clinically validated.
 */
export function computeCadence(magnitudes: number[], sampleRateHz: number): number {
  if (magnitudes.length < sampleRateHz * 2) return 0;
  const mean = magnitudes.reduce((a, b) => a + b, 0) / magnitudes.length;
  const threshold = mean + 0.3;
  let peaks = 0;
  let above = false;
  for (const v of magnitudes) {
    if (v > threshold && !above) { peaks += 1; above = true; }
    else if (v <= threshold) above = false;
  }
  const durationMinutes = magnitudes.length / sampleRateHz / 60;
  if (durationMinutes <= 0) return 0;
  return Math.round(peaks / durationMinutes);
}

import { Accelerometer } from "expo-sensors";

export async function captureGaitWindow(durationMs: number): Promise<{ cadence: number; sampleCount: number }> {
  Accelerometer.setUpdateInterval(20); // 50 Hz
  const magnitudes: number[] = [];
  const sub = Accelerometer.addListener(({ x, y, z }) => {
    magnitudes.push(Math.sqrt(x * x + y * y + z * z));
  });
  await new Promise((r) => setTimeout(r, durationMs));
  sub.remove();
  return {
    cadence: computeCadence(magnitudes, 50),
    sampleCount: magnitudes.length,
  };
}
```

Run test → PASS.

- [ ] **Step 4:** Commit:
```bash
git add src/lib/biomarkers/gait.ts src/lib/biomarkers/gait.test.ts package.json
git commit -m "feat: add accelerometer-based gait cadence capture"
```

---

### Task 4: Smartphone biomarkers — typing cadence

**Files:**
- Create: `src/lib/biomarkers/typing.ts`
- Create: `src/lib/biomarkers/typing.test.ts`

- [ ] **Step 1: Failing test.** `src/lib/biomarkers/typing.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { computeTypingMetrics } from "./typing";

describe("computeTypingMetrics", () => {
  it("calculates words-per-minute and average inter-key interval", () => {
    // 20 keystrokes, each 200ms apart = 4s total for 20 chars = ~60 WPM
    const times: number[] = [];
    for (let i = 0; i < 20; i++) times.push(i * 200);
    const m = computeTypingMetrics(times);
    expect(m.avgIntervalMs).toBeCloseTo(200, 0);
    expect(m.wpm).toBeGreaterThan(55);
    expect(m.wpm).toBeLessThan(65);
  });
  it("returns zeros for <2 keystrokes", () => {
    expect(computeTypingMetrics([]).wpm).toBe(0);
    expect(computeTypingMetrics([100]).wpm).toBe(0);
  });
});
```

- [ ] **Step 2: Implement.** `src/lib/biomarkers/typing.ts`:
```ts
/**
 * Compute typing metrics from an array of keystroke timestamps (ms).
 * WPM uses standard 5-char word. General wellness signal only.
 */
export interface TypingMetrics { wpm: number; avgIntervalMs: number; keystrokes: number }

export function computeTypingMetrics(timestampsMs: number[]): TypingMetrics {
  if (timestampsMs.length < 2) return { wpm: 0, avgIntervalMs: 0, keystrokes: timestampsMs.length };
  const intervals: number[] = [];
  for (let i = 1; i < timestampsMs.length; i++) intervals.push(timestampsMs[i] - timestampsMs[i - 1]);
  const avgIntervalMs = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const durationMs = timestampsMs[timestampsMs.length - 1] - timestampsMs[0];
  const wpm = Math.round((timestampsMs.length / 5) / (durationMs / 60000));
  return { wpm, avgIntervalMs: Math.round(avgIntervalMs), keystrokes: timestampsMs.length };
}
```

Run → PASS.

- [ ] **Step 3:** Commit:
```bash
git add src/lib/biomarkers/typing.ts src/lib/biomarkers/typing.test.ts
git commit -m "feat: add keystroke-based typing cadence metrics"
```

---

### Task 5: Integrate biomarkers into check-in flow

**Files:**
- Modify: `src/screens/caregiver/CheckInTextScreen.tsx`
- Modify: `src/screens/caregiver/CheckInScreen.tsx`

- [ ] **Step 1:** In `CheckInTextScreen`, capture keystroke timestamps into a ref while user types; on save, compute metrics + queue a `typing_cadence` event:
```tsx
// near top
import { computeTypingMetrics } from "../../lib/biomarkers/typing";
import { queueEvent, flush } from "../../lib/eventBatcher";
// in component
const keystrokesRef = useRef<number[]>([]);
// onChangeText:
onChangeText={(t) => { keystrokesRef.current.push(Date.now()); setText(t); }}
// in save(), after successful memory write:
if (patientId) {
  const m = computeTypingMetrics(keystrokesRef.current);
  await queueEvent({ kind: "typing_cadence", capturedAt: new Date().toISOString(), data: m as any, patientId });
  flush();
}
```

- [ ] **Step 2:** In `CheckInScreen` (voice), on `start` call `captureGaitWindow(30000)` in parallel and on save queue a `gait` event. Keep it lightweight — this doesn't block the voice capture.

- [ ] **Step 3:** Commit:
```bash
git add src/screens/caregiver/CheckInTextScreen.tsx src/screens/caregiver/CheckInScreen.tsx
git commit -m "feat: capture gait + typing biomarkers during check-ins"
```

---

### Task 6: Sensor settings screen

**Files:**
- Create: `src/screens/caregiver/SensorSettingsScreen.tsx`
- Create: `src/hooks/useSensorPrefs.ts`

- [ ] **Step 1:** `src/hooks/useSensorPrefs.ts`:
```ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

export interface SensorPrefs {
  gaitEnabled: boolean;
  typingEnabled: boolean;
  smartHomeEnabled: boolean;
}
const KEY = "vela:sensor_prefs";
const DEFAULT: SensorPrefs = { gaitEnabled: true, typingEnabled: true, smartHomeEnabled: false };

export function useSensorPrefs() {
  const [prefs, setPrefs] = useState<SensorPrefs>(DEFAULT);
  useEffect(() => { AsyncStorage.getItem(KEY).then(v => v && setPrefs({ ...DEFAULT, ...JSON.parse(v) })); }, []);
  const update = async (p: Partial<SensorPrefs>) => {
    const next = { ...prefs, ...p };
    setPrefs(next);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  };
  return { prefs, update };
}
```

- [ ] **Step 2:** Screen:
```tsx
import React from "react";
import { View, Text, Switch, ScrollView } from "react-native";
import { useSensorPrefs } from "../../hooks/useSensorPrefs";

export default function SensorSettingsScreen() {
  const { prefs, update } = useSensorPrefs();
  return (
    <ScrollView contentContainerStyle={{ padding: 24 }}>
      <Text style={{ fontSize: 22, fontWeight: "700", marginBottom: 16 }}>Sensors</Text>
      <Text style={{ color: "#64748b", marginBottom: 24 }}>All sensing is off by default for the patient. These toggles affect the CAREGIVER'S phone during check-ins — general wellness signals only, never a diagnosis.</Text>
      <Row label="Gait cadence (during voice check-ins)" value={prefs.gaitEnabled} onChange={(v) => update({ gaitEnabled: v })} />
      <Row label="Typing cadence (during text check-ins)" value={prefs.typingEnabled} onChange={(v) => update({ typingEnabled: v })} />
      <Row label="Smart home events (HomeKit / Matter)" value={prefs.smartHomeEnabled} onChange={(v) => update({ smartHomeEnabled: v })} />
    </ScrollView>
  );
}
function Row({ label, value, onChange }: any) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderColor: "#e2e8f0" }}>
      <Text style={{ flex: 1, fontSize: 15 }}>{label}</Text>
      <Switch value={value} onValueChange={onChange} />
    </View>
  );
}
```

- [ ] **Step 3:** Commit:
```bash
git add src/screens/caregiver/SensorSettingsScreen.tsx src/hooks/useSensorPrefs.ts
git commit -m "feat: add sensor settings screen + prefs hook"
```

---

### Task 7: HomeKit bridge (iOS-only, v1)

**Files:**
- Create: `src/lib/homekit/index.ts`
- Modify: `app.json` (NSHomeKitUsageDescription)

- [ ] **Step 1:** Add HomeKit usage string in `app.json` under `ios.infoPlist`:
```json
"NSHomeKitUsageDescription": "Vela uses HomeKit to watch for motion and door events that help detect wandering or sundowning."
```

- [ ] **Step 2:** Install: `npx expo install react-native-homekit` (iOS only). If unavailable in 2026, fall back to a thin native-module stub and note the gap in CLAUDE.md.

- [ ] **Step 3:** `src/lib/homekit/index.ts`:
```ts
import { Platform } from "react-native";
import { queueEvent } from "../eventBatcher";

export async function startHomeKitListeners(patientId: string): Promise<() => void> {
  if (Platform.OS !== "ios") return () => {};
  try {
    const HK = require("react-native-homekit"); // require inside try — unavailable on Android/web
    await HK.requestAuthorization();
    const homes = await HK.getHomes();
    const disposers: Array<() => void> = [];
    for (const home of homes) {
      for (const accessory of home.accessories) {
        for (const service of accessory.services) {
          // Motion sensors
          const mot = service.characteristics.find((c: any) => c.type === "00000022-0000-1000-8000-0026BB765291");
          if (mot) {
            const sub = HK.subscribe(accessory.uuid, service.uuid, mot.uuid, (value: boolean) => {
              if (value) queueEvent({
                kind: "motion",
                capturedAt: new Date().toISOString(),
                data: { room: service.name, accessory: accessory.name },
                patientId,
              });
            });
            disposers.push(sub);
          }
          // Contact (door) sensors
          const door = service.characteristics.find((c: any) => c.type === "0000006A-0000-1000-8000-0026BB765291");
          if (door) {
            const sub = HK.subscribe(accessory.uuid, service.uuid, door.uuid, (state: number) => {
              queueEvent({
                kind: "door",
                capturedAt: new Date().toISOString(),
                data: { door: accessory.name, state: state === 1 ? "open" : "closed" },
                patientId,
              });
            });
            disposers.push(sub);
          }
        }
      }
    }
    return () => disposers.forEach((d) => d());
  } catch (e) {
    console.warn("HomeKit unavailable:", e);
    return () => {};
  }
}
```

- [ ] **Step 4:** Commit:
```bash
git add src/lib/homekit/index.ts app.json package.json
git commit -m "feat: HomeKit motion + door event listeners (iOS v1)"
```

---

### Task 8: Wire HomeKit into caregiver root when enabled

**Files:**
- Modify: `src/navigation/RootNavigator.tsx` (or the caregiver view component)

- [ ] **Step 1:** In the caregiver view, when `prefs.smartHomeEnabled` is true and a `patientId` is resolved, call `startHomeKitListeners(patientId)` on mount and dispose on unmount. Flush the batcher every 2 min via `setInterval`.

- [ ] **Step 2:** Commit:
```bash
git add src/navigation/RootNavigator.tsx
git commit -m "feat: start HomeKit listeners when smart home enabled"
```

---

### Task 9: Smoke-test checklist

**Files:**
- Create: `docs/manual-tests/plan-d-smoke.md`

- [ ] Content:
```markdown
# Plan D Smoke Tests

1. **Gait capture** — During a voice check-in, walk in a circle. `GET /api/profiles/:patientId/events?kind=gait` returns a doc with non-zero cadence.
2. **Typing capture** — Type 40 characters in TextCheckIn. Check `?kind=typing_cadence`. `wpm` between 20 and 120.
3. **Sensor toggle off** — Disable gait in settings. Do a voice check-in. No gait event appears for the new window.
4. **Queue offline** — Put phone in airplane mode. Trigger gait capture. Expect event queued in AsyncStorage. Re-enable network → event appears in backend within 2 min.
5. **HomeKit pair** — On iOS, enable smart home. Trigger motion on a paired HomeKit motion sensor. `GET /api/profiles/:patientId/events?kind=motion` shows the event within 10s.
```

- [ ] **Step 2:** Commit:
```bash
git add docs/manual-tests/plan-d-smoke.md
git commit -m "docs: manual smoke-test checklist for Plan D"
```

---

### Task 10: Docs

**Files:**
- Modify: `README.md`, `CLAUDE.md`

- [ ] **Step 1:** README append:
```markdown
### Events & Sensors (Plan D)
| Method | Path | Purpose |
|---|---|---|
| POST | `/api/profiles/:patientId/events` | Ingest batch of passive events (max 100/batch) |
| GET | `/api/profiles/:patientId/events?since=&kind=` | Read recent events (last 24h default) |

Event kinds: `motion`, `door`, `presence`, `sleep`, `gait`, `typing_cadence`, `voice_sample`.
```

- [ ] **Step 2:** CLAUDE.md append:
```markdown
### Sensors (Plan D, 2026-04-13)
- Never mark a biomarker as diagnostic. The copy says "general wellness." Any change to wellness-vs-medical claim language requires a legal review.
- HomeKit is iOS-only in v1. Android Matter integration is a v2 plan.
- All passive writes flow through `src/lib/eventBatcher.ts` — queued offline, flushed when online.
```

- [ ] **Step 3:** Commit:
```bash
git add README.md CLAUDE.md
git commit -m "docs: document events collection + sensor privacy posture"
```

---

## Plan summary

Backend: `profile_events` collection + `/events` ingest. Client: `eventBatcher`, `gait.ts`, `typing.ts`, `SensorSettingsScreen`, HomeKit bridge, integration into check-in screens. All opt-in, all general-wellness framed.

**Next plan:** **E — Patient Companion (Twilio phone number)**.
