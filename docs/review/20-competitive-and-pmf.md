## Competitive Analysis & Product-Market Fit

Verification confirms the harshest conclusion: the features that would differentiate Vela from free caregiving apps are not built. The entire GlassesHub cluster (digest, repetition, nutrition, live stream) renders hardcoded mock JSON with a green "Live" chip over fabricated numbers; the wandering/safe-zone safety control is an `Alert.alert` stub with an unwired `locationWatcher.ts`; and the gait/typing biomarker engines have zero non-test importers. What actually functions — med/routine checklists, a help-alert inbox, a commodity Groq LLM, notes, a daily email — is undifferentiated against Medisafe/CareZone/free LLMs. All 11 draft findings were verified against source and none were refuted; the Critical and High items are factually accurate as written.

### [PMF-1] The core competitive differentiator (glasses intelligence) is entirely mock data
**Severity:** Critical · **Effort:** Large

- **Issue:** The premium "ambient intelligence" feature cluster is a demo skin over static JSON.
- **Description:** `GlassesHubScreen` imports `MOCK_GLASSES_ALERTS`/`MOCK_DAILY_DIGEST` and computes all counts from them (GlassesHubScreen.tsx:13,33-35); `DailyDigestScreen` does `useState<DailyDigest>(MOCK_DAILY_DIGEST)` with no fetch/useEffect (DailyDigestScreen.tsx:116); `RepetitionPatternScreen` uses `useState(MOCK_REPETITION_WEEK)` (RepetitionPatternScreen.tsx:13,55); the hub renders a green "Live" chip over the fabricated numbers (GlassesHubScreen.tsx:229); `LiveStreamScreen` renders literal "Live stream coming soon" (LiveStreamScreen.tsx:35). All data flows from `src/data/glassesMockData.ts`.
- **Why it matters:** The single diligence question is "what can this do that a free app can't?" The answer — ambient cognitive/nutrition/repetition monitoring — does not exist in code.
- **Impact:** Business: the premium price and investment thesis rest on an unbuilt feature. Caregiver: care decisions made on fabricated numbers labeled "Live"; trust collapses the instant the data never changes.
- **Recommendation:** Gate the entire GlassesHub behind a clearly-labeled "Preview / not yet active" state wired to real backend (the `inferPatterns` job and patterns route already exist), or remove it from the shipping build. Never show mock health/safety numbers with a "Live" indicator.
- **Expected impact:** Removes the existential "vaporware" diligence risk and forces the value prop onto features that actually function.
- **Evidence:** src/screens/caregiver/GlassesHubScreen.tsx:13,33-35,229; DailyDigestScreen.tsx:116 (no fetch present); RepetitionPatternScreen.tsx:13,55; LiveStreamScreen.tsx:35; src/data/glassesMockData.ts

### [PMF-2] Wandering/geofence safety feature is a non-functional stub
**Severity:** Critical · **Effort:** Large

- **Issue:** The highest willingness-to-pay use case in elder care — wandering alerts — does nothing.
- **Description:** "Set Safe Zone" opens a modal whose CTA fires `Alert.alert("Set Safe Zone", "...Contact support for full address search.")` behind a button literally labeled "Use Current Approach" (PatientDetailScreen.tsx:563-574). The client service `src/services/locationWatcher.ts` (which defines a real `GEOFENCE_TASK` and `zone-exit` notify) has **zero importers** anywhere in the app — confirmed by grep. The backend geofence route is mounted (server.ts:143-144) but no client arms it.
- **Why it matters:** Wandering is the highest-anxiety, highest-pay dementia use case. A caregiver comparing Vela to a $30 GPS tracker finds Vela's version inoperative.
- **Impact:** Caregiver: false sense of safety — believes a safe-zone alarm protects their parent when nothing is armed. Business: cannot compete head-to-head with location-safety incumbents (AngelSense, medical-alert pendants).
- **Recommendation:** Ship a real map-based safe-zone picker and wire `locationWatcher.ts` to the geofence route with background location + alerting, or remove the Safe Zone UI entirely until built. Do not present a safety control that does nothing.
- **Expected impact:** Unlocks the strongest paid use case in the category and eliminates a dangerous false-safety surface.
- **Evidence:** src/screens/caregiver/PatientDetailScreen.tsx:563-574; src/services/locationWatcher.ts (no importers, confirmed); src/server-routes/geofence.ts; src/server.ts:143-144

### [PMF-3] Severe feature bloat: multiple flagship features are orphaned dead code
**Severity:** High · **Effort:** Medium

- **Issue:** Headline differentiators are never wired into the running app.
- **Description:** Biomarker engines `src/lib/biomarkers/gait.ts` and `typing.ts` have **zero non-test importers** (confirmed). `reports.ts` does NOT call them — it builds biomarkers inline from `profile_events` documents (reports.ts:96, loop at 97-160), so the engine modules are pure dead code. `eventBatcher` is referenced only by RootNavigator's `flush` and HomeKit's `queueEvent` (eventBatcher importers confirmed) — and HomeKit itself is only wired into RootNavigator and an onboarding marketing slide (SmartHomeStep.tsx:31), with no functional integration. `locationWatcher` is unused (PMF-2). The result: ~38 screens spanning geofence, live video, voice check-ins, passive sensors, HomeKit, pattern inference, visit-prep PDFs, mood, nutrition — most shallow, stubbed, or fake.
- **Why it matters:** Bloat dilutes the value prop, multiplies QA/maintenance surface, and signals the team chased a roadmap deck instead of shipping one thing well. A vulnerable-population product needs depth, not 12 thin features.
- **Impact:** Business: burn-rate and review risk (Apple already rejected for non-functional features); diffuse positioning makes marketing impossible. Caregiver: confusing surface full of dead ends.
- **Recommendation:** Pick 2-3 must-have jobs (med/routine adherence + help alerts + one real intelligence feature) and cut or feature-flag the rest. Delete or quarantine orphaned modules (biomarker engines, locationWatcher) until a real producer/consumer path exists.
- **Expected impact:** Sharpens the value prop, cuts QA surface ~40%, reduces App Store rejection risk, lowers maintenance cost.
- **Evidence:** src/lib/biomarkers/gait.ts & typing.ts (no non-test importers, confirmed); src/server-routes/reports.ts:96-160 (inline, never calls engines); src/lib/homekit + src/screens/onboarding/SmartHomeStep.tsx:31; src/services/locationWatcher.ts (unused)

### [PMF-4] Why would a caregiver pay $29/mo? The paid value is mostly commodity or fictional
**Severity:** High · **Effort:** Medium

- **Issue:** The differentiated tier is fictional; the functional tier is undifferentiated commodity.
- **Description:** Strip the mock glasses features and what functions is: a med/routine checklist (useRoutine/useMeds), a help-alert inbox, a face list, a Groq llama-3.3 chat assistant that CRUDs reminders/tasks/meds (assistant.ts:90-147), notes, and a daily summary email. Every one has free or low-cost incumbents — Medisafe (free med reminders), CareZone, Lotsa Helping Hands (free coordination), any free LLM app. The genuinely novel paid features (ambient digest, repetition, biomarkers, geofence, live video) are mock/stub/orphaned per PMF-1/2/3.
- **Why it matters:** A premium SaaS price requires a sharp, unique must-have. Right now the differentiated tier is fictional and the functional tier is undifferentiated.
- **Impact:** Business: high churn, low conversion, no justification for $29/mo vs free comps. The clinical-trial-recruitment and data-licensing lines depend on a populated, retained user base this value prop won't produce.
- **Recommendation:** Anchor pricing to one defensible job that works end to end (real pattern/repetition inference from logged events, or functional wandering alerts), make IT the paywall trigger, and re-test willingness to pay. Until then, consider a lower intro price.
- **Expected impact:** Realistic conversion modeling; avoids launching a premium price the product can't defend.
- **Evidence:** src/server-routes/assistant.ts:90-147; src/hooks/useRoutine.ts, useMeds.ts, useHelpAlert.ts; concept-level comp analysis

### [PMF-5] Paywall fires before any value is experienced, and almost nothing is actually gated
**Severity:** High · **Effort:** Medium

- **Issue:** The paywall is both premature (money before value) and toothless (only blocks seat invites).
- **Description:** The funnel is Login → 3-screen swipe intro → 6-step onboarding wizard ending in the Paywall, shown before the caregiver has linked a patient or seen real data. Yet the ONLY tier gate in caregiver screens is `InviteSeatScreen.tsx:113` (`tier === "free" && !isInvitedMember` blocks seat invites). Grep confirms no other `tier`/`useSubscription` enforcement gates content — every other screen is accessible regardless of tier. `useSubscription` confirms starter/unlimited tiers exist, but enforcement is thin.
- **Why it matters:** Selling before value = low conversion and high refund/cancel. Gating only seat invites means the "must-have" is collaboration, a weak hook for a solo adult-child caregiver.
- **Impact:** Business: depressed trial-to-paid conversion; caregivers bounce at a money ask they don't understand. Mispriced gating undermines all three revenue streams.
- **Recommendation:** Move the paywall to a value moment (after first real digest/alert/patient link) and define a clear free-vs-paid matrix gating a genuine must-have, not just seat invites.
- **Expected impact:** Higher trial-start and trial-to-paid rates; clearer free-tier funnel for the recruitment/data flywheel.
- **Evidence:** src/navigation/OnboardingNavigator.tsx; src/screens/onboarding/PaywallStep.tsx; src/screens/caregiver/InviteSeatScreen.tsx:113 (only gate, confirmed); src/hooks/useSubscription.ts

### [PMF-6] Apple 2.1 rejection is a symptom of an unresolved positioning conflict
**Severity:** High · **Effort:** Medium

- **Issue:** The app is simultaneously "glasses are the hero" and "glasses are optional V2."
- **Description:** The pivot is caregiver-first with glasses as V2, yet the most prominent caregiver cluster (GlassesHub) is glasses-branded and mock (PMF-1), the patient side centers on a glasses "Faces" feature, and Apple rejected the app as non-functional without the hardware. The caregiver-first thesis and the glasses-centric UI are at war in the same binary.
- **Why it matters:** This ambiguity is exactly what triggered the 2.1 rejection and muddles positioning, marketing, and pricing.
- **Impact:** Business: repeated rejections delay revenue; muddled story weakens fundraising and the clinician pitch. Caregiver: unclear what they are buying.
- **Recommendation:** Commit fully to caregiver-first: make every shippable feature work without glasses, relabel/hide glasses-only surfaces as "V2 hardware preview," and prove standalone phone+cloud utility to resolve 2.1.
- **Expected impact:** Unblocks App Store approval and gives sales/clinicians one coherent story.
- **Evidence:** CLAUDE.md product direction; src/screens/caregiver/GlassesHubScreen.tsx; src/screens/patient/FacesScreen.tsx; App Store 2.1 rejection (memory: appstore-rejection-remediation)

### [PMF-7] Why would a clinician recommend it? No clinical-grade evidence, and claims are deliberately defanged
**Severity:** Medium · **Effort:** Large

- **Issue:** No clinician-facing surface, no validation, claims constrained to "general wellness."
- **Description:** Biomarkers are legally constrained to "general wellness, never diagnostic"; the gait/typing engines are orphaned (PMF-3); pattern inference requires `GEMINI_API_KEY` + ≥10 events/30d and `PatternsCard` returns null when empty (PatternsCard.tsx:20, rendered at TimelineScreen.tsx:268); visit-prep PDFs write to ephemeral Render storage (visitPrepPdf.ts). There is no EHR/portal integration and no clinician-facing view.
- **Why it matters:** Clinicians are a key trust/distribution channel underpinning the clinical-trial-recruitment line. They won't recommend a non-diagnostic wellness app with no validation and no clinician view.
- **Impact:** Business: the recruitment and pharma-data revenue streams have no clinician on-ramp; referral channel is closed. Caregiver: visit-prep PDF may vanish (ephemeral storage) when most needed.
- **Recommendation:** Define a credible clinician value path: durable (S3) visit-prep PDFs, a structured shareable summary, and at least pilot evidence. Internally position as "caregiver enablement," not "clinical tool," and price accordingly.
- **Expected impact:** Opens the clinician referral channel the recruitment/data revenue depends on.
- **Evidence:** src/components/PatternsCard.tsx:20 (silent null); src/screens/TimelineScreen.tsx:268; src/server-jobs/visitPrepPdf.ts; CLAUDE.md "general wellness" constraint

### [PMF-8] Why would a patient keep using it? The patient retention loop is thin and glasses-dependent
**Severity:** Medium · **Effort:** Medium

- **Issue:** The only intrinsic daily loop is a checklist; the "delightful" feature needs optional V2 hardware.
- **Description:** Patient surface = Today (routine+meds checklist), Faces (needs glasses on the same network — most calls fail offline per CLAUDE.md), Help button, Routine, Health, plus an AI FAB. The only daily intrinsic loop is checking off tasks/meds; Faces requires hardware the pivot calls optional V2. A cognitively-impaired patient has little reason to self-open a checklist app, and there is no glasses-independent caregiver-set engagement nudge.
- **Why it matters:** Caregiver-first SaaS still needs patient-side data (adherence, events) to power digests, patterns, and the pharma-data line. No patient engagement = empty dashboards = stalled flywheel.
- **Impact:** Patient: no compelling daily reason to use; dignity/independence promise unrealized. Business: empty dashboards → caregiver churn → no data → broken revenue flywheel.
- **Recommendation:** Design a low-friction glasses-independent patient loop (voice/text check-in prompts, caregiver-triggered reminders the patient simply acknowledges) and instrument adherence capture so the dashboard populates with minimal patient action.
- **Expected impact:** Sustains the data flywheel every revenue stream depends on; improves caregiver retention via non-empty dashboards.
- **Evidence:** src/screens/patient/TodayScreen.tsx; src/screens/patient/FacesScreen.tsx; CLAUDE.md (Faces requires glasses on network)

### [PMF-9] AI assistant is undifferentiated and not a defensible moat
**Severity:** Medium · **Effort:** Medium

- **Issue:** A headline paid feature is a generic LLM doing CRUD-by-chat, with no medication-write confirmation.
- **Description:** The "Coach AI"/Vision assistant is a Groq `llama-3.3-70b-versatile` chat with three tools: `create_reminder`, `create_task`, `create_medication` (assistant.ts:90-147). No proprietary medical reasoning, no fine-tuning, no visible dementia-specific guardrails; `create_medication` writes with no human-confirmation step. It is marketed as a paid feature ("Coach AI assistant", PaywallScreen.tsx:422). Competitors can replicate it in days.
- **Why it matters:** A headline paid feature that is a generic LLM provides no pricing power or defensibility and introduces clinical-safety risk (an LLM creating medications via chat for a dementia patient with no clinician in the loop).
- **Impact:** Business: no moat, easy to clone, can't anchor a premium price. Caregiver/Patient: LLM-created medication entries are a safety hazard if hallucinated or misparsed.
- **Recommendation:** Add dementia-specific guardrails, a structured confirmation step before any `create_medication` write, and proprietary context (living profile/memory) — or stop marketing it as a premium differentiator.
- **Expected impact:** Either a real moat or honest positioning; removes a med-safety failure mode.
- **Evidence:** src/server-routes/assistant.ts:90-147 (create_medication, no confirmation); src/screens/caregiver/PaywallScreen.tsx:422

### [PMF-10] Two stacked onboarding flows create an adoption barrier before value
**Severity:** Medium · **Effort:** Small

- **Issue:** Up to 9 gating screens — including marketing for unbuilt HomeKit and a paywall — before any real patient datum.
- **Description:** A new caregiver passes through TWO onboarding systems: the 3-screen swipe intro (`@vela/onboarding_complete`, OnboardingScreen.tsx) AND a separate 6-step wizard (ProfileBasics, ProfileStory, InviteSiblings, SmartHome, CallerSetup, Paywall) before reaching home (OnboardingNavigator.tsx). The SmartHome step markets non-functional HomeKit ("no new hardware needed", SmartHomeStep.tsx:31), followed by a paywall.
- **Why it matters:** Onboarding length is the top driver of activation drop-off. Stacking two flows plus a paywall plus marketing for unbuilt features front-loads friction and asks for money before demonstrating value.
- **Impact:** Business: high day-0 abandonment, low activation, low trial starts. Caregiver: fatigue and confusion at a vulnerable, stressed moment.
- **Recommendation:** Collapse to one short flow (link/create a patient + minimum profile), defer siblings/smart-home/paywall to contextual moments, and remove onboarding marketing for non-functional features. Get to a populated home in under 2 minutes.
- **Expected impact:** Measurable lift in activation and trial-start rates; less day-0 churn.
- **Evidence:** src/navigation/OnboardingNavigator.tsx; src/screens/OnboardingScreen.tsx; src/screens/onboarding/SmartHomeStep.tsx:31; CLAUDE.md onboarding notes

### [PMF-11] Genuine competitive advantages exist but are buried and unmonetized
**Severity:** Low · **Effort:** Medium

- **Issue:** Real differentiators exist but the product under-leverages them in favor of glasses theatre.
- **Description:** Confirmed-present real assets: the role-tagged multi-seat care-team model (seatResolver.ts, seats.ts) enables sibling/aide collaboration most consumer apps lack; the structured Living Profile + Mem0 memory layer scoped per patient (memory.ts) is a credible data asset; the urgent help-alert path (RootNavigator/AlertsScreen) is a functional safety primitive. Yet seat collaboration is the only gated feature (PMF-5) and the living-profile/memory asset is invisible to the buyer.
- **Why it matters:** The product is not all vapor — multi-caregiver coordination + structured profile is a defensible wedge if the team focuses there instead of glasses.
- **Impact:** Business: opportunity cost — the real moat is buried under mock features. Caregiver: the most valuable real capability is hard to discover.
- **Recommendation:** Reposition around care-team coordination + living profile as headline value, foreground the working urgent help-alert flow in marketing, and build the paid tier around these functional assets rather than the mock glasses hub.
- **Expected impact:** Converts existing real engineering into a defensible, marketable wedge without new vaporware.
- **Evidence:** src/server-core/seatResolver.ts; src/server-routes/seats.ts; src/server-core/memory.ts; caregiver urgent help overlay (RootNavigator/AlertsScreen)
