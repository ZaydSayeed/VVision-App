import { useState, useEffect, useCallback } from "react";
import { Medication } from "../types";
import { STORAGE_KEYS, readStorage, writeStorage, today } from "../config/storage";

export function useMeds() {
  const [meds, setMeds] = useState<Medication[]>([]);

  useEffect(() => {
    readStorage<Medication[]>(STORAGE_KEYS.MEDICATIONS, []).then(setMeds);
  }, []);

  const persist = useCallback(async (updated: Medication[]) => {
    setMeds(updated);
    await writeStorage(STORAGE_KEYS.MEDICATIONS, updated);
  }, []);

  const addMed = useCallback(async (name: string, dosage: string, time: string) => {
    const med: Medication = {
      id: Date.now().toString(),
      name,
      dosage,
      time,
      takenDate: null,
    };
    const current = await readStorage<Medication[]>(STORAGE_KEYS.MEDICATIONS, []);
    await persist([...current, med]);
  }, [persist]);

  const toggleTaken = useCallback(async (id: string) => {
    const current = await readStorage<Medication[]>(STORAGE_KEYS.MEDICATIONS, []);
    const t = today();
    const updated = current.map((med) =>
      med.id === id
        ? { ...med, takenDate: med.takenDate === t ? null : t }
        : med
    );
    await persist(updated);
  }, [persist]);

  const deleteMed = useCallback(async (id: string) => {
    const current = await readStorage<Medication[]>(STORAGE_KEYS.MEDICATIONS, []);
    await persist(current.filter((m) => m.id !== id));
  }, [persist]);

  const isTakenToday = (med: Medication) => med.takenDate === today();

  return { meds, addMed, toggleTaken, deleteMed, isTakenToday };
}
