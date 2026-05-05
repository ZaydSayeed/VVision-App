# Stage Sync (App ↔ Glasses) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sync dementia stage bidirectionally between the VVision caregiver app and the glasses AI — caregiver sets the initial stage, glasses bootstraps from it and writes back observations when its `StageDetector` classifies a change.

**Architecture:** Both repos share the same MongoDB Atlas cluster and database (`dvision`). The glasses reads its `patient_id` from a `device_links` collection (keyed by `DVISION_DEVICE_CODE` env var), bootstraps `StageDetector.force_stage()` from the patient profile on boot, and fires a callback to write `stage_observations` whenever the classifier detects a change. The app surfaces the latest observation as a banner prompting the caregiver to review.

**Tech Stack:** Python 3.12 / pymongo / pytest (glasses); TypeScript / Express / Zod / vitest / React Native (app). Both use the same MongoDB URI and DB name.

---

## File Map

**Glasses (`/projects/VelaVision/`):**
- Modify: `src/dvision/config.py` — add `DVISION_DEVICE_CODE` env var
- Modify: `src/dvision/mongo_database.py` — add `get_device_link()`, `get_patient_profile()`, `write_stage_observation()`
- Modify: `src/dvision/stage_detector.py` — add `set_on_stage_change()` callback; fire it in `get_stage()` after lock release
- Modify: `src/dvision/app.py` — boot sequence: resolve `patient_id` from device link, bootstrap stage, wire callback
- Create: `tests/test_mongo_stage_sync.py` — unit tests for the three new mongo methods
- Modify: `tests/test_stage_detector.py` — add callback tests

**App (`/projects/VVision-App/`):**
- Modify: `src/server-core/database.ts` — add indexes for `device_links` + `stage_observations`
- Create: `src/server-routes/device.ts` — `GET/POST/DELETE /api/profiles/:patientId/device-link` + `GET /api/profiles/:patientId/stage-observations/latest`
- Create: `src/server-routes/device.test.ts` — Zod schema tests
- Modify: `src/server.ts` — mount device routes
- Create: `src/api/device.ts` — API client functions
- Modify: `src/screens/caregiver/PatientStatusScreen.tsx` — Glasses card + stage observation banner

---

### Task 1: Add `DVISION_DEVICE_CODE` to glasses config

**Files:**
- Modify: `/projects/VelaVision/src/dvision/config.py`

- [ ] **Step 1: Add the env var**

Open `src/dvision/config.py`. After the `MEMORY_DB_PATH` line (line 135), add:

```python
# =============================================================================
# Device Identity
# =============================================================================
DVISION_DEVICE_CODE: str = os.getenv("DVISION_DEVICE_CODE", "")
```

- [ ] **Step 2: Verify it loads**

```bash
cd /Users/haadisiddiqui/projects/VelaVision
DVISION_DEVICE_CODE=VELA1234 .venv312/bin/python3.12 -c "from src.dvision.config import DVISION_DEVICE_CODE; print(DVISION_DEVICE_CODE)"
```

Expected output: `VELA1234`

- [ ] **Step 3: Commit**

```bash
git add src/dvision/config.py
git commit -m "feat(glasses): add DVISION_DEVICE_CODE config env var"
```

---

### Task 2: Add stage sync methods to `MongoFaceDatabase`

**Files:**
- Modify: `/projects/VelaVision/src/dvision/mongo_database.py`
- Create: `/projects/VelaVision/tests/test_mongo_stage_sync.py`

The `MongoFaceDatabase` already has `self._collection` (the `people` collection). `self._collection.database` gives the pymongo `Database` object — the same pattern already used in `get_unknown_sightings()`.

- [ ] **Step 1: Write failing tests**

Create `/projects/VelaVision/tests/test_mongo_stage_sync.py`:

```python
from unittest.mock import MagicMock, patch
from datetime import datetime
import pytest
from dvision.mongo_database import MongoFaceDatabase
from dvision.stage_detector import Stage, BehavioralSignals


def _db_with_mock_collection(collection_data: dict):
    """Build a MongoFaceDatabase with a mocked MongoDB backend."""
    db = MongoFaceDatabase.__new__(MongoFaceDatabase)
    db.people = []
    db._matrix_v1 = None
    db._matrix_v2 = None
    db._indices_v1 = []
    db._indices_v2 = []

    mock_coll = MagicMock()
    mock_db = MagicMock()
    mock_coll.database = mock_db
    db._collection = mock_coll

    for name, mock in collection_data.items():
        setattr(mock_db.__getitem__.return_value, "_name", name)
        mock_db.__getitem__.side_effect = lambda n, _mocks=collection_data: _mocks[n]

    return db, mock_db


def test_get_device_link_found():
    from bson import ObjectId
    patient_oid = ObjectId()
    mock_links = MagicMock()
    mock_links.find_one.return_value = {"device_code": "VELA1234", "patient_id": patient_oid}

    db, mock_db = _db_with_mock_collection({"device_links": mock_links})
    result = db.get_device_link("VELA1234")
    assert result == str(patient_oid)
    mock_links.find_one.assert_called_once_with({"device_code": "VELA1234"})


def test_get_device_link_not_found():
    mock_links = MagicMock()
    mock_links.find_one.return_value = None
    db, mock_db = _db_with_mock_collection({"device_links": mock_links})
    assert db.get_device_link("NOPE") is None


def test_get_device_link_no_connection():
    db = MongoFaceDatabase.__new__(MongoFaceDatabase)
    db.people = []
    db._collection = None
    assert db.get_device_link("VELA1234") is None


def test_get_patient_profile_found():
    from bson import ObjectId
    oid = ObjectId()
    mock_patients = MagicMock()
    mock_patients.find_one.return_value = {"_id": oid, "name": "Alice", "stage": "moderate"}
    db, mock_db = _db_with_mock_collection({"patients": mock_patients})
    result = db.get_patient_profile(str(oid))
    assert result == {"stage": "moderate", "name": "Alice"}


def test_get_patient_profile_not_found():
    from bson import ObjectId
    mock_patients = MagicMock()
    mock_patients.find_one.return_value = None
    db, mock_db = _db_with_mock_collection({"patients": mock_patients})
    assert db.get_patient_profile(str(ObjectId())) is None


def test_write_stage_observation_inserts_when_stage_changed():
    from bson import ObjectId
    patient_id = str(ObjectId())
    mock_obs = MagicMock()
    mock_obs.find_one.return_value = {"observed_stage": "early"}  # previous was early
    db, mock_db = _db_with_mock_collection({"stage_observations": mock_obs})

    signals = BehavioralSignals(minutes_observed=120.0, repetition_events=3.0)
    db.write_stage_observation(patient_id, "VELA1234", Stage.MID, signals)

    mock_obs.insert_one.assert_called_once()
    doc = mock_obs.insert_one.call_args[0][0]
    assert doc["observed_stage"] == "mid"
    assert doc["patient_id"] == patient_id
    assert doc["device_code"] == "VELA1234"
    assert doc["signals"]["minutes_observed"] == 120.0


def test_write_stage_observation_skips_when_stage_unchanged():
    from bson import ObjectId
    patient_id = str(ObjectId())
    mock_obs = MagicMock()
    mock_obs.find_one.return_value = {"observed_stage": "mid"}  # already mid
    db, mock_db = _db_with_mock_collection({"stage_observations": mock_obs})

    signals = BehavioralSignals(minutes_observed=120.0)
    db.write_stage_observation(patient_id, "VELA1234", Stage.MID, signals)

    mock_obs.insert_one.assert_not_called()


def test_write_stage_observation_inserts_when_no_prior():
    from bson import ObjectId
    patient_id = str(ObjectId())
    mock_obs = MagicMock()
    mock_obs.find_one.return_value = None  # no prior observation
    db, mock_db = _db_with_mock_collection({"stage_observations": mock_obs})

    signals = BehavioralSignals(minutes_observed=120.0)
    db.write_stage_observation(patient_id, "VELA1234", Stage.EARLY, signals)

    mock_obs.insert_one.assert_called_once()
```

- [ ] **Step 2: Run tests — expect failure**

```bash
cd /Users/haadisiddiqui/projects/VelaVision
.venv312/bin/python3.12 -m pytest tests/test_mongo_stage_sync.py -v
```

Expected: `AttributeError: 'MongoFaceDatabase' object has no attribute 'get_device_link'`

- [ ] **Step 3: Implement the three methods**

In `src/dvision/mongo_database.py`, add these three methods to the `MongoFaceDatabase` class (after `log_unknown_sighting`, before the end of the class):

```python
def get_device_link(self, device_code: str) -> Optional[str]:
    """Look up patient_id for a given device code. Returns patient_id string or None."""
    if self._collection is None:
        return None
    links_col = self._collection.database["device_links"]
    doc = links_col.find_one({"device_code": device_code})
    if doc and doc.get("patient_id"):
        return str(doc["patient_id"])
    return None

def get_patient_profile(self, patient_id: str) -> Optional[dict]:
    """Fetch stage and name from the patients collection. Returns {stage, name} or None."""
    if self._collection is None:
        return None
    try:
        patients_col = self._collection.database["patients"]
        doc = patients_col.find_one({"_id": ObjectId(patient_id)})
        if doc is None:
            return None
        return {"stage": doc.get("stage"), "name": doc.get("name", "")}
    except Exception:
        return None

def write_stage_observation(
    self,
    patient_id: str,
    device_code: str,
    stage,
    signals,
) -> None:
    """Write a stage observation to MongoDB. Skips if stage unchanged from last observation."""
    if self._collection is None:
        return
    obs_col = self._collection.database["stage_observations"]
    last = obs_col.find_one(
        {"patient_id": patient_id},
        sort=[("observed_at", -1)],
    )
    if last and last.get("observed_stage") == stage.value:
        return
    obs_col.insert_one({
        "patient_id": patient_id,
        "device_code": device_code,
        "observed_stage": stage.value,
        "signals": {
            "prompts_offered": signals.prompts_offered,
            "prompts_responded": signals.prompts_responded,
            "repetition_events": signals.repetition_events,
            "confused_switches": signals.confused_switches,
            "hallucination_events": signals.hallucination_events,
            "recent_falls": sum(
                1 for t in signals.fall_timestamps
                if t >= __import__("time").time() - 604800
            ),
            "minutes_observed": signals.minutes_observed,
            "stationary_ratio": (
                signals.minutes_stationary / signals.minutes_observed
                if signals.minutes_observed > 0 else 0.0
            ),
        },
        "observed_at": datetime.now().isoformat(),
    })
    logger.info("Stage observation written: %s for patient %s", stage.value, patient_id)
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd /Users/haadisiddiqui/projects/VelaVision
.venv312/bin/python3.12 -m pytest tests/test_mongo_stage_sync.py -v
```

Expected: 8 passed

- [ ] **Step 5: Commit**

```bash
git add src/dvision/mongo_database.py tests/test_mongo_stage_sync.py
git commit -m "feat(glasses): add get_device_link, get_patient_profile, write_stage_observation"
```

---

### Task 3: Add `set_on_stage_change` callback to `StageDetector`

**Files:**
- Modify: `/projects/VelaVision/src/dvision/stage_detector.py`
- Modify: `/projects/VelaVision/tests/test_stage_detector.py`

The callback must fire **after** the lock is released to avoid deadlocks. The approach: capture the pending callback and new stage inside the lock, then fire after.

- [ ] **Step 1: Add callback tests to `tests/test_stage_detector.py`**

Append to the end of `tests/test_stage_detector.py`:

```python
def test_callback_fires_on_stage_change():
    d = StageDetector()
    fired = []
    d.set_on_stage_change(lambda s: fired.append(s))

    # Push signals that will classify as MID
    for _ in range(3):
        d.record_hallucination()
    _fast_forward(d)
    d.get_stage()  # triggers classification → callback

    assert len(fired) == 1
    assert fired[0] == Stage.MID


def test_callback_not_fired_when_stage_unchanged():
    d = StageDetector()
    for _ in range(3):
        d.record_hallucination()
    _fast_forward(d)
    d.get_stage()  # first eval → MID

    fired = []
    d.set_on_stage_change(lambda s: fired.append(s))
    d._last_eval = 0.0  # force re-eval
    d.get_stage()  # re-eval → still MID, callback should NOT fire

    assert len(fired) == 0


def test_force_stage_does_not_fire_callback():
    d = StageDetector()
    fired = []
    d.set_on_stage_change(lambda s: fired.append(s))
    d.force_stage(Stage.LATE)
    assert len(fired) == 0


def test_callback_not_fired_when_transitioning_from_unknown():
    """First classification from UNKNOWN should not fire the callback."""
    d = StageDetector()
    fired = []
    d.set_on_stage_change(lambda s: fired.append(s))
    # No signals — will stay UNKNOWN (not enough observation time)
    d.get_stage()
    assert len(fired) == 0
```

- [ ] **Step 2: Run new tests — expect failure**

```bash
cd /Users/haadisiddiqui/projects/VelaVision
.venv312/bin/python3.12 -m pytest tests/test_stage_detector.py::test_callback_fires_on_stage_change -v
```

Expected: `AttributeError: 'StageDetector' object has no attribute 'set_on_stage_change'`

- [ ] **Step 3: Implement the callback**

In `src/dvision/stage_detector.py`, make these changes:

**In `__init__`**, add after `self._last_eval = 0.0`:
```python
        self._on_stage_change = None
```

**Add new method** after `force_stage`:
```python
    def set_on_stage_change(self, callback) -> None:
        with self._lock:
            self._on_stage_change = callback
```

**Replace `get_stage`** with:
```python
    def get_stage(self) -> Stage:
        now = time.time()
        pending_callback = None
        pending_stage = None
        with self._lock:
            if now - self._last_eval >= self.EVAL_INTERVAL:
                self._last_eval = now
                new_stage = self._classify_locked()
                if (
                    new_stage != self._stage
                    and self._stage != Stage.UNKNOWN
                    and new_stage != Stage.UNKNOWN
                    and self._on_stage_change is not None
                ):
                    pending_callback = self._on_stage_change
                    pending_stage = new_stage
                self._stage = new_stage
            current_stage = self._stage
        if pending_callback is not None:
            try:
                pending_callback(pending_stage)
            except Exception as e:
                logger.error("Stage change callback failed: %s", e)
        return current_stage
```

- [ ] **Step 4: Run all stage detector tests — expect pass**

```bash
cd /Users/haadisiddiqui/projects/VelaVision
.venv312/bin/python3.12 -m pytest tests/test_stage_detector.py -v
```

Expected: all tests pass (existing + 4 new)

- [ ] **Step 5: Commit**

```bash
git add src/dvision/stage_detector.py tests/test_stage_detector.py
git commit -m "feat(glasses): add set_on_stage_change callback to StageDetector"
```

---

### Task 4: Wire the boot sequence in `app.py`

**Files:**
- Modify: `/projects/VelaVision/src/dvision/app.py`

**Context:** The boot sequence starts at line ~931 in `app.py` (inside the `main()` function, after `db = _create_database(opts)`). Currently it has:
```python
_patient_id = _os.environ.get("PATIENT_ID", "default")
stage_detector = StageDetector()
```

We replace this block with device-link resolution, profile-based stage bootstrap, and callback wiring.

- [ ] **Step 1: Replace `_patient_id` and `stage_detector` initialization**

Find and replace this block in `app.py` (around line 934-939):

```python
    _patient_id = _os.environ.get("PATIENT_ID", "default")
    stage_detector = StageDetector()
```

Replace with:

```python
    from .config import DVISION_DEVICE_CODE
    _patient_id = _os.environ.get("PATIENT_ID", "default")

    _mongo_available = hasattr(db, "_collection") and db._collection is not None
    if DVISION_DEVICE_CODE and _mongo_available:
        resolved = db.get_device_link(DVISION_DEVICE_CODE)
        if resolved:
            _patient_id = resolved
            logger.info("Device linked to patient_id: %s", _patient_id)
        else:
            logger.warning("No device_link found for code %s — running without patient link", DVISION_DEVICE_CODE)

    stage_detector = StageDetector()

    if _patient_id != "default" and _mongo_available:
        from .stage_detector import Stage as _Stage
        _profile = db.get_patient_profile(_patient_id)
        if _profile and _profile.get("stage"):
            _stage_map = {"mild": _Stage.EARLY, "moderate": _Stage.MID, "severe": _Stage.LATE}
            _initial = _stage_map.get(_profile["stage"])
            if _initial:
                stage_detector.force_stage(_initial)
                logger.info("Stage bootstrapped: %s → %s", _profile["stage"], _initial.value)

    if _patient_id != "default" and _mongo_available:
        _cb_patient_id = _patient_id
        _cb_device_code = DVISION_DEVICE_CODE

        def _stage_change_cb(new_stage) -> None:
            try:
                db.write_stage_observation(
                    _cb_patient_id,
                    _cb_device_code,
                    new_stage,
                    stage_detector.get_signals_snapshot(),
                )
            except Exception as _e:
                logger.error("Failed to write stage observation: %s", _e)

        stage_detector.set_on_stage_change(_stage_change_cb)
```

- [ ] **Step 2: Verify the app still starts with `--use-json` (no MongoDB)**

```bash
cd /Users/haadisiddiqui/projects/VelaVision
.venv312/bin/python3.12 -m dvision --use-json --list-people
```

Expected: prints people list (or "No people in database.") with no errors about device_link or patient_id.

- [ ] **Step 3: Verify the app still starts with MongoDB and no `DVISION_DEVICE_CODE`**

```bash
cd /Users/haadisiddiqui/projects/VelaVision
.venv312/bin/python3.12 -m dvision --list-people
```

Expected: prints people list. Log may show "running without patient link" warning if MongoDB is connected, or nothing if no `DVISION_DEVICE_CODE` is set.

- [ ] **Step 4: Commit**

```bash
git add src/dvision/app.py
git commit -m "feat(glasses): bootstrap stage from patient profile on boot, wire stage change callback"
```

---

### Task 5: Add MongoDB indexes in the app

**Files:**
- Modify: `/projects/VVision-App/src/server-core/database.ts`

- [ ] **Step 1: Add the two index blocks**

In `src/server-core/database.ts`, add after the last `await db.collection(...)` line (after the `onboarding_progress` index, before `console.log("Indexes ensured")`):

```typescript
  await db.collection("device_links").createIndex({ device_code: 1 }, { unique: true });
  await db.collection("device_links").createIndex({ patient_id: 1 }, { unique: true });
  await db.collection("stage_observations").createIndex({ patient_id: 1, observed_at: -1 });
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/haadisiddiqui/projects/VVision-App
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/server-core/database.ts
git commit -m "feat(app): add device_links and stage_observations indexes"
```

---

### Task 6: Create the device backend routes

**Files:**
- Create: `/projects/VVision-App/src/server-routes/device.ts`
- Create: `/projects/VVision-App/src/server-routes/device.test.ts`

This file follows the same pattern as `health.ts`: `authMiddleware` + `requirePatientAccess`, Zod validation, ObjectId guard.

- [ ] **Step 1: Write the schema tests first**

Create `src/server-routes/device.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { z } from "zod";

const deviceCodeSchema = z.object({
  device_code: z
    .string()
    .min(4)
    .max(12)
    .regex(/^[A-Z0-9-]+$/, "device_code must be uppercase alphanumeric with optional dashes"),
});

describe("deviceCodeSchema", () => {
  it("accepts valid code", () => {
    expect(deviceCodeSchema.safeParse({ device_code: "VELA1234" }).success).toBe(true);
  });

  it("accepts code with dash", () => {
    expect(deviceCodeSchema.safeParse({ device_code: "VELA-1234" }).success).toBe(true);
  });

  it("rejects lowercase", () => {
    expect(deviceCodeSchema.safeParse({ device_code: "vela1234" }).success).toBe(false);
  });

  it("rejects too short", () => {
    expect(deviceCodeSchema.safeParse({ device_code: "AB" }).success).toBe(false);
  });

  it("rejects too long", () => {
    expect(deviceCodeSchema.safeParse({ device_code: "ABCDEFGHIJKLMN" }).success).toBe(false);
  });

  it("rejects special chars", () => {
    expect(deviceCodeSchema.safeParse({ device_code: "VELA@123" }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run schema tests — expect pass (no implementation needed)**

```bash
cd /Users/haadisiddiqui/projects/VVision-App
npm test -- src/server-routes/device.test.ts
```

Expected: 6 passed

- [ ] **Step 3: Create `src/server-routes/device.ts`**

```typescript
import { Router, Request, Response } from "express";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb } from "../server-core/database";
import { authMiddleware } from "../server-core/security";
import { requirePatientAccess } from "../server-core/seatResolver";

const deviceCodeSchema = z.object({
  device_code: z
    .string()
    .min(4)
    .max(12)
    .regex(/^[A-Z0-9-]+$/, "device_code must be uppercase alphanumeric with optional dashes"),
});

const router = Router();

// GET /api/profiles/:patientId/device-link — fetch current linked device code
router.get("/:patientId/device-link", authMiddleware, requirePatientAccess, async (req: Request, res: Response) => {
  if (!ObjectId.isValid(req.params.patientId)) {
    res.status(400).json({ detail: "Invalid patient ID" });
    return;
  }
  try {
    const db = getDb();
    const link = await db.collection("device_links").findOne(
      { patient_id: req.params.patientId },
      { projection: { device_code: 1, linked_at: 1, _id: 0 } }
    );
    res.json(link ?? null);
  } catch {
    res.status(500).json({ detail: "Internal server error" });
  }
});

// POST /api/profiles/:patientId/device-link — link a device to this patient
router.post("/:patientId/device-link", authMiddleware, requirePatientAccess, async (req: Request, res: Response) => {
  if (!ObjectId.isValid(req.params.patientId)) {
    res.status(400).json({ detail: "Invalid patient ID" });
    return;
  }
  const parsed = deviceCodeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ detail: parsed.error.issues[0].message });
    return;
  }
  try {
    const db = getDb();
    const now = new Date().toISOString();
    await db.collection("device_links").updateOne(
      { device_code: parsed.data.device_code },
      { $set: { device_code: parsed.data.device_code, patient_id: req.params.patientId, linked_at: now } },
      { upsert: true }
    );
    res.json({ device_code: parsed.data.device_code, linked_at: now });
  } catch {
    res.status(500).json({ detail: "Internal server error" });
  }
});

// DELETE /api/profiles/:patientId/device-link — unlink device from this patient
router.delete("/:patientId/device-link", authMiddleware, requirePatientAccess, async (req: Request, res: Response) => {
  if (!ObjectId.isValid(req.params.patientId)) {
    res.status(400).json({ detail: "Invalid patient ID" });
    return;
  }
  try {
    const db = getDb();
    await db.collection("device_links").deleteOne({ patient_id: req.params.patientId });
    res.status(204).end();
  } catch {
    res.status(500).json({ detail: "Internal server error" });
  }
});

// GET /api/profiles/:patientId/stage-observations/latest
router.get("/:patientId/stage-observations/latest", authMiddleware, requirePatientAccess, async (req: Request, res: Response) => {
  if (!ObjectId.isValid(req.params.patientId)) {
    res.status(400).json({ detail: "Invalid patient ID" });
    return;
  }
  try {
    const db = getDb();
    const obs = await db
      .collection("stage_observations")
      .find({ patient_id: req.params.patientId })
      .sort({ observed_at: -1 })
      .limit(1)
      .toArray();
    res.json(obs[0] ? { ...obs[0], _id: String(obs[0]._id) } : null);
  } catch {
    res.status(500).json({ detail: "Internal server error" });
  }
});

export default router;
```

- [ ] **Step 4: Run all tests**

```bash
cd /Users/haadisiddiqui/projects/VVision-App
npm test
```

Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add src/server-routes/device.ts src/server-routes/device.test.ts
git commit -m "feat(app): add device-link and stage-observations backend routes"
```

---

### Task 7: Mount device routes in `server.ts`

**Files:**
- Modify: `/projects/VVision-App/src/server.ts`

- [ ] **Step 1: Add import and mount**

In `src/server.ts`, add the import alongside the other route imports:

```typescript
import deviceRoutes from "./server-routes/device";
```

Then mount it alongside the other profile-prefixed routes (look for `app.use("/api/profiles", profileRoutes)` and add after it):

```typescript
app.use("/api/profiles", deviceRoutes);
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/haadisiddiqui/projects/VVision-App
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/server.ts
git commit -m "feat(app): mount device routes at /api/profiles"
```

---

### Task 8: Create the app API client

**Files:**
- Create: `/projects/VVision-App/src/api/device.ts`

This follows the same pattern as `src/api/health.ts` — uses `authFetch`, returns typed results.

- [ ] **Step 1: Create `src/api/device.ts`**

```typescript
import { authFetch } from "./authFetch";

export type DeviceLink = {
  device_code: string;
  linked_at: string;
};

export type StageObservation = {
  patient_id: string;
  device_code: string;
  observed_stage: "early" | "mid" | "late";
  signals: {
    prompts_offered: number;
    prompts_responded: number;
    repetition_events: number;
    confused_switches: number;
    hallucination_events: number;
    recent_falls: number;
    minutes_observed: number;
    stationary_ratio: number;
  };
  observed_at: string;
};

export async function getDeviceLink(patientId: string): Promise<DeviceLink | null> {
  const res = await authFetch(`/api/profiles/${patientId}/device-link`);
  if (!res.ok) return null;
  return res.json();
}

export async function linkDevice(patientId: string, deviceCode: string): Promise<DeviceLink> {
  const res = await authFetch(`/api/profiles/${patientId}/device-link`, {
    method: "POST",
    body: JSON.stringify({ device_code: deviceCode }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as any).detail ?? "Failed to link device");
  }
  return res.json();
}

export async function unlinkDevice(patientId: string): Promise<void> {
  await authFetch(`/api/profiles/${patientId}/device-link`, { method: "DELETE" });
}

export async function getLatestStageObservation(patientId: string): Promise<StageObservation | null> {
  const res = await authFetch(`/api/profiles/${patientId}/stage-observations/latest`);
  if (!res.ok) return null;
  return res.json();
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/haadisiddiqui/projects/VVision-App
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/api/device.ts
git commit -m "feat(app): add device API client"
```

---

### Task 9: Add Glasses card + stage banner to `PatientStatusScreen`

**Files:**
- Modify: `/projects/VVision-App/src/screens/caregiver/PatientStatusScreen.tsx`

**Context:** `PatientStatusScreen` is the caregiver's view of their linked patient. `patientId = user?.patient_id` is already resolved at the top. The screen uses the existing pattern: `useMemo` for styles (receives `colors`), Animated slide panels, `useTheme()` for colors.

The stage level helper: `"mild"` / `"early"` = 1, `"moderate"` / `"mid"` = 2, `"severe"` / `"late"` = 3.

- [ ] **Step 1: Add imports and state**

At the top of `PatientStatusScreen.tsx`, add to the existing imports:

```typescript
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Alert, TextInput } from "react-native";
import { getDeviceLink, linkDevice, unlinkDevice, getLatestStageObservation, DeviceLink, StageObservation } from "../../api/device";
```

Inside the `PatientStatusScreen` function body, after the existing state declarations, add:

```typescript
const [deviceLink, setDeviceLink] = useState<DeviceLink | null | undefined>(undefined);
const [stageObs, setStageObs] = useState<StageObservation | null>(null);
const [bannerDismissed, setBannerDismissed] = useState(false);
const [linkModalVisible, setLinkModalVisible] = useState(false);
const [deviceCodeInput, setDeviceCodeInput] = useState("");
const [linkError, setLinkError] = useState("");
const [linking, setLinking] = useState(false);
```

- [ ] **Step 2: Add data-fetching effect**

After the existing `useEffect` (the clock interval), add:

```typescript
useEffect(() => {
  if (!patientId) return;
  getDeviceLink(patientId).then(setDeviceLink).catch(() => setDeviceLink(null));
  getLatestStageObservation(patientId).then(setStageObs).catch(() => setStageObs(null));
}, [patientId]);

useEffect(() => {
  if (!patientId || !stageObs) return;
  AsyncStorage.getItem(`@vela/stage-banner-dismissed:${patientId}:${stageObs.observed_at}`)
    .then((v) => setBannerDismissed(v === "1"))
    .catch(() => {});
}, [patientId, stageObs]);
```

- [ ] **Step 3: Add helper functions**

After the `handleSaveNote` function, add:

```typescript
function stageLevel(s: string | null | undefined): number {
  if (!s) return 0;
  if (s === "mild" || s === "early") return 1;
  if (s === "moderate" || s === "mid") return 2;
  if (s === "severe" || s === "late") return 3;
  return 0;
}

function stageName(s: string): string {
  if (s === "early") return "mild";
  if (s === "mid") return "moderate";
  if (s === "late") return "severe";
  return s;
}

async function handleLinkDevice() {
  if (!patientId) return;
  const code = deviceCodeInput.trim().toUpperCase();
  if (code.length < 4) { setLinkError("Enter the code shown on the glasses dashboard."); return; }
  setLinking(true);
  setLinkError("");
  try {
    const result = await linkDevice(patientId, code);
    setDeviceLink(result);
    setLinkModalVisible(false);
    setDeviceCodeInput("");
  } catch (e: any) {
    setLinkError(e.message ?? "Could not link device. Check the code and try again.");
  } finally {
    setLinking(false);
  }
}

async function handleUnlinkDevice() {
  if (!patientId) return;
  Alert.alert("Unlink Glasses", "Remove the glasses link for this patient?", [
    { text: "Cancel", style: "cancel" },
    {
      text: "Unlink", style: "destructive", onPress: async () => {
        await unlinkDevice(patientId).catch(() => {});
        setDeviceLink(null);
      },
    },
  ]);
}

async function dismissStageBanner() {
  if (!patientId || !stageObs) return;
  await AsyncStorage.setItem(`@vela/stage-banner-dismissed:${patientId}:${stageObs.observed_at}`, "1");
  setBannerDismissed(true);
}
```

- [ ] **Step 4: Add styles**

Inside the `styles` useMemo object, add after the last existing style:

```typescript
    glassesCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.lg,
      marginBottom: spacing.lg,
    },
    glassesRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    glassesLinked: { ...fonts.medium, fontSize: 13, color: colors.text },
    glassesCode: { ...fonts.regular, fontSize: 12, color: colors.muted, marginTop: 2 },
    linkBtn: {
      backgroundColor: colors.violet,
      borderRadius: radius.pill,
      paddingVertical: 7,
      paddingHorizontal: spacing.lg,
    },
    linkBtnText: { ...fonts.medium, fontSize: 13, color: "#FFFFFF" },
    unlinkBtn: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.pill,
      paddingVertical: 7,
      paddingHorizontal: spacing.lg,
    },
    unlinkBtnText: { ...fonts.medium, fontSize: 13, color: colors.muted },
    stageBanner: {
      backgroundColor: colors.amber + "22",
      borderRadius: radius.md,
      padding: spacing.md,
      marginBottom: spacing.lg,
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.sm,
      borderLeftWidth: 3,
      borderLeftColor: colors.amber,
    },
    stageBannerText: { ...fonts.regular, fontSize: 13, color: colors.text, flex: 1 },
    stageBannerAction: { ...fonts.medium, fontSize: 13, color: colors.amber, marginTop: 4 },
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", alignItems: "center" },
    modalCard: { backgroundColor: colors.bg, borderRadius: radius.lg, padding: spacing.xl, width: "80%", gap: spacing.md },
    modalTitle: { ...fonts.medium, fontSize: 17, color: colors.text },
    modalInput: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      padding: spacing.md,
      ...fonts.regular,
      fontSize: 15,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
      letterSpacing: 2,
    },
    modalError: { ...fonts.regular, fontSize: 12, color: colors.coral },
    modalRow: { flexDirection: "row", gap: spacing.md, justifyContent: "flex-end" },
    modalCancelBtn: { paddingVertical: 9, paddingHorizontal: spacing.lg },
    modalCancelText: { ...fonts.medium, fontSize: 14, color: colors.muted },
    modalConfirmBtn: { backgroundColor: colors.violet, borderRadius: radius.pill, paddingVertical: 9, paddingHorizontal: spacing.xl },
    modalConfirmText: { ...fonts.medium, fontSize: 14, color: "#FFFFFF" },
```

- [ ] **Step 5: Render the Glasses card and stage banner**

In the JSX, find the `<ScrollView>` content area. Add the following **before** the first `<SectionHeader>` or card in the scrollable content:

```tsx
{/* Stage observation banner */}
{stageObs && !bannerDismissed && stageLevel(stageObs.observed_stage) > stageLevel(user?.stage) && (
  <TouchableOpacity style={styles.stageBanner} onPress={dismissStageBanner} activeOpacity={0.8}>
    <Ionicons name="warning-outline" size={18} color={colors.amber} />
    <View style={{ flex: 1 }}>
      <Text style={styles.stageBannerText}>
        Vision's glasses have observed signs consistent with{" "}
        <Text style={{ ...fonts.medium }}>{stageName(stageObs.observed_stage)}</Text> dementia. Tap to dismiss or go to Profile to review the stage.
      </Text>
    </View>
  </TouchableOpacity>
)}

{/* Glasses card */}
{deviceLink !== undefined && (
  <View style={styles.glassesCard}>
    <View style={styles.glassesRow}>
      <View>
        <Text style={styles.glassesLinked}>
          {deviceLink ? "Glasses linked" : "No glasses linked"}
        </Text>
        {deviceLink && (
          <Text style={styles.glassesCode}>{deviceLink.device_code}</Text>
        )}
      </View>
      {deviceLink ? (
        <TouchableOpacity style={styles.unlinkBtn} onPress={handleUnlinkDevice} activeOpacity={0.8}>
          <Text style={styles.unlinkBtnText}>Unlink</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.linkBtn} onPress={() => setLinkModalVisible(true)} activeOpacity={0.8}>
          <Text style={styles.linkBtnText}>Link Glasses</Text>
        </TouchableOpacity>
      )}
    </View>
  </View>
)}

{/* Link Glasses modal */}
<Modal visible={linkModalVisible} transparent animationType="fade" onRequestClose={() => setLinkModalVisible(false)}>
  <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setLinkModalVisible(false)}>
    <TouchableOpacity style={styles.modalCard} activeOpacity={1} onPress={() => {}}>
      <Text style={styles.modalTitle}>Link Glasses</Text>
      <TextInput
        style={styles.modalInput}
        value={deviceCodeInput}
        onChangeText={(t) => { setDeviceCodeInput(t.toUpperCase()); setLinkError(""); }}
        placeholder="e.g. VELA1234"
        placeholderTextColor={colors.muted}
        autoCapitalize="characters"
        autoCorrect={false}
      />
      {linkError ? <Text style={styles.modalError}>{linkError}</Text> : null}
      <View style={styles.modalRow}>
        <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setLinkModalVisible(false)}>
          <Text style={styles.modalCancelText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleLinkDevice} disabled={linking} activeOpacity={0.8}>
          <Text style={styles.modalConfirmText}>{linking ? "Linking…" : "Link"}</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  </TouchableOpacity>
</Modal>
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd /Users/haadisiddiqui/projects/VVision-App
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 7: Run all tests**

```bash
cd /Users/haadisiddiqui/projects/VVision-App
npm test
```

Expected: all tests pass

- [ ] **Step 8: Commit**

```bash
git add src/screens/caregiver/PatientStatusScreen.tsx src/api/device.ts
git commit -m "feat(app): glasses link card and stage observation banner in PatientStatusScreen"
```

---

## Self-Review

**Spec coverage:**
- ✅ Device linking (Option B) — `device_links` collection, POST/DELETE/GET routes, UI card
- ✅ Stage bootstrap (app → glasses) — `force_stage()` called on boot from `patients.stage`
- ✅ Stage sync back (glasses → app) — `set_on_stage_change` callback + `write_stage_observation`
- ✅ Stage vocabulary mapping — `mild↔EARLY`, `moderate↔MID`, `severe↔LATE`
- ✅ No write on `force_stage` boot call — callback only fires from `get_stage()` when heuristic classifies change
- ✅ Graceful degradation — no DVISION_DEVICE_CODE, no MongoDB → continues without linking
- ✅ Caregiver banner — compares `stageObs.observed_stage` level vs `user?.stage` level
- ✅ Banner dismissal — AsyncStorage keyed by patientId + observedAt

**Placeholder scan:** None found.

**Type consistency:** `DeviceLink`, `StageObservation`, `stageLevel()`, `stageName()` — consistent across API client and component.
