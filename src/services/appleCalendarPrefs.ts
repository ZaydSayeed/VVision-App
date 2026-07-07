import * as SecureStore from "expo-secure-store";

const KEY = "appleCalendarSyncEnabled";

export async function isAppleCalendarSyncEnabled(): Promise<boolean> {
  const value = await SecureStore.getItemAsync(KEY);
  return value === "true";
}

export async function setAppleCalendarSyncEnabled(enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(KEY, enabled ? "true" : "false");
}
