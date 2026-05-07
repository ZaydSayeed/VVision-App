import { useEffect, useState, useCallback } from "react";
import { getTrend, TrendPoint } from "../api/health";
import type { Range } from "../components/health/RangeToggle";

type Metric = "steps" | "heart_rate" | "active_minutes" | "sleep";

export function useMetricTrend(
  patientId: string | null,
  metric: Metric,
  range: Range,
  enabled: boolean
) {
  const [points, setPoints] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!patientId || !enabled) return;
    setLoading(true);
    setPoints([]); // clear stale data so chart doesn't show old range while loading
    try {
      const result = await getTrend(patientId, metric, range);
      setPoints(result.points);
    } catch {
      setPoints([]);
    } finally {
      setLoading(false);
    }
  }, [patientId, metric, range, enabled]);

  useEffect(() => { load(); }, [load]);

  return { points, loading };
}
