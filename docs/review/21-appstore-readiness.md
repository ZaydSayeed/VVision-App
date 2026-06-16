## App Store Readiness

Verification against the actual code confirms all eleven draft findings — none were hallucinated, and the headline Critical (ASR-1) is in fact a genuine logic deadlock, not a loose claim. The new-caregiver first-run funnel is broken at the root: the onboarding gate keys off `!user.patient_id`, but `useOnboarding` early-returns before setting `ready=true` in exactly that case, so a fresh caregiver signup never sees the wizard and lands on an empty dashboard — directly reinforcing the live 2.1 "non-functional" rejection. The purchase flow advances on an unconfirmed entitlement, the patient surface still frames itself around glasses, and the HealthKit-consent-vs-pharma-licensing mismatch is a latent 5.1.2 trap. Most fixes are Small-to-Medium and code-local; the remaining IAP/metadata work lives in App Store Connect and RevenueCat, not the binary.

### [ASR-1] New-caregiver onboarding wizard (and its paywall step) never runs on first launch
**Severity:** Critical · **Effort:** Medium

- **Issue:** The onboarding gate can never fire for a brand-new caregiver, so the wizard and its paywall step are unreachable on first launch.
- **Description:** The gate is `if (onboardingReady && !onboardingCompleted && !user.patient_id) return <OnboardingNavigator/>` (RootNavigator.tsx:554). But `useOnboarding.load()` does `if (!patientId) return;` before the `try/finally` that sets `ready=true` (useOnboarding.ts:11-20), and `useCurrentProfile` returns `user.patient_id` verbatim (useCurrentProfile.ts:9). A new caregiver signup inserts `patient_id: null` with no auto-created patient (auth.ts:100-108; the auto-heal block at 52-78 only runs for the `patient` role). So for the only users the gate targets, `onboardingReady` stays false forever and the wizard is skipped. Even if it did render, every step no-ops: `ProfileBasicsStep.next()` early-returns on `!patientId` (ProfileBasicsStep.tsx:31) and `useOnboarding.complete()` early-returns on `!patientId` (useOnboarding.ts:25).
- **Why it matters:** The pivot is caregiver-first and the entire conversion + IAP-discoverability strategy ends at PaywallStep. If the wizard never fires for a fresh signup, there is no guided setup, no trial prompt at peak intent, and no in-flow path to the paywall.
- **Impact:** Business — near-zero first-session conversion for organically acquired caregivers; the $29/mo funnel is broken at step zero. Caregiver — lands on an empty dashboard with no patient and no instructions. Reviewer — an app-only caregiver demo account that hasn't linked a patient sees an empty, purposeless home, reinforcing the 2.1 "non-functional" perception.
- **Recommendation:** Decouple readiness from patientId: have caregiver signup create a draft Living Profile (and `primary_caregiver` seat) so a `patient_id` exists immediately, OR gate the no-patient case on local state. Make `useOnboarding` resolve `ready=true` even when patientId is absent, and make the wizard's first step "add your loved one" so a patient_id is created before steps that depend on it.
- **Expected impact:** Restores the intended first-run funnel and in-flow paywall exposure — plausibly the single largest lever on trial-start rate and on the reviewer seeing a working paid product.
- **Evidence:** RootNavigator.tsx:554; useOnboarding.ts:11-20,25; useCurrentProfile.ts:9; auth.ts:100-108,52-78; ProfileBasicsStep.tsx:31.

### [ASR-2] Purchase flow declares success and routes home without confirming the entitlement activated
**Severity:** High · **Effort:** Small

- **Issue:** `handlePurchase` navigates to a "paid" home immediately after `purchasePackage` without checking that the entitlement is active.
- **Description:** `handlePurchase` calls `await Purchases.purchasePackage(pkg)` then `navigation.replace("CaregiverHome")`, suppressing only `e.userCancelled` (PaywallScreen.tsx:215-227). It never inspects the returned `customerInfo.entitlements.active` for `starter`/`unlimited` — even though `useSubscription` reads exactly that field to derive tier (useSubscription.ts:66-72). In the onboarding variant, `PaywallStep` overrides `replace()` to call `complete("paywall")` and unmount the wizard regardless of entitlement state (PaywallStep.tsx:14-21). A purchase that resolves but isn't yet reflected (sandbox lag, deferred/ask-to-buy, network race) marks onboarding complete and sends the user to a "paid" home while `useSubscription` still reports `tier:"free"`.
- **Why it matters:** Auto-renewable flows must reliably reflect entitlement state; advancing on an unconfirmed purchase produces "I paid but it's still locked" tickets and is exactly the inconsistency that draws 2.1(b)/3.1.2 scrutiny.
- **Impact:** Business — paid users hit gated features, churn, chargebacks. Caregiver — pays $29 and still sees free-tier limits. Reviewer — a sandbox purchase that doesn't visibly unlock anything reads as a broken IAP.
- **Recommendation:** After `purchasePackage`, inspect the returned `customerInfo` (or re-read entitlements) and only navigate when `starter`/`unlimited` is active; otherwise show a "finalizing" state and refresh. In `PaywallStep`, only call `complete("paywall")` on confirmed entitlement or an explicit user "skip," not on any `replace()`.
- **Expected impact:** Eliminates a whole class of post-purchase support tickets and removes an IAP-correctness flag for review.
- **Evidence:** PaywallScreen.tsx:215-227; PaywallStep.tsx:14-21; useSubscription.ts:66-72.

### [ASR-3] Patient-side first launch is framed entirely around glasses hardware the user may not own
**Severity:** High · **Effort:** Small

- **Issue:** The Faces tab's entire value proposition is tied to glasses the patient may not have.
- **Description:** FacesScreen's subtitle is "Your glasses will recognize these people" (FacesScreen.tsx:437); the empty state reads "Add photos of people you know so the glasses can recognize them" (481-486) and the offline state reads "Make sure your phone is on the same network as the glasses system" (491-496). The status chip toggles between "Glasses are active" and "Glasses not connected." A patient who installs the app with no glasses sees a tab whose entire purpose is a device they don't have. The graceful offline state prevents a crash, but the feature is value-less without hardware.
- **Why it matters:** The 2.1 rejection was specifically that the app appears non-functional without the glasses. Copy that ties a whole tab's value to absent hardware actively reinforces that conclusion and confuses real patient users.
- **Impact:** Patient — a cognitively impaired user faces a tab that never works and copy implying they're missing equipment. Reviewer — confirms the hardware-dependency narrative on the patient surface even after caregiver-side glasses entry points were hidden.
- **Recommendation:** Reframe Faces copy to be software-first ("People you know — add photos so Vela can help you recognize them") and mention glasses only as an optional enhancement when hardware is detected. Consider hiding or de-emphasizing the Faces tab when no glasses/network are present so the patient app stands on routines, meds, and help.
- **Expected impact:** Removes the most visible remaining hardware-dependency cue; makes the app demonstrably useful without glasses for the 2.1 reply.
- **Evidence:** FacesScreen.tsx:437,481-496.

### [ASR-4] HealthKit data feeds "care team" while business model plans pharma data licensing — 5.1.2 conflict
**Severity:** High · **Effort:** Medium

- **Issue:** Stated HealthKit use ("care team wellbeing") does not cover the planned pharma data-licensing revenue stream, violating HealthKit terms.
- **Description:** The app reads HealthKit steps/HR/sleep/activity (services/healthkit.ts) with `NSHealthShareUsageDescription` = "Vela uses your health data ... to help your care team monitor your wellbeing" (app.json:30,63). The product direction explicitly plans "de-identified behavioral/cognitive/adherence data licensing to pharma" as a revenue stream, and the rejection memory flags 5.1.2 (Health data may not be used for advertising/data-mining/sale) as unresolved. The consent surface (LoginScreen.tsx:23,394-401; HealthOnboardingScreen) describes read-only wellbeing monitoring and says nothing about third-party/pharma sharing.
- **Why it matters:** Apple bans selling or licensing HealthKit-derived data and requires consent + privacy policy to match actual use. A mismatch between stated use ("care team") and intended use ("license to pharma") is both an App Store rejection vector and a legal/HIPAA-adjacent exposure for a vulnerable population.
- **Impact:** Business — a reviewer cross-referencing the website/privacy policy or pitch materials could reject under 5.1.2 and flag the developer account; legal liability if health data is licensed without explicit, scoped consent. Patient/caregiver — consent given for "care team" use does not cover monetization.
- **Recommendation:** Draw an explicit, enforced boundary excluding HealthKit/biometric data from any licensing pipeline, documented in server code and the privacy policy. Any external sharing of health-derived data requires a separate, granular, revocable consent screen — never the generic signup checkbox. Get a legal review of privacy policy vs actual data flows before resubmission.
- **Expected impact:** Closes a latent 5.1.2 rejection path and a material legal-diligence red flag; protects the developer account.
- **Evidence:** app.json:24-25,30,63; services/healthkit.ts; LoginScreen.tsx:22-23,394-401; rejection memory (HealthKit licensing conflict).

### [ASR-5] Terms of Use is Apple's generic stdEULA; no product EULA covers health data, AI, or vulnerable-user terms
**Severity:** Medium · **Effort:** Medium

- **Issue:** Both signup and paywall link Apple's stock EULA, which addresses none of this app's actual risk surface.
- **Description:** `TERMS_URL` = `https://www.apple.com/legal/internet-services/itunes/dev/stdeula/` in both LoginScreen.tsx:23 (linked at 394-401) and PaywallScreen.tsx:20 (linked at 446-447). This satisfies the literal 3.1.2(c) "functional Terms link," but the app collects health/biometric data, uses LLMs that can hallucinate care guidance, and serves cognitively impaired users — none of which Apple's boilerplate covers (no AI-limitations disclaimer, no "not a medical device" clause, no data-use terms).
- **Why it matters:** For a healthcare app handling sensitive data and giving AI-generated suggestions, the stock EULA leaves no limitation of liability or medical disclaimer — a diligence weakness and a soft App Review/legal risk.
- **Impact:** Business — unbounded liability exposure and a thin legal posture an acquirer's counsel will flag. Reviewer — acceptable in-app today, but ASC still needs the EULA in the metadata field (per memory), unconfirmed.
- **Recommendation:** Publish a Vela-specific EULA covering data use, AI / "not a medical device" disclaimers, and acceptable use; link it (not Apple's URL) from signup and paywall; add it to the ASC EULA metadata field. Keep stdEULA only as a fallback.
- **Expected impact:** Strengthens legal posture and fully satisfies 3.1.2(c) at both in-app and metadata level.
- **Evidence:** LoginScreen.tsx:22-23,394-401; PaywallScreen.tsx:18-20,446-447.

### [ASR-6] First-run intro (3-swipe OnboardingScreen) sets no expectations and has no value/trial hook
**Severity:** Medium · **Effort:** Medium

- **Issue:** The post-signup intro is a skippable, value-free 3-slide swipe with no trial, next-action, or glasses-optional framing.
- **Description:** OnboardingScreen is a generic 3-slide swipe for both roles ("Stay Connected," "Smart Alerts" for caregivers) with a prominent Skip and a 3s AsyncStorage race that defaults `onboardingDone` to false on timeout (RootNavigator.tsx:82-87). It mentions nothing about the trial, the subscription, the need to link a patient, or glasses-optional positioning. After it, the broken wizard gate (ASR-1) drops the user on an empty home.
- **Why it matters:** First-run is the only moment to set expectations and intent. A skippable, value-free intro followed by an empty dashboard is a textbook abandonment funnel and gives the reviewer no sense of what the paid product does.
- **Impact:** Business — low activation and trial-start; caregivers never learn they must link a patient. Reviewer — weak impression of product value.
- **Recommendation:** Make the intro outcome-oriented and end on one primary action (caregiver: "Add your loved one"). Surface the 7-day trial and "works without glasses." De-emphasize Skip until there's an actionable next step. Fix the AsyncStorage timeout default so a slow read doesn't re-show onboarding.
- **Expected impact:** Higher activation/link-rate and a clearer product story for users and reviewers.
- **Evidence:** OnboardingScreen.tsx:62-91,264-320; RootNavigator.tsx:82-87.

### [ASR-7] RevenueCat Android key is a placeholder; cross-platform purchase config is incomplete
**Severity:** Medium · **Effort:** Small

- **Issue:** The Android RevenueCat key is `goog_PLACEHOLDER`, so any Android build's paywall is dead.
- **Description:** revenuecat.ts:1-2 has `RC_API_KEY_ANDROID = "goog_PLACEHOLDER"` while iOS is a real `appl_` key. app.json declares an Android package (`com.velavision.caregiver`) and Android build settings, implying Android is intended. Any Android build initializing Purchases with this key fails to load offerings — the paywall is non-functional.
- **Why it matters:** Even if the current submission is iOS-only, a placeholder billing key is a diligence smell and a guaranteed broken paywall the moment Android is enabled. It also signals the RevenueCat dashboard config may be incompletely wired — the same root cause behind the live 2.1(b) flag.
- **Impact:** Business — Android monetization is non-functional; signals incomplete IAP setup. Reviewer (if Android submitted) — empty paywall → immediate rejection.
- **Recommendation:** Replace with the real `goog_` key and verify the Android offering, or explicitly gate/hide subscription UI on Android until configured. Confirm the iOS "current" offering contains starter+unlimited products in sandbox before resubmission (the 2.1(b) fix is in ASC/RevenueCat, not code).
- **Expected impact:** Prevents a broken-paywall rejection on Android and de-risks the iOS IAP config.
- **Evidence:** revenuecat.ts:1-2; app.json (Android package + build settings).

### [ASR-8] App Store metadata/screenshots/positioning still glasses-centric; no software-first store presence prepared
**Severity:** Medium · **Effort:** Medium

- **Issue:** No revised, software-first store listing exists; the current presence still leads with hardware.
- **Description:** App name is "Vela Vision," bundle `com.velavision.caregiver`; the pivot is caregiver-SaaS-first with glasses as optional V2, yet there's no evidence in the repo of revised screenshots, description, or keyword positioning leading with caregiver software value. The 2.1 rejection was rooted in the listing implying a hardware requirement. Screenshots/description are the reviewer's first and primary signal.
- **Why it matters:** Apple judges 2.1 hardware-dependency heavily on metadata and screenshots, not just runtime. A listing that shows glasses and pairing keeps triggering 2.1 even if the binary works standalone.
- **Impact:** Business — continued 2.1 rejections and a positioning mismatch with go-to-market; lower organic store conversion. Reviewer — hardware expectation set before the app opens.
- **Recommendation:** Produce caregiver-first screenshots (Timeline/dashboard, Living Profile, voice check-in, paywall with trial) and a description leading with "caregiver app for dementia families — works on your phone; smart glasses optional." Add EULA + Privacy URLs to ASC metadata. Avoid any screenshot implying hardware is required.
- **Expected impact:** Directly addresses the 2.1 listing perception and aligns the store page with the pivot; improves store-page conversion.
- **Evidence:** app.json (name, bundle id); rejection memory (2.1 requires app-only demo + metadata); concept-level for screenshots/description.

### [ASR-9] SmartHome onboarding step is misleading: both buttons do nothing and don't enable HomeKit
**Severity:** Medium · **Effort:** Small

- **Issue:** "Yes, we have smart home" and "Not right now" call the identical `advance()` — neither requests HomeKit nor enables monitoring.
- **Description:** SmartHomeStep.tsx:33-38 wires both `Pressable`s to the same `advance()` (line 20-23), which only does `complete("smart_home")` + `navigation.navigate("CallerSetupStep")`. It never requests HomeKit permission nor sets `sensorPrefs.smartHomeEnabled` (the flag RootNavigator uses to start HomeKit listeners). A caregiver who taps "Yes" believes they enabled smart-home monitoring; nothing happens.
- **Why it matters:** Onboarding that claims to set up a safety-relevant feature (wandering/sundowning detection) but silently does nothing is a trust failure and, given the framing, a potential false-reassurance safety issue.
- **Impact:** Caregiver — false belief that passive home monitoring is active; no events ever flow. Business — a setup step that demos as functional but isn't, undermining the "smart home, no new hardware" pitch.
- **Recommendation:** Wire "Yes" to actually request HomeKit access and set `smartHomeEnabled` via the sensor-prefs hook; show success/failure. If HomeKit isn't ready for this build, relabel the step as informational so it doesn't imply activation.
- **Expected impact:** Removes a misleading setup step and either activates a differentiating feature or honestly defers it.
- **Evidence:** SmartHomeStep.tsx:20-23,33-38.

### [ASR-10] No retention mechanism tied to the trial; trial expiry has no in-app nudge or graceful downgrade messaging
**Severity:** Medium · **Effort:** Medium

- **Issue:** The 7-day trial has no countdown, pre-expiry reminder, or value-loss messaging — just silent gating.
- **Description:** The product advertises a 7-day trial (PaywallScreen trialBadge + legal copy, PaywallScreen.tsx:379-382,436-441). `useSubscription` exposes `trialActive` (line 71), but there's no in-app trial countdown, "trial ends in N days," or conversion reminder, and no copy for what a caregiver loses at expiry to `tier:"free"`. The reviewer override even simulates an expired trial (useSubscription.ts:49-51), but the real post-trial UX is just 402-driven gating with no proactive touchpoint.
- **Why it matters:** Trial-to-paid conversion lives or dies on the day-5-to-7 nudge and a clear value-loss message at expiry. Silent gating after a silent trial yields low conversion and high involuntary churn.
- **Impact:** Business — depressed trial conversion and unclear churn; the $29/mo model's core metric is unmanaged. Caregiver — surprise lockout mid-care with no warning, during an emotionally loaded use case.
- **Recommendation:** Add a trial-status banner (days remaining, what's included), a pre-expiry reminder (push + in-app), and explicit downgrade messaging at expiry. Instrument trial-start, day-5 view, and conversion events for diligence-grade funnel metrics.
- **Expected impact:** Materially lifts trial-to-paid conversion (typically the highest-leverage SaaS retention lever) and reduces involuntary churn.
- **Evidence:** PaywallScreen.tsx:379-382,436-441; useSubscription.ts:49-51,71.

### [ASR-11] Dead/unreachable hardware code (glasses, livestream, geofencing) remains in the binary
**Severity:** Low · **Effort:** Small

- **Issue:** The full Glasses* stack (and LiveStream/locationWatcher) are still registered as navigable routes rendering mock data, despite their entry buttons being removed.
- **Description:** RootNavigator.tsx:579-610 registers GlassesHub, GlassesAlerts, GlassesDigest, GlassesNutrition, GlassesRepetitions, and GlassesConfig screens (plus LiveStream and locationWatcher per the rejection memory). The screens render mock data and remain reachable via any retained deep link, state restoration, or future code path even though their entry points were hidden.
- **Why it matters:** Shipping mock-data hardware screens is a residual 2.1 risk (a reviewer reaching one via state restoration finds non-functional placeholder content) and a diligence concern (dead code obscures what actually ships).
- **Impact:** Business — residual 2.1 exposure and a code-quality signal in diligence. Reviewer — any path reaching a mock "glasses" screen re-triggers the hardware/non-functional narrative.
- **Recommendation:** Remove the unused Glasses*/LiveStream registrations and locationWatcher from the shipped build (feature-flag behind a hardware-detected condition for V2 if needed) so the binary contains no reachable mock-hardware surfaces during review.
- **Expected impact:** Eliminates residual 2.1 surface area and cleans the binary for diligence.
- **Evidence:** RootNavigator.tsx:579-610; rejection memory (glasses/LiveStream/locationWatcher retained as dead code).
