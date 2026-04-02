import { useState, useEffect, useCallback } from "react";
import { PatientSummary } from "../types";
import { fetchLinkedPatients } from "../api/client";

export function usePatients() {
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await fetchLinkedPatients();
      setPatients(data);
    } catch {
      setPatients([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { patients, loading, refresh: load };
}
