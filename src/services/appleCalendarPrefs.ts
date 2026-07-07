import { secureStorage } from "../config/secureStorage";

const KEY = "appleCalendarSyncEnabled";

export async function isAppleCalendarSyncEnabled(): Promise<boolean> {
  const value = await secureStorage.getItem(KEY);
  return value === "true";
}

export async function setAppleCalendarSyncEnabled(enabled: boolean): Promise<void> {
  await secureStorage.setItem(KEY, enabled ? "true" : "false");
}
