import { authFetch } from "./authFetch";

export async function inviteSeat(
  patientId: string,
  email: string,
  role: "sibling" | "paid_aide" | "clinician"
) {
  const res = await authFetch(`/api/profiles/${patientId}/seats`, {
    method: "POST",
    body: JSON.stringify({ email, role }),
  });
  if (!res.ok) throw new Error((await res.json()).detail ?? "Invite failed");
  return res.json() as Promise<{ token: string; status: "pending" }>;
}

export async function listSeats(patientId: string) {
  const res = await authFetch(`/api/profiles/${patientId}/seats`);
  if (!res.ok) throw new Error("Failed to load seats");
  return res.json() as Promise<{
    seats: Array<{ userId: string; role: string; createdAt: string }>;
    invites: Array<{ email: string; role: string; status: string }>;
  }>;
}

export async function acceptInvite(token: string) {
  const res = await authFetch(`/api/profiles/accept-invite`, {
    method: "POST",
    body: JSON.stringify({ token }),
  });
  if (!res.ok) throw new Error((await res.json()).detail ?? "Accept failed");
  return res.json() as Promise<{ ok: true; patientId: string; role: string }>;
}
