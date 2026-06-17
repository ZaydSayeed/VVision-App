import React from "react";
import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";
import { render, screen, fireEvent } from "@testing-library/react-native";

jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn(),
  impactAsync: jest.fn(),
  NotificationFeedbackType: { Error: "error" },
  ImpactFeedbackStyle: { Heavy: "heavy" },
}));
// Reduce Motion ON so the decorative ring loop (Animated.loop, unmocked by
// jest-expo) is skipped — the copy + action buttons render identically either way.
jest.mock("../hooks/useReducedMotion", () => ({ useReducedMotion: () => true }));

import { UrgentAlertOverlay } from "./UrgentAlertOverlay";

const baseProps = {
  visible: true,
  pendingCount: 1,
  latestTimestamp: undefined,
  onRespond: () => {},
  onMarkHandled: () => {},
};

// The overlay schedules haptic setTimeouts when shown; fake timers keep them
// from leaking past the test and triggering a worker-exit warning.
beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe("UrgentAlertOverlay", () => {
  it("renders the SOS copy + both actions when visible", () => {
    render(<UrgentAlertOverlay {...baseProps} />);
    expect(screen.getByText("Help Requested")).toBeTruthy();
    expect(screen.getByText("Urgent")).toBeTruthy();
    expect(screen.getByLabelText("I'm responding now")).toBeTruthy();
    expect(screen.getByLabelText("Mark this help request as handled")).toBeTruthy();
  });

  it("renders nothing when not visible", () => {
    render(<UrgentAlertOverlay {...baseProps} visible={false} />);
    expect(screen.queryByText("Help Requested")).toBeNull();
  });

  it("calls onRespond when 'I'm Responding Now' is pressed (SAFE — stops escalation)", () => {
    const onRespond = jest.fn();
    render(<UrgentAlertOverlay {...baseProps} onRespond={onRespond} />);
    fireEvent.press(screen.getByLabelText("I'm responding now"));
    expect(onRespond).toHaveBeenCalledTimes(1);
  });

  it("calls onMarkHandled when 'Mark as Handled' is pressed", () => {
    const onMarkHandled = jest.fn();
    render(<UrgentAlertOverlay {...baseProps} onMarkHandled={onMarkHandled} />);
    fireEvent.press(screen.getByLabelText("Mark this help request as handled"));
    expect(onMarkHandled).toHaveBeenCalledTimes(1);
  });

  it("shows a pending-count line only when more than one request is pending", () => {
    const { rerender } = render(<UrgentAlertOverlay {...baseProps} pendingCount={1} />);
    expect(screen.queryByText(/pending request/)).toBeNull();
    rerender(<UrgentAlertOverlay {...baseProps} pendingCount={3} />);
    expect(screen.getByText("3 pending requests")).toBeTruthy();
  });
});
