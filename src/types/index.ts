// ── Auth ──────────────────────────────────────────────────
export type UserRole = "patient" | "caregiver";

export interface AppUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  patient_id: string | null;
}

// ── People (face recognition database) ───────────────────
export interface Person {
  id: string;
  _id?: string; // legacy compat
  name: string;
  relation: string;
  last_seen: string | null;
  seen_count: number;
  notes: string;
  interactions: Interaction[];
}

export interface Interaction {
  timestamp: string;
  summary: string;
}

// ── Alerts (unknown faces) ───────────────────────────────
export interface Alert {
  id: string;
  _id?: string; // legacy compat
  type: string;
  timestamp: string;
  patient_id?: string;
}

// ── Vitals ───────────────────────────────────────────────
export interface VitalsReading {
  pulse_rate: number | null;
  breathing_rate: number | null;
  expression: Expression;
  engagement: number | null;
  confidence: number;
}

export type Expression =
  | "Happy"
  | "Sad"
  | "Surprised"
  | "Confused"
  | "Drowsy"
  | "Neutral"
  | "";

// ── Dashboard ────────────────────────────────────────────
export interface DashboardStats {
  seenToday: number;
  alertCount: number;
  mostFrequent: string;
  lastActivity: string;
}

export interface TimelineEvent {
  type: "seen" | "interaction" | "alert";
  name?: string;
  relation?: string;
  summary?: string;
  time: string;
  count?: number;
}

// ── Patient Summary (caregiver multi-patient) ────────────
export interface PatientSummary {
  id: string;
  name: string;
  tasksTotal: number;
  tasksDone: number;
  medsTotal: number;
  medsDone: number;
  pendingHelp?: number;
}

// ── Routine Tasks ────────────────────────────────────────
export interface RoutineTask {
  id: string;
  label: string;
  time: string;
  completed_date: string | null;
  patient_id?: string;
}

// ── Medications ──────────────────────────────────────────
export interface Medication {
  id: string;
  name: string;
  dosage: string;
  time: string;
  taken_date: string | null;
  patient_id?: string;
}

// ── Help Alerts ──────────────────────────────────────────
export interface HelpAlert {
  id: string;
  patient_id?: string;
  timestamp: string;
  dismissed: boolean;
  cancelled?: boolean;
  resolved?: boolean;
  note?: string;
  cause?: string;
  resolved_at?: string;
}

// ── Caregiver Profiles ───────────────────────────────────
export interface CaregiverProfile {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  relation?: string;
  addedAt?: string;
}

// ── Faces ────────────────────────────────────────────────
export interface FacePerson {
  id: string;
  name: string;
  photoUri: string | null;
  addedAt: string;
}

// ── Reminders ────────────────────────────────────────────
export interface Reminder {
  id: string;
  patient_id?: string;
  text: string;
  time?: string;
  recurrence?: string;
  source: "glasses" | "app";
  created_at: string;
  completed_date: string | null;
}

// ── Conversations ─────────────────────────────────────────
export interface ConversationTurn {
  id: string;
  patient_id?: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

// ── Caregiver Notes ──────────────────────────────────────
export interface CaregiverNote {
  id: string;
  patientId: string;
  caregiverId: string;
  caregiverName: string;
  text: string;
  pinned: boolean;
  timestamp: string;
}
