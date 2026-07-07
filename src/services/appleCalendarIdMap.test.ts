import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../config/secureStorage", () => ({
  secureStorage: {
    getItem: vi.fn(),
    setItem: vi.fn(),
  },
}));

import { secureStorage } from "../config/secureStorage";
import { getAppleEventId, setAppleEventId, clearAppleEventId } from "./appleCalendarIdMap";

describe("appleCalendarIdMap", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null when no mapping exists", async () => {
    (secureStorage.getItem as any).mockResolvedValue(null);
    expect(await getAppleEventId("evt-1")).toBeNull();
  });

  it("returns a stored mapping", async () => {
    (secureStorage.getItem as any).mockResolvedValue(JSON.stringify({ "evt-1": "apple-abc" }));
    expect(await getAppleEventId("evt-1")).toBe("apple-abc");
  });

  it("adds a mapping, preserving existing entries", async () => {
    (secureStorage.getItem as any).mockResolvedValue(JSON.stringify({ "evt-1": "apple-abc" }));
    await setAppleEventId("evt-2", "apple-def");
    expect(secureStorage.setItem).toHaveBeenCalledWith(
      "appleCalendarIdMap",
      JSON.stringify({ "evt-1": "apple-abc", "evt-2": "apple-def" })
    );
  });

  it("removes a mapping", async () => {
    (secureStorage.getItem as any).mockResolvedValue(JSON.stringify({ "evt-1": "apple-abc", "evt-2": "apple-def" }));
    await clearAppleEventId("evt-1");
    expect(secureStorage.setItem).toHaveBeenCalledWith(
      "appleCalendarIdMap",
      JSON.stringify({ "evt-2": "apple-def" })
    );
  });
});
