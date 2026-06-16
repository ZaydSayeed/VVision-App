import { useCallback, useEffect, useState } from "react";
import { getOnboarding, markStep, OnboardingStep } from "../api/onboarding";
import { useCurrentProfile } from "./useCurrentProfile";

export function useOnboarding() {
  const { patientId } = useCurrentProfile();
  const [progress, setProgress] = useState<Record<OnboardingStep, boolean>>({} as any);
  const [completed, setCompleted] = useState(false);
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    // NOTE: the 6-step caregiver wizard (OnboardingNavigator) is not enabled.
    // Its first step (ProfileBasicsStep) only PATCHes an existing patient and
    // bails without a patientId, so it cannot create a profile for a brand-new
    // caregiver — surfacing it would dead-end them. Until a "caregiver creates
    // profile" flow exists, the working path is signup → dashboard → link code
    // (fixed via patient_id refresh + seat-on-link). Keep ready=false when there
    // is no patientId so the gate routes to the dashboard, not the broken wizard.
    if (!patientId) return;
    try {
      const r = await getOnboarding(patientId);
      setProgress(r.progress);
      setCompleted(!!r.completedAt);
    } finally {
      setReady(true);
    }
  }, [patientId]);

  useEffect(() => { load(); }, [load]);

  const complete = async (step: OnboardingStep) => {
    if (!patientId) return;
    const r = await markStep(patientId, step);
    setProgress(r.progress);
    setCompleted(!!r.completedAt);
  };

  return { progress, completed, complete, ready };
}
