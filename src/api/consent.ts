import { authFetch } from "./authFetch";

export interface ConsentState {
  healthMetrics: boolean;
  activityPatterns: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
  updatedByRole: string | null;
}

export type ConsentCategory = "healthMetrics" | "activityPatterns";

export async function getConsent(patientId: string): Promise<ConsentState> {
  const r = await authFetch(`/api/profiles/${patientId}/consent`);
  if (!r.ok) throw new Error("Couldn't load privacy settings");
  return r.json();
}

export async function updateConsent(
  patientId: string,
  patch: Partial<Record<ConsentCategory, boolean>>
): Promise<ConsentState> {
  const r = await authFetch(`/api/profiles/${patientId}/consent`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  if (!r.ok) throw new Error("Couldn't update privacy settings");
  return r.json();
}
