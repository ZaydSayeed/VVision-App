import { authFetch } from "./authFetch";

export async function generateReport(
  patientId: string, startDate: string, endDate: string, visitId?: string
): Promise<Blob> {
  const res = await authFetch(`/api/profiles/${patientId}/report`, {
    method: "POST",
    body: JSON.stringify({ startDate, endDate, visitId }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Report generation failed (${res.status}). ${detail}`);
  }
  return res.blob();
}

export async function emailReport(
  patientId: string, startDate: string, endDate: string, doctorId: string, visitId?: string
): Promise<{ sentTo: string }> {
  const res = await authFetch(`/api/profiles/${patientId}/report/email`, {
    method: "POST",
    body: JSON.stringify({ startDate, endDate, doctorId, visitId }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Email failed (${res.status}). ${detail}`);
  }
  return res.json();
}

export async function generateReportLink(
  patientId: string, startDate: string, endDate: string, visitId?: string
): Promise<{ url: string; expiresAt: string }> {
  const res = await authFetch(`/api/profiles/${patientId}/report/link`, {
    method: "POST",
    body: JSON.stringify({ startDate, endDate, visitId }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Link generation failed (${res.status}). ${detail}`);
  }
  return res.json();
}
