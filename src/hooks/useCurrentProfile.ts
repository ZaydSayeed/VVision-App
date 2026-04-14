import { useAuth } from "../context/AuthContext";

/**
 * Returns the currently linked patient's ID for the logged-in caregiver (or patient's own ID).
 * This is the canonical way to get patientId for Living Profile operations.
 */
export function useCurrentProfile(): { patientId: string | undefined } {
  const { user } = useAuth();
  return { patientId: user?.patient_id ?? undefined };
}
