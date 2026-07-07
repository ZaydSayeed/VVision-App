import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { renderHook, act, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";

jest.mock("../api/client", () => ({
  fetchMedications: jest.fn(),
  createMedication: jest.fn(),
  updateMedication: jest.fn(),
  deleteMedication: jest.fn(),
}));

// useMeds refreshes the widget snapshot after a successful toggle (Task 4).
// Mock AuthContext (avoids needing a real Supabase client in this test) and
// calendarApi's refresh helper (avoids requiring the native widget-bridge module).
jest.mock("../context/AuthContext", () => ({
  useAuth: () => ({ user: { id: "u1", patient_id: "p1", name: "Mom" } }),
}));
jest.mock("../services/calendarApi", () => ({
  refreshWidgetForPatient: jest.fn(() => Promise.resolve()),
}));

import { useMeds } from "./useMeds";
import * as client from "../api/client";

const today = new Date().toISOString().slice(0, 10);
const baseMed = { id: "m1", name: "Donepezil", dosage: "10mg", time: "8:00 AM", taken_date: null };

beforeEach(() => {
  jest.clearAllMocks();
  (client.fetchMedications as any).mockResolvedValue([{ ...baseMed }]);
});

describe("useMeds — optimistic check-off", () => {
  it("optimistically marks a med taken and keeps it on a successful save", async () => {
    (client.updateMedication as any).mockResolvedValue({ ...baseMed, taken_date: today });

    const { result } = renderHook(() => useMeds());
    await waitFor(() => expect(result.current.meds).toHaveLength(1));

    await act(async () => {
      await result.current.toggleTaken("m1");
    });

    expect(client.updateMedication).toHaveBeenCalledWith("m1", { taken_date: today });
    expect(result.current.meds[0].taken_date).toBe(today);
  });

  it("rolls back and alerts when the save fails — never leaves a false 'taken' (SAFE-3)", async () => {
    (client.updateMedication as any).mockRejectedValue(new Error("offline"));
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});

    const { result } = renderHook(() => useMeds());
    await waitFor(() => expect(result.current.meds).toHaveLength(1));

    await act(async () => {
      await result.current.toggleTaken("m1");
    });

    // The checkbox must NOT claim "taken" when the server never recorded it.
    expect(result.current.meds[0].taken_date).toBeNull();
    expect(alertSpy).toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});
