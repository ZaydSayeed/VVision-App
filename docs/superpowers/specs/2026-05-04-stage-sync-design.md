# VVision-App — Dementia Stage Sync (App ↔ Glasses)
**Date:** 2026-05-04
**Status:** Approved

## Scope

Three-part feature bridging the caregiver app's stage setting and the glasses AI's `StageDetector`:

1. **Device linking** — caregiver links their glasses device to a patient in the app
2. **Stage bootstrap** — on boot, glasses reads the caregiver-set stage from MongoDB and seeds `StageDetector.force_stage()`
3. **Stage sync back** — when `StageDetector` classifies a new stage, glasses writes an observation to MongoDB; app surfaces it to the caregiver as a review prompt

Out of scope: automatic stage updates without caregiver confirmation, multi-device linking per patient (one device per patient for now).

---

## Shared Infrastructure

Both systems connect to the same MongoDB Atlas cluster and the same database (`dvision`, controlled by `MONGODB_DB_NAME` env var). No HTTP bridge between systems is needed — both read/write the same collections.

**Two new MongoDB collections:**

### `device_links`
```
{
  device_code: string,      // e.g. "VELA-4821" — 8 uppercase alphanumeric
  patient_id: ObjectId,     // references patients._id
  linked_at: ISO string,
}
```
Unique index on `device_code`. One document per glasses device.

### `stage_observations`
```
{
  patient_id: ObjectId,
  device_code: string,
  observed_stage: "early" | "mid" | "late",
  signals: {                // snapshot of BehavioralSignals at time of write
    prompts_offered: number,
    prompts_responded: number,
    repetition_events: number,
    confused_switches: number,
    hallucination_events: number,
    recent_falls: number,
    minutes_observed: number,
    stationary_ratio: number,
  },
  observed_at: ISO string,
}
```
Index on `(patient_id, observed_at desc)`. Only written when observed stage changes from the previous observation.

---

## Stage Vocabulary Mapping

| App (`patients.stage`) | Glasses (`Stage` enum) |
|---|---|
| `"mild"` | `Stage.EARLY` |
| `"moderate"` | `Stage.MID` |
| `"severe"` | `Stage.LATE` |
| `null` / not set | `Stage.UNKNOWN` (no force_stage call) |

Reverse mapping (glasses → app suggestion): `EARLY→"mild"`, `MID→"moderate"`, `LATE→"severe"`.

---

## Part 1 — Device Linking

### Glasses side
- Add `DVISION_DEVICE_CODE` env var to `config.py` (e.g. `"VELA-4821"`)
- On boot, glasses calls `get_device_link(device_code)` in `mongo_database.py`
- If a `device_links` document exists → stores `patient_id` for use in stage bootstrap and observation writes
- If no document found → logs a warning, continues without patient linking (graceful degradation)

### App side — new backend route
`POST /api/profiles/:patientId/device-link`
- Auth: caregiver with seat access to patientId
- Body: `{ device_code: string }` — validated as 4-8 uppercase alphanumeric
- Behavior: upserts a `device_links` document `{ device_code, patient_id, linked_at }`
- Returns: `{ device_code, linked_at }`

`DELETE /api/profiles/:patientId/device-link`
- Removes the `device_links` document for this patient (unlinks the device)

### App side — UI
In **PatientStatusScreen** (caregiver's view of a patient), add a "Glasses" card:
- If no device linked: shows "Link Glasses" button → opens a small modal with a text input for the device code + a "Link" button
- If linked: shows the device code + "Unlink" button
- Device code is shown on the glasses dashboard (`dashboard.py`) and/or printed during setup

---

## Part 2 — Stage Bootstrap (App → Glasses)

In `app.py`, after resolving `patient_id` from the device link:

```python
patient_profile = db.get_patient_profile(patient_id)
if patient_profile and patient_profile.get("stage"):
    mapped = {"mild": Stage.EARLY, "moderate": Stage.MID, "severe": Stage.LATE}
    initial_stage = mapped.get(patient_profile["stage"])
    if initial_stage:
        stage_detector.force_stage(initial_stage)
        logger.info("Stage bootstrapped from caregiver profile: %s", initial_stage.value)
```

`get_patient_profile(patient_id)` in `mongo_database.py`: reads `patients` collection by `_id`, returns `{ stage, name }`.

---

## Part 3 — Stage Sync Back (Glasses → App)

### Glasses side
Add `on_stage_change` callback to `StageDetector`:

```python
def set_on_stage_change(self, callback) -> None:
    self._on_stage_change = callback
```

In `_classify_locked()`, after computing new stage, if it differs from `self._stage`:
```python
if new_stage != self._stage and self._on_stage_change:
    self._on_stage_change(new_stage)
```

In `app.py`, wire up the callback after boot:
```python
def _on_stage_change(new_stage: Stage):
    db.write_stage_observation(patient_id, device_code, new_stage, stage_detector.get_signals_snapshot())

stage_detector.set_on_stage_change(_on_stage_change)
```

`write_stage_observation()` in `mongo_database.py`: inserts a `stage_observations` document. Only writes if `new_stage` differs from the most recent observation for this patient (dedupe check). Does **not** write on the initial `force_stage()` boot call — only fires when `StageDetector` independently classifies a change after observation, so the caregiver-set stage never immediately triggers its own "worsening" banner.

### App side — new backend route
`GET /api/profiles/:patientId/stage-observations/latest`
- Auth: caregiver with seat access
- Returns: the most recent `stage_observations` document for this patient, or `null` if none

### App side — UI banner
In **PatientStatusScreen**, after fetching the latest stage observation:
- If `observed_stage` maps to a higher stage than `patient.stage` → show a yellow banner:
  > "Vision's glasses observed signs consistent with **moderate** dementia this week. [Review Stage]"
- "Review Stage" opens the existing profile edit modal pre-filled with the suggested stage
- Banner dismissed once caregiver takes action (updates stage or explicitly dismisses)
- Dismissed state stored in AsyncStorage: `@vela/stage-banner-dismissed:{patientId}:{observedAt}`

---

## Files Affected

| Repo | File | Change |
|---|---|---|
| Glasses | `src/dvision/config.py` | Add `DVISION_DEVICE_CODE` env var |
| Glasses | `src/dvision/mongo_database.py` | Add `get_device_link()`, `get_patient_profile()`, `write_stage_observation()` |
| Glasses | `src/dvision/stage_detector.py` | Add `set_on_stage_change()` callback + fire on stage change |
| Glasses | `src/dvision/app.py` | Boot sequence: resolve patient_id, bootstrap stage, wire callback |
| App | `src/server-routes/device.ts` | New file — `POST/DELETE /api/profiles/:patientId/device-link` |
| App | `src/server-routes/profiles.ts` | Add `GET /api/profiles/:patientId/stage-observations/latest` |
| App | `src/server-core/database.ts` | Add indexes for `device_links` and `stage_observations` |
| App | `src/screens/caregiver/PatientStatusScreen.tsx` | Glasses card (link/unlink UI) + stage observation banner |
| App | `src/api/device.ts` | New file — API client for device-link routes |

---

## Error Handling

- **No device code set on glasses:** logs warning on boot, skips all stage sync, no crash
- **No matching device_link in MongoDB:** same — logs warning, continues
- **Patient profile has no stage:** skip `force_stage()`, `StageDetector` starts `UNKNOWN` as before
- **Stage observation write fails:** log error, do not crash the glasses app
- **App: no observation found:** banner simply doesn't render (null check)
