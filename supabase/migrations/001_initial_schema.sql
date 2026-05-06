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
