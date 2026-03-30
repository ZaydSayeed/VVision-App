import { useState, useEffect, useCallback } from "react";
import { CaregiverProfile } from "../types";
import { STORAGE_KEYS, readStorage, writeStorage } from "../config/storage";

export function useCaregiver() {
  const [profiles, setProfiles] = useState<CaregiverProfile[]>([]);

  useEffect(() => {
    readStorage<CaregiverProfile[]>(STORAGE_KEYS.CAREGIVER_PROFILES, []).then(setProfiles);
  }, []);

  const persist = useCallback(async (updated: CaregiverProfile[]) => {
    setProfiles(updated);
    await writeStorage(STORAGE_KEYS.CAREGIVER_PROFILES, updated);
  }, []);

  const addProfile = useCallback(async (name: string, phone: string, relation: string) => {
    const profile: CaregiverProfile = {
      id: Date.now().toString(),
      name,
      phone,
      relation,
      addedAt: new Date().toISOString(),
    };
    const current = await readStorage<CaregiverProfile[]>(STORAGE_KEYS.CAREGIVER_PROFILES, []);
    await persist([...current, profile]);
  }, [persist]);

  const deleteProfile = useCallback(async (id: string) => {
    const current = await readStorage<CaregiverProfile[]>(STORAGE_KEYS.CAREGIVER_PROFILES, []);
    await persist(current.filter((p) => p.id !== id));
  }, [persist]);

  return { profiles, addProfile, deleteProfile };
}
