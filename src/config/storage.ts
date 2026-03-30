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

export function today(): string {
  return new Date().toISOString().split("T")[0];
}
