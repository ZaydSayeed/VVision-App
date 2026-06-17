import React from "react";
import { describe, it, expect } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import { GlassesComingSoon } from "./GlassesComingSoon";

describe("GlassesComingSoon", () => {
  it("renders the title, the coming-soon chip, and the description", () => {
    render(
      <GlassesComingSoon
        title="Daily Digest"
        description="A plain-language recap of the day."
      />
    );

    expect(screen.getByText("Daily Digest")).toBeTruthy();
    expect(screen.getByText("Coming soon")).toBeTruthy();
    expect(screen.getByText("A plain-language recap of the day.")).toBeTruthy();
  });
});
