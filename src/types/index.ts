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
