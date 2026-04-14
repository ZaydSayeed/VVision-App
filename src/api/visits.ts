import { authFetch } from "./authFetch";

export async function listVisits(patientId: string) {
  const r = await authFetch(`/api/profiles/${patientId}/visits`);
  if (!r.ok) throw new Error("load failed");
  return r.json() as Promise<{ visits: Array<any> }>;
}

export async function createVisit(
  patientId: string,
  body: { providerName: string; scheduledFor: string; providerRole?: string; notes?: string }
) {
  const r = await authFetch(`/api/profiles/${patientId}/visits`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error((await r.json()).detail);
  return r.json() as Promise<{ id: string }>;
}
