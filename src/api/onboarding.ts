import { authFetch } from "./authFetch";

export type OnboardingStep = "profile_basics" | "profile_story" | "siblings" | "smart_home" | "caller_setup" | "paywall";

export async function getOnboarding(patientId: string) {
  const r = await authFetch(`/api/profiles/${patientId}/onboarding`);
  if (!r.ok) throw new Error("load failed");
  return r.json() as Promise<{ progress: Record<OnboardingStep, boolean>; completedAt: string | null }>;
}

export async function markStep(patientId: string, step: OnboardingStep, done = true) {
  const r = await authFetch(`/api/profiles/${patientId}/onboarding`, {
    method: "PATCH",
    body: JSON.stringify({ [step]: done }),
  });
  if (!r.ok) throw new Error("update failed");
  return r.json();
}
