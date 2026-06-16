import { useCallback, useEffect, useState } from "react";
import { ConsentCategory, ConsentState, getConsent, updateConsent } from "../api/consent";
import { useCurrentProfile } from "./useCurrentProfile";

export function useConsent() {
  const { patientId } = useCurrentProfile();
  const [consent, setConsent] = useState<ConsentState | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!patientId) {
      setReady(true);
      return;
    }
    try {
      setConsent(await getConsent(patientId));
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? "Couldn't load privacy settings");
    } finally {
      setReady(true);
    }
  }, [patientId]);

  useEffect(() => {
    load();
  }, [load]);

  const setCategory = useCallback(
    async (category: ConsentCategory, value: boolean) => {
      if (!patientId) return;
      const previous = consent;
      // Optimistic toggle, roll back on failure.
      setConsent((c) => (c ? { ...c, [category]: value } : c));
      try {
        const updated = await updateConsent(patientId, { [category]: value });
        setConsent(updated);
      } catch (e: any) {
        setConsent(previous);
        setError(e?.message ?? "Couldn't update privacy settings");
        throw e;
      }
    },
    [patientId, consent]
  );

  return { consent, ready, error, setCategory, reload: load };
}
