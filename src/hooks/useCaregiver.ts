import { useState, useEffect, useCallback } from "react";
import { CaregiverProfile } from "../types";
import { fetchCaregiverProfiles } from "../api/client";

export function useCaregiver() {
  const [profiles, setProfiles] = useState<CaregiverProfile[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchCaregiverProfiles();
      setProfiles(data);
      setLoadError(null);
    } catch (e: any) {
      setLoadError(e?.message ?? "Failed to load caregiver info");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { profiles, loadError, refresh: load };
}
