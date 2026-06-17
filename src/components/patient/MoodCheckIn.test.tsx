import React from "react";
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MoodCheckIn } from "./MoodCheckIn";

const user = { id: "u1", role: "patient" } as any;

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  (global as any).fetch = jest.fn(async () => ({ ok: true, status: 200 }));
});

describe("MoodCheckIn", () => {
  it("renders the prompt and all four moods", () => {
    render(<MoodCheckIn user={user} />);
    expect(screen.getByText("How are you feeling today?")).toBeTruthy();
    expect(screen.getByLabelText("Happy")).toBeTruthy();
    expect(screen.getByLabelText("Sad")).toBeTruthy();
  });

  it("submits the chosen mood and hides the card", async () => {
    render(<MoodCheckIn user={user} />);
    fireEvent.press(screen.getByLabelText("Happy"));

    await waitFor(() =>
      expect((global as any).fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/mood"),
        expect.objectContaining({ method: "POST", body: JSON.stringify({ mood: "happy" }) })
      )
    );
    await waitFor(() =>
      expect(screen.queryByText("How are you feeling today?")).toBeNull()
    );
  });

  it("stays hidden if the patient already checked in today", async () => {
    const today = new Date().toISOString().slice(0, 10);
    await AsyncStorage.setItem(`@vela/mood_submitted:u1:${today}`, "1");
    render(<MoodCheckIn user={user} />);

    await waitFor(() =>
      expect(screen.queryByText("How are you feeling today?")).toBeNull()
    );
  });
});
