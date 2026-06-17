import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";
import { renderHook, act } from "@testing-library/react-native";
import { useClock } from "./useClock";

beforeEach(() => { jest.useFakeTimers(); });
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe("useClock", () => {
  it("returns the current time and re-ticks on the interval", () => {
    jest.setSystemTime(new Date("2026-06-17T08:00:00Z"));
    const { result } = renderHook(() => useClock(60000));
    expect(result.current.getHours()).toBe(new Date("2026-06-17T08:00:00Z").getHours());

    act(() => {
      jest.setSystemTime(new Date("2026-06-17T09:00:00Z"));
      jest.advanceTimersByTime(60000);
    });
    expect(result.current.getHours()).toBe(new Date("2026-06-17T09:00:00Z").getHours());
  });

  it("clears its interval on unmount", () => {
    const clearSpy = jest.spyOn(global, "clearInterval");
    const { unmount } = renderHook(() => useClock());
    unmount();
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });
});
