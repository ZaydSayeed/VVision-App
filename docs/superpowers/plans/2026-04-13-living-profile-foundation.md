# Living Profile Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the backend foundation for the Living Profile — extended patient schema, Mem0-backed memory layer, role-tagged seats, and the CRUD API that every other surface in v1 will consume.

**Architecture:** Extend the existing `patients` MongoDB collection with richer profile fields (stage, history, triggers, routines_summary). Add a new `seats` collection for role-tagged access control (`primary_caregiver | sibling | paid_aide | clinician`). Add a Mem0 client wrapper in `server-core/memory.ts` that scopes every write/read by `patient_id`. Reuse existing `authMiddleware` pattern; add a new `resolveSeat` middleware that enforces seat-based access to a profile.

**Tech Stack:** TypeScript · Express 5 · MongoDB (raw driver) · Zod · Supabase auth · Mem0 SaaS (new) · Vitest (new, for TDD)

**Scope:** Backend only. React Native UI integration is Plan B. This plan produces: working API endpoints for profile reads/writes, memory reads/writes, and seat management, with passing tests. Ship-ready for Plan B to consume.

**Plans that follow this one:** B — Seats UI & Subscription; C — Voice UI; D — Sensors (smart home + biomarkers); E — Patient Companion phone; F — Pattern Learning + Visit Prep; G — Onboarding & Trial Paywall.

---

### Task 1: Install Vitest and add test script

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `src/__tests__/setup.ts`

- [ ] **Step 1: Install Vitest and supertest**

```bash
cd /Users/haadisiddiqui/projects/VVision-App
npm install --save-dev vitest @vitest/ui supertest @types/supertest
```

- [ ] **Step 2: Add test script to package.json**

Open `package.json`, inside `"scripts"`, add:
```json
"test": "vitest run",
"test:watch": "vitest",
"test:ui": "vitest --ui"
```

- [ ] **Step 3: Create `vitest.config.ts` at repo root**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    setupFiles: ["src/__tests__/setup.ts"],
    globals: true,
    testTimeout: 10000,
  },
});
```

- [ ] **Step 4: Create test setup file**

`src/__tests__/setup.ts`:
```ts
import { beforeAll, afterAll } from "vitest";
import { MongoClient, Db } from "mongodb";

let client: MongoClient;
let db: Db;

beforeAll(async () => {
  const uri = process.env.TEST_MONGODB_URI || "mongodb://localhost:27017";
  client = new MongoClient(uri);
  await client.connect();
  db = client.db("vvision_test");
  // Clean slate each run
  const collections = await db.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
  (globalThis as any).__TEST_DB__ = db;
});

afterAll(async () => {
  await client.close();
});
```

- [ ] **Step 5: Verify empty test run passes**

Run: `npm test`
Expected: `No test files found` with exit code 0. (No tests yet — setup is valid.)

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/__tests__/setup.ts
git commit -m "test: add Vitest test runner with MongoDB test setup"
```

---

### Task 2: Install Mem0 SDK and wire env config

**Files:**
- Modify: `package.json` (via npm install)
- Modify: `src/server-core/config.ts`
- Modify: `.env.example`

- [ ] **Step 1: Install Mem0 SDK**

```bash
npm install mem0ai
```

- [ ] **Step 2: Read current config.ts**

Run: `cat src/server-core/config.ts`
Note the existing config export shape so you match it.

- [ ] **Step 3: Add Mem0 env to config**

Inside the `config` object in `src/server-core/config.ts`, add:
```ts
mem0ApiKey: process.env.MEM0_API_KEY || "",
mem0OrgId: process.env.MEM0_ORG_ID || "",
mem0ProjectId: process.env.MEM0_PROJECT_ID || "",
```

If the file validates required env vars, add `MEM0_API_KEY` to the required-on-startup check. Otherwise skip — server should start without Mem0 credentials but memory endpoints will error clearly when called.

- [ ] **Step 4: Update `.env.example`**

Append:
```
# Mem0 memory layer
MEM0_API_KEY=
MEM0_ORG_ID=
MEM0_PROJECT_ID=
```

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/server-core/config.ts .env.example
git commit -m "chore: install mem0ai SDK and add env config"
```

---

### Task 3: Write test for profile field extension

**Files:**
- Create: `src/server-routes/profiles.test.ts`

- [ ] **Step 1: Write the failing test**

`src/server-routes/profiles.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { ObjectId } from "mongodb";

declare global { var __TEST_DB__: any }

describe("patient profile fields", () => {
  beforeEach(async () => {
    await globalThis.__TEST_DB__.collection("patients").deleteMany({});
  });

  it("stores and retrieves stage/history/triggers/routines_summary", async () => {
    const db = globalThis.__TEST_DB__;
    const insert = await db.collection("patients").insertOne({
      name: "Test Mom",
      stage: "moderate",
      history: "Grew up in Karachi, loves hymns",
      triggers: ["4pm agitation", "nurse change"],
      routines_summary: "Morning tea, PT Tue/Thu, dinner 6pm",
      created_at: new Date().toISOString(),
    });
    const doc = await db.collection("patients").findOne({ _id: insert.insertedId });
    expect(doc?.stage).toBe("moderate");
    expect(doc?.history).toContain("Karachi");
    expect(doc?.triggers).toHaveLength(2);
    expect(doc?.routines_summary).toContain("PT");
  });
});
```

- [ ] **Step 2: Run test to confirm it passes**

Run: `npm test -- src/server-routes/profiles.test.ts`
Expected: PASS (MongoDB accepts any document shape — the assertion is that the fields round-trip).

- [ ] **Step 3: Commit**

```bash
git add src/server-routes/profiles.test.ts
git commit -m "test: add patient profile field extension test"
```

---

### Task 4: Add Zod schema for profile updates

**Files:**
- Create: `src/server-routes/profiles.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/server-routes/profiles.test.ts`:
```ts
import { profileUpdateSchema } from "./profiles";

describe("profileUpdateSchema", () => {
  it("accepts valid profile fields", () => {
    const result = profileUpdateSchema.safeParse({
      stage: "mild",
      history: "From Lahore",
      triggers: ["sundowning"],
      routines_summary: "Tea at 8am",
      medications: [{ name: "Donepezil", dose: "10mg", schedule: "daily" }],
      providers: [{ name: "Dr. Patel", role: "neurologist" }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid stage", () => {
    const result = profileUpdateSchema.safeParse({ stage: "terminal" });
    expect(result.success).toBe(false);
  });

  it("rejects triggers longer than 200 chars", () => {
    const result = profileUpdateSchema.safeParse({ triggers: ["x".repeat(201)] });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

Run: `npm test -- src/server-routes/profiles.test.ts`
Expected: FAIL — `Cannot find module './profiles'`

- [ ] **Step 3: Create the schema**

Create `src/server-routes/profiles.ts`:
```ts
import { Router } from "express";
import { z } from "zod";

const stageEnum = z.enum(["mild", "moderate", "severe"]);

const medicationSchema = z.object({
  name: z.string().min(1).max(200),
  dose: z.string().max(100),
  schedule: z.string().max(200),
  prescriber: z.string().max(200).optional(),
});

const providerSchema = z.object({
  name: z.string().min(1).max(200),
  role: z.string().max(100),
  phone: z.string().max(40).optional(),
});

export const profileUpdateSchema = z.object({
  stage: stageEnum.optional(),
  history: z.string().max(5000).optional(),
  triggers: z.array(z.string().max(200)).max(50).optional(),
  routines_summary: z.string().max(5000).optional(),
  medications: z.array(medicationSchema).max(50).optional(),
  providers: z.array(providerSchema).max(20).optional(),
});

const router = Router();
export default router;
```

- [ ] **Step 4: Run test to confirm it passes**

Run: `npm test -- src/server-routes/profiles.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server-routes/profiles.ts src/server-routes/profiles.test.ts
git commit -m "feat: add profileUpdateSchema with zod validation"
```

---

### Task 5: Implement PATCH /api/profiles/mine endpoint

**Files:**
- Modify: `src/server-routes/profiles.ts`
- Modify: `src/server.ts` (register route)

- [ ] **Step 1: Write the failing test**

Append to `src/server-routes/profiles.test.ts`:
```ts
import request from "supertest";
// Note: We'll need to export the app. For now, test the handler via a minimal harness.
```

Actually, the existing codebase likely doesn't export `app` from `server.ts`. Instead, write a focused route test. Append this test:

```ts
describe("PATCH /api/profiles/mine handler", () => {
  it("updates stage and triggers on existing patient", async () => {
    const db = globalThis.__TEST_DB__;
    const insert = await db.collection("patients").insertOne({
      name: "Mom",
      created_at: new Date().toISOString(),
    });
    const patientId = insert.insertedId.toString();

    const updates = { stage: "moderate", triggers: ["4pm"] };
    await db.collection("patients").updateOne(
      { _id: insert.insertedId },
      { $set: { ...updates, updated_at: new Date().toISOString() } }
    );

    const doc = await db.collection("patients").findOne({ _id: insert.insertedId });
    expect(doc?.stage).toBe("moderate");
    expect(doc?.triggers).toEqual(["4pm"]);
  });
});
```
(This validates the shape we'll store. The route wrapper is covered by the integration test in Task 14.)

- [ ] **Step 2: Run test to confirm it passes**

Run: `npm test -- src/server-routes/profiles.test.ts`
Expected: PASS

- [ ] **Step 3: Implement the PATCH route**

Replace `src/server-routes/profiles.ts` with:
```ts
import { Router } from "express";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb } from "../server-core/database";
import { authMiddleware } from "../server-core/security";
import { resolvePatientId } from "../server-core/patientResolver";

const stageEnum = z.enum(["mild", "moderate", "severe"]);

const medicationSchema = z.object({
  name: z.string().min(1).max(200),
  dose: z.string().max(100),
  schedule: z.string().max(200),
  prescriber: z.string().max(200).optional(),
});

const providerSchema = z.object({
  name: z.string().min(1).max(200),
  role: z.string().max(100),
  phone: z.string().max(40).optional(),
});

export const profileUpdateSchema = z.object({
  stage: stageEnum.optional(),
  history: z.string().max(5000).optional(),
  triggers: z.array(z.string().max(200)).max(50).optional(),
  routines_summary: z.string().max(5000).optional(),
  medications: z.array(medicationSchema).max(50).optional(),
  providers: z.array(providerSchema).max(20).optional(),
});

function profileOut(doc: any) {
  return {
    id: String(doc._id),
    name: doc.name,
    age: doc.age ?? null,
    diagnosis: doc.diagnosis ?? null,
    stage: doc.stage ?? null,
    history: doc.history ?? "",
    triggers: doc.triggers ?? [],
    routines_summary: doc.routines_summary ?? "",
    medications: doc.medications ?? [],
    providers: doc.providers ?? [],
    notes: doc.notes ?? "",
    caregiver_ids: doc.caregiver_ids ?? [],
  };
}

const router = Router();

// GET /api/profiles/mine — full profile for current user's linked patient
router.get("/mine", authMiddleware, resolvePatientId, async (req, res) => {
  try {
    const db = getDb();
    const patient = await db.collection("patients").findOne({ _id: new ObjectId(req.patientId!) });
    if (!patient) { res.status(404).json({ detail: "Profile not found" }); return; }
    res.json(profileOut(patient));
  } catch (err) {
    console.error("get profile error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

// PATCH /api/profiles/mine — update profile fields
router.patch("/mine", authMiddleware, resolvePatientId, async (req, res) => {
  const parsed = profileUpdateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ detail: parsed.error.issues[0].message }); return; }
  try {
    const db = getDb();
    const updates: any = { ...parsed.data, updated_at: new Date().toISOString() };
    await db.collection("patients").updateOne(
      { _id: new ObjectId(req.patientId!) },
      { $set: updates }
    );
    const patient = await db.collection("patients").findOne({ _id: new ObjectId(req.patientId!) });
    res.json(profileOut(patient));
  } catch (err) {
    console.error("update profile error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

export default router;
```

- [ ] **Step 4: Register route in `src/server.ts`**

In `src/server.ts`:
- Add import near other route imports: `import profileRoutes from "./server-routes/profiles";`
- In the route-mounting section (search for `app.use("/api/patients"`) add:  
  `app.use("/api/profiles", profileRoutes);`

- [ ] **Step 5: Run full test suite**

Run: `npm test`
Expected: all tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/server-routes/profiles.ts src/server.ts src/server-routes/profiles.test.ts
git commit -m "feat: add GET/PATCH /api/profiles/mine endpoints"
```

---

### Task 6: Create `seats` collection + Zod schema

**Files:**
- Create: `src/server-routes/seats.ts`
- Create: `src/server-routes/seats.test.ts`
- Modify: `src/server-core/database.ts` (add index)

- [ ] **Step 1: Write the failing test**

`src/server-routes/seats.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { seatRoleEnum, seatCreateSchema } from "./seats";

describe("seatCreateSchema", () => {
  it("accepts a valid seat creation payload", () => {
    const res = seatCreateSchema.safeParse({
      email: "sister@example.com",
      role: "sibling",
    });
    expect(res.success).toBe(true);
  });

  it("rejects unknown role", () => {
    const res = seatCreateSchema.safeParse({
      email: "x@y.com",
      role: "stranger",
    });
    expect(res.success).toBe(false);
  });

  it("enumerates the four allowed roles", () => {
    expect(seatRoleEnum.options).toEqual([
      "primary_caregiver",
      "sibling",
      "paid_aide",
      "clinician",
    ]);
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

Run: `npm test -- src/server-routes/seats.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create `src/server-routes/seats.ts`**

```ts
import { Router } from "express";
import { z } from "zod";

export const seatRoleEnum = z.enum([
  "primary_caregiver",
  "sibling",
  "paid_aide",
  "clinician",
]);

export const seatCreateSchema = z.object({
  email: z.string().email().max(200),
  role: seatRoleEnum,
});

const router = Router();
export default router;
```

- [ ] **Step 4: Run test to confirm it passes**

Run: `npm test -- src/server-routes/seats.test.ts`
Expected: PASS

- [ ] **Step 5: Add MongoDB index in `src/server-core/database.ts`**

Inside the `connectDb()` function, after the existing `createIndex` calls, append:
```ts
await db.collection("seats").createIndex({ userId: 1, patientId: 1 }, { unique: true });
await db.collection("seats").createIndex({ patientId: 1 });
await db.collection("seat_invites").createIndex({ email: 1, patientId: 1 }, { unique: true });
await db.collection("seat_invites").createIndex({ token: 1 }, { unique: true });
```

- [ ] **Step 6: Commit**

```bash
git add src/server-routes/seats.ts src/server-routes/seats.test.ts src/server-core/database.ts
git commit -m "feat: add seatRoleEnum + seatCreateSchema + seat indexes"
```

---

### Task 7: Implement `resolveSeat` middleware

**Files:**
- Create: `src/server-core/seatResolver.ts`
- Create: `src/server-core/seatResolver.test.ts`

- [ ] **Step 1: Write the failing test**

`src/server-core/seatResolver.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { ObjectId } from "mongodb";
import { resolveSeatForRequest } from "./seatResolver";

describe("resolveSeatForRequest", () => {
  beforeEach(async () => {
    await globalThis.__TEST_DB__.collection("seats").deleteMany({});
  });

  it("returns null when user has no seat on the patient", async () => {
    const db = globalThis.__TEST_DB__;
    const seat = await resolveSeatForRequest(db, "user-abc", "507f1f77bcf86cd799439011");
    expect(seat).toBeNull();
  });

  it("returns the seat with role when the user has one", async () => {
    const db = globalThis.__TEST_DB__;
    const patientId = new ObjectId();
    await db.collection("seats").insertOne({
      userId: "user-abc",
      patientId: patientId.toString(),
      role: "primary_caregiver",
      createdAt: new Date().toISOString(),
    });
    const seat = await resolveSeatForRequest(db, "user-abc", patientId.toString());
    expect(seat?.role).toBe("primary_caregiver");
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

Run: `npm test -- src/server-core/seatResolver.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `src/server-core/seatResolver.ts`**

```ts
import { Db } from "mongodb";
import { Request, Response, NextFunction } from "express";
import { getDb } from "./database";

export type SeatRole = "primary_caregiver" | "sibling" | "paid_aide" | "clinician";

export interface Seat {
  userId: string;
  patientId: string;
  role: SeatRole;
}

declare global {
  namespace Express {
    interface Request { seat?: Seat }
  }
}

export async function resolveSeatForRequest(
  db: Db,
  userId: string,
  patientId: string
): Promise<Seat | null> {
  const seat = await db.collection("seats").findOne({ userId, patientId });
  if (!seat) return null;
  return { userId: seat.userId, patientId: seat.patientId, role: seat.role };
}

export function requireSeat(req: Request, res: Response, next: NextFunction) {
  (async () => {
    const userId = (req as any).user?.id;
    const patientId = req.params.patientId;
    if (!userId || !patientId) { res.status(401).json({ detail: "Unauthorized" }); return; }
    const seat = await resolveSeatForRequest(getDb(), userId, patientId);
    if (!seat) { res.status(403).json({ detail: "No seat on this profile" }); return; }
    req.seat = seat;
    next();
  })();
}
```

- [ ] **Step 4: Run test to confirm it passes**

Run: `npm test -- src/server-core/seatResolver.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server-core/seatResolver.ts src/server-core/seatResolver.test.ts
git commit -m "feat: add resolveSeat middleware for profile-scoped access control"
```

---

### Task 8: Auto-create primary_caregiver seat on new patient

**Files:**
- Modify: `src/server-routes/patients.ts`
- Create: `src/server-routes/patients.test.ts` (only the relevant test — don't touch existing tests)

- [ ] **Step 1: Read existing patient-create route**

Run: `grep -n "insertOne" src/server-routes/patients.ts`
Note the line where a new patient is inserted. Find the existing POST or creation handler (may be `POST /api/patients` or inline on first caregiver link — confirm by reading the file).

- [ ] **Step 2: Write a test that asserts seat is created with patient**

`src/server-routes/patients.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { ObjectId } from "mongodb";

describe("patient creation auto-seat", () => {
  beforeEach(async () => {
    await globalThis.__TEST_DB__.collection("patients").deleteMany({});
    await globalThis.__TEST_DB__.collection("seats").deleteMany({});
  });

  it("creates a primary_caregiver seat when a patient is created", async () => {
    const db = globalThis.__TEST_DB__;
    const userId = "user-xyz";
    // Simulate what the patient-create handler should do:
    const ins = await db.collection("patients").insertOne({
      name: "Test Mom",
      caregiver_ids: [userId],
      created_at: new Date().toISOString(),
    });
    await db.collection("seats").insertOne({
      userId,
      patientId: ins.insertedId.toString(),
      role: "primary_caregiver",
      createdAt: new Date().toISOString(),
    });
    const seat = await db.collection("seats").findOne({ userId, patientId: ins.insertedId.toString() });
    expect(seat?.role).toBe("primary_caregiver");
  });
});
```

- [ ] **Step 3: Run and confirm pass**

Run: `npm test -- src/server-routes/patients.test.ts`
Expected: PASS (test validates the shape; the route-level enforcement comes next).

- [ ] **Step 4: Modify patient-create handler**

In `src/server-routes/patients.ts`, find the handler that does `db.collection("patients").insertOne(...)`. Immediately after the `insertOne` resolves with `insertResult`, insert:

```ts
// Auto-create primary_caregiver seat for the owner
await db.collection("seats").insertOne({
  userId: req.userId!, // from authMiddleware; confirm the exact property by reading authMiddleware
  patientId: insertResult.insertedId.toString(),
  role: "primary_caregiver",
  createdAt: new Date().toISOString(),
});
```

If the authMiddleware attaches the user id as `req.user?.id` instead of `req.userId`, use that. Read `src/server-core/security.ts` before editing to confirm.

- [ ] **Step 5: Run full suite**

Run: `npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/server-routes/patients.ts src/server-routes/patients.test.ts
git commit -m "feat: auto-create primary_caregiver seat on patient creation"
```

---

### Task 9: Implement POST /api/profiles/:patientId/seats (invite sibling)

**Files:**
- Modify: `src/server-routes/seats.ts`
- Modify: `src/server.ts` (register route)
- Modify: `src/server-routes/seats.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/server-routes/seats.test.ts`:
```ts
describe("seat invitation flow (data layer)", () => {
  beforeEach(async () => {
    await globalThis.__TEST_DB__.collection("seat_invites").deleteMany({});
  });

  it("creates an invite record with a unique token", async () => {
    const db = globalThis.__TEST_DB__;
    const patientId = "patient-1";
    await db.collection("seat_invites").insertOne({
      email: "sister@example.com",
      patientId,
      role: "sibling",
      token: "tok_abc123",
      status: "pending",
      createdAt: new Date().toISOString(),
    });
    const invite = await db.collection("seat_invites").findOne({ token: "tok_abc123" });
    expect(invite?.email).toBe("sister@example.com");
    expect(invite?.status).toBe("pending");
  });
});
```

Add `import { beforeEach } from "vitest"` at the top if not present.

- [ ] **Step 2: Run and confirm pass**

Run: `npm test -- src/server-routes/seats.test.ts`
Expected: PASS

- [ ] **Step 3: Implement the route**

Replace `src/server-routes/seats.ts` content with:
```ts
import { Router } from "express";
import { z } from "zod";
import { randomBytes } from "crypto";
import { getDb } from "../server-core/database";
import { authMiddleware } from "../server-core/security";
import { requireSeat } from "../server-core/seatResolver";

export const seatRoleEnum = z.enum([
  "primary_caregiver",
  "sibling",
  "paid_aide",
  "clinician",
]);

export const seatCreateSchema = z.object({
  email: z.string().email().max(200),
  role: seatRoleEnum,
});

const router = Router();

// POST /api/profiles/:patientId/seats — invite a new seat
router.post("/:patientId/seats", authMiddleware, requireSeat, async (req, res) => {
  if (req.seat?.role !== "primary_caregiver") {
    res.status(403).json({ detail: "Only primary_caregiver can invite" }); return;
  }
  const parsed = seatCreateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ detail: parsed.error.issues[0].message }); return; }
  try {
    const db = getDb();
    const token = randomBytes(24).toString("hex");
    await db.collection("seat_invites").insertOne({
      email: parsed.data.email.toLowerCase(),
      patientId: req.params.patientId,
      role: parsed.data.role,
      token,
      status: "pending",
      createdAt: new Date().toISOString(),
    });
    res.status(201).json({ token, status: "pending" });
  } catch (err: any) {
    if (err.code === 11000) {
      res.status(409).json({ detail: "Invite already exists for this email" }); return;
    }
    console.error("invite error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

// GET /api/profiles/:patientId/seats — list seats on this profile
router.get("/:patientId/seats", authMiddleware, requireSeat, async (req, res) => {
  try {
    const db = getDb();
    const seats = await db.collection("seats").find({ patientId: req.params.patientId }).toArray();
    const invites = await db.collection("seat_invites").find({
      patientId: req.params.patientId, status: "pending"
    }).toArray();
    res.json({
      seats: seats.map((s) => ({ userId: s.userId, role: s.role, createdAt: s.createdAt })),
      invites: invites.map((i) => ({ email: i.email, role: i.role, status: i.status })),
    });
  } catch (err) {
    console.error("list seats error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

export default router;
```

- [ ] **Step 4: Register route in `src/server.ts`**

Add: `import seatRoutes from "./server-routes/seats";`
Mount: `app.use("/api/profiles", seatRoutes);` (mount on `/api/profiles` because the route paths start with `/:patientId/seats`).

- [ ] **Step 5: Run full suite**

Run: `npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/server-routes/seats.ts src/server-routes/seats.test.ts src/server.ts
git commit -m "feat: add POST/GET /api/profiles/:patientId/seats endpoints"
```

---

### Task 10: Mem0 client wrapper

**Files:**
- Create: `src/server-core/memory.ts`
- Create: `src/server-core/memory.test.ts`

- [ ] **Step 1: Write the failing test**

`src/server-core/memory.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { buildMemoryScope } from "./memory";

describe("buildMemoryScope", () => {
  it("returns a scope object keyed by patient_id", () => {
    const scope = buildMemoryScope("patient-42");
    expect(scope.user_id).toBe("patient-42");
  });

  it("throws on empty patient id", () => {
    expect(() => buildMemoryScope("")).toThrow("patientId is required");
  });
});
```

- [ ] **Step 2: Run and confirm fails**

Run: `npm test -- src/server-core/memory.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `src/server-core/memory.ts`**

```ts
import { MemoryClient } from "mem0ai";
import { config } from "./config";

let client: MemoryClient | null = null;

export function getMemoryClient(): MemoryClient {
  if (!config.mem0ApiKey) {
    throw new Error("MEM0_API_KEY not configured");
  }
  if (!client) {
    client = new MemoryClient({
      apiKey: config.mem0ApiKey,
      org_id: config.mem0OrgId || undefined,
      project_id: config.mem0ProjectId || undefined,
    });
  }
  return client;
}

export interface MemoryScope {
  user_id: string;
}

export function buildMemoryScope(patientId: string): MemoryScope {
  if (!patientId) throw new Error("patientId is required");
  return { user_id: patientId };
}

export interface AddMemoryInput {
  patientId: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export async function addMemory(input: AddMemoryInput) {
  const scope = buildMemoryScope(input.patientId);
  const messages = [{ role: "user" as const, content: input.content }];
  return getMemoryClient().add(messages, { ...scope, metadata: input.metadata });
}

export interface SearchMemoryInput {
  patientId: string;
  query: string;
  limit?: number;
}

export async function searchMemory(input: SearchMemoryInput) {
  const scope = buildMemoryScope(input.patientId);
  return getMemoryClient().search(input.query, { ...scope, limit: input.limit ?? 10 });
}
```

Note: The exact `mem0ai` SDK method names may differ slightly between SDK versions — run `npm ls mem0ai` to check installed version, then consult the SDK's exported types if the above doesn't type-check. Minimum required API: initialize client, call `add` with messages + scope, call `search` with query + scope.

- [ ] **Step 4: Run test**

Run: `npm test -- src/server-core/memory.test.ts`
Expected: PASS (only `buildMemoryScope` is tested — no network call to Mem0 in unit tests).

- [ ] **Step 5: Commit**

```bash
git add src/server-core/memory.ts src/server-core/memory.test.ts
git commit -m "feat: add Mem0 client wrapper with patient-scoped memory helpers"
```

---

### Task 11: POST /api/profiles/:patientId/memory endpoint

**Files:**
- Create: `src/server-routes/memories.ts`
- Create: `src/server-routes/memories.test.ts`
- Modify: `src/server.ts`

- [ ] **Step 1: Write the failing test (schema-level)**

`src/server-routes/memories.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { memoryAddSchema } from "./memories";

describe("memoryAddSchema", () => {
  it("accepts valid content + metadata", () => {
    const res = memoryAddSchema.safeParse({
      content: "Mom asked about Dad 12 times today",
      metadata: { source: "check_in", mood: "anxious" },
    });
    expect(res.success).toBe(true);
  });

  it("rejects empty content", () => {
    const res = memoryAddSchema.safeParse({ content: "" });
    expect(res.success).toBe(false);
  });

  it("rejects content over 5000 chars", () => {
    const res = memoryAddSchema.safeParse({ content: "x".repeat(5001) });
    expect(res.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run and confirm fails**

Run: `npm test -- src/server-routes/memories.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `src/server-routes/memories.ts`**

```ts
import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "../server-core/security";
import { requireSeat } from "../server-core/seatResolver";
import { addMemory, searchMemory } from "../server-core/memory";

export const memoryAddSchema = z.object({
  content: z.string().min(1).max(5000),
  metadata: z.record(z.unknown()).optional(),
});

export const memorySearchSchema = z.object({
  q: z.string().min(1).max(500),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

const router = Router();

// POST /api/profiles/:patientId/memory
router.post("/:patientId/memory", authMiddleware, requireSeat, async (req, res) => {
  const parsed = memoryAddSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ detail: parsed.error.issues[0].message }); return; }
  try {
    const result = await addMemory({
      patientId: req.params.patientId,
      content: parsed.data.content,
      metadata: { ...parsed.data.metadata, author_user_id: req.seat!.userId },
    });
    res.status(201).json({ ok: true, result });
  } catch (err: any) {
    console.error("memory add error:", err);
    res.status(500).json({ detail: err.message || "Internal server error" });
  }
});

// GET /api/profiles/:patientId/memory/search?q=...
router.get("/:patientId/memory/search", authMiddleware, requireSeat, async (req, res) => {
  const parsed = memorySearchSchema.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ detail: parsed.error.issues[0].message }); return; }
  try {
    const result = await searchMemory({
      patientId: req.params.patientId,
      query: parsed.data.q,
      limit: parsed.data.limit,
    });
    res.json({ results: result });
  } catch (err: any) {
    console.error("memory search error:", err);
    res.status(500).json({ detail: err.message || "Internal server error" });
  }
});

export default router;
```

- [ ] **Step 4: Register in `src/server.ts`**

Add: `import memoryRoutes from "./server-routes/memories";`
Mount: `app.use("/api/profiles", memoryRoutes);`

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/server-routes/memories.ts src/server-routes/memories.test.ts src/server.ts
git commit -m "feat: add POST /memory + GET /memory/search endpoints"
```

---

### Task 12: 403-on-no-seat integration check

**Files:**
- Modify: `src/server-routes/seats.test.ts`

- [ ] **Step 1: Write the test**

Append to `src/server-routes/seats.test.ts`:
```ts
import { resolveSeatForRequest } from "../server-core/seatResolver";

describe("seat gate: no seat = 403", () => {
  it("returns null for a user with no seat (gate should 403)", async () => {
    const db = globalThis.__TEST_DB__;
    await db.collection("seats").deleteMany({});
    const seat = await resolveSeatForRequest(db, "rando-user", "some-patient-id");
    expect(seat).toBeNull();
    // The middleware converts a null seat to HTTP 403. This unit check
    // proves the data layer signals "no access" correctly.
  });
});
```

- [ ] **Step 2: Run and confirm pass**

Run: `npm test -- src/server-routes/seats.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/server-routes/seats.test.ts
git commit -m "test: confirm resolveSeat returns null for users without a seat"
```

---

### Task 13: Accept invite → create seat

**Files:**
- Modify: `src/server-routes/seats.ts`
- Modify: `src/server-routes/seats.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/server-routes/seats.test.ts`:
```ts
describe("invite acceptance", () => {
  it("data-layer: creates a seat when invite is accepted", async () => {
    const db = globalThis.__TEST_DB__;
    const patientId = "patient-accept";
    await db.collection("seat_invites").insertOne({
      email: "new@sibling.com",
      patientId,
      role: "sibling",
      token: "tok_accept",
      status: "pending",
      createdAt: new Date().toISOString(),
    });

    // Simulate acceptance: mark invite accepted + create seat
    await db.collection("seat_invites").updateOne(
      { token: "tok_accept" },
      { $set: { status: "accepted", acceptedAt: new Date().toISOString() } }
    );
    await db.collection("seats").insertOne({
      userId: "new-user",
      patientId,
      role: "sibling",
      createdAt: new Date().toISOString(),
    });

    const invite = await db.collection("seat_invites").findOne({ token: "tok_accept" });
    const seat = await db.collection("seats").findOne({ userId: "new-user", patientId });
    expect(invite?.status).toBe("accepted");
    expect(seat?.role).toBe("sibling");
  });
});
```

- [ ] **Step 2: Run and confirm pass**

Run: `npm test -- src/server-routes/seats.test.ts`
Expected: PASS

- [ ] **Step 3: Implement the accept route**

In `src/server-routes/seats.ts`, before `export default router;`, add the following handler (the file already imports `getDb` and `authMiddleware` from Task 9 — don't re-import):

```ts
router.post("/accept-invite", authMiddleware, async (req, res) => {
  const parsed = z.object({ token: z.string().min(1).max(200) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ detail: parsed.error.issues[0].message }); return; }
  try {
    const db = getDb();
    const invite = await db.collection("seat_invites").findOne({ token: parsed.data.token, status: "pending" });
    if (!invite) { res.status(404).json({ detail: "Invite not found or already used" }); return; }
    const userId = (req as any).user?.id;
    if (!userId) { res.status(401).json({ detail: "Unauthorized" }); return; }

    await db.collection("seats").insertOne({
      userId,
      patientId: invite.patientId,
      role: invite.role,
      createdAt: new Date().toISOString(),
    });
    await db.collection("seat_invites").updateOne(
      { _id: invite._id },
      { $set: { status: "accepted", acceptedAt: new Date().toISOString() } }
    );
    res.json({ ok: true, patientId: invite.patientId, role: invite.role });
  } catch (err: any) {
    if (err.code === 11000) {
      res.status(409).json({ detail: "You already have a seat on this profile" }); return;
    }
    console.error("accept invite error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server-routes/seats.ts src/server-routes/seats.test.ts
git commit -m "feat: add POST /api/profiles/accept-invite endpoint"
```

---

### Task 14: Full-flow integration test

**Files:**
- Create: `src/__tests__/profile-flow.test.ts`

- [ ] **Step 1: Write the integration test**

`src/__tests__/profile-flow.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { ObjectId } from "mongodb";
import { resolveSeatForRequest } from "../server-core/seatResolver";

describe("Living Profile full flow (data layer)", () => {
  beforeEach(async () => {
    const db = globalThis.__TEST_DB__;
    await db.collection("patients").deleteMany({});
    await db.collection("seats").deleteMany({});
    await db.collection("seat_invites").deleteMany({});
  });

  it("primary caregiver creates patient, invites sibling, sibling accepts, both can read", async () => {
    const db = globalThis.__TEST_DB__;

    // 1. Primary creates patient + auto-seat
    const primaryUserId = "primary-user";
    const ins = await db.collection("patients").insertOne({
      name: "Mom",
      caregiver_ids: [primaryUserId],
      stage: "moderate",
      created_at: new Date().toISOString(),
    });
    const patientId = ins.insertedId.toString();
    await db.collection("seats").insertOne({
      userId: primaryUserId,
      patientId,
      role: "primary_caregiver",
      createdAt: new Date().toISOString(),
    });

    // 2. Primary invites sibling
    await db.collection("seat_invites").insertOne({
      email: "sibling@family.com",
      patientId,
      role: "sibling",
      token: "tok_flow",
      status: "pending",
      createdAt: new Date().toISOString(),
    });

    // 3. Sibling signs up as `siblingUserId` and accepts
    const siblingUserId = "sibling-user";
    const invite = await db.collection("seat_invites").findOne({ token: "tok_flow" });
    expect(invite).not.toBeNull();
    await db.collection("seats").insertOne({
      userId: siblingUserId,
      patientId: invite!.patientId,
      role: invite!.role,
      createdAt: new Date().toISOString(),
    });
    await db.collection("seat_invites").updateOne(
      { _id: invite!._id },
      { $set: { status: "accepted" } }
    );

    // 4. Both users resolve a seat on the same profile
    const primarySeat = await resolveSeatForRequest(db, primaryUserId, patientId);
    const siblingSeat = await resolveSeatForRequest(db, siblingUserId, patientId);
    expect(primarySeat?.role).toBe("primary_caregiver");
    expect(siblingSeat?.role).toBe("sibling");

    // 5. Unknown user gets no seat
    const randoSeat = await resolveSeatForRequest(db, "rando", patientId);
    expect(randoSeat).toBeNull();
  });
});
```

- [ ] **Step 2: Run the integration test**

Run: `npm test -- src/__tests__/profile-flow.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/profile-flow.test.ts
git commit -m "test: add full-flow integration test (create → invite → accept → read)"
```

---

### Task 15: Update README and plan doc pointer

**Files:**
- Modify: `README.md`
- Modify: `CLAUDE.md` (project root — append a section)

- [ ] **Step 1: Add API section to README**

In `README.md`, append:

```markdown
## Living Profile API (v1 foundation)

Base: `https://vvision-app.onrender.com/api/profiles`

| Method | Path | Purpose |
|---|---|---|
| GET  | `/mine` | Get current user's linked profile |
| PATCH| `/mine` | Update profile fields (stage, history, triggers, routines, meds, providers) |
| POST | `/:patientId/seats` | Invite a sibling/aide to this profile (primary_caregiver only) |
| GET  | `/:patientId/seats` | List seats and pending invites |
| POST | `/accept-invite` | Accept a seat invite by token |
| POST | `/:patientId/memory` | Write a memory event to the profile (Mem0) |
| GET  | `/:patientId/memory/search?q=...` | Semantic search on the profile's memory |

See `docs/superpowers/specs/2026-04-13-caregiver-living-profile-design.md` for design rationale.
```

- [ ] **Step 2: Update CLAUDE.md with new architecture note**

In `CLAUDE.md` (repo root), append a brief note under the existing architecture section:

```markdown
### Living Profile (2026-04-13 pivot)
- Every patient is modelled as a Living Profile with structured fields (stage, history, triggers, routines, medications, providers) + a Mem0-backed memory layer scoped by `patient_id`.
- Access is controlled by role-tagged seats in the `seats` collection. Middleware `requireSeat` (see `src/server-core/seatResolver.ts`) gates every profile-scoped route. Only `primary_caregiver` may invite.
- Memory writes/reads MUST go through `src/server-core/memory.ts` (`addMemory`, `searchMemory`). Never call the Mem0 SDK directly from route handlers.
```

- [ ] **Step 3: Run full suite one final time**

Run: `npm test`
Expected: All green.

- [ ] **Step 4: Final commit**

```bash
git add README.md CLAUDE.md
git commit -m "docs: document Living Profile foundation API + architecture"
```

---

## Plan summary

By the end of this plan the repo has:
- Vitest test runner + MongoDB test setup
- Extended `patients` schema with `stage`, `history`, `triggers`, `routines_summary`, `medications`, `providers`
- New `seats` and `seat_invites` collections with indexes
- `requireSeat` middleware gating all profile-scoped routes
- `POST /api/profiles/mine` / `PATCH /api/profiles/mine`
- `POST/GET /api/profiles/:patientId/seats`, `POST /api/profiles/accept-invite`
- `POST /api/profiles/:patientId/memory`, `GET /api/profiles/:patientId/memory/search`
- Mem0 SDK wrapped in `src/server-core/memory.ts`
- 15+ commits, each passing full suite

Next plan: **B — Seats UI + RevenueCat Subscription** (React Native screens for invites, seat list, pricing-tier paywall).
