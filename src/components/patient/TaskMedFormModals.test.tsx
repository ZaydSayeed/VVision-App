import React from "react";
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: any) => children,
}));
jest.mock("../shared/TimeSlider", () => ({
  TimeSlider: ({ onChange }: any) => {
    const { Text } = require("react-native");
    return <Text accessibilityLabel="set-time" onPress={() => onChange("9:00 AM")}>time</Text>;
  },
}));

import { AddTaskModal, AddMedModal } from "./TaskMedFormModals";

beforeEach(() => { jest.clearAllMocks(); });

describe("AddTaskModal", () => {
  it("blocks submit and shows an error when fields are empty", () => {
    const onAdd = jest.fn(async () => {});
    const onClose = jest.fn();
    render(<AddTaskModal visible onClose={onClose} onAdd={onAdd} />);

    fireEvent.press(screen.getByText("Add"));

    expect(screen.getByText("Please fill in both fields.")).toBeTruthy();
    expect(onAdd).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("submits trimmed values and closes on success", async () => {
    const onAdd = jest.fn(async () => {});
    const onClose = jest.fn();
    render(<AddTaskModal visible onClose={onClose} onAdd={onAdd} />);

    fireEvent.changeText(screen.getByPlaceholderText("e.g. Morning walk"), "  Walk  ");
    fireEvent.press(screen.getByLabelText("set-time"));
    fireEvent.press(screen.getByText("Add"));

    await waitFor(() => expect(onAdd).toHaveBeenCalledWith("Walk", "9:00 AM"));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});

describe("AddMedModal", () => {
  it("requires all three fields before submitting", () => {
    const onAdd = jest.fn(async () => {});
    render(<AddMedModal visible onClose={() => {}} onAdd={onAdd} />);

    fireEvent.press(screen.getByText("Add"));

    expect(screen.getByText("Please fill in all fields.")).toBeTruthy();
    expect(onAdd).not.toHaveBeenCalled();
  });
});
