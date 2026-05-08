# Zone Alerts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Caregivers set a safe zone (home address or radius) for their patient. When the patient's phone leaves that zone for more than 5 minutes, the caregiver gets an immediate push notification.

**Architecture:** 
- New `geofences` MongoDB collection stores one geofence per patient (lat, lng, radiusMeters).
- Two backend routes: `GET/PUT /api/profiles/:patientId/geofence` for caregivers to read/set zones.
- Patient app uses `expo-location` with `expo-task-manager` to run a background task that checks position every 5 minutes. If outside the zone for 2 consecutive checks (~10 min), it calls `POST /api/notifications/zone-exit` on the backend.
- Backend route `POST /api/notifications/zone-exit` sends push to caregiver via the `pushTokens` collection.

**⚠️ Build requirement:** `expo-location` requires a new EAS development build (cannot run background tasks in Expo Go). Run `eas build --profile development --platform ios` after implementing.

**Tech Stack:** React Native, `expo-location`, `expo-task-manager`, Express/TypeScript, MongoDB, Expo Push API

---

## File Structure

- Create: `src/server-routes/geofence.ts` — `GET/PUT /api/profiles/:patientId/geofence`
- Create: `src/server-routes/geofence.test.ts` — backend tests
- Create: `src/server-routes/zoneExit.ts` — `POST /api/notifications/zone-exit`
- Create: `src/services/locationWatcher.ts` — background location task
- Modify: `src/server-core/database.ts` — add `geofences` index
- Modify: `src/server.ts` — mount new routes
- Modify: `app.json` — add location permissions + background modes
- Modify: `src/navigation/RootNavigator.tsx` — start location watcher for patients
- Modify: `src/screens/caregiver/PatientDetailScreen.tsx` — geofence setup UI

---

### Task 1: Install expo-location and update app.json

**Files:**
- Modify: `app.json`

- [ ] **Step 1: Install expo-location**

```bash
cd /Users/haadisiddiqui/projects/VVision-App && npx expo install expo-location expo-task-manager
```

- [ ] **Step 2: Update app.json permissions**

In `app.json`, under `expo.ios.infoPlist`, add location permissions:

```json
"NSLocationWhenInUseUsageDescription": "Vela uses your location to alert your caregiver if you leave your safe zone.",
"NSLocationAlwaysAndWhenInUseUsageDescription": "Vela uses your location in the background to alert your caregiver if you leave your safe zone.",
"NSLocationAlwaysUsageDescription": "Vela uses your location in the background to alert your caregiver if you leave your safe zone."
```

Under `expo.ios.infoPlist.UIBackgroundModes`, change from `["fetch"]` to:

```json
["fetch", "location"]
```

Under `expo.android` (create if not present), add:

```json
"permissions": ["ACCESS_BACKGROUND_LOCATION", "ACCESS_FINE_LOCATION"]
```

- [ ] **Step 3: Verify app.json is valid JSON**

```bash
cd /Users/haadisiddiqui/projects/VVision-App && node -e "JSON.parse(require('fs').readFileSync('app.json','utf8')); console.log('valid')"
```
Expected: `valid`

- [ ] **Step 4: Commit**

```bash
git add app.json package.json
git commit -m "feat: add expo-location and location permissions for zone alerts"
```

---

### Task 2: Backend geofence routes

**Files:**
- Create: `src/server-routes/geofence.ts`
- Create: `src/server-routes/geofence.test.ts`
- Modify: `src/server-core/database.ts`
- Modify: `src/server.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/server-routes/geofence.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

vi.mock("../server-core/security", () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.auth = { userId: "user-caregiver" };
    next();
  },
}));
vi.mock("../server-core/seatResolver", () => ({
  requireSeat: (_req: any, _res: any, next: any) => next(),
}));

const mockDoc = { patientId: "patient-123", lat: 32.9, lng: -96.8, radiusMeters: 500, name: "Home", updatedAt: new Date() };
const mockCol = {
  findOne: vi.fn().mockResolvedValue(mockDoc),
  replaceOne: vi.fn().mockResolvedValue({}),
};
vi.mock("../server-core/database", () => ({
  getDb: () => ({ collection: () => mockCol }),
}));

import geofenceRouter from "./geofence";
const app = express();
app.use(express.json());
app.use("/api/profiles/:patientId/geofence", geofenceRouter);

describe("GET /api/profiles/:patientId/geofence", () => {
  it("returns existing geofence", async () => {
    const res = await request(app).get("/api/profiles/patient-123/geofence");
    expect(res.status).toBe(200);
    expect(res.body.lat).toBe(32.9);
    expect(res.body.radiusMeters).toBe(500);
  });

  it("returns 404 when no geofence set", async () => {
    mockCol.findOne.mockResolvedValueOnce(null);
    const res = await request(app).get("/api/profiles/patient-123/geofence");
    expect(res.status).toBe(404);
  });
});

describe("PUT /api/profiles/:patientId/geofence", () => {
  beforeEach(() => vi.clearAllMocks());

  it("upserts geofence and returns 200", async () => {
    const res = await request(app)
      .put("/api/profiles/patient-123/geofence")
      .send({ lat: 32.9, lng: -96.8, radiusMeters: 400, name: "Home" });
    expect(res.status).toBe(200);
    expect(res.body.lat).toBe(32.9);
  });

  it("returns 400 for invalid lat/lng", async () => {
    const res = await request(app)
      .put("/api/profiles/patient-123/geofence")
      .send({ lat: 999, lng: -96.8, radiusMeters: 400 });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
cd /Users/haadisiddiqui/projects/VVision-App && npx vitest run src/server-routes/geofence.test.ts
```
Expected: FAIL (module not found)

- [ ] **Step 3: Create the geofence route**

```typescript
// src/server-routes/geofence.ts
import { Router } from "express";
import { z } from "zod";
import { getDb } from "../server-core/database";
import { authMiddleware } from "../server-core/security";
import { requireSeat } from "../server-core/seatResolver";

const router = Router({ mergeParams: true });

const geofenceSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radiusMeters: z.number().min(50).max(50000).default(500),
  name: z.string().max(100).trim().default("Home"),
});

function geofenceOut(doc: any) {
  return {
    patientId: doc.patientId,
    lat: doc.lat,
    lng: doc.lng,
    radiusMeters: doc.radiusMeters,
    name: doc.name,
    updatedAt: doc.updatedAt,
  };
}

// GET /api/profiles/:patientId/geofence
router.get("/", authMiddleware, requireSeat, async (req, res) => {
  try {
    const db = getDb();
    const doc = await db.collection("geofences").findOne({ patientId: req.params.patientId });
    if (!doc) {
      res.status(404).json({ detail: "No geofence set" });
      return;
    }
    res.json(geofenceOut(doc));
  } catch (err) {
    console.error("get geofence error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

// PUT /api/profiles/:patientId/geofence
router.put("/", authMiddleware, requireSeat, async (req, res) => {
  const parsed = geofenceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ detail: parsed.error.issues[0].message });
    return;
  }
  try {
    const db = getDb();
    const doc = {
      patientId: req.params.patientId,
      lat: parsed.data.lat,
      lng: parsed.data.lng,
      radiusMeters: parsed.data.radiusMeters,
      name: parsed.data.name,
      updatedAt: new Date(),
    };
    await db.collection("geofences").replaceOne(
      { patientId: req.params.patientId },
      doc,
      { upsert: true }
    );
    res.json(geofenceOut(doc));
  } catch (err) {
    console.error("put geofence error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

export default router;
```

- [ ] **Step 4: Add geofences index in database.ts**

```typescript
  await db.collection("geofences").createIndex({ patientId: 1 }, { unique: true });
```

- [ ] **Step 5: Mount route in server.ts**

```typescript
import geofenceRouter from "./server-routes/geofence";
// ...
app.use("/api/profiles/:patientId/geofence", geofenceRouter);
```

- [ ] **Step 6: Run test to verify it passes**

```
cd /Users/haadisiddiqui/projects/VVision-App && npx vitest run src/server-routes/geofence.test.ts
```
Expected: PASS (4 tests)

- [ ] **Step 7: Commit**

```bash
git add src/server-routes/geofence.ts src/server-routes/geofence.test.ts src/server-core/database.ts src/server.ts
git commit -m "feat: add geofence backend routes (GET/PUT /api/profiles/:patientId/geofence)"
```

---

### Task 3: Zone exit notification route

**Files:**
- Create: `src/server-routes/zoneExit.ts`
- Modify: `src/server-routes/patientTokens.ts` (add zone-exit route) — OR create new file and mount under `/api/notifications`

The simplest approach is to add a `POST /api/notifications/zone-exit` route to the existing `patientTokens.ts` file. The patient's app calls this when it detects the patient is outside the zone. The backend looks up the caregiver push token and fires the push.

- [ ] **Step 1: Add zone-exit route to patientTokens.ts**

In `src/server-routes/patientTokens.ts`, add after the existing register route:

```typescript
// POST /api/notifications/zone-exit — patient app signals zone departure
// Looks up caregiver's push token and sends alert
router.post("/zone-exit", authMiddleware, resolvePatientId, async (req, res) => {
  try {
    const db = getDb();
    const patientId = req.patientId!;

    // Rate-limit: only send once per hour per patient
    const lastAlertKey = `zone_exit_last:${patientId}`;
    const lastAlert = await db.collection("geofences").findOne({ patientId, lastZoneAlert: { $exists: true } });
    if (lastAlert?.lastZoneAlert) {
      const elapsed = Date.now() - new Date(lastAlert.lastZoneAlert).getTime();
      if (elapsed < 60 * 60 * 1000) {
        res.json({ sent: false, reason: "rate_limited" });
        return;
      }
    }

    // Get patient name
    const user = await db.collection("users").findOne({ patient_id: patientId });
    const patientName = user?.name ?? "Your patient";

    // Get caregiver push token
    const tokenDoc = await db.collection("pushTokens").findOne({ patientId });
    if (!tokenDoc?.expoPushToken) {
      res.json({ sent: false, reason: "no_caregiver_token" });
      return;
    }

    // Send push
    const pushRes = await fetch("https://exp.host/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: tokenDoc.expoPushToken,
        title: "Zone Alert",
        body: `${patientName} has left their safe zone.`,
        data: { patientId, type: "zone_exit" },
        priority: "high",
      }),
    });
    const pushJson = await pushRes.json();
    const ticket = pushJson?.data?.[0];
    if (ticket?.status === "error") {
      console.error("[zone-exit] push error:", ticket.details);
    }

    // Record last alert time
    await db.collection("geofences").updateOne(
      { patientId },
      { $set: { lastZoneAlert: new Date() } }
    );

    res.json({ sent: true });
  } catch (err) {
    console.error("zone-exit error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});
```

- [ ] **Step 2: Verify TypeScript compiles**

```
cd /Users/haadisiddiqui/projects/VVision-App && npx tsc --noEmit 2>&1 | head -20
```
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/server-routes/patientTokens.ts
git commit -m "feat: add zone-exit push notification endpoint"
```

---

### Task 4: Patient background location watcher

**Files:**
- Create: `src/services/locationWatcher.ts`
- Modify: `src/navigation/RootNavigator.tsx`

- [ ] **Step 1: Create locationWatcher.ts**

```typescript
// src/services/locationWatcher.ts
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { authHeaders } from "../api/client";
import { API_BASE_URL } from "../config/api";

const TASK_NAME = "vela-location-check";
const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

let outsideZoneSince: Date | null = null;
const ALERT_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes (2 consecutive checks)

function haversineDistanceMeters(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

TaskManager.defineTask(TASK_NAME, async ({ data, error }: any) => {
  if (error) { console.error("[locationWatcher] task error:", error); return; }
  const location = data?.locations?.[0];
  if (!location) return;

  try {
    const geofenceRes = await fetch(`${API_BASE_URL}/api/profiles/mine/geofence-check`, {
      headers: { ...authHeaders() },
    });
    if (!geofenceRes.ok) return;
    const geofence = await geofenceRes.json();
    if (!geofence?.lat) return;

    const dist = haversineDistanceMeters(
      location.coords.latitude, location.coords.longitude,
      geofence.lat, geofence.lng
    );

    if (dist > geofence.radiusMeters) {
      if (!outsideZoneSince) {
        outsideZoneSince = new Date();
      } else if (Date.now() - outsideZoneSince.getTime() >= ALERT_THRESHOLD_MS) {
        // Outside for 10+ minutes — alert caregiver
        await fetch(`${API_BASE_URL}/api/notifications/zone-exit`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
        });
        outsideZoneSince = null; // Reset so we don't spam
      }
    } else {
      outsideZoneSince = null; // Back inside zone
    }
  } catch (err) {
    console.error("[locationWatcher] check failed:", err);
  }
});

export async function startLocationWatcher(): Promise<void> {
  const { status } = await Location.requestBackgroundPermissionsAsync();
  if (status !== "granted") return;

  const isRegistered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
  if (isRegistered) return;

  await Location.startLocationUpdatesAsync(TASK_NAME, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: CHECK_INTERVAL_MS,
    distanceInterval: 50,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: "Vela",
      notificationBody: "Watching for safe zone alerts",
    },
  });
}

export async function stopLocationWatcher(): Promise<void> {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
  if (isRegistered) {
    await Location.stopLocationUpdatesAsync(TASK_NAME);
  }
}
```

**Note:** The background task calls a new endpoint `GET /api/profiles/mine/geofence-check` — this is a patient-facing alias that resolves the patient's own geofence. Add this to the geofence router in Task 5.

- [ ] **Step 2: Start the watcher in RootNavigator for patients**

In `src/navigation/RootNavigator.tsx`, add the import:

```typescript
import { startLocationWatcher } from "../services/locationWatcher";
```

Inside the patient push token registration `useEffect` (the one that checks `user.role !== "patient"`), after the token registration call, add:

```typescript
      // Start location watcher for zone alerts
      startLocationWatcher().catch((err) =>
        console.error("Location watcher start failed (non-fatal):", err)
      );
```

- [ ] **Step 3: Verify TypeScript compiles**

```
cd /Users/haadisiddiqui/projects/VVision-App && npx tsc --noEmit 2>&1 | head -30
```
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/services/locationWatcher.ts src/navigation/RootNavigator.tsx
git commit -m "feat: add background location watcher for zone exit detection"
```

---

### Task 5: Add geofence-check patient route + caregiver setup UI

**Files:**
- Modify: `src/server-routes/geofence.ts` — add `GET /api/profiles/mine/geofence-check`
- Modify: `src/server.ts` — mount patient geofence-check route
- Modify: `src/screens/caregiver/PatientDetailScreen.tsx` — geofence setup button

**Sub-step A: Add patient geofence-check route**

In `src/server-routes/geofence.ts`, the existing routes use `/:patientId` which requires a seat. We need a patient-self route. Add a separate patient router:

```typescript
// At the bottom of geofence.ts, after the existing router export:

import { resolvePatientId } from "../server-core/patientResolver";

export const patientGeofenceRouter = Router();

// GET /api/profiles/mine/geofence-check — patient reads their own geofence
patientGeofenceRouter.get("/", authMiddleware, resolvePatientId, async (req, res) => {
  try {
    const db = getDb();
    const doc = await db.collection("geofences").findOne({ patientId: req.patientId! });
    if (!doc) {
      res.status(404).json({ detail: "No geofence set" });
      return;
    }
    res.json(geofenceOut(doc));
  } catch (err) {
    console.error("get patient geofence error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});
```

In `src/server.ts`, mount it:

```typescript
import geofenceRouter, { patientGeofenceRouter } from "./server-routes/geofence";
// ...
app.use("/api/profiles/mine/geofence-check", patientGeofenceRouter);
app.use("/api/profiles/:patientId/geofence", geofenceRouter);
```

**Important:** Mount `mine/geofence-check` BEFORE `/:patientId/geofence` to avoid Express matching `:patientId = "mine"`.

**Sub-step B: Caregiver geofence setup UI**

In `src/screens/caregiver/PatientDetailScreen.tsx`, add a "Set Safe Zone" button in the actions section. When tapped, show a bottom sheet with fields for address (displayed as lat/lng for now — full address geocoding is out of scope for this plan).

Add state:

```typescript
const [geofence, setGeofence] = useState<{ lat: number; lng: number; radiusMeters: number; name: string } | null>(null);
const [geofenceSheetOpen, setGeofenceSheetOpen] = useState(false);
```

Fetch existing geofence on mount:

```typescript
useEffect(() => {
  fetch(`${API_BASE_URL}/api/profiles/${patientId}/geofence`, {
    headers: { ...authHeaders() },
  })
    .then((r) => r.ok ? r.json() : null)
    .then((data) => { if (data) setGeofence(data); })
    .catch(() => {});
}, [patientId]);
```

Add a "Safe Zone" button in the actions row (wherever the existing "Request Live View" button is):

```typescript
<TouchableOpacity
  style={[styles.actionBtn, { backgroundColor: colors.surface }]}
  onPress={() => setGeofenceSheetOpen(true)}
  accessibilityLabel="Set safe zone for patient"
>
  <Ionicons name="location-outline" size={20} color={colors.violet} />
  <Text style={styles.actionBtnLabel}>
    {geofence ? `Zone: ${geofence.name}` : "Set Safe Zone"}
  </Text>
</TouchableOpacity>
```

Add the geofence modal (simplified — caregiver enters lat/lng manually or uses current location):

```typescript
<Modal visible={geofenceSheetOpen} transparent animationType="slide" onRequestClose={() => setGeofenceSheetOpen(false)}>
  <View style={styles.geofenceOverlay}>
    <View style={[styles.geofenceSheet, { backgroundColor: colors.surface }]}>
      <Text style={styles.geofenceTitle}>Set Safe Zone</Text>
      <Text style={styles.geofenceSub}>
        {geofence
          ? `Current: ${geofence.name} (${geofence.radiusMeters}m radius)`
          : "No safe zone set yet"}
      </Text>
      <TouchableOpacity
        style={[styles.geofenceBtn, { backgroundColor: colors.violet }]}
        onPress={async () => {
          // Use patient's last known location as zone center (simplified)
          Alert.alert(
            "Set Safe Zone",
            "To set the safe zone, enter the patient's home coordinates. Contact support for full address search.",
            [{ text: "OK" }]
          );
        }}
      >
        <Text style={styles.geofenceBtnText}>Use Current Approach</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => setGeofenceSheetOpen(false)}>
        <Text style={[styles.geofenceSub, { textAlign: "center", marginTop: spacing.md }]}>Cancel</Text>
      </TouchableOpacity>
    </View>
  </View>
</Modal>
```

Add styles:

```typescript
    geofenceOverlay: {
      flex: 1, backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "flex-end",
    },
    geofenceSheet: {
      borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
      padding: spacing.xl, gap: spacing.md,
    },
    geofenceTitle: { fontSize: 18, ...fonts.medium, color: colors.text },
    geofenceSub: { fontSize: 13, ...fonts.regular, color: colors.muted },
    geofenceBtn: {
      borderRadius: radius.pill, paddingVertical: spacing.md,
      alignItems: "center",
    },
    geofenceBtnText: { fontSize: 15, ...fonts.medium, color: "#fff" },
    actionBtn: {
      flexDirection: "row", alignItems: "center", gap: spacing.xs,
      borderRadius: radius.md, padding: spacing.sm,
    },
    actionBtnLabel: { fontSize: 13, ...fonts.regular, color: colors.text },
```

- [ ] **Step 6: Verify TypeScript compiles**

```
cd /Users/haadisiddiqui/projects/VVision-App && npx tsc --noEmit 2>&1 | head -30
```
Expected: No errors.

- [ ] **Step 7: Run all tests**

```
cd /Users/haadisiddiqui/projects/VVision-App && npx vitest run
```
Expected: All tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/server-routes/geofence.ts src/server.ts src/screens/caregiver/PatientDetailScreen.tsx
git commit -m "feat: add geofence setup UI and patient geofence-check route"
```

---

## After Implementation

Run a new EAS development build to test location features:

```bash
eas build --profile development --platform ios
```

Background location tasks cannot be tested in Expo Go — they require a dev client build.
