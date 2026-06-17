import React from "react";
import { describe, it, expect, jest } from "@jest/globals";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { AddChooserSheet } from "./AddChooserSheet";

describe("AddChooserSheet", () => {
  it("routes to the task flow when 'A routine task' is chosen", () => {
    const onChooseTask = jest.fn();
    const onChooseMed = jest.fn();
    render(
      <AddChooserSheet visible onClose={() => {}} onChooseTask={onChooseTask} onChooseMed={onChooseMed} />
    );
    fireEvent.press(screen.getByText("A routine task"));
    expect(onChooseTask).toHaveBeenCalledTimes(1);
    expect(onChooseMed).not.toHaveBeenCalled();
  });

  it("routes to the medication flow when 'A medication' is chosen", () => {
    const onChooseTask = jest.fn();
    const onChooseMed = jest.fn();
    render(
      <AddChooserSheet visible onClose={() => {}} onChooseTask={onChooseTask} onChooseMed={onChooseMed} />
    );
    fireEvent.press(screen.getByText("A medication"));
    expect(onChooseMed).toHaveBeenCalledTimes(1);
    expect(onChooseTask).not.toHaveBeenCalled();
  });
});
