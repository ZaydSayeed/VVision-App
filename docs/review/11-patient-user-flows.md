## Patient User Flows

The patient surface has the right shape but its safety-critical paths are not safe enough for the population it serves. Verification confirmed every Critical and High finding against the code: the Help button has no offline queue and no delivery guarantee (writes bypass the cache and are never replayed), there is zero haptic/audible confirmation, med/task check-offs swallow write errors and silently record false non-adherence, and the "Vision" AI assistant is text-input only despite a misleadingly named `micBtn` send button. Several Medium/Low findings (destructive patient-side deletes, the conflated Health empty state, skippable safety onboarding, dual FABs, small low-contrast type) compound the picture. None were refuted. The broader pattern is that the patient flows are visually polished but optimistic about connectivity and the user's abilities, and they fail silently in exactly the moments that matter most.

### [SAFE-1] Help request can fail silently offline — no queue, no delivery guarantee
**Severity:** Critical · **Effort:** Medium

- **Issue:** A help tap can be permanently lost with no persistence, replay, or fallback.
- **Description:** `createHelpAlert()` is a POST routed through the write path in `src/api/client.ts:128-130`, which never consults or writes the offline cache and is explicitly never auto-retried at the network layer. `useHelpAlert.sendHelp` (`src/hooks/useHelpAlert.ts:48-73`) retries 3× with 1.5–4.5s backoff, but every attempt hits the same cache-less write path; if the phone is truly offline all 3 fail and the alert is dropped — never persisted or replayed when connectivity returns. There is no offline pre-check on HelpScreen (grep for `offline`/`NetworkContext` in `HelpScreen.tsx` returns nothing) and no local durable queue anywhere.
- **Why it matters:** For a dementia patient, the help button is the safety-critical core of the product. A request silently lost during a fall, wandering episode, or medical event is the worst-case failure: the patient believes help is coming and the caregiver never finds out.
- **Impact:** Patient (physical harm when no caregiver responds); business (one publicized silent-failure incident destroys trust in a safety product and is direct liability exposure).
- **Recommendation:** Persist every help tap to a local durable queue immediately on press, flush with background retry until the server acks, and show the "sent" state only after ack (or after queueing, with explicit "will send when back online" copy). Add an offline banner on HelpScreen and, when there is no connectivity, offer a fallback (`tel:`/SMS to caregiver) so the patient always has a working path.
- **Expected impact:** Eliminates the single highest-severity failure mode — converts unbounded silent loss into guaranteed eventual delivery with honest UI.
- **Evidence:** `src/api/client.ts:123-158`; `src/hooks/useHelpAlert.ts:48-73`; `src/screens/patient/HelpScreen.tsx:55-72,290-297`

### [SAFE-2] No haptic or audible confirmation that Help was sent
**Severity:** High · **Effort:** Small

- **Issue:** Send success/failure is communicated only by a silent visual state change.
- **Description:** On success HelpScreen swaps to a checkmark and "Help is on the way!" text (`src/screens/patient/HelpScreen.tsx:318-339`). There is no Haptics, Vibration, or sound feedback anywhere in `HelpScreen.tsx` or `useHelpAlert.ts` (grep returns no matches), and no failure haptic either.
- **Why it matters:** Dementia patients frequently have co-occurring vision/hearing impairment and reduced attention. A purely visual, silent state change is easy to miss, leading to repeated taps (anxiety) or the assumption that nothing happened.
- **Impact:** Patient (uncertainty, repeated taps, panic during an emergency); caregiver (duplicate alerts).
- **Recommendation:** Fire a distinct success haptic (`notificationAsync(Success)`) plus an optional short confirmation sound on send-success, and a warning haptic on failure. Keep the visual state. Make sound/haptic a caregiver-configurable accessibility setting.
- **Expected impact:** Multi-sensory confirmation closes the loop for sensory-impaired users, reducing duplicate sends and panic during the most stressful moment in the app.
- **Evidence:** `src/screens/patient/HelpScreen.tsx:318-339`; no Haptics/Vibration/Sound import in HelpScreen.tsx or useHelpAlert.ts

### [SAFE-3] Med and task check-offs swallow write errors — false-negative adherence data
**Severity:** High · **Effort:** Small

- **Issue:** A failed check-off write rejects silently, leaving the box unchecked and recording false non-adherence.
- **Description:** `useMeds.toggleTaken` (`src/hooks/useMeds.ts:34-44`) and `useRoutine.toggleComplete` (`src/hooks/useRoutine.ts:34-44`) await an unguarded `updateMedication`/`updateRoutine` write with no try/catch. If the write fails (offline, cold start, 500) the promise rejects, optimistic state is never set, the checkbox stays visibly unchecked, and the patient gets zero error feedback. Because writes bypass the cache (`src/api/client.ts:128-130`), the failure is invisible. The caregiver dashboard then reads this as "medication NOT taken."
- **Why it matters:** Adherence is a headline clinical signal of the caregiver-first product. A patient who took their pill but whose tap failed is recorded as non-adherent — triggering false caregiver intervention, or worse, prompting the patient to re-dose because the UI never acknowledged the tap.
- **Impact:** Patient (confusion, possible double-dosing); caregiver (false "missed med" alerts, eroded data trust); business (adherence data licensed to pharma is corrupted by silent write failures).
- **Recommendation:** Wrap toggles in try/catch with optimistic update + rollback-on-failure, surface an inline "couldn't save — tap to retry" affordance, and queue the write offline so it reconciles. Never let a check-off reject silently.
- **Expected impact:** Removes a systematic false-negative in the product's headline metric and prevents dangerous double-dosing prompted by an unresponsive UI.
- **Evidence:** `src/hooks/useMeds.ts:34-44`; `src/hooks/useRoutine.ts:34-44`; `src/api/client.ts:128-130`

### [PUF-1] AI "Vision" assistant is text-only and unusable by an impaired patient
**Severity:** High · **Effort:** Large

- **Issue:** The marquee AI assistant requires free-text typing on the patient surface; there is no voice input.
- **Description:** VisionSheet has a style named `micBtn` but the button renders an Ionicons `send` arrow and calls `handleSend` — there is NO voice/speech capture (grep for voice/Recording/Audio/Speech in `VisionSheet.tsx` matches only the misnamed style). The only input is a `TextInput` requiring typing (`src/components/VisionSheet.tsx:561-580`, `247-250`). Voice-session code exists elsewhere (`useVoiceSession`/CheckIn screens) but is wired to the caregiver side, not the patient Vision chat.
- **Why it matters:** The target patient has dementia and often impaired fine-motor skills, vision, and literacy. Requiring free-text typing excludes most of the intended population, making the flagship AI feature decorative on the patient surface.
- **Impact:** Patient (cannot realistically use the assistant); business (AI is a key differentiator but doesn't function for the patient persona).
- **Recommendation:** Add real voice input to the patient Vision sheet (reuse the existing Gemini/`useVoiceSession` path) with large tap-to-talk and spoken-back replies (TTS). Replace the misleading mic-styled send button or add a genuine mic alongside it.
- **Expected impact:** Turns the AI from unusable-to-the-patient into the primary low-friction modality, widening the addressable patient population.
- **Evidence:** `src/components/VisionSheet.tsx:247-250,561-580`; grep voice/Recording/Audio/Speech matched only `micBtn`; `useVoiceSession.ts` is caregiver-wired

### [PUF-2] Floating Vision FAB competes with the Help button in the same lower zone, inviting mis-taps
**Severity:** Medium · **Effort:** Small

- **Issue:** Two prominent round floating buttons sit in the same lower region of the patient UI.
- **Description:** The patient Vision sparkles FAB is positioned `absolute`, `bottom:108, right:24` with no text label (`src/navigation/RootNavigator.tsx:244-249,316-320`), hovering just above the bottom tab bar where the coral Help FAB lives as the center tab (`src/navigation/PatientTabNavigator.tsx:60-128`, `top:-20`, with a "Help" label). They are not perfectly stacked — Help is center, Vision is bottom-right — but both are large round buttons in the lower zone competing for "the important button to tap," and only Help is labeled.
- **Why it matters:** Dementia patients have impaired target discrimination. In an emergency a patient may tap the AI assistant instead of Help. Two FABs (one unlabeled) in the same zone is a discoverability and safety anti-pattern.
- **Impact:** Patient (taps wrong button under stress); caregiver (delayed help).
- **Recommendation:** Separate the two affordances spatially and visually: keep Help unmistakable (large, coral, center, labeled) and either move/relabel the Vision entry point (e.g., a labeled row on Today) or hide the floating Vision FAB while on the Help screen. Label both.
- **Expected impact:** Reduces mis-taps on the safety-critical control and clarifies the two distinct actions for low-discrimination users.
- **Evidence:** `src/navigation/RootNavigator.tsx:244-249,316-320`; `src/navigation/PatientTabNavigator.tsx:60-128`

### [PUF-3] Destructive Edit/Delete actions exposed directly to the patient on tasks/meds
**Severity:** Medium · **Effort:** Medium

- **Issue:** A confused patient can permanently delete care-plan items the caregiver set up.
- **Description:** TaskDetailSheet places Edit and a coral Delete as side-by-side primary actions (`src/components/patient/TaskDetailSheet.tsx:175-184`), with delete gated only by a single `Alert.alert` confirm (`:45-52`). TodayScreen lets the patient delete reminders via `Alert.alert` (`src/screens/patient/TodayScreen.tsx:854-862`). There is no soft-delete, caregiver notification, or undo.
- **Why it matters:** Care-plan items (meds, routines) should generally be caregiver-authored and protected from accidental patient deletion. Letting the patient delete their own medication schedule is a safety and data-integrity hole.
- **Impact:** Patient (loses care plan, missed meds); caregiver (silent loss of configured items, no audit/restore).
- **Recommendation:** Make caregiver-authored items non-deletable (or soft-delete with caregiver notification) from the patient role. De-emphasize or remove patient-side Edit/Delete; reserve destructive actions for the caregiver. If kept, require a stronger confirmation plus undo.
- **Expected impact:** Protects the integrity of the caregiver-managed care plan and prevents unrecoverable deletion of medications by a confused patient.
- **Evidence:** `src/components/patient/TaskDetailSheet.tsx:45-52,175-184`; `src/screens/patient/TodayScreen.tsx:854-862`

### [PUF-4] Health screen conflates loading, no-data, permission-denied, and error into a bare "—"
**Severity:** Medium · **Effort:** Small

- **Issue:** Every non-value state on Health renders an identical, unactionable dash.
- **Description:** `useHealthSummary` exposes `loading` and `error` (`src/hooks/useHealthSummary.ts:5-24`), but HealthScreen ignores both and renders summary values as "—" when absent (`src/screens/patient/HealthScreen.tsx:27-34,80-96`). So "still loading," "HealthKit permission denied," "sync failed," and "genuinely no data" all look identical — no spinner, no retry, no "reconnect Health" guidance.
- **Why it matters:** A patient or co-located caregiver sees dashes and cannot tell whether the metric is broken, blocked by permissions, or simply empty — undermining confidence in the wellness data and giving no path to fix a permissions problem.
- **Impact:** Patient/caregiver (silent, unactionable empty state; permission issues never get fixed).
- **Recommendation:** Render distinct states: loading skeleton/spinner; an explicit "Health access is off — reconnect" CTA when permission is denied (route to HealthOnboarding/Settings); an error+retry row using the hook's `error`; and a true empty state only when permission is granted but no data exists.
- **Expected impact:** Makes Health data trustworthy and self-healing, recovering users from the common HealthKit permission-denied dead end.
- **Evidence:** `src/screens/patient/HealthScreen.tsx:27-34,80-96`; `src/hooks/useHealthSummary.ts:5-24`

### [PUF-5] Onboarding "Skip" instantly marks onboarding complete and never re-shows
**Severity:** Medium · **Effort:** Small

- **Issue:** Tapping Skip permanently suppresses the only in-app explanation of the Help flow.
- **Description:** OnboardingScreen's Skip and Get Started both call `finish()`, which writes `@vela/onboarding_complete:{userId}=true` and never re-shows the 3 intro slides (`src/screens/OnboardingScreen.tsx:122-130,305-320`). The only content teaching the patient that the Help button summons their caregiver lives on slide 3. Skip is top-right and easy to hit.
- **Why it matters:** Dementia patients won't retain a one-time, skippable intro anyway; skipping removes even the first exposure. The product's most important concept — how to get help — has no persistent, re-discoverable explanation.
- **Impact:** Patient (never learns the Help flow); caregiver (must explain it out-of-band).
- **Recommendation:** Don't treat Skip as "never show again" for safety content. Keep a persistent one-line explainer on the Help screen ("Tap to alert {caregiver}" — partially exists at `HelpScreen.tsx:343-349`) and on Today, and let the caregiver re-trigger onboarding. Consider gating completion on reaching the last slide.
- **Expected impact:** Ensures the help concept is learnable and re-discoverable rather than gated behind a single skippable screen the target user will forget.
- **Evidence:** `src/screens/OnboardingScreen.tsx:122-130,305-320`; `src/screens/patient/HelpScreen.tsx:343-349`

### [PUF-6] Cancel can fail silently and "Help is coming" is shown before any caregiver acknowledgement
**Severity:** Medium · **Effort:** Small

- **Issue:** Displayed help state can diverge from server reality in both directions.
- **Description:** `handleCancel` (`src/screens/patient/HelpScreen.tsx:65-71`) wraps `dismissAlert` in a try/catch that ignores errors, then always clears local sent state — so the UI says "cancelled" even if the server still has an active alert. Separately the screen shows "Help is coming! {caregiver} has been notified" purely on local `sentAt` (`:34,276-286`), before any caregiver acknowledgement, overstating certainty. The resolved-detection logic that could gate "on their way" already exists at `:44-52`.
- **Why it matters:** The patient may believe they cancelled when they didn't (caregiver still races over), or believe a caregiver is en route when none has even seen it. Both mislead a vulnerable user about a live safety event.
- **Impact:** Patient (false sense of state); caregiver (confused whether the request is live).
- **Recommendation:** Surface cancel failures ("couldn't cancel — your caregiver may still be coming"); distinguish "sent/delivered" from "caregiver acknowledged" in the copy, using the existing resolved-detection (`:44-52`) to gate the "on their way" language.
- **Expected impact:** Aligns displayed state with reality for the safety flow, preventing both false-cancel and false-reassurance.
- **Evidence:** `src/screens/patient/HelpScreen.tsx:34,44-52,65-71,276-286`

### [PUF-7] No patient-side device/battery/pairing visibility — patient can't tell if glasses are working
**Severity:** Medium · **Effort:** Medium

- **Issue:** The only glasses signal is a binary connected/not-connected chip inferred from cache state.
- **Description:** FacesScreen shows "Glasses are active" / "Glasses not connected · last synced X ago" (`src/screens/patient/FacesScreen.tsx:447-462`), derived from offline cache state. There is no battery indicator, no pairing flow, and no device status anywhere in the patient tabs (grep for battery/pair/device across patient screens found only this chip and a camera-permission alert).
- **Why it matters:** The glasses are worn all day; a dead/disconnected device silently stops face recognition and any safety sensing. Neither the patient nor a co-located caregiver can see battery or re-pair, so failures go unnoticed.
- **Impact:** Patient (wears non-functional glasses, loses recognition/safety features); caregiver (no early warning); business (the App Store 2.1 rejection concerned non-function without hardware — the patient has no visibility into hardware state).
- **Recommendation:** Add a patient-facing device status surface (battery %, connected/last-seen, a simple re-pair CTA) — at minimum a status row on Today or Faces. Even "last synced X ago + battery" closes the awareness gap.
- **Expected impact:** Gives patient/caregiver early warning of device failure instead of silent loss of the wearable's features.
- **Evidence:** `src/screens/patient/FacesScreen.tsx:447-462`; grep battery/pair/device across `src/screens/patient/*` found no battery or pairing UI

### [PUF-8] Patient AI chat and several patient surfaces use small, low-contrast type
**Severity:** Low · **Effort:** Medium

- **Issue:** Core patient content sits at 11–13px muted type with no Dynamic Type support.
- **Description:** VisionSheet input/body text is 13px (`src/components/VisionSheet.tsx:246`), with 11–12px muted subtitle/chip styles in the surrounding component. TaskDetailSheet uses 11px uppercase letter-spaced section labels and ~15px notes. None scale with iOS Dynamic Type, and several rely on `colors.muted` to convey meaning.
- **Why it matters:** Reduced visual acuity is common in the dementia population. Small muted text and uppercase letter-spaced labels are hard to read, and the absence of Dynamic Type means caregivers can't enlarge them.
- **Impact:** Patient (cannot comfortably read core content); accessibility / App Review risk.
- **Recommendation:** Adopt a patient-mode minimum body size (~17px+), support `allowFontScaling`/Dynamic Type, raise muted-text contrast where it conveys meaning, and avoid uppercase letter-spacing for primary content on patient screens.
- **Expected impact:** Materially improves readability for low-vision dementia users and reduces accessibility-related friction and review risk.
- **Evidence:** `src/components/VisionSheet.tsx:246`; `src/components/patient/TaskDetailSheet.tsx` section-label and notes styles

### [PUF-9] Vision chat shows generic "try again" on failure with no retry affordance, and the consent gate has no offline handling
**Severity:** Low · **Effort:** Small

- **Issue:** Transient AI errors force a retype, and the AI-provider consent wall is dense legal text aimed at the wrong user.
- **Description:** On send failure VisionSheet appends a static assistant bubble "Sorry, I couldn't connect right now. Please try again." (`src/components/VisionSheet.tsx:159-165`) with no retry button — the patient must retype. The consent gate reads AsyncStorage and falls back to `consented=false` on read failure, forcing the patient through a privacy wall of small legal text naming the third-party AI provider — incomprehensible to the target user.
- **Why it matters:** A patient who can't retype won't recover from a transient error, and a wall of provider/legal text is meaningless friction for a cognitively impaired person — likely causing abandonment or an accidental "Don't Allow" that disables the assistant.
- **Impact:** Patient (gives up on the assistant; accidental opt-out); business (lowers AI engagement, the differentiator).
- **Recommendation:** Add a one-tap "Retry" on failed turns. Reconsider whether the patient should see the AI-provider consent wall at all — the caregiver (account owner) could grant AI consent during caregiver onboarding, sparing the patient the legal screen.
- **Expected impact:** Recovers patients from transient AI errors and removes a confusing consent barrier, raising successful assistant interactions.
- **Evidence:** `src/components/VisionSheet.tsx:159-165` and the consent-gate AsyncStorage fallback
