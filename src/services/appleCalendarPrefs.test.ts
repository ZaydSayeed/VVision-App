import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
}));

import * as SecureStore from "expo-secure-store";
import { isAppleCalendarSyncEnabled, setAppleCalendarSyncEnabled } from "./appleCalendarPrefs";

describe("appleCalendarPrefs", () => {
  beforeEach(() => vi.clearAllMocks());

  it("defaults to false when nothing is stored", async () => {
    (SecureStore.getItemAsync as any).mockResolvedValue(null);
    expect(await isAppleCalendarSyncEnabled()).toBe(false);
  });

  it("returns true once enabled", async () => {
    (SecureStore.getItemAsync as any).mockResolvedValue("true");
    expect(await isAppleCalendarSyncEnabled()).toBe(true);
  });

  it("persists the enabled flag", async () => {
    await setAppleCalendarSyncEnabled(true);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith("appleCalendarSyncEnabled", "true");
  });
});
