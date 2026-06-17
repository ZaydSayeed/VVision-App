import React from "react";
import { describe, it, expect, jest } from "@jest/globals";
import { Animated } from "react-native";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { NotificationPanel } from "./NotificationPanel";

const anim = () => new Animated.Value(0);

const baseProps = {
  visible: true,
  slideAnim: anim(),
  backdropAnim: anim(),
  onClose: () => {},
  totalNotifs: 0,
  pendingTasks: [],
  pendingMeds: [],
};

describe("NotificationPanel", () => {
  it("shows the all-caught-up empty state when nothing is pending", () => {
    render(<NotificationPanel {...baseProps} />);
    expect(screen.getByText("You're all caught up!")).toBeTruthy();
  });

  it("lists pending tasks and meds under their sections", () => {
    render(
      <NotificationPanel
        {...baseProps}
        totalNotifs={2}
        pendingTasks={[{ id: "t1", label: "Take a walk", time: "9:00 AM" }] as any}
        pendingMeds={[{ id: "m1", name: "Donepezil", dosage: "10mg", time: "8:00 AM" }] as any}
      />
    );
    expect(screen.getByText("Routine Tasks")).toBeTruthy();
    expect(screen.getByText("Take a walk")).toBeTruthy();
    expect(screen.getByText("Medications")).toBeTruthy();
    expect(screen.getByText("Donepezil")).toBeTruthy();
    expect(screen.queryByText("You're all caught up!")).toBeNull();
  });

  it("calls onClose when the close button is pressed", () => {
    const onClose = jest.fn();
    render(<NotificationPanel {...baseProps} onClose={onClose} />);
    fireEvent.press(screen.getByLabelText("Close reminders"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
