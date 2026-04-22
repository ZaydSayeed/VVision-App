import { useCallback, useEffect, useState } from "react";
import { getOnboarding, markStep, OnboardingStep } from "../api/onboarding";
import { useCurrentProfile } from "./useCurrentProfile";

export function useOnboarding() {
  const { patientId } = useCurrentProfile();
  const [progress, setProgress] = useState<Record<OnboardingStep, boolean>>({} as any);
  const [completed, setCompleted] = useState(false);
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
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
