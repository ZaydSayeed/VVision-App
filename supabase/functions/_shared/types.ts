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

export interface PersonRow {
  id: string;
  patient_id: string | null;
  name: string;
  relation: string;
  embedding: number[] | null;
  last_seen: string | null;
  seen_count: number;
  notes: string;
  notes_private: boolean;
  embedding_version: number;
  is_patient: boolean;
  created_at: string;
}

export interface HelpAlertRow {
  id: string;
  patient_id: string;
  dismissed: boolean;
  cancelled: boolean;
  resolved: boolean;
  note: string | null;
  cause: string | null;
  resolved_at: string | null;
  timestamp: string;
}
