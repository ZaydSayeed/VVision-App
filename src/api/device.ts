import { authFetch } from "./authFetch";

export type DeviceLink = {
  device_code: string;
  linked_at: string;
};

export type StageObservation = {
  patient_id: string;
  device_code: string;
  observed_stage: "early" | "mid" | "late";
  signals: {
    prompts_offered: number;
    prompts_responded: number;
    repetition_events: number;
    confused_switches: number;
    hallucination_events: number;
    recent_falls: number;
    minutes_observed: number;
    stationary_ratio: number;
  };
  observed_at: string;
};

export async function getDeviceLink(patientId: string): Promise<DeviceLink | null> {
  const res = await authFetch(`/api/profiles/${patientId}/device-link`);
  if (!res.ok) return null;
  return res.json();
}

export async function linkDevice(patientId: string, deviceCode: string): Promise<DeviceLink> {
  const res = await authFetch(`/api/profiles/${patientId}/device-link`, {
    method: "POST",
    body: JSON.stringify({ device_code: deviceCode }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({} as { detail?: string }));
    throw new Error(body.detail ?? "Failed to link device");
  }
  return res.json();
}

export async function unlinkDevice(patientId: string): Promise<void> {
  await authFetch(`/api/profiles/${patientId}/device-link`, { method: "DELETE" });
}

export async function getLatestStageObservation(patientId: string): Promise<StageObservation | null> {
  const res = await authFetch(`/api/profiles/${patientId}/stage-observations/latest`);
  if (!res.ok) return null;
  return res.json();
}
