import { describe, it, expect } from "vitest";
import { contrastRatio } from "./contrast";
import { lightColors, darkColors } from "./theme";

const AA = 4.5; // WCAG AA for normal-size text

describe("contrastRatio", () => {
  it("black on white is 21:1", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 0);
  });
  it("identical colors are 1:1", () => {
    expect(contrastRatio("#7B5CE7", "#7B5CE7")).toBeCloseTo(1, 5);
  });
});

describe("muted text meets WCAG AA on every surface it sits on", () => {
  it("light muted is readable on bg / surface / warm / warmSurface", () => {
    for (const surface of [
      lightColors.bg,
      lightColors.surface,
      lightColors.warm,
      lightColors.warmSurface,
    ]) {
      expect(contrastRatio(lightColors.muted, surface)).toBeGreaterThanOrEqual(AA);
    }
  });

  it("dark muted is readable on bg / surface", () => {
    for (const surface of [darkColors.bg, darkColors.surface]) {
      expect(contrastRatio(darkColors.muted, surface)).toBeGreaterThanOrEqual(AA);
    }
  });
});
