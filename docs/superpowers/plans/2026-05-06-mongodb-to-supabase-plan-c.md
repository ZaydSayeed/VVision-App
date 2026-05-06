# MongoDB → Supabase Migration Script + Cutover Plan C

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Write a one-time migration script that reads every document from MongoDB Atlas and inserts it into Supabase PostgreSQL (with ObjectId → UUID remapping and foreign key ordering), verify counts match, then execute the final URL cutover for both the app and the glasses.

**Architecture:** A standalone Node.js/TypeScript script (`scripts/migrate-to-supabase.ts`) connects to both MongoDB and Supabase simultaneously. It migrates in FK dependency order, builds an in-memory `mongoId → uuid` map per collection, and remaps all cross-references before insert. Counts are verified after each collection. Cutover is a three-step env var flip.

**Tech Stack:** TypeScript, `mongodb` driver (already in `package.json`), `@supabase/supabase-js` (already in `package.json`), `tsx` (already installed for the server).

**Depends on:** Plan A (Edge Functions deployed to test Supabase project) and Plan B (glasses Python updated) must both be ready before cutover. The migration script itself can be written and dry-run independently.

**Run from:** `/Users/haadisiddiqui/projects/VVision-App`

---

## File Map

| Action | Path | Purpose |
|--------|------|---------|
| **Create** | `scripts/migrate-to-supabase.ts` | One-time migration script |
| **Create** | `scripts/verify-migration.ts` | Post-migration count verifier |
| **Modify** | `app.json` | Switch `apiBaseUrl` at cutover |
| **Modify** | `VelaVision/.env` | Switch `DVISION_RENDER_API_URL` at cutover |

---

## Task 1: Migration Script Scaffold + patients Collection

**Files:**
- Create: `scripts/migrate-to-supabase.ts`

- [ ] **Step 1: Write a failing test**

```bash
cd /Users/haadisiddiqui/projects/VVision-App
node -e "require('fs').existsSync('scripts/migrate-to-supabase.ts') && console.log('exists') || process.exit(1)" 2>&1 || echo "FAIL — file does not exist yet"
```

Expected: `FAIL — file does not exist yet`

- [ ] **Step 2: Create the script scaffold with patients migration**

Create `scripts/migrate-to-supabase.ts`:

```ts
/**
 * MongoDB → Supabase one-time migration script.
 *
 * Run:
 *   npx tsx scripts/migrate-to-supabase.ts [--dry-run]
 *
 * Env vars required (set in .env or export):
 *   MONGODB_URI           — source MongoDB Atlas connection string
 *   MONGODB_DB_NAME       — source database name (e.g. "dvision")
 *   SUPABASE_URL          — target Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY — target Supabase service role key (bypasses RLS)
 */

import { MongoClient, ObjectId } from "mongodb";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { config } from "dotenv";

config();

const DRY_RUN = process.argv.includes("--dry-run");

if (DRY_RUN) console.log("DRY RUN — no data will be written to Supabase.\n");

// ---------------------------------------------------------------------------
// Connections
// ---------------------------------------------------------------------------

const mongo = new MongoClient(process.env.MONGODB_URI!, { tls: true });
const supabase: SupabaseClient = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// ---------------------------------------------------------------------------
// ID maps: mongoId → uuid for each collection that other collections reference
// ---------------------------------------------------------------------------
const patientIdMap = new Map<string, string>();   // MongoDB _id → new uuid
const userIdMap = new Map<string, string>();
const personIdMap = new Map<string, string>();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function id(mongoId: ObjectId | string | undefined): string {
  return String(mongoId ?? "");
}

async function insertBatch<T>(
  table: string,
  rows: T[],
  label: string,
): Promise<number> {
  if (rows.length === 0) {
    console.log(`  ${label}: 0 rows — skipped`);
    return 0;
  }
  if (DRY_RUN) {
    console.log(`  [DRY RUN] ${label}: would insert ${rows.length} rows into ${table}`);
    return rows.length;
  }
  const BATCH = 500;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const { error } = await supabase.from(table).insert(chunk);
    if (error) throw new Error(`${label} batch ${i}: ${error.message}`);
    inserted += chunk.length;
  }
  console.log(`  ${label}: inserted ${inserted} rows`);
  return inserted;
}

// ---------------------------------------------------------------------------
// Per-collection migrators
// ---------------------------------------------------------------------------

async function migratePatients(db: ReturnType<MongoClient["db"]>): Promise<number> {
  const docs = await db.collection("patients").find().toArray();
  const rows = docs.map((d) => {
    const uuid = randomUUID();
    patientIdMap.set(id(d._id), uuid);
    return {
      id: uuid,
      link_code: d.link_code ?? randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase(),
      name: d.name ?? null,
      stage: d.stage ?? null,
      history: d.history ?? null,
      triggers: d.triggers ?? null,
      created_at: d.createdAt ?? d.created_at ?? new Date().toISOString(),
    };
  });
  return insertBatch("patients", rows, "patients");
}

async function migrateUsers(db: ReturnType<MongoClient["db"]>): Promise<number> {
  const docs = await db.collection("users").find().toArray();
  const rows: object[] = [];
  for (const d of docs) {
    const uuid = randomUUID();
    userIdMap.set(id(d._id), uuid);
    const patient_id = d.patient_id ? patientIdMap.get(id(d.patient_id)) ?? null : null;
    rows.push({
      id: uuid,
      supabase_uid: d.supabase_uid ?? d.supabaseUid ?? "",
      role: d.role ?? "caregiver",
      patient_id,
      link_code: d.link_code ?? d.linkCode ?? null,
      created_at: d.createdAt ?? d.created_at ?? new Date().toISOString(),
    });
  }
  return insertBatch("users", rows, "users");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("Connecting to MongoDB…");
  await mongo.connect();
  const db = mongo.db(process.env.MONGODB_DB_NAME ?? "dvision");
  console.log("Connected.\n");

  try {
    console.log("=== Phase 1: Core tables ===");
    await migratePatients(db);
    await migrateUsers(db);
    // Remaining collections migrated in Tasks 2–4
  } finally {
    await mongo.close();
    console.log("\nDone.");
  }
}

main().catch((err) => {
  console.error("MIGRATION FAILED:", err);
  process.exit(1);
});
```

- [ ] **Step 3: Dry-run the scaffold**

```bash
cd /Users/haadisiddiqui/projects/VVision-App
MONGODB_URI=$MONGODB_URI MONGODB_DB_NAME=dvision SUPABASE_URL=https://placeholder.supabase.co SUPABASE_SERVICE_ROLE_KEY=placeholder npx tsx scripts/migrate-to-supabase.ts --dry-run
```

Expected output (MongoDB connection will fail with placeholder — that's OK; verify syntax compiles):
```
Connecting to MongoDB…
```
Then either a connection error (expected with placeholder URI) or `Connected.` If it errors on the connect call, the script is syntactically correct.

Verify TypeScript compiles:
```bash
npx tsc scripts/migrate-to-supabase.ts --noEmit --skipLibCheck --module commonjs --target es2020 --esModuleInterop 2>&1 | head -20
```
Expected: no output (no type errors).

- [ ] **Step 4: Commit**

```bash
git add scripts/migrate-to-supabase.ts
git commit -m "feat(migrate): add migration script scaffold — patients + users"
```

---

## Task 2: Migrate people, interactions, device_links, seats, seat_invites

**Files:**
- Modify: `scripts/migrate-to-supabase.ts` (add migration functions + main() calls)

- [ ] **Step 1: Add migration functions**

Add these functions to `scripts/migrate-to-supabase.ts` before `main()`:

```ts
async function migratePeople(db: ReturnType<MongoClient["db"]>): Promise<number> {
  const docs = await db.collection("people").find().toArray();
  const rows: object[] = [];
  for (const d of docs) {
    const uuid = randomUUID();
    personIdMap.set(id(d._id), uuid);
    const patient_id = d.patient_id
      ? patientIdMap.get(id(d.patient_id)) ?? null
      : null;
    rows.push({
      id: uuid,
      patient_id,
      name: d.name,
      relation: d.relation ?? "",
      embedding: d.embedding ?? null,
      last_seen: d.last_seen ?? null,
      seen_count: d.seen_count ?? 0,
      notes: d.notes ?? "",
      notes_private: d.notes_private ?? false,
      embedding_version: d.embedding_version ?? 1,
      is_patient: d.is_patient ?? false,
      created_at: d.createdAt ?? new Date().toISOString(),
    });
  }
  return insertBatch("people", rows, "people");
}

async function migrateInteractions(db: ReturnType<MongoClient["db"]>): Promise<number> {
  const docs = await db.collection("people").find({}, { projection: { _id: 1, interactions: 1 } }).toArray();
  const rows: object[] = [];
  for (const d of docs) {
    const person_id = personIdMap.get(id(d._id));
    if (!person_id) continue;
    for (const ix of (d.interactions ?? [])) {
      rows.push({
        id: randomUUID(),
        person_id,
        summary: ix.summary ?? null,
        category: ix.category ?? "visit",
        timestamp: ix.timestamp ?? null,
        created_at: ix.timestamp ?? new Date().toISOString(),
      });
    }
  }
  return insertBatch("interactions", rows, "interactions");
}

async function migrateDeviceLinks(db: ReturnType<MongoClient["db"]>): Promise<number> {
  const docs = await db.collection("device_links").find().toArray();
  const rows: object[] = [];
  for (const d of docs) {
    const patient_id = d.patient_id ? patientIdMap.get(id(d.patient_id)) ?? null : null;
    if (!patient_id) {
      console.warn(`  device_links: no patient_id mapping for ${id(d._id)} — skipping`);
      continue;
    }
    rows.push({
      id: randomUUID(),
      patient_id,
      device_code: d.device_code,
      created_at: d.createdAt ?? new Date().toISOString(),
    });
  }
  return insertBatch("device_links", rows, "device_links");
}

async function migrateSeats(db: ReturnType<MongoClient["db"]>): Promise<number> {
  // seats.userId stores supabase_uid (text), not MongoDB _id — pass through directly.
  // seats.patientId is a MongoDB ObjectId → remap to new uuid.
  const docs = await db.collection("seats").find().toArray();
  const rows: object[] = [];
  const seen = new Set<string>(); // deduplicate (user_id, patient_id)
  for (const d of docs) {
    const patient_id = d.patientId ? patientIdMap.get(id(d.patientId)) ?? null : null;
    const user_id = d.userId; // already supabase_uid string
    if (!patient_id || !user_id) continue;
    const key = `${user_id}:${patient_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      id: randomUUID(),
      user_id,
      patient_id,
      role: d.role ?? "caregiver",
    });
  }
  return insertBatch("seats", rows, "seats");
}

async function migrateSeatInvites(db: ReturnType<MongoClient["db"]>): Promise<number> {
  const docs = await db.collection("seat_invites").find().toArray();
  const rows: object[] = [];
  for (const d of docs) {
    const patient_id = d.patientId ? patientIdMap.get(id(d.patientId)) ?? null : null;
    if (!patient_id) continue;
    rows.push({
      id: randomUUID(),
      email: d.email,
      patient_id,
      token: d.token,
      created_at: d.createdAt ?? new Date().toISOString(),
    });
  }
  return insertBatch("seat_invites", rows, "seat_invites");
}
```

- [ ] **Step 2: Add calls to main()**

Update the `main()` function body (replace the try block):

```ts
try {
  console.log("=== Phase 1: Core tables ===");
  await migratePatients(db);
  await migrateUsers(db);

  console.log("\n=== Phase 2: People + relations ===");
  await migratePeople(db);
  await migrateInteractions(db);
  await migrateDeviceLinks(db);
  await migrateSeats(db);
  await migrateSeatInvites(db);

  // Phase 3 migrators added in Task 3
  console.log("\n=== Migration complete (Phases 1-2) ===");
} finally {
  await mongo.close();
  console.log("\nDone.");
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc scripts/migrate-to-supabase.ts --noEmit --skipLibCheck --module commonjs --target es2020 --esModuleInterop 2>&1
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add scripts/migrate-to-supabase.ts
git commit -m "feat(migrate): add people, interactions, device_links, seats, seat_invites migration"
```

---

## Task 3: Migrate Patient Care + Health + AI Collections

**Files:**
- Modify: `scripts/migrate-to-supabase.ts`

- [ ] **Step 1: Add migration functions**

Add these functions before `main()`:

```ts
async function migrateSimple(
  db: ReturnType<MongoClient["db"]>,
  collection: string,
  table: string,
  transform: (d: Record<string, unknown>) => object | null,
): Promise<number> {
  const docs = await db.collection(collection).find().toArray() as Record<string, unknown>[];
  const rows: object[] = [];
  for (const d of docs) {
    const row = transform(d);
    if (row) rows.push(row);
  }
  return insertBatch(table, rows, `${collection} → ${table}`);
}

async function migrateRoutines(db: ReturnType<MongoClient["db"]>): Promise<number> {
  return migrateSimple(db, "routines", "routines", (d) => {
    const patient_id = d.patient_id ? patientIdMap.get(id(d.patient_id as string)) ?? null : null;
    if (!patient_id) return null;
    return {
      id: randomUUID(),
      patient_id,
      label: d.label ?? "",
      time: d.time ?? null,
      notes: d.notes ?? null,
      completed_date: d.completed_date ?? d.completedDate ?? null,
      created_at: d.createdAt ?? new Date().toISOString(),
    };
  });
}

async function migrateMedications(db: ReturnType<MongoClient["db"]>): Promise<number> {
  return migrateSimple(db, "medications", "medications", (d) => {
    const patient_id = d.patient_id ? patientIdMap.get(id(d.patient_id as string)) ?? null : null;
    if (!patient_id) return null;
    return {
      id: randomUUID(),
      patient_id,
      name: d.name ?? "",
      dosage: d.dosage ?? null,
      time: d.time ?? null,
      taken_date: d.taken_date ?? d.takenDate ?? null,
      created_at: d.createdAt ?? new Date().toISOString(),
    };
  });
}

async function migrateReminders(db: ReturnType<MongoClient["db"]>): Promise<number> {
  return migrateSimple(db, "reminders", "reminders", (d) => {
    const patient_id = d.patient_id ? patientIdMap.get(id(d.patient_id as string)) ?? null : null;
    if (!patient_id) return null;
    return {
      id: randomUUID(),
      patient_id,
      text: d.text ?? "",
      time: d.time ?? null,
      source: d.source ?? "app",
      completed_date: d.completed_date ?? d.completedDate ?? null,
      created_at: d.createdAt ?? new Date().toISOString(),
    };
  });
}

async function migrateHelpAlerts(db: ReturnType<MongoClient["db"]>): Promise<number> {
  return migrateSimple(db, "help_alerts", "help_alerts", (d) => {
    const patient_id = d.patient_id ? patientIdMap.get(id(d.patient_id as string)) ?? null : null;
    if (!patient_id) return null;
    return {
      id: randomUUID(),
      patient_id,
      status: d.status ?? "pending",
      created_at: d.createdAt ?? new Date().toISOString(),
    };
  });
}

async function migrateAlerts(db: ReturnType<MongoClient["db"]>): Promise<number> {
  return migrateSimple(db, "alerts", "alerts", (d) => {
    const patient_id = d.patient_id ? patientIdMap.get(id(d.patient_id as string)) ?? null : null;
    return {
      id: randomUUID(),
      patient_id,
      type: d.type ?? "unknown_face",
      confidence: d.confidence ?? null,
      crop_path: d.crop_path ?? null,
      embedding: d.embedding ?? null,
      embedding_version: d.embedding_version ?? null,
      timestamp: d.timestamp ?? new Date().toISOString(),
    };
  });
}

async function migrateConversations(db: ReturnType<MongoClient["db"]>): Promise<number> {
  return migrateSimple(db, "conversations", "conversations", (d) => {
    const patient_id = d.patient_id ? patientIdMap.get(id(d.patient_id as string)) ?? null : null;
    if (!patient_id) return null;
    return {
      id: randomUUID(),
      patient_id,
      role: d.role ?? "user",
      content: d.content ?? "",
      created_at: d.createdAt ?? d.created_at ?? new Date().toISOString(),
    };
  });
}

async function migratePatterns(db: ReturnType<MongoClient["db"]>): Promise<number> {
  return migrateSimple(db, "patterns", "patterns", (d) => {
    const patient_id = d.patientId ? patientIdMap.get(id(d.patientId as string)) ?? null : null;
    if (!patient_id) return null;
    return {
      id: randomUUID(),
      patient_id,
      title: d.title ?? "",
      description: d.description ?? null,
      confidence: d.confidence ?? null,
      last_observed: d.lastObserved ?? null,
    };
  });
}

async function migrateHealthReadings(db: ReturnType<MongoClient["db"]>): Promise<number> {
  const docs = await db.collection("patient_health_readings").find().toArray() as Record<string, unknown>[];
  const rows: object[] = [];
  const seen = new Set<string>(); // deduplicate by natural key

  for (const d of docs) {
    const patient_id = d.patientId ? patientIdMap.get(id(d.patientId as string)) ?? null : null;
    if (!patient_id) continue;

    const metric = d.metric as string;
    const date = d.date as string;
    const recorded_at = (d.recordedAt as string) ?? null;

    // Natural key for dedup
    const key = metric === "heart_rate"
      ? `${patient_id}:${metric}:${recorded_at}`
      : `${patient_id}:${metric}:${date}`;
    if (seen.has(key)) continue;
    seen.add(key);

    rows.push({
      id: randomUUID(),
      patient_id,
      metric,
      date: date ?? null,
      value: d.value ?? 0,
      unit: d.unit ?? null,
      recorded_at: recorded_at,
      source: d.source ?? "healthkit",
      synced_at: d.syncedAt ?? new Date().toISOString(),
    });
  }
  return insertBatch("patient_health_readings", rows, "patient_health_readings");
}

async function migrateProfileEvents(db: ReturnType<MongoClient["db"]>): Promise<number> {
  return migrateSimple(db, "profile_events", "profile_events", (d) => {
    const patient_id = d.patientId ? patientIdMap.get(id(d.patientId as string)) ?? null : null;
    if (!patient_id) return null;
    return {
      id: randomUUID(),
      patient_id,
      kind: d.kind ?? "unknown",
      payload: d.payload ?? {},
      captured_at: d.capturedAt ?? d.captured_at ?? new Date().toISOString(),
    };
  });
}

async function migrateSubscriptions(db: ReturnType<MongoClient["db"]>): Promise<number> {
  return migrateSimple(db, "subscriptions", "subscriptions", (d) => {
    const patient_id = d.patientId ? patientIdMap.get(id(d.patientId as string)) ?? null : null;
    if (!patient_id) return null;
    return {
      id: randomUUID(),
      patient_id,
      tier: d.tier ?? "free",
      trial_active: d.trialActive ?? false,
      updated_at: d.updatedAt ?? new Date().toISOString(),
    };
  });
}

async function migrateOnboarding(db: ReturnType<MongoClient["db"]>): Promise<number> {
  return migrateSimple(db, "onboarding_progress", "onboarding_progress", (d) => {
    const patient_id = d.patientId ? patientIdMap.get(id(d.patientId as string)) ?? null : null;
    if (!patient_id) return null;
    return {
      id: randomUUID(),
      patient_id,
      steps: d.steps ?? {},
      completed_at: d.completedAt ?? null,
    };
  });
}

async function migrateStageObservations(db: ReturnType<MongoClient["db"]>): Promise<number> {
  return migrateSimple(db, "stage_observations", "stage_observations", (d) => {
    const patient_id = d.patient_id ? patientIdMap.get(id(d.patient_id as string)) ?? null : null;
    if (!patient_id) return null;
    return {
      id: randomUUID(),
      patient_id,
      device_code: d.device_code ?? null,
      observed_stage: d.observed_stage ?? null,
      signals: d.signals ?? {},
      observed_at: d.observed_at ?? new Date().toISOString(),
    };
  });
}

async function migrateCheckinLogs(db: ReturnType<MongoClient["db"]>): Promise<number> {
  return migrateSimple(db, "checkin_logs", "checkin_logs", (d) => {
    const patient_id = d.patientId ? patientIdMap.get(id(d.patientId as string)) ?? null : null;
    if (!patient_id) return null;
    return {
      id: randomUUID(),
      patient_id,
      source: d.source ?? null,
      content: d.content ?? null,
      created_at: d.createdAt ?? new Date().toISOString(),
    };
  });
}

async function migrateDoctors(db: ReturnType<MongoClient["db"]>): Promise<number> {
  return migrateSimple(db, "doctors", "doctors", (d) => {
    const patient_id = d.patient_id ?? d.patientId;
    const mapped_patient_id = patient_id ? patientIdMap.get(id(patient_id as string)) ?? null : null;
    if (!mapped_patient_id) return null;
    return {
      id: randomUUID(),
      patient_id: mapped_patient_id,
      name: d.name ?? null,
      email: d.email ?? null,
      created_at: d.createdAt ?? new Date().toISOString(),
    };
  });
}

async function migrateNotes(db: ReturnType<MongoClient["db"]>): Promise<number> {
  // Collection is "caregiver_notes" — schema table is "caregiver_notes"
  // caregiverId stores supabase_uid (text), not MongoDB ObjectId
  return migrateSimple(db, "caregiver_notes", "caregiver_notes", (d) => {
    const patient_id = d.patientId ? patientIdMap.get(id(d.patientId as string)) ?? null : null;
    if (!patient_id) return null;
    return {
      id: randomUUID(),
      patient_id,
      caregiver_supabase_uid: d.caregiverId ?? "",
      content: d.content ?? "",
      pinned: d.pinned ?? false,
      created_at: d.createdAt ?? new Date().toISOString(),
    };
  });
}

async function migratePushTokens(db: ReturnType<MongoClient["db"]>): Promise<number> {
  // push_tokens reference user by supabase_uid in some implementations;
  // check the actual field name in MongoDB and remap if needed.
  return migrateSimple(db, "push_tokens", "push_tokens", (d) => {
    const user_id_mongo = d.userId ?? d.user_id;
    // Try to find the new UUID for this user via the userIdMap
    const user_id = user_id_mongo ? userIdMap.get(id(user_id_mongo as string)) ?? null : null;
    if (!user_id) return null;
    return {
      id: randomUUID(),
      user_id,
      token: d.token ?? "",
      updated_at: d.updatedAt ?? new Date().toISOString(),
    };
  });
}
```

- [ ] **Step 2: Update main() to call all Phase 3 migrators**

Replace the Phase 3 comment in `main()` with:

```ts
console.log("\n=== Phase 3: Patient care + health + AI ===");
await migrateRoutines(db);
await migrateMedications(db);
await migrateReminders(db);
await migrateHelpAlerts(db);
await migrateAlerts(db);
await migrateConversations(db);
await migratePatterns(db);
await migrateHealthReadings(db);
await migrateProfileEvents(db);
await migrateSubscriptions(db);
await migrateOnboarding(db);
await migrateStageObservations(db);
await migrateCheckinLogs(db);
await migrateDoctors(db);
await migrateNotes(db);
await migratePushTokens(db);

// stream_sessions — SKIP (2h TTL, not worth migrating)
console.log("  stream_sessions: SKIP (TTL data)");

console.log("\n=== Migration complete ===");
```

- [ ] **Step 3: Type-check**

```bash
npx tsc scripts/migrate-to-supabase.ts --noEmit --skipLibCheck --module commonjs --target es2020 --esModuleInterop 2>&1
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add scripts/migrate-to-supabase.ts
git commit -m "feat(migrate): add all remaining collection migrators"
```

---

## Task 4: Verification Script

**Files:**
- Create: `scripts/verify-migration.ts`

- [ ] **Step 1: Write failing test**

```bash
node -e "require('fs').existsSync('scripts/verify-migration.ts') && console.log('exists') || process.exit(1)" 2>&1 || echo "FAIL — file does not exist yet"
```

Expected: `FAIL — file does not exist yet`

- [ ] **Step 2: Create verify-migration.ts**

```ts
/**
 * Post-migration verification: compare row counts MongoDB ↔ Supabase.
 *
 * Run after migration:
 *   npx tsx scripts/verify-migration.ts
 */

import { MongoClient } from "mongodb";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config();

const mongo = new MongoClient(process.env.MONGODB_URI!, { tls: true });
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const MAPPINGS: Array<{ mongo: string; pg: string; note?: string }> = [
  { mongo: "patients",              pg: "patients" },
  { mongo: "users",                 pg: "users" },
  { mongo: "people",                pg: "people" },
  { mongo: "device_links",          pg: "device_links" },
  { mongo: "seats",                 pg: "seats" },
  { mongo: "seat_invites",          pg: "seat_invites" },
  { mongo: "routines",              pg: "routines" },
  { mongo: "medications",           pg: "medications" },
  { mongo: "reminders",             pg: "reminders" },
  { mongo: "help_alerts",           pg: "help_alerts" },
  { mongo: "alerts",                pg: "alerts" },
  { mongo: "conversations",         pg: "conversations" },
  { mongo: "patterns",              pg: "patterns" },
  { mongo: "patient_health_readings", pg: "patient_health_readings" },
  { mongo: "profile_events",        pg: "profile_events" },
  { mongo: "subscriptions",         pg: "subscriptions" },
  { mongo: "onboarding_progress",   pg: "onboarding_progress" },
  { mongo: "stage_observations",    pg: "stage_observations" },
  { mongo: "checkin_logs",          pg: "checkin_logs" },
  { mongo: "doctors",               pg: "doctors" },
  { mongo: "caregiver_notes",       pg: "caregiver_notes" },
  { mongo: "push_tokens",           pg: "push_tokens" },
];

async function main() {
  await mongo.connect();
  const db = mongo.db(process.env.MONGODB_DB_NAME ?? "dvision");

  let allMatch = true;
  console.log(`${"Collection".padEnd(28)} ${"MongoDB".padStart(8)} ${"Supabase".padStart(10)} ${"Status".padStart(8)}`);
  console.log("-".repeat(58));

  for (const { mongo: col, pg: table, note } of MAPPINGS) {
    let mongoCount = 0;
    let pgCount = 0;
    let status = "OK";

    try {
      mongoCount = await db.collection(col).countDocuments();
    } catch {
      mongoCount = -1;
    }

    try {
      const { count, error } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true });
      pgCount = error ? -1 : (count ?? 0);
    } catch {
      pgCount = -1;
    }

    // interactions: skip count check — extracted from people subdocs, always more rows
    if (table === "interactions") {
      console.log(`${"(interactions)".padEnd(28)} ${"n/a".padStart(8)} ${String(pgCount).padStart(10)} ${"SKIP".padStart(8)}`);
      continue;
    }

    if (mongoCount !== pgCount) {
      status = "MISMATCH";
      allMatch = false;
    }

    const label = note ? `${col} (${note})` : col;
    console.log(
      `${label.padEnd(28)} ${String(mongoCount).padStart(8)} ${String(pgCount).padStart(10)} ${status.padStart(8)}`
    );
  }

  console.log("-".repeat(58));
  if (allMatch) {
    console.log("\n✓ All counts match — migration verified.");
  } else {
    console.error("\n✗ Count mismatches found — DO NOT cut over.");
    process.exit(1);
  }

  await mongo.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 3: Type-check**

```bash
npx tsc scripts/verify-migration.ts --noEmit --skipLibCheck --module commonjs --target es2020 --esModuleInterop 2>&1
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add scripts/verify-migration.ts
git commit -m "feat(migrate): add post-migration count verification script"
```

---

## Task 5: Dry-Run Against Real MongoDB (Pre-Flight)

**Goal:** Run the migration script in dry-run mode against the real MongoDB and confirm it reads all collections without errors. No data is written to Supabase during this step.

- [ ] **Step 1: Add real credentials to .env.migration**

Create `/Users/haadisiddiqui/projects/VVision-App/.env.migration`:

```
MONGODB_URI=<real-mongodb-atlas-uri>
MONGODB_DB_NAME=<real-db-name>
SUPABASE_URL=https://<test-project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<test-service-role-key>
```

(Copy from the existing `.env` — do not commit this file.)

Add `.env.migration` to `.gitignore` if not already there.

- [ ] **Step 2: Run dry-run**

```bash
cd /Users/haadisiddiqui/projects/VVision-App
set -a && source .env.migration && set +a
npx tsx scripts/migrate-to-supabase.ts --dry-run
```

Expected output (counts will vary — zeros are fine, no errors is the goal):
```
DRY RUN — no data will be written to Supabase.

Connecting to MongoDB…
Connected.

=== Phase 1: Core tables ===
  patients: [DRY RUN] would insert N rows into patients
  users: [DRY RUN] would insert N rows into users

=== Phase 2: People + relations ===
  people: [DRY RUN] would insert N rows into people
  ...

=== Migration complete ===
Done.
```

Verify no `Error` lines appear. If any collection throws, check the field name mapping and fix before proceeding.

- [ ] **Step 3: Fix any field name mismatches found in dry-run**

Common issues to look for:
- `patient_id` vs `patientId` — some MongoDB documents use camelCase
- Missing `_id` on some documents (unusual but possible)
- Empty `link_code` on patients

Fix each by adding a fallback in the relevant transform function.

- [ ] **Step 4: Commit fixes**

```bash
git add scripts/migrate-to-supabase.ts
git commit -m "fix(migrate): correct field name mappings from dry-run inspection"
```

---

## Task 6: Full Migration Run Against Test Supabase

**Goal:** Run the real migration (no `--dry-run`) against the **test** Supabase project (not production) and verify counts match.

- [ ] **Step 1: Ensure Plan A Edge Functions are deployed to test project**

```bash
cd /Users/haadisiddiqui/projects/VVision-App
npx supabase functions list --project-ref <test-project-ref>
```

Expected: all 12 Edge Functions listed (auth, routines, medications, health, patients, people, alerts, care, ai, stream, device, reports).

- [ ] **Step 2: Apply SQL schema to test Supabase**

In the Supabase dashboard for the test project:
- Go to SQL Editor
- Paste and run `supabase/migrations/001_initial_schema.sql` (from Plan A Task 1)
- Verify no errors

Or via CLI:
```bash
npx supabase db push --project-ref <test-project-ref>
```

- [ ] **Step 3: Run the real migration**

```bash
cd /Users/haadisiddiqui/projects/VVision-App
set -a && source .env.migration && set +a
npx tsx scripts/migrate-to-supabase.ts
```

Expected: all collections inserted without errors, row counts logged.

- [ ] **Step 4: Run verification**

```bash
npx tsx scripts/verify-migration.ts
```

Expected:
```
✓ All counts match — migration verified.
```

If any MISMATCH rows appear: investigate that collection's transform function, fix, re-run migration for that collection only (can comment out others in main()), re-verify.

- [ ] **Step 5: Smoke-test the Edge Functions against migrated data**

```bash
# GET /api/routines for a migrated patient
curl -H "Authorization: Bearer <test-user-jwt>" \
  "https://<test-project>.supabase.co/functions/v1/routines/<migrated-patient-id>" | jq .

# GET /api/patients/mine
curl -H "Authorization: Bearer <test-user-jwt>" \
  "https://<test-project>.supabase.co/functions/v1/patients/mine" | jq .
```

Expected: JSON responses with real data matching what's in MongoDB.

---

## Task 7: Cutover

**Goal:** Point both the React Native app and the VelaVision glasses at the production Supabase project. Do this in a maintenance window (low-traffic time, e.g. 2 AM).

**Pre-flight checklist — do these before starting:**
- [ ] Plan A Edge Functions deployed to **production** Supabase project
- [ ] SQL schema applied to production Supabase
- [ ] pg_cron jobs configured in production Supabase
- [ ] Plan B Python code committed and deployed to the glasses
- [ ] Verify migration script passes on the test project (Task 6)

- [ ] **Step 1: Run migration on production Supabase**

Update `.env.migration` to point at production:
```
SUPABASE_URL=https://<prod-project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<prod-service-role-key>
```

```bash
set -a && source .env.migration && set +a
npx tsx scripts/migrate-to-supabase.ts
npx tsx scripts/verify-migration.ts
```

Only proceed if `✓ All counts match`.

- [ ] **Step 2: Update app.json (React Native app)**

Open `app.json`. Find:
```json
"apiBaseUrl": "https://vvision-app.onrender.com"
```

Replace with:
```json
"apiBaseUrl": "https://<prod-project>.supabase.co/functions/v1"
```

Rebuild the Expo app:
```bash
npx eas build --platform ios --profile production
npx eas build --platform android --profile production
```

Or for Expo Go / development client:
```bash
npx expo start --clear
```

- [ ] **Step 3: Update glasses env (VelaVision)**

On the Raspberry Pi, update `/Users/haadisiddiqui/projects/VelaVision/.env`:

```
SUPABASE_EDGE_URL=https://<prod-project>.supabase.co/functions/v1
DVISION_PATIENT_TOKEN=<prod-device-token>
DVISION_RENDER_API_URL=https://<prod-project>.supabase.co/functions/v1
```

Restart the glasses software:
```bash
bash /Users/haadisiddiqui/projects/VelaVision/run.sh
```

- [ ] **Step 4: Monitor for 24 hours**

Check in the Supabase dashboard:
- Edge Function logs: look for 4xx/5xx errors
- Database: verify new rows are appearing in routines, alerts, conversations
- Glasses: verify face recognition events appear in `alerts` table

- [ ] **Step 5: Wind down Render and MongoDB**

After 1 week of stable operation:
1. Set Render service to "Suspended" (keep for 1 week before deleting)
2. Downgrade MongoDB Atlas cluster to free tier (M0)
3. After 1 more week with no issues: delete the Render service and cancel MongoDB Atlas

- [ ] **Step 6: Commit the app.json change**

```bash
cd /Users/haadisiddiqui/projects/VVision-App
git add app.json
git commit -m "feat(cutover): switch apiBaseUrl to Supabase Edge Functions"
```
