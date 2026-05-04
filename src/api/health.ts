import { authFetch } from "./authFetch";

export type Reading = {
  metric: "steps" | "heart_rate" | "active_minutes" | "sleep";
  date: string;
  value: number;
  unit: string;
};

export async function syncReadings(
  patientId: string,
  readings: Reading[]
): Promise<{ written: number }> {
  const r = await authFetch(`/api/profiles/${patientId}/health/sync`, {
    method: "POST",
    body: JSON.stringify({ readings }),
  });
  if (!r.ok) throw new Error((await r.json()).detail);
  return r.json();
}

export type Summary = {
  date: string;
  steps: { value: number; unit: string } | null;
  heartRate: { value: number; unit: string } | null;
  activeMinutes: { value: number; unit: string } | null;
  sleep: { value: number; unit: string } | null;
};

export async function getSummary(patientId: string): Promise<Summary> {
  const r = await authFetch(`/api/profiles/${patientId}/health/summary`);
  if (!r.ok) throw new Error("summary load failed");
  return r.json();
}

export type TrendPoint = { date: string; value: number };
export type Trend = { metric: string; range: string; points: TrendPoint[] };

export async function getTrend(
  patientId: string,
  metric: Reading["metric"],
  range: "1d" | "7d" | "30d" | "90d"
): Promise<Trend> {
  const r = await authFetch(
    `/api/profiles/${patientId}/health/trends?metric=${metric}&range=${range}`
  );
  if (!r.ok) throw new Error("trend load failed");
  return r.json();
}
