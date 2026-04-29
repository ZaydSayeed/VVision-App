// Mock data for glasses integration screens.
// Replace these with real MongoDB reads once the glasses backend is live.

export type AlertPriority = 1 | 2 | 3 | 4;

export type AlertType =
  | "fall"
  | "distress"
  | "medication"
  | "sundowning"
  | "visitor"
  | "hydration"
  | "wandering"
  | "general";

export interface GlassesAlert {
  _id: string;
  alert_type: AlertType;
  message: string;
  priority: AlertPriority;
  timestamp: string;
  acknowledged: boolean;
  acknowledged_at?: string;
  dismissed: boolean;
}

export interface VisitorEntry {
  name: string;
  relation: string;
  arrival: string;
  departure?: string;
}

export interface MealEntry {
  label: string;
  observed: boolean;
  time?: string;
}

export interface MedicationEntry {
  time: string;
  label: string;
  confirmed: boolean;
}

export interface RepetitionEntry {
  phrase: string;
  count: number;
  time_range: string;
}

export interface DailyDigest {
  date: string;
  warnings: number;
  visitors: VisitorEntry[];
  meals: MealEntry[];
  hydration_events: number;
  sleep: { wake_time?: string; nap?: { start: string; end: string } };
  safety: { falls: number; wandering: boolean; confusion_episodes: number; confusion_times: string[] };
  sundowning: { active_window?: string; peak_time?: string; peak_score?: number };
  medications: MedicationEntry[];
  repetitions: RepetitionEntry[];
  mood: string;
}

export interface NutritionEvent {
  type: "eating" | "drinking";
  start_hour: number;
  start_min: number;
  duration_min?: number;
}

export interface RepetitionDay {
  date: string;
  label: string;
  entries: Array<{ phrase: string; count: number; hour: number }>;
}

// ─── Alerts ──────────────────────────────────────────────────────────────────

export const MOCK_GLASSES_ALERTS: GlassesAlert[] = [
  {
    _id: "a1",
    alert_type: "fall",
    message: "Possible fall detected near the kitchen. Please check immediately.",
    priority: 4,
    timestamp: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
    acknowledged: false,
    dismissed: false,
  },
  {
    _id: "a2",
    alert_type: "sundowning",
    message: "Agitation pattern detected — sundowning window is active (3 PM – 6 PM).",
    priority: 3,
    timestamp: new Date(Date.now() - 28 * 60 * 1000).toISOString(),
    acknowledged: false,
    dismissed: false,
  },
  {
    _id: "a3",
    alert_type: "medication",
    message: "Evening medication was not confirmed within the 10-minute window.",
    priority: 3,
    timestamp: new Date(Date.now() - 65 * 60 * 1000).toISOString(),
    acknowledged: true,
    acknowledged_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    dismissed: false,
  },
  {
    _id: "a4",
    alert_type: "hydration",
    message: "No drinking event detected in the last 4 hours.",
    priority: 2,
    timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    acknowledged: false,
    dismissed: false,
  },
  {
    _id: "a5",
    alert_type: "visitor",
    message: "Unrecognized person detected at the front door.",
    priority: 2,
    timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    acknowledged: false,
    dismissed: false,
  },
  {
    _id: "a6",
    alert_type: "general",
    message: "Glasses connected and streaming normally.",
    priority: 1,
    timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    acknowledged: false,
    dismissed: false,
  },
];

// ─── Daily Digest ─────────────────────────────────────────────────────────────

export const MOCK_DAILY_DIGEST: DailyDigest = {
  date: new Date().toISOString().slice(0, 10),
  warnings: 2,
  visitors: [
    { name: "Sarah", relation: "daughter", arrival: "2:15 PM", departure: "4:30 PM" },
    { name: "John", relation: "neighbor", arrival: "11:00 AM", departure: "11:18 AM" },
  ],
  meals: [
    { label: "Breakfast", observed: true, time: "8:40 AM" },
    { label: "Lunch", observed: true, time: "12:55 PM" },
    { label: "Dinner", observed: false },
  ],
  hydration_events: 3,
  sleep: {
    wake_time: "7:12 AM",
    nap: { start: "1:30 PM", end: "2:05 PM" },
  },
  safety: {
    falls: 0,
    wandering: false,
    confusion_episodes: 1,
    confusion_times: ["3:45 PM"],
  },
  sundowning: {
    active_window: "3 PM – 6 PM",
    peak_time: "4 PM",
    peak_score: 0.68,
  },
  medications: [
    { time: "8:00 AM", label: "Morning pills", confirmed: true },
    { time: "8:00 PM", label: "Evening pills", confirmed: false },
  ],
  repetitions: [
    { phrase: '"Where is John?"', count: 4, time_range: "2–3 PM" },
    { phrase: '"What day is it?"', count: 2, time_range: "4–5 PM" },
  ],
  mood: "Generally calm · Brief agitation 4:30 – 5:15 PM",
};

// ─── Nutrition ────────────────────────────────────────────────────────────────

export const MOCK_NUTRITION_EVENTS: NutritionEvent[] = [
  { type: "eating", start_hour: 8, start_min: 40, duration_min: 25 },
  { type: "drinking", start_hour: 9, start_min: 15 },
  { type: "drinking", start_hour: 10, start_min: 45 },
  { type: "eating", start_hour: 12, start_min: 55, duration_min: 30 },
  { type: "drinking", start_hour: 14, start_min: 20 },
  { type: "drinking", start_hour: 16, start_min: 10 },
  { type: "drinking", start_hour: 18, start_min: 30 },
];

// ─── Repetition heatmap ───────────────────────────────────────────────────────

export const MOCK_REPETITION_WEEK: RepetitionDay[] = [
  {
    date: "Mon",
    label: "Mon",
    entries: [
      { phrase: '"Where is Sarah?"', count: 3, hour: 14 },
      { phrase: '"What day is it?"', count: 2, hour: 15 },
    ],
  },
  {
    date: "Tue",
    label: "Tue",
    entries: [
      { phrase: '"Where is John?"', count: 5, hour: 15 },
      { phrase: '"Is it time for dinner?"', count: 3, hour: 17 },
    ],
  },
  {
    date: "Wed",
    label: "Wed",
    entries: [{ phrase: '"What time is it?"', count: 2, hour: 10 }],
  },
  {
    date: "Thu",
    label: "Thu",
    entries: [
      { phrase: '"Where is John?"', count: 6, hour: 14 },
      { phrase: '"I need to go home"', count: 4, hour: 16 },
      { phrase: '"What day is it?"', count: 3, hour: 15 },
    ],
  },
  {
    date: "Fri",
    label: "Fri",
    entries: [
      { phrase: '"Where is Sarah?"', count: 4, hour: 15 },
      { phrase: '"Is it time for dinner?"', count: 2, hour: 18 },
    ],
  },
  {
    date: "Sat",
    label: "Sat",
    entries: [{ phrase: '"What day is it?"', count: 1, hour: 11 }],
  },
  {
    date: "Today",
    label: "Today",
    entries: [
      { phrase: '"Where is John?"', count: 4, hour: 14 },
      { phrase: '"What day is it?"', count: 2, hour: 16 },
    ],
  },
];

// ─── Patient Profile Config defaults ─────────────────────────────────────────

export interface NightModeConfig {
  enabled: boolean;
  start_hour: number;
  end_hour: number;
  movement_alert: boolean;
  sustained_threshold_min: number;
}

export interface NutritionThresholds {
  warn_no_meal_by_hour: number;
  alert_no_meal_by_hour: number;
  alert_no_drink_by_hours: number;
}

export interface PatientProfileConfig {
  patient_name: string;
  caregiver_name: string;
  night_mode: NightModeConfig;
  nutrition: NutritionThresholds;
  digest_hour: number;
  sundowning_auto: boolean;
  sundowning_start_hour: number;
  sundowning_end_hour: number;
}

export const MOCK_PATIENT_CONFIG: PatientProfileConfig = {
  patient_name: "Robert",
  caregiver_name: "Sarah",
  night_mode: {
    enabled: true,
    start_hour: 22,
    end_hour: 7,
    movement_alert: true,
    sustained_threshold_min: 5,
  },
  nutrition: {
    warn_no_meal_by_hour: 13,
    alert_no_meal_by_hour: 15,
    alert_no_drink_by_hours: 3,
  },
  digest_hour: 21,
  sundowning_auto: true,
  sundowning_start_hour: 15,
  sundowning_end_hour: 19,
};
