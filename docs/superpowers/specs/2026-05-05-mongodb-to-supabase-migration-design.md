# MongoDB → Supabase Migration Design

**Date:** 2026-05-05
**Scope:** Both repos — VVision-App (Node.js/Express) and VelaVision (Python glasses)
**Goal:** Replace MongoDB Atlas + Render hosting with Supabase (DB + Edge Functions + Storage). Everything in one place, one dashboard, one bill.

---

## Architecture

```
React Native App   ──→  Supabase Edge Functions  ──→  Supabase PostgreSQL
VelaVision Glasses ──→  Supabase Edge Functions  ──→  Supabase PostgreSQL
```

All data access goes through Edge Functions. Neither the app nor the glasses ever touch the database directly — only an API token is exposed on client devices.

**What Supabase replaces:**
- MongoDB Atlas → Supabase PostgreSQL + pgvector
- Render Express server → Supabase Edge Functions (Deno/TypeScript)
- Render local `uploads/` → Supabase Storage
- MongoDB TTL indexes → pg_cron cleanup jobs
- Node-cron scheduled jobs → pg_cron + scheduled Edge Functions

**What stays the same:**
- Supabase Auth (already in use — no changes)
- React Native app fetch calls in `src/api/client.ts` (paths unchanged, only `apiBaseUrl` changes)
- All business logic and validation (Zod, auth middleware, seat resolver)
- Groq, Mem0, ElevenLabs, Daily.co, RevenueCat integrations (external APIs unchanged)

**App config change:** `apiBaseUrl` in `app.json` switches from `https://vvision-app.onrender.com` to `https://<project>.supabase.co/functions/v1`.

**Glasses config change:** `DVISION_RENDER_API_URL` env var points to the same Supabase URL.

---

## Database Schema

19 MongoDB collections → 24 PostgreSQL tables. All IDs are `uuid` (replacing MongoDB ObjectId). pgvector extension required for face embeddings.

### Auth & Users

```sql
users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supabase_uid text UNIQUE NOT NULL,
  role text NOT NULL CHECK (role IN ('patient', 'caregiver')),
  patient_id uuid REFERENCES patients(id),
  link_code text,
  created_at timestamptz DEFAULT now()
)

patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_code text UNIQUE NOT NULL,
  name text,
  stage text,
  history text,
  triggers text,
  created_at timestamptz DEFAULT now()
)

device_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES patients(id) NOT NULL,
  device_code text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
)

seats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) NOT NULL,
  patient_id uuid REFERENCES patients(id) NOT NULL,
  role text DEFAULT 'caregiver',
  UNIQUE (user_id, patient_id)
)

seat_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  patient_id uuid REFERENCES patients(id) NOT NULL,
  token text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (email, patient_id)
)
```

### Patient Care

```sql
routines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES patients(id) NOT NULL,
  label text NOT NULL,
  time text,
  notes text,
  completed_dates text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
)

medications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES patients(id) NOT NULL,
  name text NOT NULL,
  dosage text,
  time text,
  taken_dates text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
)

reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES patients(id) NOT NULL,
  text text NOT NULL,
  time text,
  completed_date text,
  created_at timestamptz DEFAULT now()
)

help_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES patients(id) NOT NULL,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
)
```

### Face Recognition

```sql
-- Requires: CREATE EXTENSION IF NOT EXISTS vector;
people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES patients(id),
  name text NOT NULL,
  relation text DEFAULT '',
  embedding vector(512),
  last_seen text,
  seen_count int DEFAULT 0,
  notes text DEFAULT '',
  notes_private bool DEFAULT false,
  embedding_version int DEFAULT 1,
  is_patient bool DEFAULT false,
  created_at timestamptz DEFAULT now()
)

-- Extracted from people.interactions subdoc arrays
interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid REFERENCES people(id) ON DELETE CASCADE NOT NULL,
  summary text,
  category text DEFAULT 'visit',
  timestamp text,
  created_at timestamptz DEFAULT now()
)

alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES patients(id),
  type text DEFAULT 'unknown_face',
  confidence float,
  crop_path text,
  embedding vector(512),
  embedding_version int,
  timestamp timestamptz DEFAULT now()
)
```

**pgvector similarity search** replaces the in-memory matrix matching in `mongo_database.py`. The glasses recognition lookup becomes:
```sql
SELECT *, 1 - (embedding <=> $query_vector) AS similarity
FROM people
ORDER BY embedding <=> $query_vector
LIMIT 1;
```

### Health & Sensors

```sql
patient_health_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES patients(id) NOT NULL,
  metric text NOT NULL,
  date text NOT NULL,
  value float NOT NULL,
  unit text,
  recorded_at timestamptz,   -- HR samples only
  source text DEFAULT 'healthkit',
  synced_at timestamptz DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (patient_id, metric, date, recorded_at)
)

profile_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES patients(id) NOT NULL,
  kind text NOT NULL,
  payload jsonb DEFAULT '{}',
  captured_at timestamptz DEFAULT now()
)

stage_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES patients(id) NOT NULL,
  device_code text,
  observed_stage text,
  signals jsonb DEFAULT '{}',
  observed_at timestamptz DEFAULT now()
)
```

### AI & Patterns

```sql
conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES patients(id) NOT NULL,
  role text NOT NULL,
  content text,
  created_at timestamptz DEFAULT now()
)

patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES patients(id) NOT NULL,
  title text NOT NULL,
  description text,
  confidence float,
  last_observed timestamptz,
  UNIQUE (patient_id, title)
)

checkin_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES patients(id) NOT NULL,
  source text,
  content text,
  created_at timestamptz DEFAULT now()
)
```

### Subscriptions & Onboarding

```sql
subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES patients(id) UNIQUE NOT NULL,
  tier text DEFAULT 'free',
  trial_active bool DEFAULT false,
  updated_at timestamptz DEFAULT now()
)

onboarding_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES patients(id) UNIQUE NOT NULL,
  steps jsonb DEFAULT '{}',
  completed_at timestamptz
)
```

### Comms, Livestream & Misc

```sql
stream_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES patients(id) NOT NULL,
  status text DEFAULT 'pending',
  room_url text,
  caregiver_token text,
  patient_token text,
  expires_at timestamptz DEFAULT now() + interval '2 hours',
  created_at timestamptz DEFAULT now()
)

push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) NOT NULL,
  token text NOT NULL,
  updated_at timestamptz DEFAULT now()
)

doctors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES patients(id) NOT NULL,
  name text,
  email text,
  created_at timestamptz DEFAULT now()
)

notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES patients(id) NOT NULL,
  author_id uuid REFERENCES users(id) NOT NULL,
  content text,
  pinned bool DEFAULT false,
  created_at timestamptz DEFAULT now()
)
```

### Scheduled Jobs (pg_cron)

```sql
-- Delete expired stream sessions (hourly)
SELECT cron.schedule('cleanup-stream-sessions', '0 * * * *',
  'DELETE FROM stream_sessions WHERE expires_at < now()');

-- Trigger pattern inference Edge Function (nightly 03:00 UTC)
SELECT cron.schedule('infer-patterns', '0 3 * * *',
  'SELECT net.http_post(url := ''https://<project>.supabase.co/functions/v1/ai/infer-patterns'', ...)');
```

### Storage Buckets

```
pdfs/        — doctor report PDFs (private, signed URLs for sharing)
face-crops/  — unknown face crops from glasses (private)
```

---

## Edge Functions Structure

28 Express route files → 12 Edge Functions. Each lives at `supabase/functions/<name>/index.ts`.

```
supabase/functions/
  auth/         ← auth.ts (user creation, role assignment)
  routines/     ← routines.ts + reminders.ts
  medications/  ← medications.ts
  health/       ← health.ts (sync, summary, trends)
  patients/     ← patients.ts + profiles.ts + caregiverProfiles.ts
  people/       ← people.ts (face DB CRUD)
  alerts/       ← alerts.ts + helpAlerts.ts
  care/         ← notes.ts + doctors.ts + visits.ts
  ai/           ← assistant.ts + memories.ts + conversations.ts + patterns.ts + checkin logs
  stream/       ← stream.ts + streamSessions.ts + live.ts
  device/       ← device.ts + onboarding.ts + subscription.ts + revenueCatWebhook.ts
  reports/      ← reports.ts + events.ts + stage observations
```

### Routing Pattern

Each function uses path + method routing internally — no framework needed:

```ts
import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js";

serve(async (req: Request) => {
  const url = new URL(req.url);
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Auth check (same logic as current Express middleware)
  const user = await verifyJwt(req, supabase);
  if (!user) return new Response("Unauthorized", { status: 401 });

  if (req.method === "GET" && url.pathname.endsWith("/routines")) {
    return handleList(req, supabase, user);
  }
  // ...
  return new Response("Not Found", { status: 404 });
});
```

### Special Cases

**`reports/`** — PDF generation (pdfkit via `npm:pdfkit`) can exceed the 2s CPU limit. Runs as a background Edge Function (Supabase `no-timeout` flag). `npm:nodemailer` handles email delivery as before.

**`ai/`** — Mem0 API calls can be slow. Same background mode. Groq calls (~1-2s) are fast enough for foreground.

**Shared helpers** — auth verification, `requireSeat`, `resolvePatientId`, Zod schemas live in `supabase/functions/_shared/` and are imported by each function.

---

## Data Migration

A one-time Node.js script (`scripts/migrate-to-supabase.ts`) runs immediately before cutover. Uses both the `mongodb` driver and `@supabase/supabase-js` simultaneously.

### Migration Order

Foreign key constraints require this sequence:

```
1. patients
2. users              (references patients)
3. people             (references patients)
4. interactions       (extracted from people.interactions[], references people)
5. device_links       (references patients)
6. seats              (references users + patients)
7. seat_invites       (references patients)
8. routines, medications, reminders, alerts, help_alerts,
   conversations, patterns, visits, profile_events,
   patient_health_readings, subscriptions, onboarding_progress,
   stage_observations, checkin_logs, push_tokens, doctors, notes
9. stream_sessions    — SKIP (2h TTL, not worth migrating)
```

### Key Transforms

**ObjectId → UUID:** The script builds an in-memory map of `mongoId → newUuid` for each collection before inserting. All cross-references (e.g. `patient_id` foreign keys) are remapped using this map before insert.

**Face embeddings:** `person.embedding` (plain float array) → pgvector format on insert. The Supabase JS client accepts a plain JS array for `vector` columns — no special transform needed beyond ensuring it's a flat number array.

**Interactions:** Iterate every person document, extract `person.interactions[]`, insert each as a row in the `interactions` table with `person_id` set to the new UUID.

**Health readings:** The `UNIQUE NULLS NOT DISTINCT` constraint handles both cumulative metrics (unique on `patient_id + metric + date`, `recorded_at` is null) and HR samples (unique on `patient_id + metric + recorded_at`, `date` is set). No special transform needed.

### Verification

After the script completes, row counts in Supabase are compared against MongoDB collection counts. Migration only proceeds to cutover if counts match.

---

## Glasses Python Migration

`mongo_database.py` (500 lines of pymongo) is replaced by `supabase_database.py` — the same public interface (`MongoFaceDatabase` class) but all methods become HTTP calls to Edge Functions instead of direct DB operations.

**Methods → Edge Function calls:**

| Method | Edge Function |
|---|---|
| `load()` | `GET /people` |
| `add_embedding()` | `POST /people` |
| `add_interaction()` | `POST /people/:id/interactions` |
| `update_notes()` | `PATCH /people/:id` |
| `lookup()` | Stays local — embeddings loaded into memory on `load()`, pgvector similarity search via `POST /people/lookup` |
| `log_unknown_sighting()` | `POST /alerts` |
| `get_device_link()` | `GET /device/link/:code` |
| `get_patient_profile()` | `GET /patients/:id/profile` |
| `write_stage_observation()` | `POST /reports/stage-observation` |

`stream_client.py` stays identical — only the base URL env var changes.

All other Python files that currently reference MongoDB collections directly (`activity_tracker.py`, `reminders.py`, `alert_bus.py`, etc.) are updated to call `supabase_database.py` methods instead.

---

## Phased Build Order

Current app stays live on Render throughout. No downtime until the final cutover step.

### Phase 1 — Supabase Foundation (~1 day)
- Create Supabase project
- Enable pgvector: `CREATE EXTENSION IF NOT EXISTS vector`
- Run SQL schema (all 24 tables, indexes, RLS policies)
- Create Storage buckets (`pdfs`, `face-crops`)
- Configure pg_cron jobs

### Phase 2 — Edge Functions (~2-3 days)
Migrate in this order (simplest → most complex):
```
routines → medications → reminders → health →
patients → alerts → care → device → onboarding →
subscription → stream → people → ai → reports
```
Each function is deployed and tested against the Supabase DB before moving to the next. App still points at Render during this phase.

### Phase 3 — Migration Script (~half day)
- Write `scripts/migrate-to-supabase.ts`
- Run against a test Supabase project first
- Verify all counts and foreign key integrity

### Phase 4 — Glasses Python Rewrite (~1 day)
- Write `src/dvision/supabase_database.py`
- Update all Python files that reference MongoDB
- Test end-to-end on the Pi against the Supabase Edge Functions

### Phase 5 — Cutover (~1 hour)
```
1. Run migration script (MongoDB → Supabase)
2. Verify row counts match
3. Update app.json apiBaseUrl → Supabase URL
4. Update glasses DVISION_RENDER_API_URL → Supabase URL
5. Monitor for 24 hours
6. Let Render service idle (keep for 1 week before deactivating)
7. Downgrade MongoDB Atlas to free tier, then cancel
```

---

## What Does Not Change

- Supabase Auth (already in use)
- All React Native screens and hooks
- `src/api/client.ts` fetch calls (paths identical)
- Groq, Mem0, ElevenLabs, Daily.co, RevenueCat API integrations
- Zod validation schemas
- Row-level business logic
- VelaVision glasses hardware and AI models
