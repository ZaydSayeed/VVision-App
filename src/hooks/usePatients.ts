import { useState, useEffect, useCallback, useRef } from "react";
import { PatientSummary } from "../types";
import { fetchLinkedPatients } from "../api/client";

const POLL_INTERVAL = 15000;

export function usePatients() {
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const loadingRef = useRef(false);

  const load = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      const data = await fetchLinkedPatients();
      setPatients(data);
    } catch {
      setPatients([]);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [load]);

  return { patients, loading, refresh: load };
}
