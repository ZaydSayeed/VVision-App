import AsyncStorage from "@react-native-async-storage/async-storage";

export const STORAGE_KEYS = {
  AUTH_TOKEN: "@vela/auth_token",
  CURRENT_USER: "@vela/current_user",
  ROUTINE_TASKS: "@vela/routine_tasks",
  MEDICATIONS: "@vela/medications",
  FACES: "@vela/faces",
  HELP_ALERTS: "@vela/help_alerts",
  CAREGIVER_PROFILES: "@vela/caregiver_profiles",
} as const;

export async function readStorage<T>(key: string, fallback: T): Promise<T> {
  const raw = await AsyncStorage.getItem(key);
  return raw ? (JSON.parse(raw) as T) : fallback;
}

export async function writeStorage<T>(key: string, value: T): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export function isDoneToday(dateField: string | null): boolean {
  return dateField === today();
}

export function today(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
