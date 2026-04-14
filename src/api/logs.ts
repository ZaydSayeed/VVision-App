import { authFetch } from "./authFetch";

export interface CheckInLog {
  id: string;
  content: string;
  source: "voice_check_in" | "text_check_in";
  capturedAt: string;
}

export interface LogSummary {
  bullets: string[];
  trend: string;
}

export async function fetchLogs(patientId: string): Promise<CheckInLog[]> {
  const res = await authFetch(`/api/profiles/${patientId}/memory/logs`);
  if (!res.ok) throw new Error(`Failed to fetch logs: ${res.status}`);
  const data = await res.json();
  return data.logs ?? [];
}

export async function summarizeLog(patientId: string, log: CheckInLog): Promise<LogSummary> {
  const res = await authFetch(`/api/profiles/${patientId}/memory/logs/summarize`, {
    method: "POST",
    body: JSON.stringify({ logId: log.id, content: log.content, capturedAt: log.capturedAt }),
  });
  if (!res.ok) throw new Error(`Failed to summarize: ${res.status}`);
  return res.json();
}
