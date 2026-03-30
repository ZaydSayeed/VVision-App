import { useState, useEffect, useCallback } from "react";
import { Medication } from "../types";
import {
  fetchMedications,
  createMedication,
  updateMedication,
  deleteMedication,
} from "../api/client";

function today(): string {
  return new Date().toISOString().split("T")[0];
}

export function useMeds() {
  const [meds, setMeds] = useState<Medication[]>([]);

  const load = useCallback(async () => {
    try {
      const data = await fetchMedications();
      setMeds(data);
    } catch {
      // Keep current state on error
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addMed = useCallback(
    async (name: string, dosage: string, time: string) => {
      const med = await createMedication(name, dosage, time);
      setMeds((prev) => [...prev, med]);
    },
    []
  );

  const toggleTaken = useCallback(
    async (id: string) => {
      const med = meds.find((m) => m.id === id);
      if (!med) return;

      const t = today();
      const newDate = med.taken_date === t ? null : t;
      const updated = await updateMedication(id, { taken_date: newDate });
      setMeds((prev) => prev.map((m) => (m.id === id ? updated : m)));
    },
    [meds]
  );

  const deleteMed = useCallback(async (id: string) => {
    await deleteMedication(id);
    setMeds((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const isTakenToday = (med: Medication) => med.taken_date === today();

  return { meds, addMed, toggleTaken, deleteMed, isTakenToday };
}
