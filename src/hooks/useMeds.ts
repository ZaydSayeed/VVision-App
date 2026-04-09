import { useState, useEffect, useCallback } from "react";
import { Medication } from "../types";
import { isDoneToday } from "../config/storage";
import {
  fetchMedications,
  createMedication,
  updateMedication,
  deleteMedication,
} from "../api/client";

export function useMeds(patientId?: string) {
  const [meds, setMeds] = useState<Medication[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchMedications();
      setMeds(data);
      setLoadError(null);
    } catch (e: any) {
      setLoadError(e?.message ?? "Failed to load medications");
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
      const data = await updateMedication(id, { taken_date: newDate });
      setMeds((prev) => prev.map((m) => (m.id === id ? data : m)));
    },
    [meds]
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
