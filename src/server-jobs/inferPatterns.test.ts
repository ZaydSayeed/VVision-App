import { describe, it, expect } from "vitest";
import { parseGeminiResponse } from "./inferPatterns";

describe("parseGeminiResponse", () => {
  it("extracts an array of valid patterns, drops malformed ones", () => {
    const raw = `[
      {"title":"Tue 4pm agitation","description":"Seen 3 weeks","confidence":0.7,"evidenceCount":3,"firstObserved":"2026-03-01T00:00:00Z","lastObserved":"2026-04-01T00:00:00Z","tags":["weekly"]},
      {"title":"bad entry","description":""}
    ]`;
    const out = parseGeminiResponse(raw);
    expect(out).toHaveLength(1);
    expect(out[0].title).toContain("Tue");
  });
  it("handles code-fenced JSON", () => {
    const raw = "```json\n[]\n```";
    expect(parseGeminiResponse(raw)).toEqual([]);
  });
});
