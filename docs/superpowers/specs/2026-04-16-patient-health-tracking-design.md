# Patient Health Tracking — Design

**Date:** 2026-04-16
**Status:** Approved

## Problem

The current "sensors" feature (Plan D) captures gait and typing biomarkers from the *caregiver's* phone during check-in screens. That data is meaningless for dementia monitoring — we need patient-side data, not caregiver-side data.

Patients also have no health visibility in the app at all. We want a Health surface comparable to Apple Health: steps, heart rate, active minutes, sleep — with trend graphs over time. Data should pull from any wearable the patient already uses (Apple Watch, Fitbit, Garmin, etc.) via Apple HealthKit, and degrade gracefully to step counting on a plain iPhone.

Caregivers must see the patient's data too: a quick "today" glance and full trend charts.

## Goals

- Patient sees their own health data in a dedicated Health tab
- Caregiver sees the patient's data in two places: a Today's Health strip on the patient card, and a full trend view inside the Patient Detail screen
- Data flows from the patient's phone → backend → caregiver's app
- Background sync so the data stays current even when patients (who may not be tech-savvy) don't open the app
- Plain iPhones still get steps; wearable owners get the full picture
- Remove the dead-end caregiver-side sensor capture

## Non-Goals

- Android support (HealthKit is iOS-only; Android can come later if needed)
- Manual data entry for health metrics (HealthKit is the source of truth)
- Wiping the existing `profile_events` data — capture stops, but historical events stay
- Removing the Patterns feature — it keeps working with whatever data exists

## Decisions

| Decision | Choice |
|---|---|
| Patient location | New "Health" tab in patient bottom navigation |
| Caregiver location | Today's Health strip on patient card + Health screen reachable from Patient Detail |
| Graph style | Line charts with gradient fill |
| Data source | Apple HealthKit (iOS only) |
| Metrics | Steps, Heart Rate, Active Minutes, Sleep |
| Sync model | Background-first (HKObserverQuery + iOS background tasks); on-app-open fallback |
| Permission UX | One-time custom onboarding screen on first Health-tab visit, then native HealthKit prompt |
| Old caregiver-side sensors | Removed (gait, typing, drawer entry, settings screen) |

## Architecture

### Patient App

**Health tab** — new entry in patient bottom navigation: `Today / Help / Faces / Health`.

**Health screen layout** (line-chart cards, top to bottom):
1. Steps — today's count, 7d/30d/90d trend
2. Heart Rate — latest reading, range toggle
3. Active Minutes — today's count, trend
4. Sleep — last night's hours, trend

Each card uses a line chart with gradient fill (matches the design selected during brainstorm).

**Empty states:**
- iPhone alone gives Steps via the M-series motion chip — Steps card always shows data.
- Heart Rate, Sleep, Active Minutes need a wearable. If HealthKit returns no data for a metric, the card shows: *"No data yet — connect a wearable in the iPhone Health app."*

**HealthKit integration:**
- Library: `react-native-health` (or equivalent maintained fork) wrapped via an Expo config plugin.
- Already on dev builds, so no new build constraint.
- Permission flow: patient first taps Health tab → custom onboarding screen explains what's pulled and why → tap "Connect" → native iOS HealthKit permission sheet appears.
- Required `Info.plist` keys: `NSHealthShareUsageDescription`, `NSHealthUpdateUsageDescription` (we don't write, but keep both for forward-compat).

**Sync model:**
- **Background (priority):** `HKObserverQuery` registers for each metric. When HealthKit gets new data, iOS wakes the app via background task. The app pulls deltas since `lastSyncedAt` and POSTs to backend. Battery-light because iOS controls the wake cadence.
- **On-app-open (fallback):** Every cold launch and every transition from background to foreground, pull the last 24h from HealthKit and POST. Idempotent because backend dedupes by `(patientId, metric, date)`.
- Constraint to flag: iOS background execution is best-effort. Patients who never open the app and have iOS aggressively suspending background tasks may have stale data — the on-open fallback covers that the moment they do open it.

### Caregiver App

**Patient card (Patients tab list):**
- Add a "Today's Health" strip below the patient's name: `4,821 steps · 72 bpm · 7h sleep`.
- Pulls from the new `GET /summary` endpoint.
- If patient has no readings yet, strip is hidden (don't clutter the card).

**Patient Detail screen:**
- New button: **Health** (same visual treatment as the existing Visit Reports button).
- Tapping opens the caregiver Health screen.

**Caregiver Health screen:**
- Same four line-chart cards as the patient sees.
- Adds a 7d/30d/90d range toggle at the top.
- Read-only — caregivers cannot edit health data.

### Backend (Node + Express + MongoDB)

**New collection:** `patient_health_readings`

```
{
  patientId: string,        // patient ObjectId as string
  metric: "steps" | "heart_rate" | "active_minutes" | "sleep",
  date: string,             // ISO date "YYYY-MM-DD" (the day the reading covers)
  value: number,            // unit varies by metric (count, bpm, minutes, hours)
  unit: string,             // "count" | "bpm" | "min" | "hr"
  source: string,           // "healthkit" (free for future expansion)
  syncedAt: Date            // server timestamp
}
```

**Indexes:**
- Compound unique on `(patientId, metric, date)` for dedupe
- `(patientId, metric, date desc)` for trend queries

**New routes (mounted at `/api/profiles/:patientId/health`):**

All routes use the existing `requirePatientAccess` middleware, so caregivers (seat or legacy-linked) AND the patient themselves can access.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/sync` | Patient app uploads a batch of readings. Upserts on `(patientId, metric, date)`. |
| `GET` | `/summary` | Returns today's totals for the patient card strip: `{ steps, latestHeartRate, activeMinutes, sleepHours }`. |
| `GET` | `/trends?metric=<m>&range=<7d\|30d\|90d>` | Returns array of `{ date, value }` for the line chart. |

**Sync request body (POST /sync):**
```
{
  readings: [
    { metric: "steps", date: "2026-04-16", value: 4821, unit: "count" },
    { metric: "heart_rate", date: "2026-04-16", value: 72, unit: "bpm" },
    ...
  ]
}
```

### Removal

Delete in this order:
1. **Capture code:** `useGaitCapture` calls inside the voice check-in screen, `useTypingCapture` calls inside the text check-in screen.
2. **Settings entry:** the Sensors row in `SideDrawer.tsx` (the one we added last session).
3. **Settings screen:** `SensorSettings` screen file + its registration in the navigator.
4. **Capture hooks themselves:** `useGaitCapture`, `useTypingCapture` files (after confirming they have no other consumers).

Keep:
- `profile_events` collection — historical data stays.
- Patterns feature — `PatternsCard`, `/patterns` routes, nightly job. Still works on whatever events exist.
- HomeKit/Matter integration code from Plan D — flagged for removal in a future cleanup unless we have a concrete patient-side use, but out of scope here.

## Data Flow

```
Patient phone (HealthKit)
   │
   │  HKObserverQuery wakes app (background)
   │  OR app opens → pulls last 24h
   ▼
Patient app POST /api/profiles/:patientId/health/sync
   │
   ▼
MongoDB patient_health_readings (upsert by patientId+metric+date)
   │
   ├──► Patient app GET /summary + /trends → Health tab cards
   └──► Caregiver app GET /summary → Today's Health strip
        Caregiver app GET /trends → Caregiver Health screen
```

## Testing

- **Backend:** unit tests for `/sync` dedupe behavior, `/summary` aggregation, `/trends` range filtering. `requirePatientAccess` already tested.
- **Patient app:** manual test on a real iOS device with Apple Watch (Steps, HR, Sleep flowing). Manual test on a plain iPhone (Steps only, other cards show empty state). Verify background sync by closing the app and waking it via Apple Watch activity.
- **Caregiver app:** manual test that the Today's Health strip and full Health screen render correctly.

## Open Questions for Implementation

- Confirm the exact `react-native-health` package and its current Expo config plugin compatibility before starting. If the plugin is broken or unmaintained, may need a small custom plugin.
- Confirm `BGTaskScheduler` identifier registration in Expo config (`expo-background-fetch` or custom plugin).
