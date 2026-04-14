import { authFetch } from "./authFetch";

export async function listPatterns(patientId: string) {
  const r = await authFetch(`/api/profiles/${patientId}/patterns`);
  if (!r.ok) throw new Error("load failed");
  return r.json() as Promise<{ patterns: Array<any> }>;
}

export async function dismissPattern(patientId: string, patternId: string) {
  const r = await authFetch(`/api/profiles/${patientId}/patterns/${patternId}/dismiss`, { method: "POST" });
  if (!r.ok) throw new Error("dismiss failed");
  return r.json();
}
