# VVision-App — Patient UX Polish & Bug Fixes
**Date:** 2026-05-04
**Status:** Approved

## Scope

Six discrete fixes across the patient and caregiver sides of the app, surfaced during first real-device testing.

---

## 1. Health Screen — Apple Health-style UI

**Current state:** Flat cards with static values, single global timeframe toggle (default 30d), no charts, data doesn't update when timeframe changes.

**Design:**
- Four metric cards: Steps (orange), Heart Rate (red), Active Minutes (green), Sleep (indigo)
- Default state: card shows today's value + a small sparkline preview of the last 7 days
- Tapping a card expands it in-place (accordion) to reveal a full line chart
- Each expanded card has its own timeframe toggle: **1d | 7d | 30d | 90d** — default 1d
- Switching timeframe re-fetches trend data for that metric only
- Only one card expanded at a time — tapping another collapses the current one
- Historical data: on first login, sync the last 30 days of HealthKit data (extend `DEFAULT_LOOKBACK_DAYS` from 1 to 30 for the initial sync, keep 1 day for subsequent background syncs)
- Fix timeframe bug: `useHealthTrends` must re-fetch when `range` changes — verify dependency array is correct

**Data flow:**
- `useHealthSummary` → today's values (unchanged)
- `useHealthTrends(patientId, metric, range)` → chart points — called per card when expanded
- Chart library: `react-native-svg` (already installed) — draw a custom SVG line chart using `Polyline` + `Circle` dots + `Text` axis labels. No third-party chart dependency.

---

## 2. Task Detail Bottom Sheet

**Current state:** Tasks truncated at 2 lines with `numberOfLines={2}`, no tap handler.

**Design:**
- Tapping any task row opens a bottom sheet (slides up, doesn't navigate away)
- Bottom sheet contents:
  - Full task name (no line limit)
  - Time/scheduled info if present
  - Completed toggle (marks task done from this view)
  - Optional notes field (plain text, multi-line)
  - Edit button → opens existing add/edit modal pre-filled
  - Delete button (with confirmation alert)
- Bottom sheet dismisses on backdrop tap or swipe down
- Implement with React Native `Modal` + `Animated` (slide up from bottom) — no third-party library needed
- Notes field requires adding `notes?: string` to the task schema in `src/server-routes/routines.ts` and the frontend `Task` type

---

## 3. Login Keyboard — KeyboardAvoidingView

**Current state:** `ScrollView` with `keyboardShouldPersistTaps` — keyboard covers inputs.

**Fix:**
- Wrap the login `ScrollView` in a `KeyboardAvoidingView` with `behavior="padding"` on iOS and `behavior="height"` on Android
- No visual change — inputs just stay above keyboard when focused

---

## 4. Help Button Centering

**Current state:** 4 tabs (Home, Help FAB, Faces, Health) — FAB is at position 2, not centered.

**Fix:**
- Change tab order to 5 slots: **Home | Faces | FAB | Health | (invisible placeholder)**
- Placeholder tab has no icon, no label, `tabBarButton: () => null` — exists only to balance spacing
- FAB sits at slot 3 (center of 5), perfectly centered

---

## 5. Caregiver Onboarding — Skip if Already Has Patient

**Current state:** ProfileBasicsStep (name + dementia stage wizard) appears every time a caregiver logs in.

**Fix:**
- In `RootNavigator` (or wherever the onboarding gate lives), check if `user.patient_id` is already set after login
- If `patient_id` exists → go directly to caregiver dashboard
- If `patient_id` is null → show onboarding wizard as before
- The wizard should also be reachable from the "Add Patient" flow in the Patients tab for caregivers who want to link a second patient

---

## 6. Historical HealthKit Data Sync

**Current state:** `DEFAULT_LOOKBACK_DAYS = 1` — only yesterday's data synced on first connect.

**Fix:**
- Detect first sync: check AsyncStorage for `@vela/health/lastSyncedAt`
- If key doesn't exist → use 30-day lookback for the initial sync
- If key exists → use 1-day lookback as normal
- This surfaces all historical steps, heart rate, sleep, and active minutes the patient already has in Apple Health

---

## Files Affected

| File | Change |
|---|---|
| `src/screens/patient/HealthScreen.tsx` | Full rewrite — Apple Health card UI |
| `src/services/healthSync.ts` | Extended initial lookback (30d) |
| `src/screens/patient/TodayScreen.tsx` | Task row tap handler + bottom sheet |
| `src/screens/LoginScreen.tsx` | KeyboardAvoidingView wrapper |
| `src/navigation/PatientTabNavigator.tsx` | 5-slot tab bar with centered FAB |
| `src/navigation/RootNavigator.tsx` | Caregiver onboarding gate logic |
| `src/server-routes/routines.ts` | Add `notes` field to task schema + PATCH handler |
| `src/types/index.ts` (or equivalent) | Add `notes?: string` to Task type |

## Out of Scope

- Redesigning the caregiver dashboard
- Changing the onboarding wizard content
- RevenueCat / paywall
- Daily.co livestream fix
