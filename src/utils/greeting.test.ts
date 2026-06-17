import { describe, it, expect } from "vitest";
import { getGreeting } from "./greeting";

describe("getGreeting", () => {
  it("says good morning from 5:00 up to noon", () => {
    expect(getGreeting(5).text).toBe("Good morning");
    expect(getGreeting(11).text).toBe("Good morning");
    expect(getGreeting(5).icon).toBe("sunny");
  });

  it("says good afternoon from noon up to 17:00", () => {
    expect(getGreeting(12).text).toBe("Good afternoon");
    expect(getGreeting(16).text).toBe("Good afternoon");
  });

  it("says good evening from 17:00 up to 21:00", () => {
    expect(getGreeting(17).text).toBe("Good evening");
    expect(getGreeting(20).text).toBe("Good evening");
  });

  it("says good night from 21:00 through to 5:00", () => {
    expect(getGreeting(21).text).toBe("Good night");
    expect(getGreeting(23).text).toBe("Good night");
    expect(getGreeting(0).text).toBe("Good night");
    expect(getGreeting(4).text).toBe("Good night");
  });
});
