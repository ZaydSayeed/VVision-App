import React from "react";
import { describe, it, expect, jest } from "@jest/globals";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { MedicationsCard, TasksCard } from "./TodayListCards";

const med = { id: "m1", name: "Donepezil", dosage: "10mg", time: "8:00 AM", taken_date: null } as any;
const task = { id: "t1", label: "Take a walk", time: "9:00 AM", completed_date: null } as any;

describe("MedicationsCard", () => {
  it("renders meds and fires onToggleTaken with the med id (adherence path)", () => {
    const onToggleTaken = jest.fn();
    render(
      <MedicationsCard
        meds={[med]}
        medsDone={0}
        isTakenToday={() => false}
        onToggleTaken={onToggleTaken}
        onAddMed={() => {}}
      />
    );
    expect(screen.getByText("Donepezil")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Mark Donepezil as taken"));
    expect(onToggleTaken).toHaveBeenCalledWith("m1");
  });

  it("shows the empty state when there are no meds", () => {
    render(
      <MedicationsCard meds={[]} medsDone={0} isTakenToday={() => false} onToggleTaken={() => {}} onAddMed={() => {}} />
    );
    expect(screen.getByText("No meds added yet.")).toBeTruthy();
  });
});

describe("TasksCard", () => {
  it("renders tasks and fires onToggleComplete; opening detail uses the task object", () => {
    const onToggleComplete = jest.fn();
    const onOpenTaskDetail = jest.fn();
    render(
      <TasksCard
        tasks={[task]}
        reminders={[]}
        isCompletedToday={() => false}
        onToggleComplete={onToggleComplete}
        onOpenTaskDetail={onOpenTaskDetail}
        onDeleteReminder={() => {}}
        onAddTask={() => {}}
      />
    );
    expect(screen.getByText("Take a walk")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Mark Take a walk as complete"));
    expect(onToggleComplete).toHaveBeenCalledWith("t1");
    fireEvent.press(screen.getByText("Take a walk"));
    expect(onOpenTaskDetail).toHaveBeenCalledWith(task);
  });
});
