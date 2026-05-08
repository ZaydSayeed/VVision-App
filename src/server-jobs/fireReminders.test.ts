import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseReminderTime, isReminderDueNow } from "./fireReminders";

describe("parseReminderTime", () => {
  it("parses '8:00 AM' to { hours: 8, minutes: 0 }", () => {
    expect(parseReminderTime("8:00 AM")).toEqual({ hours: 8, minutes: 0 });
  });
  it("parses '8:00 PM' to { hours: 20, minutes: 0 }", () => {
    expect(parseReminderTime("8:00 PM")).toEqual({ hours: 20, minutes: 0 });
  });
  it("parses '12:30 PM' to { hours: 12, minutes: 30 }", () => {
    expect(parseReminderTime("12:30 PM")).toEqual({ hours: 12, minutes: 30 });
  });
  it("parses '12:00 AM' to { hours: 0, minutes: 0 }", () => {
    expect(parseReminderTime("12:00 AM")).toEqual({ hours: 0, minutes: 0 });
  });
  it("returns null for unparseable strings", () => {
    expect(parseReminderTime("morning")).toBeNull();
    expect(parseReminderTime("")).toBeNull();
    expect(parseReminderTime(null)).toBeNull();
  });
});

describe("isReminderDueNow", () => {
  it("returns true when reminder time is within 5-minute window", () => {
    // 8:02 AM now, reminder at 8:00 AM
    const now = new Date("2026-05-08T08:02:00Z");
    expect(isReminderDueNow({ hours: 8, minutes: 0 }, now)).toBe(true);
  });
  it("returns false when reminder time is outside 5-minute window", () => {
    const now = new Date("2026-05-08T08:10:00Z");
    expect(isReminderDueNow({ hours: 8, minutes: 0 }, now)).toBe(false);
  });
  it("returns false when reminder is in the future", () => {
    const now = new Date("2026-05-08T07:55:00Z");
    expect(isReminderDueNow({ hours: 8, minutes: 0 }, now)).toBe(false);
  });
});
