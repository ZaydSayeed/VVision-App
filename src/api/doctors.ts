import { authFetch } from "./authFetch";

export interface Doctor {
  id: string;
  name: string;
  email: string;
}

export async function fetchDoctors(patientId: string): Promise<Doctor[]> {
  const res = await authFetch(`/api/profiles/${patientId}/doctors`);
  if (!res.ok) throw new Error(`Failed to load doctors: ${res.status}`);
  const data = await res.json();
  return data.doctors ?? [];
}

export async function addDoctor(patientId: string, name: string, email: string): Promise<Doctor> {
  const res = await authFetch(`/api/profiles/${patientId}/doctors`, {
    method: "POST",
    body: JSON.stringify({ name, email }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Failed to add doctor (${res.status}). ${detail}`);
  }
  return res.json();
}

export async function removeDoctor(patientId: string, doctorId: string): Promise<void> {
  const res = await authFetch(`/api/profiles/${patientId}/doctors/${doctorId}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Failed to remove doctor: ${res.status}`);
}
