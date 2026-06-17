import { Db } from "mongodb";

/**
 * Patient data-sharing consent (EMO-1, ASR-4).
 *
 * Opt-IN by default: nothing is shared with the care team until a category is
 * explicitly enabled. Both the patient and a caregiver with access can change
 * it, and every change records who/when so it is never covert.
 */
export type ConsentCategory = "healthMetrics" | "activityPatterns" | "aiAssistant";
export const CONSENT_CATEGORIES: ConsentCategory[] = ["healthMetrics", "activityPatterns", "aiAssistant"];

/** Behavioral-biomarker event kinds gated by the activityPatterns consent. */
export const BIOMARKER_EVENT_KINDS = ["gait", "typing_cadence", "voice_sample"];

export interface ConsentState {
  healthMetrics: boolean;
  activityPatterns: boolean;
  aiAssistant: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
  updatedByRole: string | null;
}

export interface ConsentActor {
  userId: string;
  role: string;
}

export function defaultConsent(): ConsentState {
  return {
    healthMetrics: false,
    activityPatterns: false,
    aiAssistant: false,
    updatedAt: null,
    updatedBy: null,
    updatedByRole: null,
  };
}

export function applyConsentUpdate(
  current: ConsentState,
  patch: Partial<Record<ConsentCategory, boolean>>,
  actor: ConsentActor,
  now: string
): ConsentState {
  const next: ConsentState = { ...current };
  for (const cat of CONSENT_CATEGORIES) {
    if (typeof patch[cat] === "boolean") next[cat] = patch[cat]!;
  }
  next.updatedAt = now;
  next.updatedBy = actor.userId;
  next.updatedByRole = actor.role;
  return next;
}

export function hasConsent(
  consent: ConsentState | null | undefined,
  category: ConsentCategory
): boolean {
  return !!consent?.[category];
}

/** Drop behavioral-biomarker events unless activityPatterns is consented. */
export function filterEventsByConsent<T extends { kind: string }>(
  events: T[],
  consent: ConsentState | null | undefined
): T[] {
  if (hasConsent(consent, "activityPatterns")) return events;
  return events.filter((e) => !BIOMARKER_EVENT_KINDS.includes(e.kind));
}

function toState(doc: any): ConsentState {
  if (!doc) return defaultConsent();
  return {
    healthMetrics: !!doc.healthMetrics,
    activityPatterns: !!doc.activityPatterns,
    aiAssistant: !!doc.aiAssistant,
    updatedAt: doc.updatedAt ?? null,
    updatedBy: doc.updatedBy ?? null,
    updatedByRole: doc.updatedByRole ?? null,
  };
}

export async function getConsent(db: Db, patientId: string): Promise<ConsentState> {
  const doc = await db.collection("consents").findOne({ patientId });
  return toState(doc);
}

export async function saveConsent(db: Db, patientId: string, state: ConsentState): Promise<void> {
  await db.collection("consents").updateOne(
    { patientId },
    { $set: { patientId, ...state } },
    { upsert: true }
  );
}
