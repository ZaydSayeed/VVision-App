export interface Person {
  _id: string;
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

export interface Alert {
  _id: string;
  type: string;
  timestamp: string;
}

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

// --- Auth ---
export type UserRole = "patient" | "caregiver";

export interface AppUser {
  name: string;
  role: UserRole;
}

// --- Routine Tasks ---
export interface RoutineTask {
  id: string;
  label: string;
  time: string;
  completedDate: string | null;
}

// --- Medications ---
export interface Medication {
  id: string;
  name: string;
  dosage: string;
  time: string;
  takenDate: string | null;
}

// --- Caregiver Profiles ---
export interface CaregiverProfile {
  id: string;
  name: string;
  phone: string;
  relation: string;
  addedAt: string;
}

// --- Help Alerts (local) ---
export interface HelpAlert {
  id: string;
  timestamp: string;
  dismissed: boolean;
}

// --- Faces ---
export interface FacePerson {
  id: string;
  name: string;
  photoUri: string | null;
  addedAt: string;
}
