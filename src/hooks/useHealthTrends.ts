import { useEffect, useState, useCallback } from "react";
import { getTrend, Trend } from "../api/health";
import type { Range } from "../components/health/RangeToggle";

type Metric = "steps" | "heart_rate" | "active_minutes" | "sleep";

export function useHealthTrends(patientId: string | null, range: Range) {
  const [trends, setTrends] = useState<Record<Metric, Trend | null>>({
    steps: null, heart_rate: null, active_minutes: null, sleep: null,
  });
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    try {
      const metrics: Metric[] = ["steps", "heart_rate", "active_minutes", "sleep"];
      const results = await Promise.all(metrics.map((m) => getTrend(patientId, m, range)));
      setTrends({
        steps: results[0], heart_rate: results[1], active_minutes: results[2], sleep: results[3],
      });
    } catch (e) {
      console.warn("[useHealthTrends]", e);
    } finally {
      setLoading(false);
    }
  }, [patientId, range]);

  useEffect(() => { refresh(); }, [refresh]);

  return { trends, loading, refresh };
}
