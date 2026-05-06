import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

export interface AuthInfo {
  userId: string; // supabase_uid
  token: string;
}

export interface UserRow {
  id: string;
  supabase_uid: string;
  email: string;
  name: string;
  role: string;
  patient_id: string | null;
}

// Verify Supabase JWT — returns supabase_uid or null
export async function verifyUser(req: Request): Promise<AuthInfo | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);

  const resp = await fetch(`${Deno.env.get("SUPABASE_URL")}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: Deno.env.get("SUPABASE_ANON_KEY")!,
    },
  });
  if (resp.status !== 200) return null;
  const data = await resp.json() as { id?: string };
  if (!data.id) return null;
  return { userId: data.id, token };
}

// Resolve the user's linked patient_id from the users table
export async function resolvePatientId(
  supabase: SupabaseClient,
  supabaseUid: string,
): Promise<{ patientId: string; user: UserRow } | { error: string; status: number }> {
  const { data: user } = await supabase
    .from("users")
    .select("*")
    .eq("supabase_uid", supabaseUid)
    .maybeSingle();

  if (!user) return { error: "Profile not found. Sign in again.", status: 404 };
  if (!user.patient_id) {
    const msg = user.role === "caregiver"
      ? "Ask your patient for their link code."
      : "Account setup incomplete.";
    return { error: `No patient linked to your account. ${msg}`, status: 404 };
  }
  return { patientId: user.patient_id, user };
}

// Check that userId has a seat on patientId (or is linked via users.patient_id)
export async function requirePatientAccess(
  supabase: SupabaseClient,
  userId: string,
  patientId: string,
): Promise<boolean> {
  const { data: seat } = await supabase
    .from("seats")
    .select("id")
    .eq("user_id", userId)
    .eq("patient_id", patientId)
    .maybeSingle();
  if (seat) return true;

  const { data: user } = await supabase
    .from("users")
    .select("patient_id")
    .eq("supabase_uid", userId)
    .maybeSingle();
  if (user && user.patient_id === patientId) return true;

  return false;
}

// Check if request uses a device token (glasses) rather than a Supabase JWT
export function isDeviceToken(req: Request): boolean {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;
  const token = authHeader.slice(7);
  const deviceToken = Deno.env.get("DVISION_PATIENT_TOKEN");
  return !!deviceToken && token === deviceToken;
}

export function makeSupabase(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}
