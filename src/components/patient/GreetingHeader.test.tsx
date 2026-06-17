import React from "react";
import { describe, it, expect, jest } from "@jest/globals";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { GreetingHeader } from "./GreetingHeader";

const greeting = { text: "Good morning", icon: "sunny" as const };

describe("GreetingHeader", () => {
  it("renders the greeting text and the patient's first name", () => {
    render(<GreetingHeader greeting={greeting} firstName="Rosa" notifCount={0} onOpenNotifs={() => {}} />);
    expect(screen.getByText("Good morning,")).toBeTruthy();
    expect(screen.getByText("Rosa")).toBeTruthy();
  });

  it("shows the pending count badge and opens reminders on press", () => {
    const onOpenNotifs = jest.fn();
    render(<GreetingHeader greeting={greeting} firstName="Rosa" notifCount={4} onOpenNotifs={onOpenNotifs} />);
    expect(screen.getByText("4")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Reminders"));
    expect(onOpenNotifs).toHaveBeenCalledTimes(1);
  });

  it("hides the badge when nothing is pending", () => {
    render(<GreetingHeader greeting={greeting} firstName="Rosa" notifCount={0} onOpenNotifs={() => {}} />);
    expect(screen.queryByText("0")).toBeNull();
  });
});
