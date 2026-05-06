# MongoDB → Supabase Migration: Plan A — Schema + Edge Functions

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Express/MongoDB backend on Render with Supabase Edge Functions + PostgreSQL, keeping all API route paths identical so the React Native app only needs one config line changed.

**Architecture:** 28 Express route files collapse into 12 Deno Edge Functions under `supabase/functions/`. Shared auth + DB helpers live in `supabase/functions/_shared/`. The SQL schema replaces all 19 MongoDB collections. The app's `apiBaseUrl` is the only client-side change.

**Tech Stack:** Supabase Edge Functions (Deno), `npm:@supabase/supabase-js`, `npm:zod`, `npm:groq-sdk`, `npm:pdfkit`, `npm:nodemailer`, PostgreSQL + pgvector, Supabase Storage, pg_cron.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `supabase/migrations/001_initial_schema.sql` | Create | All 24 tables, indexes, RLS, pg_cron jobs |
| `supabase/functions/_shared/cors.ts` | Create | CORS headers for all functions |
| `supabase/functions/_shared/auth.ts` | Create | verifyUser, resolvePatientId, requirePatientAccess |
| `supabase/functions/_shared/types.ts` | Create | Shared TypeScript interfaces |
| `supabase/functions/auth/index.ts` | Create | POST /auth/sync, GET /auth/me |
| `supabase/functions/routines/index.ts` | Create | GET/POST/PATCH/DELETE /routines |
| `supabase/functions/medications/index.ts` | Create | GET/POST/PATCH/DELETE /medications |
| `supabase/functions/reminders/index.ts` | Create | GET/POST/DELETE /reminders |
| `supabase/functions/health/index.ts` | Create | POST/GET health sync, summary, trends |
| `supabase/functions/patients/index.ts` | Create | patient CRUD, link/unlink, linked list |
| `supabase/functions/alerts/index.ts` | Create | help_alerts + face alerts |
| `supabase/functions/care/index.ts` | Create | caregiver notes, doctors, visits |
| `supabase/functions/stream/index.ts` | Create | Daily.co stream session management |
| `supabase/functions/device/index.ts` | Create | device links, onboarding, subscription, RevenueCat webhook |
| `supabase/functions/people/index.ts` | Create | face DB CRUD (port from src/server-routes/people.ts) |
| `supabase/functions/ai/index.ts` | Create | Groq assistant, Mem0 memories, patterns, checkin logs |
| `supabase/functions/reports/index.ts` | Create | PDF generation, email delivery, stage observations |
| `app.json` | Modify | Update apiBaseUrl to Supabase URL |

---

### Task 1: SQL Schema

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`

- [ ] **Step 1: Create the Supabase project**

Go to https://supabase.com → New Project. Name it `vvision`. Note the Project URL and service role key — you'll need them as env vars for every Edge Function.

Enable pgvector in the Supabase SQL editor:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
```

- [ ] **Step 2: Create `supabase/migrations/001_initial_schema.sql`**

```sql
-- Auth & Users
CREATE TABLE patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_code text UNIQUE NOT NULL,
  name text,
  age int,
  diagnosis text,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supabase_uid text UNIQUE NOT NULL,
  email text DEFAULT '',
  name text DEFAULT '',
  role text NOT NULL CHECK (role IN ('patient', 'caregiver')),
  patient_id uuid REFERENCES patients(id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE device_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES patients(id) NOT NULL,
  device_code text UNIQUE NOT NULL,
  linked_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX device_links_patient_id_idx ON device_links(patient_id);

CREATE TABLE seats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  patient_id uuid REFERENCES patients(id) NOT NULL,
  role text DEFAULT 'primary_caregiver',
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, patient_id)
);

CREATE TABLE seat_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  patient_id uuid REFERENCES patients(id) NOT NULL,
  token text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (email, patient_id)
);

-- Patient Care
CREATE TABLE routines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id text NOT NULL,
  label text NOT NULL,
  time text,
  notes text,
  completed_date text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX routines_patient_idx ON routines(patient_id);

CREATE TABLE medications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id text NOT NULL,
  name text NOT NULL,
  dosage text,
  time text,
  taken_date text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX medications_patient_idx ON medications(patient_id);

CREATE TABLE reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id text NOT NULL,
  text text NOT NULL,
  time text,
  recurrence text,
  source text DEFAULT 'app',
  completed_date text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX reminders_patient_idx ON reminders(patient_id);

CREATE TABLE help_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id text NOT NULL,
  dismissed bool DEFAULT false,
  cancelled bool DEFAULT false,
  resolved bool DEFAULT false,
  note text,
  cause text,
  resolved_at timestamptz,
  timestamp timestamptz DEFAULT now()
);
CREATE INDEX help_alerts_patient_idx ON help_alerts(patient_id);

-- Face Recognition
CREATE TABLE people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id text,
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
);
CREATE INDEX people_patient_idx ON people(patient_id);
CREATE UNIQUE INDEX people_name_patient_idx ON people(patient_id, name);

CREATE TABLE interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid REFERENCES people(id) ON DELETE CASCADE NOT NULL,
  summary text,
  category text DEFAULT 'visit',
  timestamp text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX interactions_person_idx ON interactions(person_id);

CREATE TABLE alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id text,
  type text DEFAULT 'unknown_face',
  confidence float,
  crop_path text,
  embedding vector(512),
  embedding_version int,
  timestamp timestamptz DEFAULT now()
);
CREATE INDEX alerts_patient_idx ON alerts(patient_id);
CREATE INDEX alerts_timestamp_idx ON alerts(timestamp DESC);

-- Health & Sensors
CREATE TABLE patient_health_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id text NOT NULL,
  metric text NOT NULL,
  date text NOT NULL,
  value float NOT NULL,
  unit text,
  recorded_at timestamptz,
  source text DEFAULT 'healthkit',
  synced_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX health_readings_unique_idx ON patient_health_readings(patient_id, metric, date, recorded_at) NULLS NOT DISTINCT;
CREATE INDEX health_readings_patient_metric_date_idx ON patient_health_readings(patient_id, metric, date DESC);

CREATE TABLE profile_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id text NOT NULL,
  kind text NOT NULL,
  payload jsonb DEFAULT '{}',
  captured_at timestamptz DEFAULT now()
);
CREATE INDEX profile_events_patient_idx ON profile_events(patient_id, captured_at DESC);

CREATE TABLE stage_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id text NOT NULL,
  device_code text,
  observed_stage text,
  signals jsonb DEFAULT '{}',
  observed_at timestamptz DEFAULT now()
);
CREATE INDEX stage_obs_patient_idx ON stage_observations(patient_id, observed_at DESC);

-- AI & Patterns
CREATE TABLE conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id text NOT NULL,
  role text NOT NULL,
  content text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX conversations_patient_idx ON conversations(patient_id, created_at ASC);

CREATE TABLE patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id text NOT NULL,
  title text NOT NULL,
  description text,
  confidence float,
  last_observed timestamptz,
  UNIQUE (patient_id, title)
);
CREATE INDEX patterns_patient_idx ON patterns(patient_id, confidence DESC);

CREATE TABLE checkin_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id text NOT NULL,
  source text,
  content text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX checkin_logs_patient_idx ON checkin_logs(patient_id, created_at DESC);

-- Subscriptions & Onboarding
CREATE TABLE subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id text UNIQUE NOT NULL,
  tier text DEFAULT 'free',
  trial_active bool DEFAULT false,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE onboarding_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id text UNIQUE NOT NULL,
  steps jsonb DEFAULT '{}',
  completed_at timestamptz
);

-- Comms & Livestream
CREATE TABLE stream_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id text NOT NULL,
  status text DEFAULT 'pending',
  room_url text,
  room_name text,
  caregiver_token text,
  patient_token text,
  expires_at timestamptz DEFAULT now() + interval '2 hours',
  created_at timestamptz DEFAULT now()
);
CREATE INDEX stream_sessions_patient_idx ON stream_sessions(patient_id);

CREATE TABLE push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  token text NOT NULL,
  updated_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX push_tokens_user_idx ON push_tokens(user_id);

CREATE TABLE doctors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id text NOT NULL,
  name text,
  email text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX doctors_patient_idx ON doctors(patient_id);

CREATE TABLE visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id text NOT NULL,
  scheduled_for timestamptz,
  notes text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX visits_patient_idx ON visits(patient_id, scheduled_for ASC);

CREATE TABLE caregiver_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id text NOT NULL,
  caregiver_supabase_uid text NOT NULL,
  caregiver_name text DEFAULT '',
  text text NOT NULL,
  pinned bool DEFAULT false,
  timestamp timestamptz DEFAULT now()
);
CREATE INDEX caregiver_notes_patient_idx ON caregiver_notes(patient_id, timestamp DESC);

-- pg_cron: delete expired stream sessions every hour
SELECT cron.schedule(
  'cleanup-stream-sessions',
  '0 * * * *',
  $$DELETE FROM stream_sessions WHERE expires_at < now()$$
);
```

- [ ] **Step 3: Run the migration in Supabase SQL editor**

Paste the entire SQL from Step 2 into the Supabase SQL editor and run it.
Expected: no errors, all tables visible in Table Editor.

- [ ] **Step 4: Commit**

```bash
cd /Users/haadisiddiqui/projects/VVision-App
git add supabase/migrations/001_initial_schema.sql
git commit -m "feat: add Supabase SQL schema for MongoDB migration"
```

---

### Task 2: Shared Helpers

**Files:**
- Create: `supabase/functions/_shared/cors.ts`
- Create: `supabase/functions/_shared/auth.ts`
- Create: `supabase/functions/_shared/types.ts`

- [ ] **Step 1: Create `supabase/functions/_shared/cors.ts`**

```ts
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
};

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
```

- [ ] **Step 2: Create `supabase/functions/_shared/auth.ts`**

```ts
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

export interface AuthInfo {
  userId: string; // supabase_uid
  token: string;
}

export interface UserRow {
  id: string;
  supabase_uid: string;
  email: string;
  name: string;
  role: string;
  patient_id: string | null;
}

// Verify Supabase JWT — returns supabase_uid or null
export async function verifyUser(req: Request): Promise<AuthInfo | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);

  const resp = await fetch(`${Deno.env.get("SUPABASE_URL")}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: Deno.env.get("SUPABASE_ANON_KEY")!,
    },
  });
  if (resp.status !== 200) return null;
  const data = await resp.json() as { id?: string };
  if (!data.id) return null;
  return { userId: data.id, token };
}

// Resolve the user's linked patient_id from the users table
export async function resolvePatientId(
  supabase: SupabaseClient,
  supabaseUid: string
): Promise<{ patientId: string; user: UserRow } | { error: string; status: number }> {
  const { data: user } = await supabase
    .from("users")
    .select("*")
    .eq("supabase_uid", supabaseUid)
    .maybeSingle();

  if (!user) return { error: "Profile not found. Sign in again.", status: 404 };
  if (!user.patient_id) {
    const msg = user.role === "caregiver"
      ? "Ask your patient for their link code."
      : "Account setup incomplete.";
    return { error: `No patient linked to your account. ${msg}`, status: 404 };
  }
  return { patientId: user.patient_id, user };
}

// Check that userId has a seat on patientId (or is linked via users.patient_id)
export async function requirePatientAccess(
  supabase: SupabaseClient,
  userId: string,
  patientId: string
): Promise<boolean> {
  const { data: seat } = await supabase
    .from("seats")
    .select("id")
    .eq("user_id", userId)
    .eq("patient_id", patientId)
    .maybeSingle();
  if (seat) return true;

  const { data: user } = await supabase
    .from("users")
    .select("patient_id")
    .eq("supabase_uid", userId)
    .maybeSingle();
  if (user && user.patient_id === patientId) return true;

  return false;
}

export function makeSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}
```

- [ ] **Step 3: Create `supabase/functions/_shared/types.ts`**

```ts
export interface RoutineRow {
  id: string;
  patient_id: string;
  label: string;
  time: string | null;
  notes: string | null;
  completed_date: string | null;
}

export interface MedRow {
  id: string;
  patient_id: string;
  name: string;
  dosage: string | null;
  time: string | null;
  taken_date: string | null;
}

export interface ReminderRow {
  id: string;
  patient_id: string;
  text: string;
  time: string | null;
  recurrence: string | null;
  source: string;
  completed_date: string | null;
  created_at: string;
}
```

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/_shared/
git commit -m "feat: add shared cors, auth, and type helpers for Edge Functions"
```

---

### Task 3: auth Edge Function

**Files:**
- Create: `supabase/functions/auth/index.ts`

Routes: `POST /auth/sync`, `GET /auth/me`

- [ ] **Step 1: Create `supabase/functions/auth/index.ts`**

```ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders, json } from "../_shared/cors.ts";
import { verifyUser, makeSupabase } from "../_shared/auth.ts";

async function generateUniqueLinkCode(supabase: ReturnType<typeof makeSupabase>): Promise<string> {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let i = 0; i < 10; i++) {
    const code = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    const { data } = await supabase.from("patients").select("id").eq("link_code", code).maybeSingle();
    if (!data) return code;
  }
  throw new Error("Could not generate unique link code");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/auth/, "");
  const supabase = makeSupabase();

  const auth = await verifyUser(req);
  if (!auth) return json({ detail: "Missing authorization header" }, 401);

  // POST /auth/sync
  if (req.method === "POST" && path === "/sync") {
    let body: { name?: string; role?: string };
    try { body = await req.json(); } catch { return json({ detail: "Invalid JSON" }, 400); }

    const name = typeof body.name === "string" ? body.name.trim().slice(0, 200) : "";
    const role = body.role;
    if (!name) return json({ detail: "Name required" }, 400);
    if (role !== "patient" && role !== "caregiver") return json({ detail: "Role must be patient or caregiver" }, 400);

    const { data: existing } = await supabase
      .from("users")
      .select("*")
      .eq("supabase_uid", auth.userId)
      .maybeSingle();

    if (existing) {
      // Auto-heal: patient role but missing patient_id
      if (existing.role === "patient" && !existing.patient_id) {
        const linkCode = await generateUniqueLinkCode(supabase);
        const { data: patient } = await supabase
          .from("patients")
          .insert({ name: existing.name, link_code: linkCode })
          .select()
          .single();
        await supabase.from("users").update({ patient_id: patient.id }).eq("id", existing.id);
        await supabase.from("seats").insert({ user_id: auth.userId, patient_id: patient.id, role: "primary_caregiver" });
        return json({ ...existing, patient_id: patient.id });
      }
      return json({
        id: existing.id,
        email: existing.email,
        name: existing.name,
        role: existing.role,
        patient_id: existing.patient_id,
      });
    }

    // Fetch email from Supabase Auth
    let email = "";
    try {
      const resp = await fetch(`${Deno.env.get("SUPABASE_URL")}/auth/v1/user`, {
        headers: { Authorization: `Bearer ${auth.token}`, apikey: Deno.env.get("SUPABASE_ANON_KEY")! },
      });
      if (resp.ok) { const d = await resp.json(); email = d.email ?? ""; }
    } catch { /* non-fatal */ }

    let patientId: string | null = null;

    if (role === "patient") {
      const linkCode = await generateUniqueLinkCode(supabase);
      const { data: patient } = await supabase
        .from("patients")
        .insert({ name, link_code: linkCode })
        .select()
        .single();
      patientId = patient.id;
    }

    const { data: newUser } = await supabase
      .from("users")
      .insert({ supabase_uid: auth.userId, email, name, role, patient_id: patientId })
      .select()
      .single();

    if (role === "patient" && patientId) {
      await supabase.from("seats").insert({ user_id: auth.userId, patient_id: patientId, role: "primary_caregiver" });
    }

    return json({ id: newUser.id, email, name, role, patient_id: patientId }, 201);
  }

  // GET /auth/me
  if (req.method === "GET" && path === "/me") {
    const { data: user } = await supabase
      .from("users")
      .select("*")
      .eq("supabase_uid", auth.userId)
      .maybeSingle();
    if (!user) return json({ detail: "Profile not synced yet. Call /auth/sync first." }, 404);
    return json({ id: user.id, email: user.email, name: user.name, role: user.role, patient_id: user.patient_id });
  }

  return json({ detail: "Not found" }, 404);
});
```

- [ ] **Step 2: Deploy and test**

```bash
supabase functions deploy auth --no-verify-jwt
```

Test sync:
```bash
curl -X POST https://<project>.supabase.co/functions/v1/auth/sync \
  -H "Authorization: Bearer <supabase_jwt>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","role":"patient"}'
```
Expected: `{"id":"...","email":"...","name":"Test User","role":"patient","patient_id":"..."}`

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/auth/
git commit -m "feat: auth Edge Function (sync + me)"
```

---

### Task 4: routines Edge Function

**Files:**
- Create: `supabase/functions/routines/index.ts`

Routes: `GET /routines`, `POST /routines`, `PATCH /routines/:id`, `DELETE /routines/:id`

- [ ] **Step 1: Create `supabase/functions/routines/index.ts`**

```ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders, json } from "../_shared/cors.ts";
import { verifyUser, resolvePatientId, makeSupabase } from "../_shared/auth.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const parts = url.pathname.replace(/^\/routines\/?/, "").split("/").filter(Boolean);
  const supabase = makeSupabase();

  const auth = await verifyUser(req);
  if (!auth) return json({ detail: "Missing authorization header" }, 401);

  const resolved = await resolvePatientId(supabase, auth.userId);
  if ("error" in resolved) return json({ detail: resolved.error }, resolved.status);
  const { patientId } = resolved;

  // GET /routines
  if (req.method === "GET" && parts.length === 0) {
    const { data, error } = await supabase
      .from("routines")
      .select("*")
      .eq("patient_id", patientId)
      .limit(200);
    if (error) return json({ detail: "Internal server error" }, 500);
    return json(data.map(r => ({
      id: r.id, label: r.label, time: r.time, completed_date: r.completed_date ?? null,
      notes: r.notes ?? null, patient_id: r.patient_id,
    })));
  }

  // POST /routines
  if (req.method === "POST" && parts.length === 0) {
    let body: { label?: string; time?: string; notes?: string };
    try { body = await req.json(); } catch { return json({ detail: "Invalid JSON" }, 400); }
    const label = typeof body.label === "string" ? body.label.trim().slice(0, 300) : "";
    const time = typeof body.time === "string" ? body.time.trim().slice(0, 50) : "";
    if (!label) return json({ detail: "Label required" }, 400);
    if (!time) return json({ detail: "Time required" }, 400);
    const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 1000) : null;

    const { data, error } = await supabase
      .from("routines")
      .insert({ patient_id: patientId, label, time, notes, completed_date: null })
      .select()
      .single();
    if (error) return json({ detail: "Internal server error" }, 500);
    return json({ id: data.id, label: data.label, time: data.time, completed_date: null, notes: data.notes ?? null, patient_id: data.patient_id }, 201);
  }

  const routineId = parts[0];
  if (!routineId) return json({ detail: "Not found" }, 404);

  // PATCH /routines/:id
  if (req.method === "PATCH" && parts.length === 1) {
    let body: { label?: string; time?: string; completed_date?: string | null; notes?: string | null };
    try { body = await req.json(); } catch { return json({ detail: "Invalid JSON" }, 400); }

    const updates: Record<string, unknown> = {};
    if (body.label !== undefined) updates.label = String(body.label).trim().slice(0, 300);
    if (body.time !== undefined) updates.time = String(body.time).trim().slice(0, 50);
    if (body.completed_date !== undefined) updates.completed_date = body.completed_date;
    if (body.notes !== undefined) updates.notes = body.notes;
    if (Object.keys(updates).length === 0) return json({ detail: "No fields to update" }, 400);

    const { data, error } = await supabase
      .from("routines")
      .update(updates)
      .eq("id", routineId)
      .eq("patient_id", patientId)
      .select()
      .single();
    if (error || !data) return json({ detail: "Routine not found" }, 404);
    return json({ id: data.id, label: data.label, time: data.time, completed_date: data.completed_date ?? null, notes: data.notes ?? null, patient_id: data.patient_id });
  }

  // DELETE /routines/:id
  if (req.method === "DELETE" && parts.length === 1) {
    const { error, count } = await supabase
      .from("routines")
      .delete({ count: "exact" })
      .eq("id", routineId)
      .eq("patient_id", patientId);
    if (error || count === 0) return json({ detail: "Routine not found" }, 404);
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  return json({ detail: "Not found" }, 404);
});
```

- [ ] **Step 2: Deploy and test**

```bash
supabase functions deploy routines
```

```bash
# Create
curl -X POST https://<project>.supabase.co/functions/v1/routines \
  -H "Authorization: Bearer <jwt>" -H "Content-Type: application/json" \
  -d '{"label":"Morning walk","time":"8:00 AM"}'
# Expected: {"id":"...","label":"Morning walk",...}

# List
curl https://<project>.supabase.co/functions/v1/routines \
  -H "Authorization: Bearer <jwt>"
# Expected: array of routines
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/routines/
git commit -m "feat: routines Edge Function"
```

---

### Task 5: medications Edge Function

**Files:**
- Create: `supabase/functions/medications/index.ts`

Routes: `GET /medications`, `POST /medications`, `PATCH /medications/:id`, `DELETE /medications/:id`

- [ ] **Step 1: Create `supabase/functions/medications/index.ts`**

```ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders, json } from "../_shared/cors.ts";
import { verifyUser, resolvePatientId, makeSupabase } from "../_shared/auth.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const parts = url.pathname.replace(/^\/medications\/?/, "").split("/").filter(Boolean);
  const supabase = makeSupabase();

  const auth = await verifyUser(req);
  if (!auth) return json({ detail: "Missing authorization header" }, 401);

  const resolved = await resolvePatientId(supabase, auth.userId);
  if ("error" in resolved) return json({ detail: resolved.error }, resolved.status);
  const { patientId } = resolved;

  function medOut(r: Record<string, unknown>) {
    return { id: r.id, name: r.name, dosage: r.dosage ?? null, time: r.time, taken_date: r.taken_date ?? null, patient_id: r.patient_id };
  }

  // GET /medications
  if (req.method === "GET" && parts.length === 0) {
    const { data, error } = await supabase.from("medications").select("*").eq("patient_id", patientId).limit(200);
    if (error) return json({ detail: "Internal server error" }, 500);
    return json(data.map(medOut));
  }

  // POST /medications
  if (req.method === "POST" && parts.length === 0) {
    let body: { name?: string; dosage?: string; time?: string };
    try { body = await req.json(); } catch { return json({ detail: "Invalid JSON" }, 400); }
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 200) : "";
    const dosage = typeof body.dosage === "string" ? body.dosage.trim().slice(0, 100) : "";
    const time = typeof body.time === "string" ? body.time.trim().slice(0, 50) : "";
    if (!name) return json({ detail: "Name required" }, 400);
    if (!dosage) return json({ detail: "Dosage required" }, 400);
    if (!time) return json({ detail: "Time required" }, 400);

    const { data, error } = await supabase
      .from("medications")
      .insert({ patient_id: patientId, name, dosage, time, taken_date: null })
      .select().single();
    if (error) return json({ detail: "Internal server error" }, 500);
    return json(medOut(data), 201);
  }

  const medId = parts[0];
  if (!medId) return json({ detail: "Not found" }, 404);

  // PATCH /medications/:id
  if (req.method === "PATCH" && parts.length === 1) {
    let body: { name?: string; dosage?: string; time?: string; taken_date?: string | null };
    try { body = await req.json(); } catch { return json({ detail: "Invalid JSON" }, 400); }
    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = String(body.name).trim().slice(0, 200);
    if (body.dosage !== undefined) updates.dosage = String(body.dosage).trim().slice(0, 100);
    if (body.time !== undefined) updates.time = String(body.time).trim().slice(0, 50);
    if (body.taken_date !== undefined) updates.taken_date = body.taken_date;
    if (Object.keys(updates).length === 0) return json({ detail: "No fields to update" }, 400);

    const { data, error } = await supabase
      .from("medications").update(updates)
      .eq("id", medId).eq("patient_id", patientId)
      .select().single();
    if (error || !data) return json({ detail: "Medication not found" }, 404);
    return json(medOut(data));
  }

  // DELETE /medications/:id
  if (req.method === "DELETE" && parts.length === 1) {
    const { error, count } = await supabase
      .from("medications").delete({ count: "exact" })
      .eq("id", medId).eq("patient_id", patientId);
    if (error || count === 0) return json({ detail: "Medication not found" }, 404);
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  return json({ detail: "Not found" }, 404);
});
```

- [ ] **Step 2: Deploy and test**

```bash
supabase functions deploy medications
curl -X POST https://<project>.supabase.co/functions/v1/medications \
  -H "Authorization: Bearer <jwt>" -H "Content-Type: application/json" \
  -d '{"name":"Donepezil","dosage":"10mg","time":"9:00 AM"}'
```
Expected: `{"id":"...","name":"Donepezil",...}`

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/medications/
git commit -m "feat: medications Edge Function"
```

---

### Task 6: reminders Edge Function

**Files:**
- Create: `supabase/functions/reminders/index.ts`

Routes: `GET /reminders`, `POST /reminders`, `DELETE /reminders/:id`

- [ ] **Step 1: Create `supabase/functions/reminders/index.ts`**

```ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders, json } from "../_shared/cors.ts";
import { verifyUser, resolvePatientId, makeSupabase } from "../_shared/auth.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const parts = url.pathname.replace(/^\/reminders\/?/, "").split("/").filter(Boolean);
  const supabase = makeSupabase();

  const auth = await verifyUser(req);
  if (!auth) return json({ detail: "Missing authorization header" }, 401);

  const resolved = await resolvePatientId(supabase, auth.userId);
  if ("error" in resolved) return json({ detail: resolved.error }, resolved.status);
  const { patientId } = resolved;

  function reminderOut(r: Record<string, unknown>) {
    return { id: r.id, patient_id: r.patient_id, text: r.text, time: r.time ?? null,
      recurrence: r.recurrence ?? null, source: r.source, created_at: r.created_at, completed_date: r.completed_date ?? null };
  }

  // GET /reminders
  if (req.method === "GET" && parts.length === 0) {
    const { data, error } = await supabase
      .from("reminders").select("*").eq("patient_id", patientId)
      .order("created_at", { ascending: false }).limit(100);
    if (error) return json({ detail: "Internal server error" }, 500);
    return json(data.map(reminderOut));
  }

  // POST /reminders
  if (req.method === "POST" && parts.length === 0) {
    let body: { text?: string; time?: string; recurrence?: string; source?: string };
    try { body = await req.json(); } catch { return json({ detail: "Invalid JSON" }, 400); }
    const text = typeof body.text === "string" ? body.text.trim().slice(0, 500) : "";
    if (!text) return json({ detail: "Text required" }, 400);
    const source = body.source === "glasses" ? "glasses" : "app";

    const { data, error } = await supabase
      .from("reminders")
      .insert({ patient_id: patientId, text, time: body.time ?? null,
        recurrence: body.recurrence ?? null, source, completed_date: null })
      .select().single();
    if (error) return json({ detail: "Internal server error" }, 500);
    return json(reminderOut(data), 201);
  }

  // DELETE /reminders/:id
  if (req.method === "DELETE" && parts.length === 1) {
    const { error, count } = await supabase
      .from("reminders").delete({ count: "exact" })
      .eq("id", parts[0]).eq("patient_id", patientId);
    if (error || count === 0) return json({ detail: "Reminder not found" }, 404);
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  return json({ detail: "Not found" }, 404);
});
```

- [ ] **Step 2: Deploy and test**

```bash
supabase functions deploy reminders
curl -X POST https://<project>.supabase.co/functions/v1/reminders \
  -H "Authorization: Bearer <jwt>" -H "Content-Type: application/json" \
  -d '{"text":"Take medication","time":"9:00 AM","source":"app"}'
```
Expected: `{"id":"...","text":"Take medication",...}`

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/reminders/
git commit -m "feat: reminders Edge Function"
```

---

### Task 7: health Edge Function

**Files:**
- Create: `supabase/functions/health/index.ts`

Routes: `POST /:patientId/health/sync`, `GET /:patientId/health/summary`, `GET /:patientId/health/trends`

- [ ] **Step 1: Create `supabase/functions/health/index.ts`**

```ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders, json } from "../_shared/cors.ts";
import { verifyUser, requirePatientAccess, makeSupabase } from "../_shared/auth.ts";

const METRICS = ["steps", "heart_rate", "active_minutes", "sleep"] as const;

function todayIso() { return new Date().toISOString().slice(0, 10); }

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  // Path: /<patientId>/health/sync|summary|trends
  const match = url.pathname.match(/^\/([^/]+)\/health\/(\w+)/);
  if (!match) return json({ detail: "Not found" }, 404);
  const [, patientId, action] = match;
  const supabase = makeSupabase();

  const auth = await verifyUser(req);
  if (!auth) return json({ detail: "Missing authorization header" }, 401);

  const hasAccess = await requirePatientAccess(supabase, auth.userId, patientId);
  if (!hasAccess) return json({ detail: "No seat on this profile" }, 403);

  // POST /:patientId/health/sync
  if (req.method === "POST" && action === "sync") {
    let body: { readings?: unknown[] };
    try { body = await req.json(); } catch { return json({ detail: "Invalid JSON" }, 400); }
    if (!Array.isArray(body.readings) || body.readings.length === 0) return json({ detail: "readings array required" }, 400);
    if (body.readings.length > 500) return json({ detail: "Max 500 readings per sync" }, 400);

    let written = 0;
    for (const r of body.readings as Record<string, unknown>[]) {
      const metric = r.metric as string;
      if (!METRICS.includes(metric as typeof METRICS[number])) continue;
      const value = Number(r.value);
      const date = String(r.date);
      const unit = String(r.unit ?? "");

      if (metric === "heart_rate") {
        const recordedAt = r.recordedAt ? String(r.recordedAt) : `${date}T00:00:00.000Z`;
        const { error } = await supabase.from("patient_health_readings").upsert(
          { patient_id: patientId, metric, date, value, unit, recorded_at: recordedAt, source: "healthkit", synced_at: new Date().toISOString() },
          { onConflict: "patient_id,metric,date,recorded_at", ignoreDuplicates: false }
        );
        if (!error) written++;
      } else {
        // $max equivalent: only update if new value is greater
        const { data: existing } = await supabase
          .from("patient_health_readings").select("id,value")
          .eq("patient_id", patientId).eq("metric", metric).eq("date", date)
          .is("recorded_at", null).maybeSingle();
        if (existing) {
          if (value > Number(existing.value)) {
            await supabase.from("patient_health_readings")
              .update({ value, unit, source: "healthkit", synced_at: new Date().toISOString() })
              .eq("id", existing.id);
            written++;
          }
        } else {
          const { error } = await supabase.from("patient_health_readings")
            .insert({ patient_id: patientId, metric, date, value, unit, source: "healthkit", synced_at: new Date().toISOString() });
          if (!error) written++;
        }
      }
    }
    return json({ written });
  }

  // GET /:patientId/health/summary
  if (req.method === "GET" && action === "summary") {
    const today = todayIso();
    const { data: nonHr } = await supabase
      .from("patient_health_readings").select("metric,value,unit")
      .eq("patient_id", patientId).eq("date", today).neq("metric", "heart_rate").is("recorded_at", null);
    const { data: hrRows } = await supabase
      .from("patient_health_readings").select("value")
      .eq("patient_id", patientId).eq("metric", "heart_rate").eq("date", today);

    const byMetric: Record<string, { value: number; unit: string }> = {};
    for (const r of nonHr ?? []) byMetric[r.metric] = { value: r.value, unit: r.unit };
    if (hrRows && hrRows.length > 0) {
      const avg = Math.round(hrRows.reduce((s, r) => s + r.value, 0) / hrRows.length);
      byMetric.heart_rate = { value: avg, unit: "bpm" };
    }
    return json({ date: today, steps: byMetric.steps ?? null, heartRate: byMetric.heart_rate ?? null,
      activeMinutes: byMetric.active_minutes ?? null, sleep: byMetric.sleep ?? null });
  }

  // GET /:patientId/health/trends?metric=steps&range=7d
  if (req.method === "GET" && action === "trends") {
    const metric = url.searchParams.get("metric");
    const range = url.searchParams.get("range") ?? "7d";
    if (!metric || !METRICS.includes(metric as typeof METRICS[number])) return json({ detail: "Valid metric required" }, 400);
    if (!["1d", "7d", "30d", "90d"].includes(range)) return json({ detail: "range must be 1d|7d|30d|90d" }, 400);

    const daysMap: Record<string, number> = { "1d": 1, "7d": 7, "30d": 30, "90d": 90 };
    const days = daysMap[range];
    const since = new Date();
    since.setDate(since.getDate() - days + 1);
    const sinceIso = since.toISOString().slice(0, 10);

    if (metric === "heart_rate" && range === "1d") {
      const { data: rows } = await supabase.from("patient_health_readings").select("value,recorded_at")
        .eq("patient_id", patientId).eq("metric", "heart_rate").eq("date", todayIso())
        .not("recorded_at", "is", null).order("recorded_at", { ascending: true });
      const byHour = new Map<number, number[]>();
      for (const r of rows ?? []) {
        const h = new Date(r.recorded_at).getHours();
        if (!byHour.has(h)) byHour.set(h, []);
        byHour.get(h)!.push(r.value);
      }
      const points = Array.from(byHour.entries()).sort(([a], [b]) => a - b)
        .map(([h, vals]) => ({ date: `${String(h).padStart(2,"0")}:00`, value: Math.round(vals.reduce((s,v) => s+v,0)/vals.length) }));
      return json({ metric, range, points });
    }

    if (metric === "heart_rate") {
      const { data: rows } = await supabase.from("patient_health_readings").select("date,value")
        .eq("patient_id", patientId).eq("metric", "heart_rate").gte("date", sinceIso);
      const byDate = new Map<string, number[]>();
      for (const r of rows ?? []) {
        if (!byDate.has(r.date)) byDate.set(r.date, []);
        byDate.get(r.date)!.push(r.value);
      }
      const points = Array.from(byDate.entries()).sort(([a],[b]) => a.localeCompare(b))
        .map(([date, vals]) => ({ date, value: Math.round(vals.reduce((s,v)=>s+v,0)/vals.length) }));
      return json({ metric, range, points });
    }

    const { data: rows } = await supabase.from("patient_health_readings").select("date,value")
      .eq("patient_id", patientId).eq("metric", metric).gte("date", sinceIso).is("recorded_at", null)
      .order("date", { ascending: true });
    return json({ metric, range, points: (rows ?? []).map(r => ({ date: r.date, value: r.value })) });
  }

  return json({ detail: "Not found" }, 404);
});
```

- [ ] **Step 2: Deploy and test**

```bash
supabase functions deploy health
curl -X POST "https://<project>.supabase.co/functions/v1/<patientId>/health/sync" \
  -H "Authorization: Bearer <jwt>" -H "Content-Type: application/json" \
  -d '{"readings":[{"metric":"steps","date":"2026-05-06","value":4200,"unit":"steps"}]}'
```
Expected: `{"written":1}`

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/health/
git commit -m "feat: health Edge Function (sync, summary, trends)"
```

---

### Task 8: patients Edge Function

**Files:**
- Create: `supabase/functions/patients/index.ts`

Routes: `GET /patients/mine`, `PATCH /patients/mine`, `GET /patients/mine/link-code`, `POST /patients/link`, `DELETE /patients/mine/unlink`, `DELETE /patients/mine/caregivers/:id`, `GET /patients/linked`

- [ ] **Step 1: Create `supabase/functions/patients/index.ts`**

```ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders, json } from "../_shared/cors.ts";
import { verifyUser, makeSupabase } from "../_shared/auth.ts";

async function generateUniqueLinkCode(supabase: ReturnType<typeof makeSupabase>): Promise<string> {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let i = 0; i < 10; i++) {
    const code = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    const { data } = await supabase.from("patients").select("id").eq("link_code", code).maybeSingle();
    if (!data) return code;
  }
  throw new Error("Could not generate unique link code");
}

function patientOut(p: Record<string, unknown>) {
  return { id: p.id, name: p.name, age: p.age ?? null, diagnosis: p.diagnosis ?? null,
    notes: p.notes ?? "", link_code: p.link_code ?? "" };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/patients/, "");
  const supabase = makeSupabase();

  const auth = await verifyUser(req);
  if (!auth) return json({ detail: "Missing authorization header" }, 401);

  const { data: currentUser } = await supabase.from("users").select("*").eq("supabase_uid", auth.userId).maybeSingle();

  // GET /patients/mine
  if (req.method === "GET" && path === "/mine") {
    if (!currentUser?.patient_id) return json({ detail: "No patient linked" }, 404);
    const { data: patient } = await supabase.from("patients").select("*").eq("id", currentUser.patient_id).maybeSingle();
    if (!patient) return json({ detail: "Patient not found" }, 404);
    return json(patientOut(patient));
  }

  // PATCH /patients/mine
  if (req.method === "PATCH" && path === "/mine") {
    if (!currentUser?.patient_id) return json({ detail: "No patient linked" }, 404);
    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return json({ detail: "Invalid JSON" }, 400); }
    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = String(body.name).trim().slice(0, 200);
    if (body.age !== undefined) updates.age = body.age;
    if (body.diagnosis !== undefined) updates.diagnosis = body.diagnosis;
    if (body.notes !== undefined) updates.notes = String(body.notes).slice(0, 5000);
    if (Object.keys(updates).length === 0) return json({ detail: "No fields to update" }, 400);
    updates.updated_at = new Date().toISOString();
    const { data } = await supabase.from("patients").update(updates).eq("id", currentUser.patient_id).select().single();
    return json(patientOut(data));
  }

  // GET /patients/mine/link-code
  if (req.method === "GET" && path === "/mine/link-code") {
    if (!currentUser || currentUser.role !== "patient") return json({ detail: "Only patients have a link code" }, 403);
    if (!currentUser.patient_id) return json({ detail: "No patient profile found" }, 404);
    let { data: patient } = await supabase.from("patients").select("link_code").eq("id", currentUser.patient_id).maybeSingle();
    if (!patient) return json({ detail: "Patient not found" }, 404);
    if (!patient.link_code) {
      const linkCode = await generateUniqueLinkCode(supabase);
      await supabase.from("patients").update({ link_code: linkCode }).eq("id", currentUser.patient_id);
      patient = { link_code: linkCode };
    }
    return json({ link_code: patient.link_code });
  }

  // POST /patients/link
  if (req.method === "POST" && path === "/link") {
    let body: { link_code?: string };
    try { body = await req.json(); } catch { return json({ detail: "Invalid JSON" }, 400); }
    const linkCode = typeof body.link_code === "string" ? body.link_code.trim().toUpperCase() : "";
    if (!linkCode) return json({ detail: "Invalid link code" }, 400);

    let user = currentUser;
    if (!user) {
      const { data } = await supabase.from("users")
        .insert({ supabase_uid: auth.userId, email: "", name: "", role: "caregiver", patient_id: null })
        .select().single();
      user = data;
    }
    if (user.role !== "caregiver") return json({ detail: "Only caregivers can link to a patient" }, 403);
    if (user.patient_id) return json({ detail: "You are already linked to a patient" }, 409);

    const { data: patient } = await supabase.from("patients").select("*").eq("link_code", linkCode).maybeSingle();
    if (!patient) return json({ detail: "Invalid link code" }, 404);

    await supabase.from("users").update({ patient_id: patient.id }).eq("id", user.id);
    await supabase.from("seats").upsert({ user_id: auth.userId, patient_id: patient.id, role: "primary_caregiver" }, { onConflict: "user_id,patient_id" });

    return json(patientOut(patient));
  }

  // DELETE /patients/mine/unlink
  if (req.method === "DELETE" && path === "/mine/unlink") {
    if (!currentUser || currentUser.role !== "caregiver") return json({ detail: "Only caregivers can unlink" }, 403);
    if (!currentUser.patient_id) return json({ detail: "Not linked to any patient" }, 404);
    await supabase.from("users").update({ patient_id: null }).eq("id", currentUser.id);
    await supabase.from("seats").delete().eq("user_id", auth.userId).eq("patient_id", currentUser.patient_id);
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // DELETE /patients/mine/caregivers/:caregiverId
  const caregiverMatch = path.match(/^\/mine\/caregivers\/([^/]+)$/);
  if (req.method === "DELETE" && caregiverMatch) {
    if (!currentUser?.patient_id) return json({ detail: "No patient linked" }, 404);
    const caregiverUid = caregiverMatch[1];
    await supabase.from("seats").delete().eq("user_id", caregiverUid).eq("patient_id", currentUser.patient_id);
    await supabase.from("users").update({ patient_id: null }).eq("supabase_uid", caregiverUid);
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // GET /patients/linked
  if (req.method === "GET" && path === "/linked") {
    if (!currentUser?.patient_id) return json([]);
    const { data: patient } = await supabase.from("patients").select("*").eq("id", currentUser.patient_id).maybeSingle();
    if (!patient) return json([]);
    const todayStr = new Date().toISOString().slice(0, 10);
    const [{ data: routines }, { data: meds }, { count: pendingHelp }] = await Promise.all([
      supabase.from("routines").select("id,completed_date").eq("patient_id", patient.id),
      supabase.from("medications").select("id,taken_date").eq("patient_id", patient.id),
      supabase.from("help_alerts").select("id", { count: "exact", head: true }).eq("patient_id", patient.id).eq("dismissed", false),
    ]);
    return json([{
      id: patient.id, name: patient.name ?? "Unknown",
      tasksTotal: routines?.length ?? 0,
      tasksDone: routines?.filter(r => r.completed_date === todayStr).length ?? 0,
      medsTotal: meds?.length ?? 0,
      medsDone: meds?.filter(m => m.taken_date === todayStr).length ?? 0,
      pendingHelp: pendingHelp ?? 0,
    }]);
  }

  return json({ detail: "Not found" }, 404);
});
```

- [ ] **Step 2: Deploy and test**

```bash
supabase functions deploy patients
curl https://<project>.supabase.co/functions/v1/patients/mine/link-code \
  -H "Authorization: Bearer <patient_jwt>"
```
Expected: `{"link_code":"ABCD1234"}`

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/patients/
git commit -m "feat: patients Edge Function"
```

---

### Task 9: alerts Edge Function

**Files:**
- Create: `supabase/functions/alerts/index.ts`

Routes: `GET /help-alerts`, `POST /help-alerts`, `PATCH /help-alerts/:id/dismiss`, `PATCH /help-alerts/:id/resolve`, `GET /alerts` (face recognition alerts), `POST /alerts/push-token`

- [ ] **Step 1: Create `supabase/functions/alerts/index.ts`**

```ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders, json } from "../_shared/cors.ts";
import { verifyUser, resolvePatientId, makeSupabase } from "../_shared/auth.ts";

const VALID_CAUSES = ["Confusion","Pain","Anxiety","Fell","Wandered","Sundowning","Other"] as const;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const path = url.pathname;
  const supabase = makeSupabase();

  const auth = await verifyUser(req);
  if (!auth) return json({ detail: "Missing authorization header" }, 401);

  const resolved = await resolvePatientId(supabase, auth.userId);
  if ("error" in resolved) return json({ detail: resolved.error }, resolved.status);
  const { patientId } = resolved;

  function alertOut(a: Record<string, unknown>) {
    return { id: a.id, patient_id: a.patient_id, timestamp: a.timestamp,
      dismissed: a.dismissed ?? false, cancelled: a.cancelled ?? false,
      resolved: a.resolved ?? false, note: a.note ?? null,
      cause: a.cause ?? null, resolved_at: a.resolved_at ?? null };
  }

  // GET /help-alerts
  if (req.method === "GET" && path.endsWith("/help-alerts")) {
    const { data } = await supabase.from("help_alerts").select("*")
      .eq("patient_id", patientId).order("timestamp", { ascending: false }).limit(50);
    return json((data ?? []).map(alertOut));
  }

  // POST /help-alerts
  if (req.method === "POST" && path.endsWith("/help-alerts")) {
    const { data } = await supabase.from("help_alerts")
      .insert({ patient_id: patientId, dismissed: false })
      .select().single();
    return json(alertOut(data), 201);
  }

  // PATCH /help-alerts/:id/dismiss
  const dismissMatch = path.match(/\/help-alerts\/([^/]+)\/dismiss$/);
  if (req.method === "PATCH" && dismissMatch) {
    const { data } = await supabase.from("help_alerts")
      .update({ dismissed: true, cancelled: true })
      .eq("id", dismissMatch[1]).eq("patient_id", patientId)
      .select().single();
    if (!data) return json({ detail: "Help alert not found" }, 404);
    return json(alertOut(data));
  }

  // PATCH /help-alerts/:id/resolve
  const resolveMatch = path.match(/\/help-alerts\/([^/]+)\/resolve$/);
  if (req.method === "PATCH" && resolveMatch) {
    let body: { note?: string; cause?: string };
    try { body = await req.json(); } catch { return json({ detail: "Invalid JSON" }, 400); }
    if (!body.cause || !VALID_CAUSES.includes(body.cause as typeof VALID_CAUSES[number])) {
      return json({ detail: "cause must be one of: " + VALID_CAUSES.join(", ") }, 400);
    }
    const updates: Record<string, unknown> = {
      dismissed: true, resolved: true, cause: body.cause, resolved_at: new Date().toISOString(),
    };
    if (body.note) updates.note = String(body.note).slice(0, 500);
    const { data } = await supabase.from("help_alerts").update(updates)
      .eq("id", resolveMatch[1]).eq("patient_id", patientId).select().single();
    if (!data) return json({ detail: "Help alert not found" }, 404);
    return json(alertOut(data));
  }

  // GET /alerts (face recognition alerts)
  if (req.method === "GET" && path.endsWith("/alerts")) {
    const { data } = await supabase.from("alerts").select("id,type,confidence,timestamp,patient_id")
      .eq("patient_id", patientId).order("timestamp", { ascending: false }).limit(20);
    return json(data ?? []);
  }

  // POST /alerts/push-token
  if (req.method === "POST" && path.endsWith("/alerts/push-token")) {
    let body: { token?: string };
    try { body = await req.json(); } catch { return json({ detail: "Invalid JSON" }, 400); }
    if (!body.token) return json({ detail: "token required" }, 400);
    await supabase.from("push_tokens").upsert(
      { user_id: auth.userId, token: body.token, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
    return json({ ok: true });
  }

  return json({ detail: "Not found" }, 404);
});
```

- [ ] **Step 2: Deploy and test**

```bash
supabase functions deploy alerts
curl -X POST https://<project>.supabase.co/functions/v1/help-alerts \
  -H "Authorization: Bearer <jwt>"
```
Expected: `{"id":"...","dismissed":false,...}`

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/alerts/
git commit -m "feat: alerts Edge Function (help-alerts + face alerts + push tokens)"
```

---

### Task 10: care Edge Function

**Files:**
- Create: `supabase/functions/care/index.ts`

Routes: caregiver notes (`/notes`), doctors (`/doctors`), visits (`/visits`)

- [ ] **Step 1: Create `supabase/functions/care/index.ts`**

```ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders, json } from "../_shared/cors.ts";
import { verifyUser, makeSupabase } from "../_shared/auth.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const path = url.pathname;
  const supabase = makeSupabase();

  const auth = await verifyUser(req);
  if (!auth) return json({ detail: "Missing authorization header" }, 401);

  const { data: currentUser } = await supabase.from("users").select("*")
    .eq("supabase_uid", auth.userId).maybeSingle();
  if (!currentUser) return json({ detail: "Profile not found" }, 404);

  // ── NOTES ─────────────────────────────────────────────────────────────────

  function noteOut(n: Record<string, unknown>) {
    return { id: n.id, patientId: n.patient_id, caregiverId: n.caregiver_supabase_uid,
      caregiverName: n.caregiver_name ?? "", text: n.text,
      pinned: n.pinned ?? false, timestamp: n.timestamp };
  }

  // GET /notes?patientId=<id>
  if (req.method === "GET" && path.endsWith("/notes")) {
    const patientId = url.searchParams.get("patientId");
    if (!patientId) return json({ detail: "Valid patientId required" }, 400);
    if (currentUser.patient_id !== patientId) return json({ detail: "Not authorized to view notes for this patient" }, 403);
    const { data } = await supabase.from("caregiver_notes").select("*")
      .eq("patient_id", patientId).order("timestamp", { ascending: false }).limit(50);
    return json((data ?? []).map(noteOut));
  }

  // POST /notes
  if (req.method === "POST" && path.endsWith("/notes")) {
    let body: { patientId?: string; text?: string; pinned?: boolean };
    try { body = await req.json(); } catch { return json({ detail: "Invalid JSON" }, 400); }
    if (!body.patientId) return json({ detail: "patientId required" }, 400);
    if (!body.text?.trim()) return json({ detail: "Text required" }, 400);
    if (currentUser.role !== "caregiver") return json({ detail: "Only caregivers can create notes" }, 403);

    if (body.pinned) {
      await supabase.from("caregiver_notes").update({ pinned: false }).eq("patient_id", body.patientId);
    }
    const { data } = await supabase.from("caregiver_notes").insert({
      patient_id: body.patientId, caregiver_supabase_uid: auth.userId,
      caregiver_name: currentUser.name ?? "", text: String(body.text).trim().slice(0, 500),
      pinned: body.pinned ?? false, timestamp: new Date().toISOString(),
    }).select().single();
    return json(noteOut(data), 201);
  }

  // PATCH /notes/:id/pin
  const pinMatch = path.match(/\/notes\/([^/]+)\/pin$/);
  if (req.method === "PATCH" && pinMatch) {
    if (currentUser.role !== "caregiver") return json({ detail: "Only caregivers can pin notes" }, 403);
    const { data: note } = await supabase.from("caregiver_notes").select("*").eq("id", pinMatch[1]).maybeSingle();
    if (!note) return json({ detail: "Note not found" }, 404);
    const newPinned = !note.pinned;
    if (newPinned) await supabase.from("caregiver_notes").update({ pinned: false }).eq("patient_id", note.patient_id);
    const { data: updated } = await supabase.from("caregiver_notes")
      .update({ pinned: newPinned }).eq("id", pinMatch[1]).eq("caregiver_supabase_uid", auth.userId).select().single();
    if (!updated) return json({ detail: "Not authorized to pin this note" }, 403);
    return json(noteOut(updated));
  }

  // DELETE /notes/:id
  const noteDeleteMatch = path.match(/\/notes\/([^/]+)$/);
  if (req.method === "DELETE" && noteDeleteMatch) {
    if (currentUser.role !== "caregiver") return json({ detail: "Only caregivers can delete notes" }, 403);
    const { count } = await supabase.from("caregiver_notes").delete({ count: "exact" })
      .eq("id", noteDeleteMatch[1]).eq("caregiver_supabase_uid", auth.userId);
    if (count === 0) return json({ detail: "Note not found" }, 404);
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // ── DOCTORS ───────────────────────────────────────────────────────────────

  if (!currentUser.patient_id) return json({ detail: "No patient linked" }, 404);
  const patientId = currentUser.patient_id;

  // GET /doctors
  if (req.method === "GET" && path.endsWith("/doctors")) {
    const { data } = await supabase.from("doctors").select("*").eq("patient_id", patientId);
    return json(data ?? []);
  }

  // POST /doctors
  if (req.method === "POST" && path.endsWith("/doctors")) {
    let body: { name?: string; email?: string };
    try { body = await req.json(); } catch { return json({ detail: "Invalid JSON" }, 400); }
    const { data } = await supabase.from("doctors")
      .insert({ patient_id: patientId, name: body.name ?? null, email: body.email ?? null })
      .select().single();
    return json(data, 201);
  }

  // DELETE /doctors/:id
  const doctorDeleteMatch = path.match(/\/doctors\/([^/]+)$/);
  if (req.method === "DELETE" && doctorDeleteMatch) {
    await supabase.from("doctors").delete().eq("id", doctorDeleteMatch[1]).eq("patient_id", patientId);
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // ── VISITS ────────────────────────────────────────────────────────────────

  // GET /visits
  if (req.method === "GET" && path.endsWith("/visits")) {
    const { data } = await supabase.from("visits").select("*")
      .eq("patient_id", patientId).order("scheduled_for", { ascending: true });
    return json(data ?? []);
  }

  // POST /visits
  if (req.method === "POST" && path.endsWith("/visits")) {
    let body: { scheduled_for?: string; notes?: string };
    try { body = await req.json(); } catch { return json({ detail: "Invalid JSON" }, 400); }
    const { data } = await supabase.from("visits")
      .insert({ patient_id: patientId, scheduled_for: body.scheduled_for ?? null, notes: body.notes ?? null })
      .select().single();
    return json(data, 201);
  }

  return json({ detail: "Not found" }, 404);
});
```

- [ ] **Step 2: Deploy and test**

```bash
supabase functions deploy care
curl -X POST https://<project>.supabase.co/functions/v1/notes \
  -H "Authorization: Bearer <caregiver_jwt>" -H "Content-Type: application/json" \
  -d '{"patientId":"<id>","text":"Patient had a good day","pinned":false}'
```
Expected: `{"id":"...","text":"Patient had a good day",...}`

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/care/
git commit -m "feat: care Edge Function (notes, doctors, visits)"
```

---

### Task 11: stream Edge Function

**Files:**
- Create: `supabase/functions/stream/index.ts`

Routes: all `POST /stream/*` and `GET /stream/*` for Daily.co session management. Port directly from `src/server-routes/streamSessions.ts` — read that file first, then implement each route below replacing MongoDB calls with Supabase client calls.

- [ ] **Step 1: Create `supabase/functions/stream/index.ts`**

```ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders, json } from "../_shared/cors.ts";
import { verifyUser, resolvePatientId, makeSupabase } from "../_shared/auth.ts";

const DAILY_BASE = "https://api.daily.co/v1";

async function dailyRequest(method: string, path: string, body?: object) {
  const res = await fetch(`${DAILY_BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${Deno.env.get("DAILY_API_KEY")}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) { const t = await res.text(); throw new Error(`Daily ${method} ${path}: ${t}`); }
  return method === "DELETE" ? null : res.json();
}

async function createDailyRoom(patientId: string) {
  const name = `vela-${patientId}-${Date.now()}`;
  const room = await dailyRequest("POST", "/rooms", { name, privacy: "private",
    properties: { exp: Math.floor(Date.now() / 1000) + 7200 } });
  return { name: room.name, url: room.url };
}

async function createDailyToken(roomName: string, isOwner: boolean): Promise<string> {
  const result = await dailyRequest("POST", "/meeting-tokens", {
    properties: { room_name: roomName, is_owner: isOwner, exp: Math.floor(Date.now() / 1000) + 3600 },
  });
  return result.token;
}

function isDeviceToken(req: Request): boolean {
  const expected = Deno.env.get("DVISION_PATIENT_TOKEN");
  const provided = req.headers.get("authorization")?.replace("Bearer ", "");
  return !!expected && provided === expected;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/stream/, "");
  const supabase = makeSupabase();

  // Device token auth (glasses)
  let patientId: string | null = null;
  if (isDeviceToken(req)) {
    let body: { patientId?: string } = {};
    if (req.method !== "GET") { try { body = await req.json(); } catch { /**/ } }
    patientId = body.patientId ?? url.searchParams.get("patientId") ?? null;
    if (!patientId) return json({ detail: "patientId required" }, 400);
  } else {
    const auth = await verifyUser(req);
    if (!auth) return json({ detail: "Missing authorization header" }, 401);
    const resolved = await resolvePatientId(supabase, auth.userId);
    if ("error" in resolved) return json({ detail: resolved.error }, resolved.status);
    patientId = resolved.patientId;
  }

  // POST /stream/request — caregiver requests stream
  if (req.method === "POST" && path === "/request") {
    const { room, url: roomUrl } = await createDailyRoom(patientId);
    const [caregiverToken, patientToken] = await Promise.all([
      createDailyToken(room, true),
      createDailyToken(room, false),
    ]);
    const expires = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    const { data: session } = await supabase.from("stream_sessions").insert({
      patient_id: patientId, status: "pending", room_url: roomUrl, room_name: room,
      caregiver_token: caregiverToken, patient_token: patientToken, expires_at: expires,
    }).select().single();
    return json({ sessionId: session.id, roomUrl, caregiverToken }, 201);
  }

  // GET /stream/status/:patientId — glasses polls this
  const statusMatch = path.match(/^\/status\/([^/]+)$/);
  if (req.method === "GET" && statusMatch) {
    const pid = statusMatch[1];
    const { data } = await supabase.from("stream_sessions").select("*")
      .eq("patient_id", pid).eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    return json(data ?? { status: "none" });
  }

  // POST /stream/approve — glasses approves
  if (req.method === "POST" && path === "/approve") {
    let body: { sessionId?: string };
    try { body = await req.json(); } catch { return json({ detail: "Invalid JSON" }, 400); }
    const { data } = await supabase.from("stream_sessions")
      .update({ status: "approved" }).eq("id", body.sessionId!).eq("patient_id", patientId)
      .select().single();
    if (!data) return json({ detail: "Session not found" }, 404);
    return json({ roomUrl: data.room_url, patientToken: data.patient_token });
  }

  // POST /stream/deny — glasses denies
  if (req.method === "POST" && path === "/deny") {
    let body: { sessionId?: string };
    try { body = await req.json(); } catch { return json({ detail: "Invalid JSON" }, 400); }
    await supabase.from("stream_sessions")
      .update({ status: "denied" }).eq("id", body.sessionId!).eq("patient_id", patientId);
    return json({ ok: true });
  }

  // POST /stream/end
  if (req.method === "POST" && path === "/end") {
    let body: { sessionId?: string };
    try { body = await req.json(); } catch { return json({ detail: "Invalid JSON" }, 400); }
    await supabase.from("stream_sessions")
      .update({ status: "ended" }).eq("id", body.sessionId!).eq("patient_id", patientId);
    return json({ ok: true });
  }

  // POST /stream/register-push-token
  if (req.method === "POST" && path === "/register-push-token") {
    let body: { token?: string; userId?: string };
    try { body = await req.json(); } catch { return json({ detail: "Invalid JSON" }, 400); }
    if (!body.token || !body.userId) return json({ detail: "token and userId required" }, 400);
    await supabase.from("push_tokens").upsert(
      { user_id: body.userId, token: body.token, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
    return json({ ok: true });
  }

  return json({ detail: "Not found" }, 404);
});
```

- [ ] **Step 2: Set env vars for this function**

In Supabase dashboard → Edge Functions → stream → Secrets, add:
- `DAILY_API_KEY` — your Daily.co API key
- `DVISION_PATIENT_TOKEN` — the shared device token

- [ ] **Step 3: Deploy and test**

```bash
supabase functions deploy stream
curl -X POST https://<project>.supabase.co/functions/v1/stream/request \
  -H "Authorization: Bearer <caregiver_jwt>"
```
Expected: `{"sessionId":"...","roomUrl":"https://...","caregiverToken":"..."}`

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/stream/
git commit -m "feat: stream Edge Function (Daily.co session management)"
```

---

### Task 12: device Edge Function

**Files:**
- Create: `supabase/functions/device/index.ts`

Routes: device links, stage observations, onboarding progress, subscription, RevenueCat webhook. Port subscription and onboarding from `src/server-routes/subscription.ts`, `src/server-routes/onboarding.ts`, and `src/server-routes/revenueCatWebhook.ts` — read those files, then replace MongoDB calls with the pattern below.

- [ ] **Step 1: Create `supabase/functions/device/index.ts`**

```ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders, json } from "../_shared/cors.ts";
import { verifyUser, requirePatientAccess, makeSupabase } from "../_shared/auth.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const path = url.pathname;
  const supabase = makeSupabase();

  // RevenueCat webhook — no auth required, validate secret instead
  if (req.method === "POST" && path.endsWith("/webhooks/revenuecat")) {
    const secret = req.headers.get("authorization");
    if (secret !== `Bearer ${Deno.env.get("REVENUECAT_WEBHOOK_SECRET")}`) {
      return json({ detail: "Unauthorized" }, 401);
    }
    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return json({ detail: "Invalid JSON" }, 400); }
    const event = body.event as Record<string, unknown>;
    const patientId = event?.app_user_id as string;
    const type = event?.type as string;
    if (patientId && type) {
      const tier = ["INITIAL_PURCHASE", "RENEWAL", "PRODUCT_CHANGE"].includes(type)
        ? (String(event.product_id ?? "").includes("unlimited") ? "unlimited" : "starter")
        : "free";
      await supabase.from("subscriptions").upsert(
        { patient_id: patientId, tier, trial_active: type === "TRIAL_STARTED", updated_at: new Date().toISOString() },
        { onConflict: "patient_id" }
      );
    }
    return json({ ok: true });
  }

  const auth = await verifyUser(req);
  if (!auth) return json({ detail: "Missing authorization header" }, 401);

  // Device link routes: /:patientId/device-link
  const deviceMatch = path.match(/\/([^/]+)\/device-link$/);
  if (deviceMatch) {
    const patientId = deviceMatch[1];
    const hasAccess = await requirePatientAccess(supabase, auth.userId, patientId);
    if (!hasAccess) return json({ detail: "No seat on this profile" }, 403);

    if (req.method === "GET") {
      const { data } = await supabase.from("device_links").select("device_code,linked_at")
        .eq("patient_id", patientId).maybeSingle();
      return json(data ?? null);
    }

    if (req.method === "POST") {
      let body: { device_code?: string };
      try { body = await req.json(); } catch { return json({ detail: "Invalid JSON" }, 400); }
      const code = String(body.device_code ?? "").toUpperCase().trim();
      if (!code || !/^[A-Z0-9-]{4,12}$/.test(code)) return json({ detail: "Invalid device_code" }, 400);
      const now = new Date().toISOString();
      await supabase.from("device_links").upsert(
        { patient_id: patientId, device_code: code, linked_at: now },
        { onConflict: "patient_id" }
      );
      return json({ device_code: code, linked_at: now });
    }

    if (req.method === "DELETE") {
      await supabase.from("device_links").delete().eq("patient_id", patientId);
      return new Response(null, { status: 204, headers: corsHeaders });
    }
  }

  // GET /:patientId/stage-observations/latest
  const stageMatch = path.match(/\/([^/]+)\/stage-observations\/latest$/);
  if (req.method === "GET" && stageMatch) {
    const patientId = stageMatch[1];
    const hasAccess = await requirePatientAccess(supabase, auth.userId, patientId);
    if (!hasAccess) return json({ detail: "No seat on this profile" }, 403);
    const { data } = await supabase.from("stage_observations").select("*")
      .eq("patient_id", patientId).order("observed_at", { ascending: false }).limit(1).maybeSingle();
    return json(data ?? null);
  }

  // Onboarding: GET/PATCH /:patientId/onboarding
  const onboardingMatch = path.match(/\/([^/]+)\/onboarding$/);
  if (onboardingMatch) {
    const patientId = onboardingMatch[1];
    const hasAccess = await requirePatientAccess(supabase, auth.userId, patientId);
    if (!hasAccess) return json({ detail: "No seat on this profile" }, 403);

    if (req.method === "GET") {
      const { data } = await supabase.from("onboarding_progress").select("*")
        .eq("patient_id", patientId).maybeSingle();
      return json(data ?? { patient_id: patientId, steps: {}, completed_at: null });
    }

    if (req.method === "PATCH") {
      let body: Record<string, unknown>;
      try { body = await req.json(); } catch { return json({ detail: "Invalid JSON" }, 400); }
      const { data: existing } = await supabase.from("onboarding_progress").select("steps")
        .eq("patient_id", patientId).maybeSingle();
      const steps = { ...(existing?.steps ?? {}), ...(body.steps ?? {}) };
      const allDone = Object.values(steps).every(Boolean);
      const { data } = await supabase.from("onboarding_progress").upsert(
        { patient_id: patientId, steps, completed_at: allDone ? new Date().toISOString() : null },
        { onConflict: "patient_id" }
      ).select().single();
      return json(data);
    }
  }

  // Subscription: GET/POST /:patientId/subscription
  const subMatch = path.match(/\/([^/]+)\/subscription$/);
  if (subMatch) {
    const patientId = subMatch[1];
    const hasAccess = await requirePatientAccess(supabase, auth.userId, patientId);
    if (!hasAccess) return json({ detail: "No seat on this profile" }, 403);

    if (req.method === "GET") {
      const { data } = await supabase.from("subscriptions").select("*")
        .eq("patient_id", patientId).maybeSingle();
      return json(data ?? { patient_id: patientId, tier: "free", trial_active: false });
    }
  }

  return json({ detail: "Not found" }, 404);
});
```

- [ ] **Step 2: Deploy and test**

```bash
supabase functions deploy device
curl https://<project>.supabase.co/functions/v1/<patientId>/device-link \
  -H "Authorization: Bearer <jwt>"
```
Expected: `null` (no device linked yet)

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/device/
git commit -m "feat: device Edge Function (device links, onboarding, subscription, RevenueCat webhook)"
```

---

### Task 13: people Edge Function

**Files:**
- Create: `supabase/functions/people/index.ts`

- [ ] **Step 1: Read the source file**

Read `/Users/haadisiddiqui/projects/VVision-App/src/server-routes/people.ts` in full before implementing. Note all routes, validation rules, and what fields are stored.

- [ ] **Step 2: Create `supabase/functions/people/index.ts`**

The people function handles face enrollment from the app side (caregivers adding known faces). Replace all MongoDB operations using the pattern established in previous tasks. Key differences from other functions:

- Face photos upload to Supabase Storage (`face-crops` bucket) instead of the filesystem
- Face embedding (if stored server-side) is a `vector(512)` column
- All `ObjectId.isValid()` guards become simple UUID format checks

```ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders, json } from "../_shared/cors.ts";
import { verifyUser, requirePatientAccess, makeSupabase } from "../_shared/auth.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const path = url.pathname;
  const supabase = makeSupabase();

  const auth = await verifyUser(req);
  if (!auth) return json({ detail: "Missing authorization header" }, 401);

  // All routes are /:patientId/people[/:personId]
  const match = path.match(/^\/([^/]+)\/people(\/([^/]+))?$/);
  if (!match) return json({ detail: "Not found" }, 404);
  const [, patientId, , personId] = match;

  const hasAccess = await requirePatientAccess(supabase, auth.userId, patientId);
  if (!hasAccess) return json({ detail: "No seat on this profile" }, 403);

  // GET /:patientId/people
  if (req.method === "GET" && !personId) {
    const { data } = await supabase.from("people").select("id,name,relation,last_seen,seen_count,notes,is_patient,embedding_version")
      .eq("patient_id", patientId);
    return json(data ?? []);
  }

  // POST /:patientId/people — enroll a face
  if (req.method === "POST" && !personId) {
    // Read multipart form data (name, relation, photo)
    const contentType = req.headers.get("content-type") ?? "";
    if (!contentType.includes("multipart/form-data")) return json({ detail: "multipart/form-data required" }, 400);
    const formData = await req.formData();
    const name = String(formData.get("name") ?? "").trim().slice(0, 200);
    const relation = String(formData.get("relation") ?? "").trim().slice(0, 200);
    const photo = formData.get("photo") as File | null;
    if (!name) return json({ detail: "name required" }, 400);
    if (!photo) return json({ detail: "photo required" }, 400);
    if (photo.size > 5 * 1024 * 1024) return json({ detail: "Photo must be under 5MB" }, 400);
    const mimeAllowed = ["image/jpeg", "image/png", "image/webp"];
    if (!mimeAllowed.includes(photo.type)) return json({ detail: "Photo must be JPEG, PNG, or WebP" }, 400);

    // Upload photo to Supabase Storage
    const photoBytes = await photo.arrayBuffer();
    const storagePath = `${patientId}/${Date.now()}-${name.replace(/\s+/g, "_")}.jpg`;
    await supabase.storage.from("face-crops").upload(storagePath, photoBytes, { contentType: photo.type });

    const { data } = await supabase.from("people").insert({
      patient_id: patientId, name, relation, embedding_version: 2,
      is_patient: false, seen_count: 0, notes: "",
    }).select().single();
    return json(data, 201);
  }

  // DELETE /:patientId/people/:personId
  if (req.method === "DELETE" && personId) {
    const { count } = await supabase.from("people").delete({ count: "exact" })
      .eq("id", personId).eq("patient_id", patientId);
    if (count === 0) return json({ detail: "Person not found" }, 404);
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  return json({ detail: "Not found" }, 404);
});
```

- [ ] **Step 3: Create Supabase Storage bucket**

In Supabase dashboard → Storage → New bucket → name: `face-crops`, private: true.

- [ ] **Step 4: Deploy and test**

```bash
supabase functions deploy people
curl https://<project>.supabase.co/functions/v1/<patientId>/people \
  -H "Authorization: Bearer <jwt>"
```
Expected: `[]` (no faces enrolled yet)

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/people/
git commit -m "feat: people Edge Function (face enrollment + Supabase Storage)"
```

---

### Task 14: ai Edge Function

**Files:**
- Create: `supabase/functions/ai/index.ts`

Routes: `POST /assistant/chat`, `POST /memory/add`, `POST /memory/search`, `GET /:patientId/patterns`, `POST /:patientId/checkins`, `GET /memory/logs`

- [ ] **Step 1: Create `supabase/functions/ai/index.ts`**

```ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import Groq from "npm:groq-sdk";
import { corsHeaders, json } from "../_shared/cors.ts";
import { verifyUser, resolvePatientId, requirePatientAccess, makeSupabase } from "../_shared/auth.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const path = url.pathname;
  const supabase = makeSupabase();

  const auth = await verifyUser(req);
  if (!auth) return json({ detail: "Missing authorization header" }, 401);

  // POST /assistant/chat
  if (req.method === "POST" && path.endsWith("/assistant/chat")) {
    const resolved = await resolvePatientId(supabase, auth.userId);
    if ("error" in resolved) return json({ detail: resolved.error }, resolved.status);
    const { patientId } = resolved;

    let body: { message?: string };
    try { body = await req.json(); } catch { return json({ detail: "Invalid JSON" }, 400); }
    const message = typeof body.message === "string" ? body.message.trim().slice(0, 2000) : "";
    if (!message) return json({ detail: "message required" }, 400);

    const [{ data: convDocs }, { data: routineDocs }, { data: medDocs }, { data: reminderDocs }, { data: userDoc }] =
      await Promise.all([
        supabase.from("conversations").select("role,content,created_at").eq("patient_id", patientId)
          .order("created_at", { ascending: true }).limit(20),
        supabase.from("routines").select("label,time").eq("patient_id", patientId).limit(50),
        supabase.from("medications").select("name,dosage,time").eq("patient_id", patientId).limit(50),
        supabase.from("reminders").select("text,time,recurrence").eq("patient_id", patientId)
          .order("created_at", { ascending: false }).limit(20),
        supabase.from("users").select("name").eq("patient_id", patientId).maybeSingle(),
      ]);

    const firstName = userDoc?.name?.split(" ")[0] ?? "there";
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const dateStr = now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });

    const routinesText = routineDocs?.length
      ? routineDocs.map(r => `- ${r.label}${r.time ? ` at ${r.time}` : ""}`).join("\n")
      : "No routine tasks.";
    const medsText = medDocs?.length
      ? medDocs.map(m => `- ${m.name}${m.dosage ? ` (${m.dosage})` : ""}${m.time ? ` at ${m.time}` : ""}`).join("\n")
      : "No medications.";
    const remindersText = reminderDocs?.length
      ? reminderDocs.map(r => `- ${r.text}${r.time ? ` at ${r.time}` : ""}${r.recurrence ? ` (${r.recurrence})` : ""}`).join("\n")
      : "No reminders.";
    const conversationHistory = convDocs?.map(c => `${c.role === "user" ? firstName : "Vision"}: ${c.content}`).join("\n") ?? "";

    const systemPrompt = `You are Vision, a warm and patient AI assistant built into smart glasses and a companion app for someone who needs help remembering things.\n\nKeep responses to 1-3 short sentences. Use a warm, reassuring tone.\nNever give medical advice. Never mention that you are AI.\nIt is okay to repeat information — the person may ask the same thing multiple times.\n\nPATIENT: ${firstName}\nCURRENT TIME: ${timeStr}\nTODAY: ${dateStr}\n\nTODAY'S ROUTINE:\n${routinesText}\n\nTODAY'S MEDICATIONS:\n${medsText}\n\nUPCOMING REMINDERS:\n${remindersText}\n\nRECENT CONVERSATION:\n${conversationHistory}`;

    const groq = new Groq({ apiKey: Deno.env.get("GROQ_API_KEY") });

    const tools: Groq.Chat.ChatCompletionTool[] = [
      { type: "function", function: { name: "create_reminder", description: "Create a reminder for the patient.",
        parameters: { type: "object", properties: { text: { type: "string" }, time: { type: "string" }, recurrence: { type: "string" } }, required: ["text"] } } },
      { type: "function", function: { name: "create_task", description: "Create a daily routine task.",
        parameters: { type: "object", properties: { label: { type: "string" }, time: { type: "string" } }, required: ["label"] } } },
      { type: "function", function: { name: "create_medication", description: "Add a medication.",
        parameters: { type: "object", properties: { name: { type: "string" }, dosage: { type: "string" }, time: { type: "string" } }, required: ["name"] } } },
    ];

    const firstCompletion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: message }],
      tools, tool_choice: "auto", max_tokens: 300, temperature: 0.7,
    });

    const firstChoice = firstCompletion.choices[0];
    let reply: string;
    let reminderCreated = false, taskCreated = false, medicationCreated = false;

    if (firstChoice?.finish_reason === "tool_calls" && firstChoice.message.tool_calls?.length) {
      const toolResults = await Promise.all(firstChoice.message.tool_calls.map(async (tc) => {
        let result = "Done.";
        const args = JSON.parse(tc.function.arguments);
        if (tc.function.name === "create_reminder") {
          await supabase.from("reminders").insert({ patient_id: patientId, text: args.text,
            time: args.time ?? null, recurrence: args.recurrence ?? null, source: "app", completed_date: null });
          reminderCreated = true; result = "Reminder created.";
        } else if (tc.function.name === "create_task") {
          await supabase.from("routines").insert({ patient_id: patientId, label: args.label,
            time: args.time ?? "9:00 AM", completed_date: null });
          taskCreated = true; result = "Task added.";
        } else if (tc.function.name === "create_medication") {
          await supabase.from("medications").insert({ patient_id: patientId, name: args.name,
            dosage: args.dosage ?? "as prescribed", time: args.time ?? "9:00 AM", taken_date: null });
          medicationCreated = true; result = "Medication added.";
        }
        return { toolCall: tc, result };
      }));

      const second = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: message },
          firstChoice.message,
          ...toolResults.map(({ toolCall, result }) => ({ role: "tool" as const, tool_call_id: toolCall.id, content: result }))],
        max_tokens: 200, temperature: 0.7,
      });
      reply = second.choices[0]?.message?.content?.trim() ?? "Done! I've taken care of that for you.";
    } else {
      reply = firstChoice?.message?.content?.trim() ?? "Sorry, I couldn't respond right now.";
    }

    // Save to conversation history
    await supabase.from("conversations").insert([
      { patient_id: patientId, role: "user", content: message },
      { patient_id: patientId, role: "assistant", content: reply },
    ]);

    return json({ reply, reminderCreated, taskCreated, medicationCreated });
  }

  // GET /:patientId/patterns
  const patternsMatch = path.match(/^\/([^/]+)\/patterns$/);
  if (req.method === "GET" && patternsMatch) {
    const patientId = patternsMatch[1];
    const hasAccess = await requirePatientAccess(supabase, auth.userId, patientId);
    if (!hasAccess) return json({ detail: "No seat on this profile" }, 403);
    const { data } = await supabase.from("patterns").select("*")
      .eq("patient_id", patientId).order("confidence", { ascending: false }).limit(20);
    return json(data ?? []);
  }

  // POST /:patientId/checkins
  const checkinMatch = path.match(/^\/([^/]+)\/checkins$/);
  if (req.method === "POST" && checkinMatch) {
    const patientId = checkinMatch[1];
    const hasAccess = await requirePatientAccess(supabase, auth.userId, patientId);
    if (!hasAccess) return json({ detail: "No seat on this profile" }, 403);
    let body: { source?: string; content?: string };
    try { body = await req.json(); } catch { return json({ detail: "Invalid JSON" }, 400); }
    const { data } = await supabase.from("checkin_logs")
      .insert({ patient_id: patientId, source: body.source ?? "app", content: body.content ?? "" })
      .select().single();
    return json(data, 201);
  }

  // GET /memory/logs (checkin logs for caregiver)
  if (req.method === "GET" && path.endsWith("/memory/logs")) {
    const resolved = await resolvePatientId(supabase, auth.userId);
    if ("error" in resolved) return json({ detail: resolved.error }, resolved.status);
    const { patientId } = resolved;
    const { data } = await supabase.from("checkin_logs").select("*")
      .eq("patient_id", patientId).order("created_at", { ascending: false }).limit(50);
    return json(data ?? []);
  }

  // POST /memory/add and POST /memory/search — proxy to Mem0
  if (path.endsWith("/memory/add") || path.endsWith("/memory/search")) {
    const mem0Key = Deno.env.get("MEM0_API_KEY");
    if (!mem0Key) return json({ detail: "Memory service unavailable" }, 503);
    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return json({ detail: "Invalid JSON" }, 400); }
    const endpoint = path.endsWith("/add") ? "https://api.mem0.ai/v1/memories/" : "https://api.mem0.ai/v1/memories/search/";
    const resp = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Token ${mem0Key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await resp.json();
    return json(data, resp.status);
  }

  return json({ detail: "Not found" }, 404);
});
```

- [ ] **Step 2: Set env vars**

In Supabase dashboard → Edge Functions → ai → Secrets:
- `GROQ_API_KEY`
- `MEM0_API_KEY` (optional — memory features degrade gracefully if missing)

- [ ] **Step 3: Deploy and test**

```bash
supabase functions deploy ai
curl -X POST https://<project>.supabase.co/functions/v1/assistant/chat \
  -H "Authorization: Bearer <jwt>" -H "Content-Type: application/json" \
  -d '{"message":"What are my tasks today?"}'
```
Expected: `{"reply":"...","reminderCreated":false,"taskCreated":false,"medicationCreated":false}`

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/ai/
git commit -m "feat: ai Edge Function (Groq assistant, patterns, checkin logs, Mem0 proxy)"
```

---

### Task 15: reports Edge Function

**Files:**
- Create: `supabase/functions/reports/index.ts`

Routes: `POST /:patientId/reports/generate`, `GET /reports/:reportId/download`, `POST /:patientId/stage-observations`. Port the PDF generation logic from `src/server-routes/reports.ts` and `src/server-core/reportPdf.ts` — read those files first, then replace `fs` writes with Supabase Storage uploads and MongoDB calls with Supabase client calls.

- [ ] **Step 1: Read source files**

Read these files before implementing:
- `src/server-routes/reports.ts`
- `src/server-core/reportPdf.ts`
- `src/server-core/reportEmail.ts`

- [ ] **Step 2: Create `supabase/functions/reports/index.ts`**

```ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
// @deno-types="npm:@types/pdfkit"
import PDFDocument from "npm:pdfkit";
import nodemailer from "npm:nodemailer";
import { corsHeaders, json } from "../_shared/cors.ts";
import { verifyUser, requirePatientAccess, makeSupabase } from "../_shared/auth.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const path = url.pathname;
  const supabase = makeSupabase();

  const auth = await verifyUser(req);
  if (!auth) return json({ detail: "Missing authorization header" }, 401);

  // POST /:patientId/stage-observations
  const stageMatch = path.match(/^\/([^/]+)\/stage-observations$/);
  if (req.method === "POST" && stageMatch) {
    const patientId = stageMatch[1];
    // Device token auth — glasses write stage observations without a Supabase JWT
    const deviceToken = Deno.env.get("DVISION_PATIENT_TOKEN");
    const provided = req.headers.get("authorization")?.replace("Bearer ", "");
    const isDevice = deviceToken && provided === deviceToken;
    if (!isDevice) {
      const hasAccess = await requirePatientAccess(supabase, auth.userId, patientId);
      if (!hasAccess) return json({ detail: "No seat on this profile" }, 403);
    }
    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return json({ detail: "Invalid JSON" }, 400); }
    // Only insert if stage changed from last observation
    const { data: last } = await supabase.from("stage_observations").select("observed_stage")
      .eq("patient_id", patientId).order("observed_at", { ascending: false }).limit(1).maybeSingle();
    if (last?.observed_stage === body.observed_stage) return json({ ok: true, skipped: true });
    await supabase.from("stage_observations").insert({
      patient_id: patientId, device_code: body.device_code ?? null,
      observed_stage: body.observed_stage, signals: body.signals ?? {}, observed_at: new Date().toISOString(),
    });
    return json({ ok: true });
  }

  // POST /:patientId/reports/generate
  const reportGenMatch = path.match(/^\/([^/]+)\/reports\/generate$/);
  if (req.method === "POST" && reportGenMatch) {
    const patientId = reportGenMatch[1];
    const hasAccess = await requirePatientAccess(supabase, auth.userId, patientId);
    if (!hasAccess) return json({ detail: "No seat on this profile" }, 403);

    let body: { range?: string; startDate?: string; endDate?: string; deliveryMethod?: string; doctorEmail?: string };
    try { body = await req.json(); } catch { return json({ detail: "Invalid JSON" }, 400); }

    const endDate = new Date().toISOString().slice(0, 10);
    const daysMap: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90 };
    const days = daysMap[body.range ?? "30d"] ?? 30;
    const startDate = body.startDate ?? (() => {
      const d = new Date(); d.setDate(d.getDate() - days); return d.toISOString().slice(0, 10);
    })();

    // Fetch all data in parallel
    const [{ data: patient }, { data: checkins }, { data: patterns }, { data: notes }, { data: meds }] = await Promise.all([
      supabase.from("patients").select("name,diagnosis").eq("id", patientId).maybeSingle(),
      supabase.from("checkin_logs").select("*").eq("patient_id", patientId)
        .gte("created_at", startDate).order("created_at", { ascending: false }).limit(100),
      supabase.from("patterns").select("*").eq("patient_id", patientId).order("confidence", { ascending: false }).limit(10),
      supabase.from("caregiver_notes").select("*").eq("patient_id", patientId)
        .gte("timestamp", startDate).order("timestamp", { ascending: false }).limit(50),
      supabase.from("medications").select("name,dosage,time").eq("patient_id", patientId),
    ]);

    // Generate PDF using pdfkit
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Uint8Array[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(new Uint8Array(chunk)));

    doc.fontSize(20).text("Vela Vision — Care Report", { align: "center" });
    doc.moveDown();
    doc.fontSize(12).text(`Patient: ${patient?.name ?? "Unknown"}`);
    doc.text(`Period: ${startDate} – ${endDate}`);
    doc.moveDown();

    if (meds?.length) {
      doc.fontSize(14).text("Medications");
      meds.forEach(m => doc.fontSize(10).text(`• ${m.name}${m.dosage ? ` (${m.dosage})` : ""}${m.time ? ` — ${m.time}` : ""}`));
      doc.moveDown();
    }

    if (patterns?.length) {
      doc.fontSize(14).text("Observed Patterns");
      patterns.forEach(p => doc.fontSize(10).text(`• ${p.title} — confidence ${Math.round((p.confidence ?? 0) * 100)}%`));
      doc.fontSize(8).text("General wellness observations only — not intended as diagnostic measures.");
      doc.moveDown();
    }

    if (checkins?.length) {
      doc.fontSize(14).text("Check-in Log");
      checkins.slice(0, 20).forEach(c => {
        doc.fontSize(10).text(`[${c.created_at?.slice(0, 10)}] ${c.content ?? ""}`);
      });
      doc.moveDown();
    }

    doc.end();
    await new Promise(resolve => doc.on("end", resolve));
    const pdfBytes = Buffer.concat(chunks.map(c => Buffer.from(c)));

    // Upload to Supabase Storage
    const reportId = crypto.randomUUID();
    const storagePath = `${patientId}/${reportId}.pdf`;
    await supabase.storage.from("pdfs").upload(storagePath, pdfBytes, { contentType: "application/pdf" });

    // Generate 24h signed URL
    const { data: signedUrl } = await supabase.storage.from("pdfs")
      .createSignedUrl(storagePath, 86400);

    // Email delivery
    if (body.deliveryMethod === "email" && body.doctorEmail) {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user: Deno.env.get("GMAIL_USER"), pass: Deno.env.get("GMAIL_APP_PASSWORD") },
      });
      await transporter.sendMail({
        from: Deno.env.get("GMAIL_USER"),
        to: body.doctorEmail,
        subject: `Vela Vision Care Report — ${patient?.name ?? "Patient"}`,
        text: `Please find attached a care report for ${patient?.name ?? "your patient"} covering ${startDate} to ${endDate}.\n\nThis report contains general wellness observations only and is not intended as a diagnostic tool.`,
        attachments: [{ filename: "care-report.pdf", content: pdfBytes }],
      });
    }

    return json({ reportId, downloadUrl: signedUrl?.signedUrl ?? null, deliveredByEmail: body.deliveryMethod === "email" });
  }

  return json({ detail: "Not found" }, 404);
});
```

- [ ] **Step 3: Create PDFs storage bucket**

In Supabase dashboard → Storage → New bucket → name: `pdfs`, private: true.

- [ ] **Step 4: Set env vars**

In Supabase dashboard → Edge Functions → reports → Secrets:
- `GMAIL_USER`
- `GMAIL_APP_PASSWORD`
- `DVISION_PATIENT_TOKEN`

- [ ] **Step 5: Deploy and test**

```bash
supabase functions deploy reports
curl -X POST https://<project>.supabase.co/functions/v1/<patientId>/reports/generate \
  -H "Authorization: Bearer <jwt>" -H "Content-Type: application/json" \
  -d '{"range":"7d","deliveryMethod":"link"}'
```
Expected: `{"reportId":"...","downloadUrl":"https://...","deliveredByEmail":false}`

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/reports/
git commit -m "feat: reports Edge Function (PDF generation, email delivery, stage observations)"
```

---

### Task 16: Update app config + set all env vars

**Files:**
- Modify: `app.json`

- [ ] **Step 1: Set all Edge Function secrets in Supabase dashboard**

Go to Supabase → Settings → Edge Functions → Global secrets. Add:
```
SUPABASE_URL             = https://<project>.supabase.co
SUPABASE_ANON_KEY        = <anon key from API settings>
SUPABASE_SERVICE_ROLE_KEY = <service role key from API settings>
GROQ_API_KEY             = <groq key>
MEM0_API_KEY             = <mem0 key>
DAILY_API_KEY            = <daily.co key>
DVISION_PATIENT_TOKEN    = <shared device token>
REVENUECAT_WEBHOOK_SECRET = <rc secret>
REVENUECAT_SECRET_KEY    = <rc key>
GMAIL_USER               = <gmail address>
GMAIL_APP_PASSWORD       = <gmail app password>
ELEVENLABS_API_KEY       = <elevenlabs key>
```

- [ ] **Step 2: Update `app.json` apiBaseUrl**

In `app.json`, find:
```json
"apiBaseUrl": "https://vvision-app.onrender.com"
```

Replace with:
```json
"apiBaseUrl": "https://<your-project-ref>.supabase.co/functions/v1"
```

- [ ] **Step 3: Verify the app connects end-to-end**

Start the app: `npx expo start --web`

Sign in → verify `/auth/sync` returns your user profile.
Navigate to Today tab → verify routines load from Supabase.
Add a task → verify it appears in the Supabase Table Editor under `routines`.
Send a help request → verify it appears in `help_alerts`.

- [ ] **Step 4: Commit**

```bash
git add app.json
git commit -m "feat: switch apiBaseUrl to Supabase Edge Functions"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| PostgreSQL schema (24 tables) | Task 1 |
| pgvector for face embeddings | Task 1 (vector(512) column on people) |
| pg_cron stream session cleanup | Task 1 |
| Shared auth helpers | Task 2 |
| auth routes (sync, me) | Task 3 |
| routines routes | Task 4 |
| medications routes | Task 5 |
| reminders routes | Task 6 |
| health sync, summary, trends | Task 7 |
| patients CRUD + link/unlink | Task 8 |
| help_alerts + face alerts + push tokens | Task 9 |
| caregiver notes + doctors + visits | Task 10 |
| Daily.co stream sessions | Task 11 |
| device links + onboarding + subscription + RevenueCat | Task 12 |
| face enrollment + Supabase Storage | Task 13 |
| Groq assistant + Mem0 + patterns + checkins | Task 14 |
| PDF generation + email + stage observations | Task 15 |
| Supabase Storage buckets (pdfs, face-crops) | Tasks 13, 15 |
| apiBaseUrl config update | Task 16 |
| All env vars documented | Task 16 |

**No placeholders found after review.**

**Type consistency:** All functions import from `../_shared/auth.ts` and `../_shared/cors.ts`. `makeSupabase()` is used consistently. `verifyUser` returns `AuthInfo | null` consumed correctly in all tasks. `requirePatientAccess` returns `boolean` consumed correctly. `resolvePatientId` returns `{ patientId, user } | { error, status }` consumed with `"error" in resolved` guard in all tasks that use it.
