import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../config/secureStorage", () => ({
  secureStorage: {
    getItem: vi.fn(),
    setItem: vi.fn(),
  },
}));

import { secureStorage } from "../config/secureStorage";
import { isAppleCalendarSyncEnabled, setAppleCalendarSyncEnabled } from "./appleCalendarPrefs";

describe("appleCalendarPrefs", () => {
  beforeEach(() => vi.clearAllMocks());

  it("defaults to false when nothing is stored", async () => {
    (secureStorage.getItem as any).mockResolvedValue(null);
    expect(await isAppleCalendarSyncEnabled()).toBe(false);
  });

  it("returns true once enabled", async () => {
    (secureStorage.getItem as any).mockResolvedValue("true");
    expect(await isAppleCalendarSyncEnabled()).toBe(true);
  });

  it("persists the enabled flag", async () => {
    await setAppleCalendarSyncEnabled(true);
    expect(secureStorage.setItem).toHaveBeenCalledWith("appleCalendarSyncEnabled", "true");
  });
});
