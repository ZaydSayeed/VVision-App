import { useState, useEffect, useCallback } from "react";
import { Alert } from "react-native";
import { Medication } from "../types";
import { isDoneToday } from "../config/storage";
import {
  fetchMedications,
  createMedication,
  updateMedication,
  deleteMedication,
} from "../api/client";
import { useAuth } from "../context/AuthContext";
import { refreshWidgetForPatient } from "../services/calendarApi";

export function useMeds(patientId?: string) {
  const { user } = useAuth();
  const [meds, setMeds] = useState<Medication[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchMedications();
      setMeds(data);
      setLoadError(null);
    } catch (e: any) {
      setLoadError(e?.message ?? "Couldn't load medications. Check your connection and try again.");
    }
  }, [patientId]);

  useEffect(() => {
    load();
  }, [load]);

  const addMed = useCallback(async (name: string, dosage: string, time: string) => {
    const data = await createMedication(name, dosage, time);
    setMeds((prev) => [...prev, data]);
  }, []);

  const toggleTaken = useCallback(
    async (id: string) => {
      const med = meds.find((m) => m.id === id);
      if (!med) return;
      const today = new Date().toISOString().slice(0, 10);
      const newDate = med.taken_date === today ? null : today;
      const previous = meds;

      // Optimistic: reflect the tap immediately so the checkbox never lags.
      setMeds((prev) => prev.map((m) => (m.id === id ? { ...m, taken_date: newDate } : m)));
      try {
        const data = await updateMedication(id, { taken_date: newDate });
        setMeds((prev) => prev.map((m) => (m.id === id ? data : m)));
        const targetPatientId = patientId ?? user?.patient_id ?? undefined;
        if (targetPatientId) {
          refreshWidgetForPatient(targetPatientId, user?.name).catch((err) =>
            console.warn("[widget] snapshot refresh failed (non-fatal):", err)
          );
        }
      } catch {
        // Roll back — a medication checkbox must never lie about whether a dose
        // was logged (false "taken" risks a missed or double dose). (SAFE-3)
        setMeds(previous);
        Alert.alert(
          "Not saved",
          "We couldn't update this medication. Please check your connection and try again."
        );
      }
    },
    [meds, patientId, user]
  );

  const editMed = useCallback(async (id: string, name: string, dosage: string, time: string) => {
    const data = await updateMedication(id, { name, dosage, time });
    setMeds((prev) => prev.map((m) => (m.id === id ? data : m)));
  }, []);

  const deleteMed = useCallback(async (id: string) => {
    await deleteMedication(id);
    setMeds((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const isTakenToday = (med: Medication) => isDoneToday(med.taken_date);

  return { meds, addMed, editMed, toggleTaken, deleteMed, isTakenToday, loadError, reload: load };
}
