import { useEffect, useState, useCallback } from "react";
import { getSummary, Summary } from "../api/health";

export function useHealthSummary(patientId: string | null) {
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    setError(null);
    try {
      setData(await getSummary(patientId));
    } catch (e: any) {
      setError(e.message ?? "load failed");
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => { refresh(); }, [refresh]);

  return { data, loading, error, refresh };
}
