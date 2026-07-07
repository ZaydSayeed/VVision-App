# Shared Calendar — Phase 1: Core Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the shared per-patient calendar — backend data model/routes, recurrence support, permissions, push reminders, and the app UI — as a working, testable feature. This is Phase 1 of 3 (see `docs/superpowers/specs/2026-07-07-shared-calendar-design.md`); Phases 2 (Apple Calendar sync) and 3 (widget) build on top of what this phase produces.

**Architecture:** New `calendar_events` MongoDB collection, one Express router (`calendarEvents.ts`) following the existing `visits.ts`/`geofence.ts` pattern (`authMiddleware` + `requirePatientAccess`), RRULE-based recurrence expanded server-side per request window. The app gets a new `CalendarScreen` (shared by patient and caregiver stacks) plus an add/edit modal, wired into `RootNavigator`. Existing `visits` are migrated into `calendar_events` as `category: "medical"` and the old visits route is retired.

**Tech Stack:** Express + Zod + MongoDB (existing), `rrule` npm package (new dependency) for recurrence, Vitest + Supertest for backend tests (existing pattern), React Native + existing screen/navigation conventions for the app.

## Global Constraints

- Route mount base is `/api/profiles` (see `src/server.ts`); this router's paths are `/:patientId/calendar-events...` to match.
- Auth pattern for all routes: `authMiddleware` then `requirePatientAccess` (from `src/server-core/seatResolver.ts`) — grants both patient and caregiver access via seats/legacy caregiver_ids.
- Edit/delete must check `createdBy === req.seat!.userId` — patients cannot modify caregiver-created events; enforced server-side, not just hidden in UI.
- Backend tests use Vitest + Supertest, mocking `authMiddleware`/`requirePatientAccess` and `getDb`, following `src/server-routes/geofence.test.ts`.
- No raw RRULE syntax is ever exposed in the app UI — only simple presets (none / daily / weekly / custom days-of-week).

---

### Task 1: Add `rrule` dependency and recurrence helper

**Files:**
- Modify: `package.json` (add `rrule` dependency)
- Create: `src/server-core/recurrence.ts`
- Test: `src/server-core/recurrence.test.ts`

**Interfaces:**
- Produces: `expandOccurrences(startAt: string, recurrenceRule: string | null, rangeStart: string, rangeEnd: string): string[]` — returns ISO datetime strings for each occurrence of the event within `[rangeStart, rangeEnd]`. If `recurrenceRule` is null, returns `[startAt]` if it falls in range, else `[]`.
- Produces: `buildDailyRule(): string`, `buildWeeklyRule(daysOfWeek: number[]): string` — helpers that build RRULE strings from the app's simple presets (`daysOfWeek`: 0=Sunday..6=Saturday, per RRULE `BYDAY` convention).

- [ ] **Step 1: Install rrule**

Run: `cd ~/Documents/VVision-App && npm install rrule`
Expected: `package.json` and `package-lock.json` updated, no errors.

- [ ] **Step 2: Write the failing test**

```typescript
// src/server-core/recurrence.test.ts
import { describe, it, expect } from "vitest";
import { expandOccurrences, buildDailyRule, buildWeeklyRule } from "./recurrence";

describe("expandOccurrences", () => {
  it("returns the single start time when there is no recurrence rule and it's in range", () => {
    const result = expandOccurrences(
      "2026-07-10T15:00:00.000Z", null,
      "2026-07-01T00:00:00.000Z", "2026-07-31T00:00:00.000Z"
    );
    expect(result).toEqual(["2026-07-10T15:00:00.000Z"]);
  });

  it("returns empty when non-recurring event is outside the range", () => {
    const result = expandOccurrences(
      "2026-08-10T15:00:00.000Z", null,
      "2026-07-01T00:00:00.000Z", "2026-07-31T00:00:00.000Z"
    );
    expect(result).toEqual([]);
  });

  it("expands a daily rule across the requested window", () => {
    const rule = buildDailyRule();
    const result = expandOccurrences(
      "2026-07-10T09:00:00.000Z", rule,
      "2026-07-10T00:00:00.000Z", "2026-07-13T00:00:00.000Z"
    );
    expect(result).toEqual([
      "2026-07-10T09:00:00.000Z",
      "2026-07-11T09:00:00.000Z",
      "2026-07-12T09:00:00.000Z",
    ]);
  });

  it("expands a weekly rule on specific days", () => {
    // 2026-07-10 is a Friday. Weekly on Mon/Wed starting that Friday should
    // first occur the following Monday (2026-07-13).
    const rule = buildWeeklyRule([1, 3]); // Mon, Wed
    const result = expandOccurrences(
      "2026-07-10T09:00:00.000Z", rule,
      "2026-07-10T00:00:00.000Z", "2026-07-16T00:00:00.000Z"
    );
    expect(result).toEqual([
      "2026-07-13T09:00:00.000Z",
      "2026-07-15T09:00:00.000Z",
    ]);
  });
});
```

- [ ] **Step 2b: Run test to verify it fails**

Run: `npx vitest run src/server-core/recurrence.test.ts`
Expected: FAIL — `Cannot find module './recurrence'`

- [ ] **Step 3: Implement recurrence.ts**

```typescript
// src/server-core/recurrence.ts
import { RRule, rrulestr } from "rrule";

const RRULE_WEEKDAYS = [RRule.SU, RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR, RRule.SA];

export function buildDailyRule(): string {
  return new RRule({ freq: RRule.DAILY }).toString();
}

export function buildWeeklyRule(daysOfWeek: number[]): string {
  return new RRule({
    freq: RRule.WEEKLY,
    byweekday: daysOfWeek.map((d) => RRULE_WEEKDAYS[d]),
  }).toString();
}

export function expandOccurrences(
  startAt: string,
  recurrenceRule: string | null,
  rangeStart: string,
  rangeEnd: string
): string[] {
  const start = new Date(startAt);
  const rangeStartDate = new Date(rangeStart);
  const rangeEndDate = new Date(rangeEnd);

  if (!recurrenceRule) {
    return start >= rangeStartDate && start < rangeEndDate ? [startAt] : [];
  }

  const rule = rrulestr(recurrenceRule, { dtstart: start });
  const occurrences = rule.between(rangeStartDate, rangeEndDate, true);
  return occurrences
    .filter((d) => d < rangeEndDate)
    .map((d) => d.toISOString());
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/server-core/recurrence.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/server-core/recurrence.ts src/server-core/recurrence.test.ts
git commit -m "feat: add RRULE-based recurrence expansion helper"
```

---

### Task 2: Calendar events schema + POST create route

**Files:**
- Create: `src/server-routes/calendarEvents.ts`
- Test: `src/server-routes/calendarEvents.test.ts`

**Interfaces:**
- Consumes: `requirePatientAccess`, `authMiddleware` (from `src/server-core/seatResolver.ts`, `src/server-core/security.ts`), `getDb` (from `src/server-core/database.ts`), `buildDailyRule`/`buildWeeklyRule` (Task 1, not used directly by the route but by the schema's shape).
- Produces: `export const calendarEventCreateSchema` (Zod schema), `export default router` mounted at `/:patientId/calendar-events`. Document shape written to `calendar_events` collection: `{ patientId, title, category, startAt, endAt, notes, recurrenceRule, createdBy, completedDates: [], createdAt }`.

- [ ] **Step 1: Write the failing test**

```typescript
// src/server-routes/calendarEvents.test.ts
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
  requirePatientAccess: (req: any, _res: any, next: any) => {
    req.seat = { userId: "user-caregiver", patientId: req.params.patientId, role: "primary_caregiver" };
    next();
  },
}));

const mockCol = {
  insertOne: vi.fn().mockResolvedValue({ insertedId: { toString: () => "event-1" } }),
};
vi.mock("../server-core/database", () => ({
  getDb: () => ({ collection: () => mockCol }),
}));

import calendarEventsRouter from "./calendarEvents";
const app = express();
app.use(express.json());
app.use("/api/profiles", calendarEventsRouter);

describe("POST /api/profiles/:patientId/calendar-events", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a one-off event and returns its id", async () => {
    const res = await request(app)
      .post("/api/profiles/patient-123/calendar-events")
      .send({
        title: "Dr. Smith checkup",
        category: "medical",
        startAt: "2026-07-15T15:00:00.000Z",
        endAt: "2026-07-15T15:30:00.000Z",
      });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe("event-1");
    expect(mockCol.insertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        patientId: "patient-123",
        title: "Dr. Smith checkup",
        category: "medical",
        createdBy: "user-caregiver",
        completedDates: [],
      })
    );
  });

  it("rejects an invalid category", async () => {
    const res = await request(app)
      .post("/api/profiles/patient-123/calendar-events")
      .send({ title: "X", category: "not-a-real-category", startAt: "2026-07-15T15:00:00.000Z", endAt: "2026-07-15T15:30:00.000Z" });
    expect(res.status).toBe(400);
  });

  it("rejects a missing title", async () => {
    const res = await request(app)
      .post("/api/profiles/patient-123/calendar-events")
      .send({ category: "medical", startAt: "2026-07-15T15:00:00.000Z", endAt: "2026-07-15T15:30:00.000Z" });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/server-routes/calendarEvents.test.ts`
Expected: FAIL — `Cannot find module './calendarEvents'`

- [ ] **Step 3: Implement calendarEvents.ts (create route only for now)**

```typescript
// src/server-routes/calendarEvents.ts
import { Router } from "express";
import { z } from "zod";
import { getDb } from "../server-core/database";
import { authMiddleware } from "../server-core/security";
import { requirePatientAccess } from "../server-core/seatResolver";

export const calendarEventCategory = z.enum(["medical", "medication", "social", "personal"]);

export const calendarEventCreateSchema = z.object({
  title: z.string().min(1).max(200),
  category: calendarEventCategory,
  startAt: z.string(),
  endAt: z.string(),
  notes: z.string().max(1000).optional(),
  recurrenceRule: z.string().max(500).optional(),
});

const router = Router();

router.post("/:patientId/calendar-events", authMiddleware, requirePatientAccess, async (req, res) => {
  const parsed = calendarEventCreateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ detail: parsed.error.issues[0].message }); return; }
  try {
    const db = getDb();
    const result = await db.collection("calendar_events").insertOne({
      ...parsed.data,
      patientId: req.params.patientId,
      recurrenceRule: parsed.data.recurrenceRule ?? null,
      notes: parsed.data.notes ?? null,
      createdBy: req.seat!.userId,
      completedDates: [],
      createdAt: new Date().toISOString(),
    });
    res.status(201).json({ id: result.insertedId.toString() });
  } catch (err) {
    console.error("calendar-events create error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

export default router;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/server-routes/calendarEvents.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/server-routes/calendarEvents.ts src/server-routes/calendarEvents.test.ts
git commit -m "feat: add calendar-events create route"
```

---

### Task 3: GET list route with recurrence expansion

**Files:**
- Modify: `src/server-routes/calendarEvents.ts`
- Modify: `src/server-routes/calendarEvents.test.ts`

**Interfaces:**
- Consumes: `expandOccurrences` (Task 1, `../server-core/recurrence`).
- Produces: `GET /:patientId/calendar-events?from=&to=` — returns `{ events: Array<{ id, title, category, occurrenceAt, endAt, notes, recurrenceRule, createdBy, completed }> }`, one entry per occurrence in range (a recurring event produces multiple entries, one per occurrence date). `completed` is `true` if that occurrence's date (YYYY-MM-DD) is in `completedDates`.

- [ ] **Step 1: Write the failing test**

```typescript
// append to src/server-routes/calendarEvents.test.ts
describe("GET /api/profiles/:patientId/calendar-events", () => {
  beforeEach(() => vi.clearAllMocks());

  it("expands a recurring event into one entry per occurrence", async () => {
    mockCol.find = vi.fn().mockReturnValue({
      toArray: vi.fn().mockResolvedValue([
        {
          _id: { toString: () => "event-1" },
          patientId: "patient-123",
          title: "Morning Adderall",
          category: "medication",
          startAt: "2026-07-10T13:00:00.000Z",
          endAt: "2026-07-10T13:05:00.000Z",
          recurrenceRule: "FREQ=DAILY",
          notes: null,
          createdBy: "user-caregiver",
          completedDates: ["2026-07-10"],
        },
      ]),
    });

    const res = await request(app)
      .get("/api/profiles/patient-123/calendar-events")
      .query({ from: "2026-07-10T00:00:00.000Z", to: "2026-07-12T00:00:00.000Z" });

    expect(res.status).toBe(200);
    expect(res.body.events).toHaveLength(2);
    expect(res.body.events[0]).toMatchObject({ occurrenceAt: "2026-07-10T13:00:00.000Z", completed: true });
    expect(res.body.events[1]).toMatchObject({ occurrenceAt: "2026-07-11T13:00:00.000Z", completed: false });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/server-routes/calendarEvents.test.ts`
Expected: FAIL — 404 (no GET route registered yet)

- [ ] **Step 3: Implement the GET route**

```typescript
// add to src/server-routes/calendarEvents.ts, after the imports:
import { expandOccurrences } from "../server-core/recurrence";

// add before `export default router;`
router.get("/:patientId/calendar-events", authMiddleware, requirePatientAccess, async (req, res) => {
  try {
    const db = getDb();
    const from = String(req.query.from ?? new Date().toISOString());
    const to = String(req.query.to ?? new Date(Date.now() + 7 * 86_400_000).toISOString());
    const docs = await db.collection("calendar_events").find({ patientId: req.params.patientId }).toArray();

    const events = docs.flatMap((doc: any) => {
      const occurrences = expandOccurrences(doc.startAt, doc.recurrenceRule, from, to);
      const durationMs = new Date(doc.endAt).getTime() - new Date(doc.startAt).getTime();
      return occurrences.map((occurrenceAt) => {
        const dateKey = occurrenceAt.slice(0, 10);
        return {
          id: doc._id.toString(),
          title: doc.title,
          category: doc.category,
          occurrenceAt,
          endAt: new Date(new Date(occurrenceAt).getTime() + durationMs).toISOString(),
          notes: doc.notes ?? null,
          recurrenceRule: doc.recurrenceRule ?? null,
          createdBy: doc.createdBy,
          completed: (doc.completedDates ?? []).includes(dateKey),
        };
      });
    });

    events.sort((a, b) => a.occurrenceAt.localeCompare(b.occurrenceAt));
    res.json({ events });
  } catch (err) {
    console.error("calendar-events list error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/server-routes/calendarEvents.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/server-routes/calendarEvents.ts src/server-routes/calendarEvents.test.ts
git commit -m "feat: add calendar-events list route with recurrence expansion"
```

---

### Task 4: PATCH edit route with creator-only permission

**Files:**
- Modify: `src/server-routes/calendarEvents.ts`
- Modify: `src/server-routes/calendarEvents.test.ts`

**Interfaces:**
- Produces: `PATCH /:patientId/calendar-events/:id` — 200 on success, 403 if `req.seat.userId !== doc.createdBy`, 404 if not found.

- [ ] **Step 1: Write the failing test**

```typescript
// append to src/server-routes/calendarEvents.test.ts
import { ObjectId } from "mongodb";

describe("PATCH /api/profiles/:patientId/calendar-events/:id", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates an event the caller created", async () => {
    const id = new ObjectId().toString();
    mockCol.findOne = vi.fn().mockResolvedValue({ _id: new ObjectId(id), patientId: "patient-123", createdBy: "user-caregiver" });
    mockCol.updateOne = vi.fn().mockResolvedValue({ matchedCount: 1 });

    const res = await request(app)
      .patch(`/api/profiles/patient-123/calendar-events/${id}`)
      .send({ title: "Updated title" });

    expect(res.status).toBe(200);
    expect(mockCol.updateOne).toHaveBeenCalled();
  });

  it("returns 403 when the caller did not create the event", async () => {
    const id = new ObjectId().toString();
    mockCol.findOne = vi.fn().mockResolvedValue({ _id: new ObjectId(id), patientId: "patient-123", createdBy: "someone-else" });

    const res = await request(app)
      .patch(`/api/profiles/patient-123/calendar-events/${id}`)
      .send({ title: "Updated title" });

    expect(res.status).toBe(403);
  });

  it("returns 404 when the event does not exist", async () => {
    const id = new ObjectId().toString();
    mockCol.findOne = vi.fn().mockResolvedValue(null);

    const res = await request(app)
      .patch(`/api/profiles/patient-123/calendar-events/${id}`)
      .send({ title: "Updated title" });

    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/server-routes/calendarEvents.test.ts`
Expected: FAIL — 404 (no PATCH route registered), `mockCol.findOne`/`updateOne` don't exist on the mock yet either

- [ ] **Step 3: Implement the PATCH route**

```typescript
// add to src/server-routes/calendarEvents.ts
import { ObjectId } from "mongodb";

export const calendarEventUpdateSchema = calendarEventCreateSchema.partial();

router.patch("/:patientId/calendar-events/:id", authMiddleware, requirePatientAccess, async (req, res) => {
  const parsed = calendarEventUpdateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ detail: parsed.error.issues[0].message }); return; }
  try {
    const db = getDb();
    const doc = await db.collection("calendar_events").findOne({
      _id: new ObjectId(String(req.params.id)),
      patientId: req.params.patientId,
    });
    if (!doc) { res.status(404).json({ detail: "Event not found" }); return; }
    if (doc.createdBy !== req.seat!.userId) { res.status(403).json({ detail: "Only the creator can edit this event" }); return; }

    await db.collection("calendar_events").updateOne(
      { _id: doc._id },
      { $set: parsed.data }
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("calendar-events update error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/server-routes/calendarEvents.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/server-routes/calendarEvents.ts src/server-routes/calendarEvents.test.ts
git commit -m "feat: add calendar-events edit route restricted to the creator"
```

---

### Task 5: DELETE route + POST complete route

**Files:**
- Modify: `src/server-routes/calendarEvents.ts`
- Modify: `src/server-routes/calendarEvents.test.ts`

**Interfaces:**
- Produces: `DELETE /:patientId/calendar-events/:id` (creator-only, same 403/404 rules as PATCH). `POST /:patientId/calendar-events/:id/complete` with body `{ date: string }` (YYYY-MM-DD) — appends `date` to `completedDates` if not already present; anyone with patient access may mark complete (not creator-restricted, since completing a task is a shared caregiving action).

- [ ] **Step 1: Write the failing tests**

```typescript
// append to src/server-routes/calendarEvents.test.ts
describe("DELETE /api/profiles/:patientId/calendar-events/:id", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes an event the caller created", async () => {
    const id = new ObjectId().toString();
    mockCol.findOne = vi.fn().mockResolvedValue({ _id: new ObjectId(id), patientId: "patient-123", createdBy: "user-caregiver" });
    mockCol.deleteOne = vi.fn().mockResolvedValue({ deletedCount: 1 });

    const res = await request(app).delete(`/api/profiles/patient-123/calendar-events/${id}`);
    expect(res.status).toBe(200);
    expect(mockCol.deleteOne).toHaveBeenCalled();
  });

  it("returns 403 when the caller did not create the event", async () => {
    const id = new ObjectId().toString();
    mockCol.findOne = vi.fn().mockResolvedValue({ _id: new ObjectId(id), patientId: "patient-123", createdBy: "someone-else" });

    const res = await request(app).delete(`/api/profiles/patient-123/calendar-events/${id}`);
    expect(res.status).toBe(403);
  });
});

describe("POST /api/profiles/:patientId/calendar-events/:id/complete", () => {
  beforeEach(() => vi.clearAllMocks());

  it("marks an occurrence complete regardless of who created it", async () => {
    const id = new ObjectId().toString();
    mockCol.findOne = vi.fn().mockResolvedValue({ _id: new ObjectId(id), patientId: "patient-123", createdBy: "someone-else", completedDates: [] });
    mockCol.updateOne = vi.fn().mockResolvedValue({ matchedCount: 1 });

    const res = await request(app)
      .post(`/api/profiles/patient-123/calendar-events/${id}/complete`)
      .send({ date: "2026-07-10" });

    expect(res.status).toBe(200);
    expect(mockCol.updateOne).toHaveBeenCalledWith(
      { _id: expect.anything() },
      { $addToSet: { completedDates: "2026-07-10" } }
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/server-routes/calendarEvents.test.ts`
Expected: FAIL — DELETE and complete routes don't exist (404s)

- [ ] **Step 3: Implement both routes**

```typescript
// add to src/server-routes/calendarEvents.ts
router.delete("/:patientId/calendar-events/:id", authMiddleware, requirePatientAccess, async (req, res) => {
  try {
    const db = getDb();
    const doc = await db.collection("calendar_events").findOne({
      _id: new ObjectId(String(req.params.id)),
      patientId: req.params.patientId,
    });
    if (!doc) { res.status(404).json({ detail: "Event not found" }); return; }
    if (doc.createdBy !== req.seat!.userId) { res.status(403).json({ detail: "Only the creator can delete this event" }); return; }

    await db.collection("calendar_events").deleteOne({ _id: doc._id });
    res.json({ ok: true });
  } catch (err) {
    console.error("calendar-events delete error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

const completeSchema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

router.post("/:patientId/calendar-events/:id/complete", authMiddleware, requirePatientAccess, async (req, res) => {
  const parsed = completeSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ detail: parsed.error.issues[0].message }); return; }
  try {
    const db = getDb();
    const doc = await db.collection("calendar_events").findOne({
      _id: new ObjectId(String(req.params.id)),
      patientId: req.params.patientId,
    });
    if (!doc) { res.status(404).json({ detail: "Event not found" }); return; }

    await db.collection("calendar_events").updateOne(
      { _id: doc._id },
      { $addToSet: { completedDates: parsed.data.date } }
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("calendar-events complete error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/server-routes/calendarEvents.test.ts`
Expected: PASS (10 tests)

- [ ] **Step 5: Commit**

```bash
git add src/server-routes/calendarEvents.ts src/server-routes/calendarEvents.test.ts
git commit -m "feat: add calendar-events delete and mark-complete routes"
```

---

### Task 6: Mount the router and migrate existing visits

**Files:**
- Modify: `src/server.ts:29,137` (import and mount)
- Create: `src/server-jobs/migrateVisitsToCalendarEvents.ts`
- Test: `src/server-jobs/migrateVisitsToCalendarEvents.test.ts`
- Modify: `src/server-routes/visits.ts` (remove — superseded)

**Interfaces:**
- Consumes: nothing new.
- Produces: `migrateVisitsToCalendarEvents(db: Db): Promise<number>` — reads every `visits` document, inserts an equivalent `calendar_events` document (`category: "medical"`, `title: providerName`, `notes` includes `providerRole` + original notes, `startAt/endAt` from `scheduledFor` with a 30-min default duration, `createdBy` from the visit's implicit caregiver context — since old visits didn't track `createdBy`, backfill with a sentinel `"migrated"` so nobody is blocked from editing; see step 3 for exact handling), returns count migrated. Run once manually against production data (see Step 5) — this is a one-time data migration, not part of the request path.

- [ ] **Step 1: Write the failing test**

```typescript
// src/server-jobs/migrateVisitsToCalendarEvents.test.ts
import { describe, it, expect, vi } from "vitest";
import { migrateVisitsToCalendarEvents } from "./migrateVisitsToCalendarEvents";

describe("migrateVisitsToCalendarEvents", () => {
  it("converts each visit into a calendar_events document and returns the count", async () => {
    const visits = [
      { _id: "v1", patientId: "patient-123", providerName: "Dr. Smith", providerRole: "Neurologist", scheduledFor: "2026-07-15T15:00:00.000Z", notes: "Bring meds list" },
    ];
    const inserted: any[] = [];
    const db = {
      collection: (name: string) => {
        if (name === "visits") return { find: () => ({ toArray: () => Promise.resolve(visits) }) };
        if (name === "calendar_events") return { insertMany: (docs: any[]) => { inserted.push(...docs); return Promise.resolve({}); } };
        throw new Error("unexpected collection " + name);
      },
    } as any;

    const count = await migrateVisitsToCalendarEvents(db);

    expect(count).toBe(1);
    expect(inserted[0]).toMatchObject({
      patientId: "patient-123",
      title: "Dr. Smith",
      category: "medical",
      startAt: "2026-07-15T15:00:00.000Z",
      endAt: "2026-07-15T15:30:00.000Z",
      notes: "Neurologist — Bring meds list",
      createdBy: "migrated",
      recurrenceRule: null,
      completedDates: [],
    });
  });

  it("returns 0 and inserts nothing when there are no visits", async () => {
    const db = {
      collection: (name: string) => {
        if (name === "visits") return { find: () => ({ toArray: () => Promise.resolve([]) }) };
        if (name === "calendar_events") return { insertMany: vi.fn() };
        throw new Error("unexpected collection " + name);
      },
    } as any;

    const count = await migrateVisitsToCalendarEvents(db);
    expect(count).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/server-jobs/migrateVisitsToCalendarEvents.test.ts`
Expected: FAIL — `Cannot find module './migrateVisitsToCalendarEvents'`

- [ ] **Step 3: Implement the migration job**

```typescript
// src/server-jobs/migrateVisitsToCalendarEvents.ts
import { Db } from "mongodb";

export async function migrateVisitsToCalendarEvents(db: Db): Promise<number> {
  const visits = await db.collection("visits").find({}).toArray();
  if (visits.length === 0) return 0;

  const docs = visits.map((v: any) => {
    const start = new Date(v.scheduledFor);
    const end = new Date(start.getTime() + 30 * 60_000);
    const notesParts = [v.providerRole, v.notes].filter(Boolean);
    return {
      patientId: v.patientId,
      title: v.providerName,
      category: "medical" as const,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      notes: notesParts.length ? notesParts.join(" — ") : null,
      recurrenceRule: null,
      createdBy: "migrated",
      completedDates: [],
      createdAt: new Date().toISOString(),
    };
  });

  await db.collection("calendar_events").insertMany(docs);
  return docs.length;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/server-jobs/migrateVisitsToCalendarEvents.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Wire the router into server.ts, add a one-time migration trigger, retire visits.ts**

In `src/server.ts`:
- Replace `import visitRoutes from "./server-routes/visits";` with `import calendarEventsRouter from "./server-routes/calendarEvents";`
- Replace `app.use("/api/profiles", visitRoutes);` with `app.use("/api/profiles", calendarEventsRouter);`
- In the existing `/api/internal/cron/tick` handler (or a one-off admin route, whichever the team prefers to trigger manually once), add a manual call to `migrateVisitsToCalendarEvents(db)` — **run this once, then remove the call**. Do not leave it running on every cron tick.
- Delete `src/server-routes/visits.ts` and any of its imports/tests (`visits.test.ts` if present) once the migration has been run against production data and verified (see manual checklist at the end of this plan).

- [ ] **Step 6: Run the full backend test suite**

Run: `npx vitest run`
Expected: All tests pass; no references to the deleted `visits.ts` remain (grep `visitRoutes` and `from "./visits"` to confirm).

- [ ] **Step 7: Commit**

```bash
git add src/server.ts src/server-jobs/migrateVisitsToCalendarEvents.ts src/server-jobs/migrateVisitsToCalendarEvents.test.ts
git rm src/server-routes/visits.ts
git commit -m "feat: mount calendar-events router, add visits migration job, retire visits route"
```

**Post-implementation note (final whole-branch review fix pass, 2026-07-07):** the whole-branch review found two gaps this task's own review couldn't see in isolation:
1. No task rebuilt the still-live "Schedule Visit"/"Visit Reports" caregiver UI on top of the new calendar API after `visits.ts` was deleted — it was still calling the now-404 `/visits` routes. Fixed by rewriting `VisitReportsScreen.tsx` to use `createCalendarEvent`/`listCalendarEvents` (`category: "medical"`) instead of `src/api/visits.ts`.
2. `migrateVisitsToCalendarEvents` was not idempotent (plain `insertMany`, no dedup) and had no documented rollback. Fixed by adding a `migratedFrom: <original visit _id>` field to each migrated doc, skipping visit ids already present in `calendar_events.migratedFrom` on re-run. Rollback (manual, run directly against the DB if the migration needs to be undone): `db.collection("calendar_events").deleteMany({ migratedFrom: { $exists: true } })`.

Also fixed as part of the same review: the `createdBy === "migrated"` sentinel was blocking edits/deletes for everyone (PATCH/DELETE now special-case it per this task's original stated intent), and the GET list route now also returns the document's true `startAt` so the app's editor stops corrupting recurring series when edited from a later occurrence.

---

### Task 7: Push reminder cron job for upcoming events

**Files:**
- Create: `src/server-jobs/fireCalendarReminders.ts`
- Test: `src/server-jobs/fireCalendarReminders.test.ts`
- Modify: `src/server-routes/cron.ts`

**Interfaces:**
- Consumes: `getCaregiverPushTokens`, `getPatientPushToken`, `sendExpoPush`, `ExpoPushMessage` (from `src/server-core/push.ts`), `expandOccurrences` (Task 1).
- Produces: `fireCalendarReminders(db: Db, leadMinutes?: number): Promise<number>` — for every calendar event occurrence starting in the next `leadMinutes` (default 30) that hasn't already been notified (tracked via a `notifiedOccurrences: string[]` field per document, storing `"<eventId>:<occurrenceISO>"` keys), sends a push to the patient and all caregivers, then records the occurrence as notified. Returns count of occurrences notified.

- [ ] **Step 1: Write the failing test**

```typescript
// src/server-jobs/fireCalendarReminders.test.ts
import { describe, it, expect, vi } from "vitest";
import { fireCalendarReminders } from "./fireCalendarReminders";

vi.mock("../server-core/push", () => ({
  getCaregiverPushTokens: vi.fn().mockResolvedValue(["ExponentPushToken[caregiver]"]),
  getPatientPushToken: vi.fn().mockResolvedValue("ExponentPushToken[patient]"),
  sendExpoPush: vi.fn().mockResolvedValue([]),
}));

describe("fireCalendarReminders", () => {
  it("notifies for an event starting within the lead window and marks it notified", async () => {
    const now = new Date("2026-07-10T12:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const doc = {
      _id: "event-1",
      patientId: "patient-123",
      title: "Dr. Smith checkup",
      startAt: "2026-07-10T12:20:00.000Z", // 20 min from now, inside default 30-min lead
      endAt: "2026-07-10T12:50:00.000Z",
      recurrenceRule: null,
      notifiedOccurrences: [],
    };
    const updateOne = vi.fn().mockResolvedValue({});
    const db = {
      collection: (name: string) => {
        if (name === "calendar_events") return { find: () => ({ toArray: () => Promise.resolve([doc]) }), updateOne };
        throw new Error("unexpected collection " + name);
      },
    } as any;

    const count = await fireCalendarReminders(db);

    expect(count).toBe(1);
    expect(updateOne).toHaveBeenCalledWith(
      { _id: "event-1" },
      { $addToSet: { notifiedOccurrences: "event-1:2026-07-10T12:20:00.000Z" } }
    );
    vi.useRealTimers();
  });

  it("does not re-notify an occurrence already in notifiedOccurrences", async () => {
    const now = new Date("2026-07-10T12:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const doc = {
      _id: "event-1",
      patientId: "patient-123",
      title: "Dr. Smith checkup",
      startAt: "2026-07-10T12:20:00.000Z",
      endAt: "2026-07-10T12:50:00.000Z",
      recurrenceRule: null,
      notifiedOccurrences: ["event-1:2026-07-10T12:20:00.000Z"],
    };
    const db = {
      collection: (name: string) => ({ find: () => ({ toArray: () => Promise.resolve([doc]) }), updateOne: vi.fn() }),
    } as any;

    const count = await fireCalendarReminders(db);
    expect(count).toBe(0);
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/server-jobs/fireCalendarReminders.test.ts`
Expected: FAIL — `Cannot find module './fireCalendarReminders'`

- [ ] **Step 3: Implement the job**

```typescript
// src/server-jobs/fireCalendarReminders.ts
import { Db } from "mongodb";
import { expandOccurrences } from "../server-core/recurrence";
import { getCaregiverPushTokens, getPatientPushToken, sendExpoPush, ExpoPushMessage } from "../server-core/push";

export async function fireCalendarReminders(db: Db, leadMinutes = 30): Promise<number> {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + leadMinutes * 60_000);
  const docs = await db.collection("calendar_events").find({}).toArray();

  let notifiedCount = 0;
  for (const doc of docs) {
    const occurrences = expandOccurrences(doc.startAt, doc.recurrenceRule ?? null, now.toISOString(), windowEnd.toISOString());
    const alreadyNotified: string[] = doc.notifiedOccurrences ?? [];

    for (const occurrenceAt of occurrences) {
      const key = `${doc._id}:${occurrenceAt}`;
      if (alreadyNotified.includes(key)) continue;

      const patientId = doc.patientId;
      const [caregiverTokens, patientToken] = await Promise.all([
        getCaregiverPushTokens(db, patientId),
        getPatientPushToken(db, patientId),
      ]);
      const tokens = [...caregiverTokens, ...(patientToken ? [patientToken] : [])];
      if (tokens.length > 0) {
        const messages: ExpoPushMessage[] = tokens.map((to) => ({
          to,
          title: "Upcoming: " + doc.title,
          body: `${doc.title} at ${new Date(occurrenceAt).toLocaleTimeString()}`,
          data: { type: "calendar_reminder", eventId: String(doc._id) },
          priority: "high",
          sound: "default",
        }));
        await sendExpoPush(messages);
      }

      await db.collection("calendar_events").updateOne(
        { _id: doc._id },
        { $addToSet: { notifiedOccurrences: key } }
      );
      notifiedCount++;
    }
  }

  return notifiedCount;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/server-jobs/fireCalendarReminders.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Wire into the cron tick**

In `src/server-routes/cron.ts`, add the import and include it in the `Promise.allSettled` alongside `escalateHelpAlerts` and `fireRemindersForAll`:

```typescript
import { fireCalendarReminders } from "../server-jobs/fireCalendarReminders";
// ...
const [escalation, reminders, calendarReminders] = await Promise.allSettled([
  escalateHelpAlerts(db),
  fireRemindersForAll(db),
  fireCalendarReminders(db),
]);
for (const r of [escalation, reminders, calendarReminders]) {
  if (r.status === "rejected") console.error("cron tick job failed:", r.reason);
}
```

- [ ] **Step 6: Run the full backend test suite**

Run: `npx vitest run`
Expected: All tests pass, including `cron.test.ts`.

- [ ] **Step 7: Commit**

```bash
git add src/server-jobs/fireCalendarReminders.ts src/server-jobs/fireCalendarReminders.test.ts src/server-routes/cron.ts
git commit -m "feat: push reminders for upcoming calendar events via cron tick"
```

---

### Task 8: App — calendar API client + category color util

**Files:**
- Create: `src/services/calendarApi.ts`
- Create: `src/config/calendarCategories.ts`

**Interfaces:**
- Produces (`calendarApi.ts`): `listCalendarEvents(patientId: string, from: string, to: string): Promise<CalendarEventOccurrence[]>`, `createCalendarEvent(patientId: string, input: CalendarEventInput): Promise<{ id: string }>`, `updateCalendarEvent(patientId: string, id: string, input: Partial<CalendarEventInput>): Promise<void>`, `deleteCalendarEvent(patientId: string, id: string): Promise<void>`, `completeCalendarEventOccurrence(patientId: string, id: string, date: string): Promise<void>`. Types: `CalendarEventOccurrence { id: string; title: string; category: CalendarCategory; occurrenceAt: string; endAt: string; notes: string | null; recurrenceRule: string | null; createdBy: string; completed: boolean }`, `CalendarEventInput { title: string; category: CalendarCategory; startAt: string; endAt: string; notes?: string; recurrenceRule?: string }`.
- Produces (`calendarCategories.ts`): `type CalendarCategory = "medical" | "medication" | "social" | "personal"`, `CALENDAR_CATEGORY_COLORS: Record<CalendarCategory, string>`, `CALENDAR_CATEGORY_LABELS: Record<CalendarCategory, string>`.

Check how existing services call the backend before writing this — look at `src/services/healthSync.ts` for the base URL / fetch-wrapper convention already in use, and match it exactly (same auth header injection, same base URL config) rather than reinventing the request pattern.

- [ ] **Step 1: Read the existing service pattern**

Run: `grep -n "apiFetch\|API_BASE\|fetch(" src/services/healthSync.ts | head -20` and read the matched lines with the file reader — confirm the exact helper name and import path used for authenticated requests (e.g. an `apiFetch` wrapper, or raw `fetch` with a token from a shared auth context). Use whatever that pattern is in the two files below — do not introduce a second request convention.

- [ ] **Step 2: Implement calendarCategories.ts**

```typescript
// src/config/calendarCategories.ts
export type CalendarCategory = "medical" | "medication" | "social" | "personal";

export const CALENDAR_CATEGORY_COLORS: Record<CalendarCategory, string> = {
  medical: "#D64545",
  medication: "#7A5FD1",
  social: "#3E9C6D",
  personal: "#3E7CB1",
};

export const CALENDAR_CATEGORY_LABELS: Record<CalendarCategory, string> = {
  medical: "Medical",
  medication: "Medication",
  social: "Social",
  personal: "Personal",
};
```

- [ ] **Step 3: Implement calendarApi.ts using the confirmed request pattern from Step 1**

Write `listCalendarEvents`, `createCalendarEvent`, `updateCalendarEvent`, `deleteCalendarEvent`, and `completeCalendarEventOccurrence`, each calling the matching route from Tasks 2–5 (`GET/POST/PATCH/DELETE /api/profiles/:patientId/calendar-events...`), using the same authenticated-fetch helper identified in Step 1. Export the `CalendarEventOccurrence` and `CalendarEventInput` types listed in this task's Interfaces block.

- [ ] **Step 4: Manual verification**

Since this is a thin API client with no business logic of its own, there's no unit test for this task — it's verified by Task 9's screen actually rendering data end-to-end. Confirm now only that it compiles: run `npx tsc --noEmit` and expect no new errors from these two files.

- [ ] **Step 5: Commit**

```bash
git add src/services/calendarApi.ts src/config/calendarCategories.ts
git commit -m "feat: add calendar API client and category color config"
```

---

### Task 9: App — CalendarScreen (list view)

**Files:**
- Create: `src/screens/shared/CalendarScreen.tsx`
- Modify: `src/navigation/RootNavigator.tsx`

**Interfaces:**
- Consumes: `listCalendarEvents`, `completeCalendarEventOccurrence` (Task 8), `CALENDAR_CATEGORY_COLORS`, `CALENDAR_CATEGORY_LABELS` (Task 8).
- Produces: `CalendarScreen` component, registered as `"Calendar"` in both `PatientStack` and `CaregiverStack` in `RootNavigator.tsx`.

Look at `src/screens/patient/TodayScreen.tsx` first for the app's existing list/card layout conventions (spacing, typography, `theme.ts` token usage) — follow those exactly rather than introducing new styles.

- [ ] **Step 1: Read the reference screen**

Read `src/screens/patient/TodayScreen.tsx` in full and note: which theme tokens it imports from `src/config/theme.ts`, how it structures a `FlatList`/card list, and how it handles loading/empty states. Reuse those same patterns.

- [ ] **Step 2: Implement CalendarScreen.tsx**

Build a screen that:
- On mount and on pull-to-refresh, calls `listCalendarEvents(patientId, startOfWeek, endOfWeek)` (week view as the default; a simple prev/next week toggle, no month/day view needed for v1 — if a day/month toggle turns out to be wanted, that's a fast follow, not blocking this task).
- Renders each occurrence as a card: colored dot/tag using `CALENDAR_CATEGORY_COLORS[event.category]`, title, time, and — if `event.completed` — a strikethrough/checked style.
- Tapping an incomplete occurrence's checkbox calls `completeCalendarEventOccurrence` and optimistically updates local state.
- Includes a floating "+" button that navigates to `"CalendarEventEditor"` (built in Task 10) with no `eventId` param (create mode).
- Tapping a card navigates to `"CalendarEventEditor"` with that event's `id` (edit mode) — the editor screen itself enforces the creator-only edit rule server-side (Task 4); if a PATCH/DELETE call returns 403, show a plain-language toast: "Only the person who added this can edit it."
- `patientId` comes from whatever existing screens in `src/screens/patient/` and `src/screens/caregiver/` already use to identify the active patient (check `TodayScreen.tsx` and `PatientsDashboardScreen.tsx` for the exact source — a route param, a context, or a hook) — match that, don't invent a new way to get it.

- [ ] **Step 3: Register the screen in RootNavigator**

In `src/navigation/RootNavigator.tsx`, add (matching the existing `<PatientStack.Screen ...>` / `<CaregiverStack.Screen ...>` style seen at lines ~206–214 and ~371–386):

```tsx
<PatientStack.Screen name="Calendar" component={CalendarScreen} options={{ headerShown: true, title: "Calendar" }} />
```

and the equivalent under `CaregiverStack`. Add a nav entry point (e.g. a button/tab) wherever the app's existing navigation surfaces screens like `"CheckIn"` or `"VisitReports"` — follow that same entry-point convention rather than adding an orphaned route nobody can reach.

- [ ] **Step 4: Manual verification**

Run: `npx tsc --noEmit` — expect no new type errors.
Then run the app (`npm start` or the project's existing dev-run command) and manually verify: navigate to Calendar, see events for the current week, create a one-off event, see it appear, mark it complete, see it strike through, confirm a caregiver-created event can't be edited from the patient login (403 toast).

- [ ] **Step 5: Commit**

```bash
git add src/screens/shared/CalendarScreen.tsx src/navigation/RootNavigator.tsx
git commit -m "feat: add CalendarScreen with week view, completion, and category colors"
```

---

### Task 10: App — Add/Edit event modal with recurrence presets

**Files:**
- Create: `src/screens/shared/CalendarEventEditorScreen.tsx`
- Modify: `src/navigation/RootNavigator.tsx`

**Interfaces:**
- Consumes: `createCalendarEvent`, `updateCalendarEvent`, `deleteCalendarEvent` (Task 8), `buildDailyRule`/`buildWeeklyRule` equivalents — since those live server-side (`src/server-core/recurrence.ts`), duplicate the same two tiny builder functions client-side in this file (no shared package boundary exists between server and app in this repo — check `src/services/` for any existing case of a server util being duplicated client-side and follow that precedent; if none exists, a local 6-line copy is acceptable here per YAGNI rather than introducing a shared workspace package for two functions).
- Produces: `CalendarEventEditorScreen`, registered as `"CalendarEventEditor"` in both stacks, accepting an optional `eventId` route param.

- [ ] **Step 1: Implement the editor screen**

Fields: title (text input), category (segmented control or picker using `CALENDAR_CATEGORY_LABELS`), date + start/end time (use the existing `@react-native-community/datetimepicker` dependency already in `app.json`'s plugins — check `src/screens/onboarding/` for an existing usage example of this picker and follow its exact pattern), notes (multiline text), recurrence (a simple three-option picker: "Doesn't repeat" / "Every day" / "Every week on selected days" with a day-of-week multi-select shown only for the weekly option).

On save: if creating, call `createCalendarEvent`; if editing, call `updateCalendarEvent`. Include a "Delete" button in edit mode calling `deleteCalendarEvent`, with a confirmation prompt (use whatever confirm-dialog pattern the codebase already has — check `PatientsDashboardScreen.tsx`'s unlink-patient button flow mentioned in project memory for the existing confirm-before-destructive-action convention).

- [ ] **Step 2: Register the screen in RootNavigator**

Add `"CalendarEventEditor"` to both `PatientStack` and `CaregiverStack`, same style as Task 9 Step 3.

- [ ] **Step 3: Manual verification**

Run: `npx tsc --noEmit` — expect no new type errors.
Then in the running app: create a daily recurring event, confirm it shows on multiple days in the CalendarScreen week view; create a weekly event on two specific days, confirm it only shows on those days; edit an event you created, confirm the change persists; attempt to delete, confirm the confirmation prompt appears and deletion removes it from the list.

- [ ] **Step 4: Commit**

```bash
git add src/screens/shared/CalendarEventEditorScreen.tsx src/navigation/RootNavigator.tsx
git commit -m "feat: add calendar event editor with recurrence presets"
```

---

## Self-Review Notes

- **Spec coverage:** Data model (Task 2/3), permissions (Task 4/5), recurrence (Task 1/3), categories (Task 8/9), notifications (Task 7), visits absorption (Task 6), UI (Task 9/10) — all five spec sections have a task. Apple Calendar sync and the widget are intentionally out of scope here (Phases 2/3, separate plans).
- **Type consistency:** `CalendarEventOccurrence`/`CalendarEventInput` (Task 8) match the JSON shape produced by the GET/POST routes (Tasks 2/3) field-for-field. `CalendarCategory` type is defined once (Task 8) and reused, not redefined.
- **No placeholders:** every step has real code; the one place requiring investigation before writing code (Task 8 Step 1, Task 9 Step 1) is scoped as an explicit read-first step, not a "figure it out" placeholder.

## Manual checklist (things Haadi must do, not automatable)

- [ ] Run the Task 6 migration once against the production database (not on every deploy) and spot-check a few migrated events in the app before deleting `visits.ts` for good.
- [ ] After merging, redeploy the Render backend (push alone won't update the live service).
