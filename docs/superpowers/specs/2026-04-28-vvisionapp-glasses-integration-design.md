# VVision-App — Glasses Integration Spec
**Date:** 2026-04-28
**Status:** STASHED — Execute after glasses backend is complete
**Depends on:** D-Vision Full Upgrade (2026-04-28-dvision-full-upgrade-design.md)

This spec covers only the app-side changes needed to consume the new data the glasses backend will produce. The glasses backend is the source of truth for all data. The app reads and displays.

---

## New MongoDB Collections to Consume

All written by the glasses backend. App reads these in real-time or on-demand.

| Collection | App usage |
|------------|-----------|
| `caregiver_alerts` | Real-time alert feed, push notifications |
| `daily_digests` | Daily summary card view |
| `nutrition_log` | Nutrition timeline view |
| `repetition_log` | Weekly repetition pattern view |
| `sundowning_events` | Sundowning trend chart |
| `medication_log` | Medication compliance history |
| `patient_profile` | Config source for night mode, thresholds, sundowning window |
| `night_mode_config` | Caregiver edits this; glasses reads it |

---

## New Screens

### 1. Alert Feed (real-time)

Polls `caregiver_alerts` every 5 seconds (or uses MongoDB Change Streams if available). Displays chronological list of alerts, color-coded by priority:

| Priority | Color | Badge |
|----------|-------|-------|
| CRITICAL (4) | Red | Red dot, push notification, sound |
| HIGH (3) | Orange | Orange dot, push notification |
| NORMAL (2) | Blue | Blue dot, no push |
| INFO (1) | Grey | No badge, no push |

Each alert card shows:
- Message text
- Timestamp (relative: "3 minutes ago")
- Alert type icon (fall, distress, medication, sundowning, visitor, hydration)
- "I'm on my way" button (CRITICAL/HIGH only) — writes `acknowledged: true` to the alert doc
- Dismiss button — marks `dismissed: true` (hides from feed but keeps in history)

Unacknowledged CRITICAL alerts stay pinned at the top regardless of age.

Push notification payload:
```json
{
  "title": "CRITICAL — Possible Fall",
  "body": "Mom may have fallen. Please check immediately.",
  "data": {"alert_type": "fall", "patient_id": "default"}
}
```

### 2. Daily Digest View

Accessible from home screen as a card: "Today's Summary". Tapping opens full digest.

**Layout:**
```
TODAY — April 28                               ⚠ 2 warnings

VISITORS
  Sarah (daughter)  2:15 PM – 4:30 PM
  John (neighbor)   11:00 AM – 11:18 AM

MEALS & HYDRATION
  ✓ Breakfast observed  8:40 AM
  ✓ Lunch observed     12:55 PM
  ⚠ No dinner observed

  Hydration: 3 events

SLEEP
  Awake by 7:12 AM
  Nap: 1:30 – 2:05 PM

SAFETY
  ✓ No falls
  ✓ No wandering
  1 confusion episode (3:45 PM)

SUNDOWNING
  Active window: 3 PM – 6 PM
  Peak agitation: 4 PM  (score 0.68)

MEDICATIONS
  ✓ 8:00 AM — Morning pills  (confirmed)
  ⚠ 8:00 PM — Evening pills  (unconfirmed)

REPETITIONS
  "Where is John?" — asked 4x between 2–3 PM

MOOD
  Generally calm · Brief agitation 4:30 – 5:15 PM
```

Past digests accessible via a calendar picker (one digest per day).

### 3. Patient Profile Config

Caregiver-editable settings that write to MongoDB `patient_profile` and `night_mode_config`. Glasses backend reads these.

Sections:
- **Patient info**: Name, photo (used for "is_patient" matching), caregiver name
- **Night mode**: Start/end hour toggles, movement alert on/off, sustained alert threshold
- **Nutrition thresholds**: "Warn if no meal by" time picker, "Alert if no meal by" time picker, "Alert if no drinking by" time picker
- **Digest time**: What time to receive the daily summary (default 9 PM)
- **Sundowning window**: Auto-detected toggle (show computed window) + manual override (hour range picker)
- **Visitors**: List of people in the face DB with their typical visit days (auto-populated from pattern detection, caregiver can edit)
- **Medication schedule**: Which reminders are medication-type, confirmation window duration

### 4. Nutrition Timeline

Day-view showing observed eating and drinking events as a horizontal timeline (similar to iPhone Health app sleep chart).

- X axis: hours (6 AM – midnight)
- Eating events: filled green segment showing estimated duration
- Drinking events: blue tick mark
- Gap warnings shown as orange zones (no eating for 6+ hours)
- Day picker to view past days

### 5. Repetition Pattern View

Weekly heatmap + list view. Shows what the patient asked repeatedly, how many times, and at what time of day.

- Heatmap: rows = days, columns = hours, cell color = repetition intensity
- Below heatmap: list of repeated questions for the selected day, sorted by count
- Useful for physicians and family to understand cognitive patterns over time

---

## Alert Acknowledgement Flow

The glasses backend polls `caregiver_alerts` for acknowledged alerts to suppress escalation:

1. Caregiver taps "I'm on my way" in app → writes `acknowledged: true, acknowledged_at: ISO` to alert doc
2. Glasses backend (sundowning predictor, distress detector) polls for this field every 30 seconds on open escalation windows
3. If acknowledged before CRITICAL escalation deadline → escalation suppressed
4. Glasses speaks: "Your caregiver is on their way."

---

## Backend API (no changes needed)

The glasses backend writes directly to MongoDB. The app reads directly from MongoDB via the existing `SHARED_MONGODB_URI`. No new API routes are needed — MongoDB is the shared bus.

The one exception: if push notifications are needed, a small Cloud Function or Render endpoint handles APNS/FCM delivery triggered by a MongoDB Change Stream watch on `caregiver_alerts`. This is outside the scope of this spec.

---

## Implementation Order (when this spec is executed)

1. Alert feed screen + push notification wiring
2. Daily digest view (read-only, no interaction needed)
3. Patient profile config (required before glasses features are fully useful)
4. Nutrition timeline
5. Repetition pattern view
