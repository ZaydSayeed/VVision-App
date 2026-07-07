# Patient-Scoped Routines & Medications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let `GET /api/routines` and `GET /api/medications` fetch a specific patient's data (not just the caller's own default-linked patient), fixing the iPhone widget's checklist gap for caregivers managing multiple patients.

**Architecture:** Add an optional `?patientId=` query parameter to both routes. When present, verify access via the existing `userHasPatientAccess()` helper before scoping the query to that patient; when absent, preserve the current `resolvePatientId`-based behavior exactly. Then update the two frontend fetch functions and the widget refresh call to pass the patient being refreshed.

**Tech Stack:** Express + Zod + MongoDB (existing), Vitest + Supertest for backend tests (existing pattern), no new dependencies.

## Global Constraints

- Absent `?patientId=`: behavior for every existing caller must be byte-identical to today — this is the backward-compatibility guarantee the whole design rests on.
- Present `?patientId=` with no access: `403 { detail: "No access to this profile" }`.
- Reuse `userHasPatientAccess(db, userId, patientId): Promise<SeatRole | null>` from `src/server-core/seatResolver.ts` — do not write new access-control logic.
- `GET /api/reminders` is explicitly out of scope — do not touch `src/server-routes/reminders.ts`.
- POST/PATCH/DELETE routes on `/api/routines` and `/api/medications` are out of scope — read-scoping only.

---

### Task 1: Patient-scoped GET /api/routines

**Files:**
- Modify: `src/server-routes/routines.ts`
- Test: `src/server-routes/routines.test.ts` (new file — none exists today)

**Interfaces:**
- Consumes: `userHasPatientAccess` from `../server-core/seatResolver` (already exported, signature above).
- Produces: no new exports — the route's runtime behavior changes only when `req.query.patientId` is present.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/server-routes/routines.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

vi.mock("../server-core/security", () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.auth = { userId: "user-caregiver" };
    next();
  },
}));

const mockUsersCol = {
  findOne: vi.fn().mockResolvedValue({ patient_id: "patient-own" }),
};
const mockRoutinesCol = {
  find: vi.fn().mockReturnValue({
    limit: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) }),
  }),
};
const mockSeatsCol = { findOne: vi.fn() };
const mockPatientsCol = { findOne: vi.fn() };

vi.mock("../server-core/database", () => ({
  getDb: () => ({
    collection: (name: string) => {
      if (name === "users") return mockUsersCol;
      if (name === "routines") return mockRoutinesCol;
      if (name === "seats") return mockSeatsCol;
      if (name === "patients") return mockPatientsCol;
      throw new Error("unexpected collection " + name);
    },
  }),
}));

import routineRoutes from "./routines";
const app = express();
app.use(express.json());
app.use("/api/routines", routineRoutes);

describe("GET /api/routines", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsersCol.findOne.mockResolvedValue({ patient_id: "patient-own" });
    mockRoutinesCol.find.mockReturnValue({
      limit: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) }),
    });
  });

  it("with no patientId param, queries the caller's own linked patient (unchanged behavior)", async () => {
    await request(app).get("/api/routines");
    expect(mockRoutinesCol.find).toHaveBeenCalledWith({ patient_id: "patient-own" });
  });

  it("with a patientId param and access granted via seat, queries that patient", async () => {
    mockSeatsCol.findOne.mockResolvedValue({ userId: "user-caregiver", patientId: "patient-other", role: "primary_caregiver" });

    const res = await request(app).get("/api/routines").query({ patientId: "patient-other" });

    expect(res.status).toBe(200);
    expect(mockRoutinesCol.find).toHaveBeenCalledWith({ patient_id: "patient-other" });
  });

  it("with a patientId param and no access, returns 403 and does not query routines", async () => {
    mockSeatsCol.findOne.mockResolvedValue(null);
    mockPatientsCol.findOne.mockResolvedValue(null);

    const res = await request(app).get("/api/routines").query({ patientId: "patient-other" });

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ detail: "No access to this profile" });
    expect(mockRoutinesCol.find).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/server-routes/routines.test.ts`
Expected: FAIL — current route ignores `req.query.patientId` entirely, so tests 2 and 3 fail (test 1 passes already, since it matches current behavior).

- [ ] **Step 3: Implement the query-param handling**

In `src/server-routes/routines.ts`, add the import and modify the GET handler:

```typescript
// add to imports at the top of the file
import { userHasPatientAccess } from "../server-core/seatResolver";
```

Replace the existing `router.get("/", authMiddleware, resolvePatientId, async (req, res) => { ... })` block with:

```typescript
router.get("/", authMiddleware, resolvePatientId, async (req, res) => {
  try {
    const db = getDb();
    let patientId = req.patientId!;

    const requestedPatientId = req.query.patientId;
    if (typeof requestedPatientId === "string" && requestedPatientId.length > 0) {
      const userId = req.auth!.userId;
      const role = await userHasPatientAccess(db, userId, requestedPatientId);
      if (!role) {
        res.status(403).json({ detail: "No access to this profile" });
        return;
      }
      patientId = requestedPatientId;
    }

    const docs = await db
      .collection("routines")
      .find({ patient_id: patientId })
      .limit(200)
      .toArray();
    res.json(docs.map(routineOut));
  } catch (err) {
    console.error("list routines error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/server-routes/routines.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Run the full backend test suite**

Run: `npx vitest run`
Expected: All existing tests still pass — this change only adds a new conditional branch, existing `resolvePatientId`-based behavior is untouched when `patientId` query param is absent.

- [ ] **Step 6: Commit**

```bash
git add src/server-routes/routines.ts src/server-routes/routines.test.ts
git commit -m "feat: allow GET /api/routines to fetch a different patient's data with access check"
```

---

### Task 2: Patient-scoped GET /api/medications

**Files:**
- Modify: `src/server-routes/medications.ts`
- Test: `src/server-routes/medications.test.ts` (new file — none exists today)

**Interfaces:**
- Consumes: `userHasPatientAccess` from `../server-core/seatResolver` (same as Task 1).
- Produces: no new exports — identical pattern to Task 1, applied to the medications collection.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/server-routes/medications.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

vi.mock("../server-core/security", () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.auth = { userId: "user-caregiver" };
    next();
  },
}));

const mockUsersCol = {
  findOne: vi.fn().mockResolvedValue({ patient_id: "patient-own" }),
};
const mockMedicationsCol = {
  find: vi.fn().mockReturnValue({
    limit: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) }),
  }),
};
const mockSeatsCol = { findOne: vi.fn() };
const mockPatientsCol = { findOne: vi.fn() };

vi.mock("../server-core/database", () => ({
  getDb: () => ({
    collection: (name: string) => {
      if (name === "users") return mockUsersCol;
      if (name === "medications") return mockMedicationsCol;
      if (name === "seats") return mockSeatsCol;
      if (name === "patients") return mockPatientsCol;
      throw new Error("unexpected collection " + name);
    },
  }),
}));

import medicationRoutes from "./medications";
const app = express();
app.use(express.json());
app.use("/api/medications", medicationRoutes);

describe("GET /api/medications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsersCol.findOne.mockResolvedValue({ patient_id: "patient-own" });
    mockMedicationsCol.find.mockReturnValue({
      limit: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) }),
    });
  });

  it("with no patientId param, queries the caller's own linked patient (unchanged behavior)", async () => {
    await request(app).get("/api/medications");
    expect(mockMedicationsCol.find).toHaveBeenCalledWith({ patient_id: "patient-own" });
  });

  it("with a patientId param and access granted via seat, queries that patient", async () => {
    mockSeatsCol.findOne.mockResolvedValue({ userId: "user-caregiver", patientId: "patient-other", role: "primary_caregiver" });

    const res = await request(app).get("/api/medications").query({ patientId: "patient-other" });

    expect(res.status).toBe(200);
    expect(mockMedicationsCol.find).toHaveBeenCalledWith({ patient_id: "patient-other" });
  });

  it("with a patientId param and no access, returns 403 and does not query medications", async () => {
    mockSeatsCol.findOne.mockResolvedValue(null);
    mockPatientsCol.findOne.mockResolvedValue(null);

    const res = await request(app).get("/api/medications").query({ patientId: "patient-other" });

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ detail: "No access to this profile" });
    expect(mockMedicationsCol.find).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/server-routes/medications.test.ts`
Expected: FAIL — same reason as Task 1.

- [ ] **Step 3: Implement the query-param handling**

In `src/server-routes/medications.ts`, add the import:

```typescript
import { userHasPatientAccess } from "../server-core/seatResolver";
```

Replace the existing `router.get("/", authMiddleware, resolvePatientId, async (req, res) => { ... })` block with:

```typescript
router.get("/", authMiddleware, resolvePatientId, async (req, res) => {
  try {
    const db = getDb();
    let patientId = req.patientId!;

    const requestedPatientId = req.query.patientId;
    if (typeof requestedPatientId === "string" && requestedPatientId.length > 0) {
      const userId = req.auth!.userId;
      const role = await userHasPatientAccess(db, userId, requestedPatientId);
      if (!role) {
        res.status(403).json({ detail: "No access to this profile" });
        return;
      }
      patientId = requestedPatientId;
    }

    const docs = await db
      .collection("medications")
      .find({ patient_id: patientId })
      .limit(200)
      .toArray();
    res.json(docs.map(medOut));
  } catch (err) {
    console.error("list medications error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/server-routes/medications.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Run the full backend test suite**

Run: `npx vitest run`
Expected: All existing tests plus Task 1's and this task's new tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/server-routes/medications.ts src/server-routes/medications.test.ts
git commit -m "feat: allow GET /api/medications to fetch a different patient's data with access check"
```

---

### Task 3: Wire the frontend to request the right patient's data

**Files:**
- Modify: `src/api/client.ts`
- Modify: `src/services/calendarApi.ts`

**Interfaces:**
- Consumes: Task 1 and Task 2's `?patientId=` query param support (server-side, already merged by this point).
- Produces: `fetchRoutines(patientId?: string): Promise<RoutineTask[]>` and `fetchMedications(patientId?: string): Promise<Medication[]>` — both now accept an optional patient id; `refreshWidgetForPatient` passes its own `patientId` argument through to both.

- [ ] **Step 1: Update fetchRoutines and fetchMedications in client.ts**

In `src/api/client.ts`, replace:

```typescript
export async function fetchRoutines(): Promise<RoutineTask[]> {
  return request<RoutineTask[]>("/api/routines");
}
```

with:

```typescript
export async function fetchRoutines(patientId?: string): Promise<RoutineTask[]> {
  const query = patientId ? `?patientId=${encodeURIComponent(patientId)}` : "";
  return request<RoutineTask[]>(`/api/routines${query}`);
}
```

And replace:

```typescript
export async function fetchMedications(): Promise<Medication[]> {
  return request<Medication[]>("/api/medications");
}
```

with:

```typescript
export async function fetchMedications(patientId?: string): Promise<Medication[]> {
  const query = patientId ? `?patientId=${encodeURIComponent(patientId)}` : "";
  return request<Medication[]>(`/api/medications${query}`);
}
```

Every other existing call site (`useRoutine.ts`, `useMeds.ts`) calls these with zero arguments — since the new parameter is optional, those call sites compile and behave unchanged with no edits needed. Confirm this by running `npx tsc --noEmit` after this step — it must show 0 errors with no other files touched yet.

- [ ] **Step 2: Wire refreshWidgetForPatient to pass its patientId through**

In `src/services/calendarApi.ts`, find the `refreshWidgetForPatient` function (around line 82) — it currently calls:

```typescript
fetchRoutines().catch(() => []),
fetchMedications().catch(() => []),
```

Change to:

```typescript
fetchRoutines(patientId).catch(() => []),
fetchMedications(patientId).catch(() => []),
```

(`patientId` here refers to `refreshWidgetForPatient`'s own first parameter — read the function's current signature before editing to confirm the parameter name matches exactly.)

- [ ] **Step 3: Run the full test suite and typecheck**

Run: `npx vitest run`
Expected: All tests pass, no regressions.

Run: `npx jest`
Expected: All tests pass, no regressions (this touches `useRoutine`/`useMeds`'s underlying fetch functions only by adding an optional parameter, so their existing tests should be unaffected — if any test mocks `fetchRoutines`/`fetchMedications` with strict argument-count assertions, it may need updating; check and fix if so).

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/api/client.ts src/services/calendarApi.ts
git commit -m "feat: pass the target patientId through to routines/medications fetches in the widget refresh"
```

---

## Self-Review Notes

- **Spec coverage:** Backward-compatible absent-param behavior (Tasks 1/3 step 1, Task 2 step 1), 403 on no-access (Tasks 1/2), reuse of `userHasPatientAccess` (Tasks 1/2), frontend wiring (Task 3), reminders explicitly untouched (no task modifies `reminders.ts`) — all five spec points covered.
- **Type consistency:** `fetchRoutines`/`fetchMedications`'s new optional parameter names and the `patientId` used in `refreshWidgetForPatient` are consistent across Task 3's two steps.
- **No placeholders:** every step has complete, real code matching the actual current file contents (verified by reading both routes files and `client.ts`/`calendarApi.ts` before writing this plan).

## Manual checklist (things Haadi must do, not automatable)

- [ ] After merging, redeploy the Render backend (push alone won't update the live service).
