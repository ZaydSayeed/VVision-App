## Caregiver User Flows

The caregiver experience — the pivot's primary paying surface — is structurally broken at its two most important junctures: the onboarding wizard never runs for a real new caregiver (it is gated on a `patient_id` the caregiver does not yet have), and linking a patient does not refresh session state, leaving the caregiver in a dead, stale-state limbo until an undocumented app relaunch. Compounding this, the access-control model is split in two (link-code caregivers get `caregiver_ids` but never a `seats` row, so seat-gated invites/onboarding/profile routes 403), an entire 6-screen "glasses" hub ships as mock data falsely labeled "Live" yet is unreachable from any navigation entry, and the dashboard the caregiver pays $29/mo for is read-only — they cannot author or edit the parent's routines or meds. Every Critical and High finding below was verified against the actual code; none were refuted. This dimension is the weakest-verified area of the product and is not shippable as the "caregiver-first" flagship without addressing the four Criticals.

### [CARE-1] Onboarding wizard is unreachable for the actual caregiver signup path
**Severity:** Critical · **Effort:** Large

- **Issue:** The 6-step onboarding wizard never mounts for a brand-new caregiver because its gate and its data hook depend on a `patient_id` the caregiver does not yet have.
- **Description:** `OnboardingNavigator` renders only when `onboardingReady && !onboardingCompleted && !user.patient_id` (RootNavigator.tsx:554). But `useOnboarding.load()` early-returns when `!patientId` and so never sets `ready=true` (useOnboarding.ts:11-12); `patientId` is `user.patient_id` (useCurrentProfile.ts:9). A new caregiver has no `patient_id` until they link a patient (which lives on the Patients tab, after onboarding), so `ready` stays false, the gate is false, and they drop onto CaregiverHome. If they DID have a `patient_id`, the GET/PATCH onboarding routes require a `seats` row via `requireSeat` (onboarding.ts:15,28) that the link-code caregiver lacks.
- **Why it matters:** This wizard captures stage, history, triggers, sibling invites, smart home, and caller setup — the structured data the Living Profile and AI personalization depend on. If it never runs, Vela has no story/stage/family context and the AI degrades to generic output.
- **Impact:** Caregiver: never guided through setup, profile empty. Business: the onboarding funnel that justifies the $29/mo SaaS does not execute for the primary segment; personalization silently fails.
- **Recommendation:** Re-sequence so linking a patient is step 0 of onboarding, before the wizard, and only mount `OnboardingNavigator` once a patient is linked AND a seat exists. After link succeeds, refresh `user.patient_id` (CARE-2) and create the primary_caregiver seat (CARE-3). Gate `ready` on a real fetch outcome, not on `patientId` presence; add an explicit "link a patient first" step if none.
- **Expected impact:** Restores the documented onboarding funnel for ~100% of new caregivers; enables the profile/personalization capture the AI and reports depend on.
- **Evidence:** RootNavigator.tsx:554; useOnboarding.ts:11-22; useCurrentProfile.ts:9; onboarding.ts:15,28 (requireSeat)

### [CARE-2] Linking a patient does not refresh user.patient_id — caregiver stuck in stale-state limbo
**Severity:** Critical · **Effort:** Small

- **Issue:** The headline caregiver action (connect to their parent) writes the DB but never updates the running session, so the app behaves as if nothing happened.
- **Description:** `user.patient_id` is derived from Supabase `user_metadata` (AuthContext.tsx:45) and only re-resolved at launch via `syncProfile` (AuthContext.tsx:118-119). The link route sets `patient_id` in Mongo (patients.ts:168-171), but `LinkPatientScreen.handleLink` just calls `onLinked()` → `setView("dashboard")` (LinkPatientScreen.tsx:34-35; PatientsTab.tsx:67) and never updates AuthContext. AuthContext exposes `updateUser` (AuthContext.tsx:28,248) but it is not called here. So after linking, `user.patient_id` is still null in-session, and every hook keyed on it (useCurrentProfile, useOnboarding, HomeKit listener, profile/seat calls) stays broken until a force-quit relaunch.
- **Why it matters:** The caregiver completes the single most important action and the app appears to do nothing — profile, onboarding, and sensor features stay dead until an undocumented relaunch.
- **Impact:** Caregiver: confusing dead state after the key action; likely abandonment. Business: first-run conversion craters because the "aha" moment requires a relaunch.
- **Recommendation:** After `linkPatient()` returns, call an AuthContext refresh (re-run `syncProfile`/`/api/auth/me` and write the new `patient_id` into context via `updateUser`, ideally also into Supabase `user_metadata`). Do not rely on cold-start sync.
- **Expected impact:** Eliminates the post-link dead state; unblocks onboarding, profile, and sensor flows in the same session.
- **Evidence:** AuthContext.tsx:45,118-119,248; patients.ts:164-171; LinkPatientScreen.tsx:34-35; PatientsTab.tsx:67

### [CARE-3] Two parallel access models: link-code caregivers get caregiver_ids but no seat, so seat-gated features 403
**Severity:** Critical · **Effort:** Medium

- **Issue:** The only caregiver-onboarding path (link code) never enrolls the caregiver in the seats system that gates invites, onboarding, and profile routes.
- **Description:** `createPrimaryCaregiverSeat` is called only when a PATIENT account is created (auth.ts:70,127). The link route adds the caregiver to `patient.caregiver_ids` but creates no `seats` row (patients.ts:164-171). Yet onboarding (onboarding.ts:15,28), seat invites (seats.ts), and profile-scoped routes use `requireSeat`, which checks ONLY the seats collection (seatResolver.ts:24). So the linking caregiver has no seat: cannot invite siblings, cannot load onboarding, and AddCaregiverScreen shows "No caregivers linked" because it lists seats, not caregiver_ids (AddCaregiverScreen.tsx:163,205-208). A separate `requirePatientAccess` (seatResolver.ts:30-43) DOES honor caregiver_ids — but the seat-gated routes use the stricter `requireSeat`.
- **Why it matters:** The multi-caregiver/family-sharing and role-based-access story is built on seats, but no caregiver onboarded via link code is ever enrolled in it. The two models are silently inconsistent.
- **Impact:** Caregiver: cannot invite family, appears as not-a-caregiver, onboarding/profile endpoints fail. Business: the "invite your siblings" growth loop and seat-based monetization are dead for link-code caregivers.
- **Recommendation:** On successful link, transactionally create a `primary_caregiver` seat mirroring auth.ts. Standardize profile-scoped routes on one model (prefer `requirePatientAccess`, which honors both). Add a one-time migration to backfill seats for all existing caregiver_ids.
- **Expected impact:** Unifies access control; unblocks invites, onboarding, Care Team membership, and profile routes for every linked caregiver.
- **Evidence:** auth.ts:10-11,70,127; patients.ts:164-171; seatResolver.ts:24,30-43,56; onboarding.ts:15,28; AddCaregiverScreen.tsx:163,205-208

### [CARE-4] Glasses hub and all 5 sub-screens are pure mock data, falsely labeled "Live"
**Severity:** Critical · **Effort:** Large

- **Issue:** Fabricated behavioral/clinical telemetry is presented as the patient's real-time data with a hard-coded green "Live" chip.
- **Description:** GlassesHubScreen derives tiles from `MOCK_GLASSES_ALERTS` and `MOCK_DAILY_DIGEST` (GlassesHubScreen.tsx:13,33-35,50) and renders the subtitle "Real-time data from the smart glasses" plus a "Live" chip (GlassesHubScreen.tsx:225,229). All four sub-screens are static mock from `src/data/glassesMockData.ts` (GlassesAlertFeedScreen, DailyDigestScreen, NutritionTimelineScreen, RepetitionPatternScreen). No fetch, loading, or empty state exists — the caregiver sees fabricated alerts, meds confirmations, eating timelines, and repetition heatmaps styled as their parent's real telemetry.
- **Why it matters:** Presenting fabricated clinical/behavioral data as live monitoring for a cognitively-impaired patient is a trust-destroying and safety-relevant misrepresentation — a caregiver could believe meds were taken or no wandering occurred based on mock content. It also matches Apple's 2.1 "non-functional" rejection theme.
- **Impact:** Patient: safety risk if caregiver trusts fake "all clear" data. Caregiver: deceived by fabricated status. Business: App Store rejection risk and trust loss if discovered.
- **Recommendation:** Either wire these screens to real endpoints with loading/empty/offline states, or remove the "Live"/"Real-time" framing and mark clearly as "Sample/Preview — no glasses connected," gated behind real device pairing. Never style mock data as live patient telemetry.
- **Expected impact:** Removes a deceptive-data App Store/safety risk; converts a fake surface into a real feature or an honest "coming soon" state.
- **Evidence:** GlassesHubScreen.tsx:13,33-35,50,225,229; src/data/glassesMockData.ts; GlassesAlertFeedScreen.tsx, DailyDigestScreen.tsx, NutritionTimelineScreen.tsx, RepetitionPatternScreen.tsx (all import MOCK_*)

### [CARE-5] The entire Glasses hub (6 screens) is orphaned — no navigation entry point exists
**Severity:** High · **Effort:** Small

- **Issue:** The 6 glasses screens are registered in the stack but unreachable from any UI.
- **Description:** GlassesHub and its sub-routes (GlassesAlerts, GlassesDigest, GlassesNutrition, GlassesRepetitions, GlassesConfig) are registered in CaregiverStack (RootNavigator.tsx:579-610), but a full-repo grep finds zero `navigate("GlassesHub")`/`onNavigate("GlassesHub")` calls — no tab, no PatientDetail button, no drawer item. The only GlassesHub references in the codebase are the import and the stack registration itself. It is unreachable dead code.
- **Why it matters:** The "device/glasses management" flow — a named pillar of this dimension and the original hardware story — does not exist for users. Significant code ships but delivers zero value and inflates the apparent feature set during diligence.
- **Impact:** Caregiver: cannot access glasses management at all. Business: dead-code maintenance burden; overstated capability vs. reality.
- **Recommendation:** Decide intentionally — if glasses management is in-scope, add a clear entry point (PatientDetail card or tab) and connect to real data (CARE-4); if it is V2, remove the 6 routes/screens from the build to reduce surface and review risk.
- **Expected impact:** Either surfaces a real feature or removes ~6 dead screens; eliminates diligence ambiguity about what actually ships.
- **Evidence:** RootNavigator.tsx:33,579-610; full-src grep for GlassesHub finds only import + stack registration (no navigate call)

### [CARE-6] Paywall is a hard wall inside onboarding with no skip/maybe-later path
**Severity:** High · **Effort:** Small

- **Issue:** The last onboarding step (paywall) has no forward exit without a purchase.
- **Description:** PaywallStep overrides only `navigation.replace`, which fires `complete("paywall")` and is invoked by PaywallScreen only on a successful purchase/trial flow (PaywallStep.tsx:16-19). PaywallScreen offers plan CTAs ("Start free trial") and Restore but no "continue free"/"skip"/"not now" action that lands on Home (PaywallScreen.tsx:407,424 — both CTAs are purchase paths). Since `paywall` is the last required step, a caregiver who does not purchase is parked with no forward exit. This contradicts the CLAUDE.md note that steps "can be skipped" and Apple's expectation that core content be reachable without purchase.
- **Why it matters:** Forcing payment before the user has seen any value (and before they can even confirm linking worked) is the worst paywall placement for a 45-65 caregiver evaluating the app, and a classic Apple 2.1(b)/3.1 friction flag.
- **Impact:** Caregiver: dead-ended, forced to abandon if not ready to pay. Business: kills trial-to-paid funnel; App Store rejection risk; first-session churn.
- **Recommendation:** Add an explicit "Continue with free / Maybe later" action that calls `complete("paywall")` and lands on Home (with the existing OnboardingReminderBanner nudging upgrade). Move the paywall to AFTER the caregiver sees their linked parent's dashboard (value-first).
- **Expected impact:** Removes a hard dead-end; large lift in onboarding completion and reduced first-session abandonment; de-risks App Store review.
- **Evidence:** PaywallStep.tsx:16-19; PaywallScreen.tsx:407,424 (no skip CTA, only purchase paths)

### [CARE-7] Caregiver dashboard is fully read-only — cannot add or edit the care plan (routines/meds)
**Severity:** High · **Effort:** Medium

- **Issue:** The caregiver can view but not author or maintain the parent's routines and medications.
- **Description:** PatientDetailScreen consumes `useRoutine`/`useMeds` but destructures only read accessors — `{ tasks, isCompletedToday }` and `{ meds, isTakenToday }` (PatientDetailScreen.tsx:71-72). A grep finds zero `addTask`/`addMed`/`deleteTask`/`toggleComplete` usage in the file. The caregiver can only view tasks/meds, generate reports, set a (placeholder) geofence, and view logs. For a caregiver-first product where the adult child is the manager/payer, there is no UI to build or maintain the parent's daily routine or medication schedule — that exists only on the patient's own TodayScreen.
- **Why it matters:** The value proposition (reduce caregiver burden, manage a parent who cannot reliably self-manage) requires the caregiver to author and adjust the care plan remotely. Read-only defeats the pivot's premise.
- **Impact:** Caregiver: cannot do the #1 job they pay for; would need the cognitively-impaired patient to enter their own meds. Business: product-market-fit failure for the stated primary persona.
- **Recommendation:** Add caregiver-side CRUD for routines and medications on PatientDetailScreen (backend routes already exist and are access-gated). Reuse the patient TodayScreen add/edit components behind the caregiver's patientId.
- **Expected impact:** Delivers the core caregiver job-to-be-done; turns the dashboard from a viewer into a management tool, the basis for the $29/mo charge.
- **Evidence:** PatientDetailScreen.tsx:71-72 (read-only destructure); grep: 0 add/edit/delete handlers in the file

### [CARE-8] Help-alert resolution and dismissal are inconsistent and lose audit data across three surfaces
**Severity:** High · **Effort:** Medium

- **Issue:** The most safety-critical signal (a patient help request) is resolved with different semantics from three places, and one action leaves it pending.
- **Description:** From the urgent overlay, "Mark as Handled" opens ResolveSheet → `resolveAlert(id, cause, note)` (RootNavigator.tsx:718-719,732), while "I'm Responding Now" only hides the overlay via `setUrgentVisible(false)` and does NOT resolve (RootNavigator.tsx:424,721-722). The notifications panel offers "Mark as handled" calling plain `dismissHelp(alert.id)` with no cause/note (RootNavigator.tsx:663). PatientDetailScreen offers "Dismiss" calling `dismissAlert(alert.id)` with no resolution data (PatientDetailScreen.tsx:466). So the same alert is sometimes richly resolved and sometimes silently dismissed, and "I'm Responding Now" leaves it pending with no state change — risking re-firing the full-screen red overlay and haptics.
- **Why it matters:** Help alerts from a dementia patient are the single most safety-critical signal. Inconsistent resolution loses the cause/outcome audit trail (needed for clinical reports and the data thesis), and "Responding Now" with no acknowledgment can cause repeated jarring alarms or a forever-pending alert.
- **Impact:** Patient: a real emergency could be buried in inconsistent state. Caregiver: re-alarming/confusion; no record of how prior alerts were handled. Business: weakens the behavioral-data product and clinical reporting.
- **Recommendation:** Unify on a single `resolveAlert(cause, note)` path from every surface; make "I'm Responding Now" write an "acknowledged" state (stops re-alarming, stays open until resolved). Add cause/note prompts to the panel and PatientDetail dismiss actions.
- **Expected impact:** Consistent, auditable help-handling; eliminates re-alarm/forever-pending edge cases on the most safety-critical flow.
- **Evidence:** RootNavigator.tsx:338,424,663,718-722,732; PatientDetailScreen.tsx:466

### [CARE-11] No way to remove a seat / revoke care-team access; permission model is invite-only
**Severity:** High · **Effort:** Medium

- **Issue:** Once granted, access to a vulnerable patient's full Living Profile cannot be revoked in-app.
- **Description:** The seats API exposes invite (POST :patientId/seats), list (GET), accept-invite, tier, and my-seat — but NO delete/revoke route (seats.ts:23,65,90,128,145). AddCaregiverScreen lists seats and pending invites with no remove action (AddCaregiverScreen.tsx:205-244). So once a sibling, paid aide, or clinician is granted access to a patient's history, memories, biometrics, and geofence, the primary caregiver cannot revoke them. Account deletion only drops the deleter's own seats (auth.ts:244).
- **Why it matters:** For a healthcare product handling a cognitively-impaired person's intimate and biometric data, inability to revoke access (a let-go aide, an estranged sibling, a clinician who finished care) is a serious privacy/consent gap and likely fails basic data-protection expectations.
- **Impact:** Patient: sensitive profile stays accessible to people who should be removed. Caregiver: cannot enforce access decisions. Business: privacy/compliance liability, especially given the data-licensing strategy.
- **Recommendation:** Add `DELETE /:patientId/seats/:userId` restricted to primary_caregiver, plus a revoke action and pending-invite cancel in AddCaregiverScreen. Cascade-clear the revoked user's access caches.
- **Expected impact:** Closes a concrete privacy/consent gap; gives the primary caregiver real control over who can see a vulnerable patient's data.
- **Evidence:** seats.ts:23,65,90,128,145 (no delete route); AddCaregiverScreen.tsx:205-244 (list only, no remove); auth.ts:244

### [CARE-9] Double, redundant onboarding: 3-swipe intro + 6-step wizard, both shown before any value
**Severity:** Medium · **Effort:** Medium

- **Issue:** A new caregiver faces up to 9 pre-value screens across two stacked onboarding layers before reaching Home.
- **Description:** A new caregiver hits the 3-screen swipe `OnboardingScreen` gated by `@vela/onboarding_complete`, then (intended) the 6-step `OnboardingNavigator` (RootNavigator.tsx:554) — up to 9 screens (Welcome, Stay Connected, Smart Alerts, ProfileBasics, ProfileStory, InviteSiblings, SmartHome, CallerSetup, Paywall) plus linking, ending in the paywall hard wall (CARE-6). SmartHomeStep and CallerSetupStep are pure marketing screens whose two buttons both call the same `advance()`, collecting nothing.
- **Why it matters:** For a 45-65 caregiver in a stressful moment, a 9+ screen funnel ending in a paywall before seeing the parent's data is a top abandonment driver. The two marketing screens could be in-app nudges.
- **Impact:** Caregiver: onboarding fatigue, abandonment. Business: each pre-value screen reduces activation; funnel length hurts trial starts.
- **Recommendation:** Collapse to a single onboarding system. Keep only steps that capture required data (link patient, name+stage, optionally story) before Home; convert SmartHome/Caller/Siblings and the paywall into post-activation prompts via the existing OnboardingReminderBanner. Target <=4 pre-Home screens.
- **Expected impact:** Roughly halves pre-value screens; typical activation lift of 15-30% from funnel shortening.
- **Evidence:** RootNavigator.tsx:554; OnboardingScreen.tsx; OnboardingNavigator.tsx; CallerSetupStep.tsx; SmartHomeStep.tsx (both buttons call advance)

### [CARE-10] Onboarding steps fire write side-effects but mark themselves complete on partial/silent failure
**Severity:** Medium · **Effort:** Small

- **Issue:** Invite and profile steps mark themselves done even when their writes silently fail.
- **Description:** InviteSiblingsStep loops invites and on the first subscription/Starter-cap error simply `break`s, then unconditionally calls `complete("siblings")` and advances. So 3 sibling emails on a free tier are all dropped (402), no error surfaces, and the step is marked done as if it succeeded. ProfileBasicsStep PATCHes name then conditionally PATCHes stage in two separate calls; if the second fails the user has a half-saved profile. There is no per-invite success/failure feedback.
- **Why it matters:** The caregiver believes they invited siblings and set up the profile, but data is silently dropped — eroding trust and breaking the family-sharing growth loop on first run.
- **Impact:** Caregiver: thinks family was invited when it was not; siblings never get access. Business: viral family-invite loop silently fails; profile data integrity issues.
- **Recommendation:** Surface per-invite results (e.g. inline "Upgrade to invite siblings" rather than a silent break), and do not mark the step complete if writes failed. Make ProfileBasics atomic or report which field failed.
- **Expected impact:** Honest invite feedback; recovers family-invite conversion that currently fails silently on free/Starter tiers.
- **Evidence:** InviteSiblingsStep.tsx (break-then-complete); ProfileBasicsStep.tsx (two separate PATCH calls); seats.ts (402 on free/Starter cap)

### [CARE-12] Geofence "Set Safe Zone" is a placeholder with no real location entry
**Severity:** Medium · **Effort:** Medium

- **Issue:** The wandering safe-zone setup is a non-functional placeholder.
- **Description:** PatientDetailScreen's geofence sheet shows a single button literally labeled "Use Current Approach" whose onPress just fires an Alert telling the user to "Contact support for full address search" (PatientDetailScreen.tsx:563-573). There is no map, address search, or radius control; the only inputs are lat/lng/radius/name held in state with no entry affordance (PatientDetailScreen.tsx:76). For a dementia-care product where wandering is a top safety risk, the safe-zone setup is effectively non-functional from the caregiver UI.
- **Why it matters:** Wandering/elopement is one of the highest-acuity dementia events. A geofence the caregiver cannot configure provides false reassurance that a safety net exists when it does not.
- **Impact:** Patient: real wandering risk unmitigated. Caregiver: false sense of safety. Business: safety-feature claim not backed by working UI.
- **Recommendation:** Implement a real geofence editor (map picker or address geocode + radius slider) wired to the existing /geofence endpoint, with confirmation of the configured zone. If not ready, remove the affordance rather than ship a placeholder safety feature.
- **Expected impact:** Turns a placeholder into a functional safety control, or honestly removes a misleading one.
- **Evidence:** PatientDetailScreen.tsx:76,563-573 (button "Use Current Approach", Alert-only with "Contact support")
