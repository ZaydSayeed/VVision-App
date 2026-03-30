import { useState, useEffect, useCallback } from "react";
import { CaregiverProfile } from "../types";
import { fetchCaregiverProfiles } from "../api/client";

export function useCaregiver() {
  const [profiles, setProfiles] = useState<CaregiverProfile[]>([]);

  const load = useCallback(async () => {
    try {
      const data = await fetchCaregiverProfiles();
      setProfiles(data);
    } catch {
      // Keep current state on error
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { profiles, refresh: load };
}
