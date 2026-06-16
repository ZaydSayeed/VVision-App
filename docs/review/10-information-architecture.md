## Information Architecture & Navigation

The navigation layer is the weakest dimension of this app and every Critical/High finding was verified true against the running code — none were hallucinated. The headline problems are real and severe: an entire six-screen GlassesHub stack (the product's differentiating glasses value) is registered in `RootNavigator` but has zero `navigate("GlassesHub")` call sites anywhere and renders only `MOCK_*` fixtures, making the core feature both unreachable and fake; a cognitively-impaired patient is shown seven simultaneous nav targets including two visually-similar floating circular FABs; the Routine tab fully duplicates the Today screen's safety-critical med data; and there is no Settings screen at all, so sensor/consent toggles set during onboarding can never be revisited. Navigation also mixes three paradigms (stacks, tabs, and a hand-rolled `useState` view-switcher in `PatientsTab`), breaking native back/deep-link on the most-used caregiver surface. This is a due-diligence red flag set: shipped-but-dead mock code, a consent-management gap on biometric data, and IA that actively works against the dementia-care mission.

### [IA-1] Entire GlassesHub stack (6 screens) is unreachable dead code backed by mock data
**Severity:** Critical · **Effort:** Large

- **Issue:** Six glasses screens are registered in the navigator but have no entry point and render only mock data.
- **Description:** `RootNavigator.tsx:579-610` registers `GlassesHub` plus five children (`GlassesAlerts`, `GlassesDigest`, `GlassesNutrition`, `GlassesRepetitions`, `GlassesConfig`). A grep for `navigate("GlassesHub")` across `src` returns ZERO call sites — only the internal `onNavigate` map inside the GlassesHub screen itself references the children, and nothing ever opens GlassesHub. Every screen renders hardcoded fixtures: `GlassesHubScreen.tsx:13,33-35` imports/uses `MOCK_GLASSES_ALERTS` and `MOCK_DAILY_DIGEST`; `PatientProfileConfigScreen.tsx:14,150` seeds state from `MOCK_PATIENT_CONFIG`; the feed/digest/nutrition/repetition screens all pull from `src/data/glassesMockData.ts`.
- **Why it matters:** These screens represent the product's differentiated value (the AI glasses). They are registered as if shipped but cannot be opened and show fake data even if they could — a Potemkin demo path. Glasses configuration, alert thresholds, night mode, nutrition history, and repetition heatmaps simply do not exist in the running app.
- **Impact:** Caregiver cannot access any glasses configuration or insights despite paying for the hardware tier. Business ships dead/fake code; if a reviewer or investor opens the bundle it destroys credibility and risks an App Store 2.1 "non-functional feature" rejection (already a live issue per the rejection-remediation memo).
- **Recommendation:** Either (a) wire a real entry point (a "Glasses" card on `PatientDetailScreen` or a tab) AND replace all `MOCK_*` with live API calls before shipping, or (b) remove the entire stack from `RootNavigator` and the bundle until it is real. Do not ship registered-but-unreachable mock screens.
- **Expected impact:** Eliminates fake/dead code, unblocks the core glasses value prop, removes a concrete App Store rejection vector.
- **Evidence:** `src/navigation/RootNavigator.tsx:579-610`; `src/screens/caregiver/GlassesHubScreen.tsx:13,33-35`; `src/screens/caregiver/PatientProfileConfigScreen.tsx:14,150`; grep `navigate("GlassesHub")` = 0 results across `src`.

### [IA-2] Cognitively-impaired patient faces 7 simultaneous navigation targets
**Severity:** Critical · **Effort:** Medium

- **Issue:** The patient home stacks 5 tabs, a raised Help FAB, and a floating Vision AI FAB — 7 nav targets, 2 of them similar floating circles.
- **Description:** `PatientTabNavigator.tsx` renders 5 bottom tabs (Home, Faces, Help, Routine, Health). The Help tab is itself a raised coral gradient FAB (`PatientTabNavigator.tsx:103-131`), and `RootNavigator.tsx:303-321` floats a violet sparkles "Vision" AI FAB at `bottom:108, right:24` directly above the floating tab bar (`bottom:14, height:72`), crowding its right edge. That is 7 distinct interactive nav affordances on one screen for a dementia patient.
- **Why it matters:** Dementia UX research is unambiguous: minimize choices, maximize a single obvious next action. Seven targets — two of them visually similar floating circular buttons — overwhelm working memory and executive function. The patient cannot form a reliable mental model of where anything lives.
- **Impact:** Patient confusion, accidental taps, inability to find the Help button among competing FABs, loss of independence — the opposite of the stated goal. Caregiver fields more "how do I…" support calls.
- **Recommendation:** Collapse the patient surface to at most 3 large tabs (Today, Faces, Help) with Help as the single prominent action. Remove the floating Vision AI FAB from the patient role entirely or fold it into Today — an autonomous AI sparkle button is a caregiver/power-user affordance, not a patient one. Never place two circular FABs in the same visual zone.
- **Expected impact:** Cuts patient nav targets from 7 to 3, aligns with dementia-UX best practice, reduces mis-taps and Help-button confusion.
- **Evidence:** `src/navigation/PatientTabNavigator.tsx:20-26,103-131`; `src/navigation/RootNavigator.tsx:303-321` (Vision FAB at `bottom:108`).

### [IA-3] Routine tab fully duplicates the Today/Home screen's routine + meds
**Severity:** High · **Effort:** Small

- **Issue:** Two patient tabs (Home and Routine) show the same routine and medication data from identical hooks.
- **Description:** `TodayScreen.tsx:56-57` and `RoutineScreen.tsx:34-35` both call `useRoutine(patientId)` and `useMeds(patientId)` with identical destructuring (`tasks, addTask, toggleComplete, deleteTask, isCompletedToday`, `meds, addMed, toggleTaken, isTakenToday`). CLAUDE.md states `RoutineScreen` "still exists but is no longer in navigation" and its "content was merged into TodayScreen" — yet `PatientTabNavigator.tsx` wires `RoutineScreen` as a live tab. The docs are stale and the dead screen is in production nav.
- **Why it matters:** A patient now has two tabs showing the same routine and medication data with different layouts. This is maximally confusing for memory impairment: tapping a checkbox in one place may not visibly reconcile with the other, and the user cannot tell which is canonical.
- **Impact:** Patient gets redundant, contradictory surfaces for the safety-critical task of medication adherence; risk of double-logging or believing a med is untaken. Caregiver gets adherence signal noise. Business carries extra bloat and bug surface.
- **Recommendation:** Remove the Routine tab from `PatientTabNavigator` (TodayScreen already owns routine+meds). Delete `RoutineScreen.tsx` or gate it behind a clearly-different purpose. Update CLAUDE.md to match reality.
- **Expected impact:** Removes a duplicate medication surface (safety win), drops patient tabs from 5 to 4, eliminates a stale dead screen.
- **Evidence:** `src/navigation/PatientTabNavigator.tsx` (Routine tab wired); `src/screens/patient/RoutineScreen.tsx:34-35`; `src/screens/patient/TodayScreen.tsx:56-57`; CLAUDE.md "Old screens RoutineScreen.tsx…no longer in navigation".

### [IA-4] Settings are fragmented across four disconnected, partly-unreachable surfaces
**Severity:** High · **Effort:** Medium

- **Issue:** There is no single Settings screen; sensor/consent prefs set in onboarding have no in-app re-entry path.
- **Description:** No `*setting*` screen exists in `src` (confirmed by find). Account/theme/link-code/privacy/delete live in `SideDrawer.tsx:106-253`. Glasses thresholds/night-mode/nutrition config live in `PatientProfileConfigScreen` (unreachable, mock-backed — see IA-1). Sensor/smart-home opt-in is only configurable inside the one-time onboarding step `SmartHomeStep.tsx`; `useSensorPrefs.ts` is the only consumer and no screen outside onboarding renders a sensor toggle. Patient health prefs sit behind `HealthOnboardingScreen`, force-launched as a modal from `HealthScreen.tsx:45-47` the first time the Health tab opens. Four surfaces, three not re-openable from a stable location.
- **Why it matters:** Users expect one predictable place to change preferences. A caregiver who skips smart-home during the wizard, or later wants to turn a sensor off (a privacy/consent action for a vulnerable patient), has no in-app path — violating the CLAUDE.md promise that "user can opt out of any sensor independently" and creating a real consent/privacy gap on biometric/location data.
- **Impact:** Caregiver cannot revisit critical privacy/sensor/biometric consent choices after onboarding and cannot reach glasses config at all. Patient gets health prefs ambushed via a forced modal. Business carries a consent-management gap that is a regulatory liability.
- **Recommendation:** Create one Settings screen reachable from the SideDrawer for both roles, consolidating account, theme, sensor/smart-home prefs (with per-sensor opt-out), glasses config, and privacy/consent. Ensure every onboarding-time toggle has a permanent re-entry point.
- **Expected impact:** Closes the post-onboarding consent gap, makes sensor opt-out reachable (regulatory + trust win), gives a single discoverable settings mental model.
- **Evidence:** `find src -iname '*setting*'` = none; `src/components/SideDrawer.tsx:106-253`; `src/hooks/useSensorPrefs.ts` (only consumer of sensor prefs); `src/screens/onboarding/SmartHomeStep.tsx` (only sensor-prefs UI); `src/screens/patient/HealthScreen.tsx:45-47`.

### [IA-5] Quadruple onboarding gauntlet before a caregiver reaches any content
**Severity:** High · **Effort:** Medium

- **Issue:** Two wholly separate onboarding systems run back-to-back with a paywall embedded mid-wizard before any content is shown.
- **Description:** The new-caregiver funnel is: Login → 3-screen swipe `OnboardingScreen` (`RootNavigator.tsx:282-284`, gated by `@vela/onboarding_complete`) → 6-step `OnboardingNavigator` wizard (ProfileBasics, ProfileStory, InviteSiblings, SmartHome, CallerSetup, Paywall; `OnboardingNavigator.tsx:14-20`, gated by `useOnboarding` + no `patient_id` at `RootNavigator.tsx:554-555`) → Home. Patients additionally hit a forced `HealthOnboarding` modal on first Health-tab open (`HealthScreen.tsx:45-47`). The 3-swipe intro and the 6-step wizard are separate systems with separate persistence keys and overlapping intent (both "welcome / set up").
- **Why it matters:** Two sequential onboarding systems with a paywall embedded mid-wizard is a high-friction, high-abandonment funnel. The adult-child caregiver (45-65) evaluating the app cannot see the actual product before committing to multi-step profile creation and a paywall, depressing activation and trial conversion.
- **Impact:** Business sees compounding drop-off across 9+ gating screens before value is shown; the embedded Paywall step before home risks App Store 2.1(b)/3.1.2 friction and kills curiosity-driven activation. Caregiver experiences fatigue, especially a stressed first-time user.
- **Recommendation:** Merge the 3-swipe intro into the wizard's first step or drop it. Let caregivers reach a (read-only) Home/Timeline before the paywall; gate premium features at point-of-use, not as an onboarding wall. Defer profile-story/siblings/smart-home into optional post-activation prompts.
- **Expected impact:** Fewer pre-value screens (target ≤3), materially higher activation/trial-start conversion, reduced paywall-placement App Store risk.
- **Evidence:** `src/navigation/RootNavigator.tsx:282-284,554-555`; `src/navigation/OnboardingNavigator.tsx:14-20`; `src/screens/OnboardingScreen.tsx:100`; `src/screens/patient/HealthScreen.tsx:45-47`.

### [IA-7] Geofence (wandering safety) config hidden in an ad-hoc bottom sheet, not in patient settings
**Severity:** High · **Effort:** Medium

- **Issue:** A life-safety wandering control is a small button opening an unlabelled-context bottom sheet on the patient detail screen, not a top-level safety setting.
- **Description:** Geofence / safe-zone configuration — wandering-prevention for dementia patients — is a bottom sheet opened by a button inside `PatientDetailScreen.tsx` (`setGeofenceSheetOpen` at lines 400 and 550-558). The button text is "Set Safe Zone" / "Zone: {name}" with `accessibilityLabel="Set safe zone for patient"`, so it is labelled, but it is buried on a detail screen — not in any settings hub, not surfaced as a distinct safety control, and not represented anywhere a caregiver scanning for "how do I set a safe zone / get wandering alerts" would look. The backend fully supports it (`server-routes/geofence.ts`, `patientTokens.ts:78` sends "has left their safe zone" alerts), so the feature is real but effectively undiscoverable.
- **Why it matters:** Wandering is one of the highest-acuity safety risks in dementia care and can be life-threatening. A safety-critical control buried in a detail-screen sheet means caregivers may never configure it, leaving the patient unprotected while believing the app covers it (false sense of safety).
- **Impact:** Patient faces unmonitored wandering risk if geofence is never set up. Caregiver gets false reassurance. Business carries liability if a marketed safety feature was effectively undiscoverable.
- **Recommendation:** Promote geofence/safe-zone setup to a clearly-labelled, top-level safety setting per patient (in the consolidated Settings from IA-4 and/or a prominent PatientDetail safety card), with explicit status ("Safe zone: not configured").
- **Expected impact:** Makes a life-safety feature discoverable and verifiable, reducing wandering-related incident risk and liability.
- **Evidence:** `src/screens/caregiver/PatientDetailScreen.tsx:400,550-558`; backend `src/server-routes/geofence.ts`, `src/server-routes/patientTokens.ts:78`; geofence UI exists only on PatientDetail (plus mock DailyDigest/GlassesAlertFeed).

### [IA-6] Caregiver deep features are buried behind single, inconsistent entry points
**Severity:** Medium · **Effort:** Large

- **Issue:** Each critical caregiver workflow has exactly one obscure door, and `PatientsTab` bypasses the navigator with a hand-rolled view switcher.
- **Description:** Voice Check-In is reachable only from a button on `TimelineScreen.tsx:259`; HelpHistory only from a link in `AlertsScreen.tsx:377`; CheckInText only as a fallback link inside `CheckInScreen.tsx:130`; VisitReports and CaregiverHealth only from `PatientDetailScreen.tsx:529,537`; LiveStream only via `PatientsTab` internal state or a push notification (`PatientsTab.tsx:39-62`). Navigation mixes three paradigms: React Navigation stacks, bottom tabs, and `PatientsTab`'s hand-rolled `useState` view switcher (`PatientsTab.tsx:21,64-126`) that swaps between dashboard/detail/logs/logDetail/link/livestream without the navigator — so no OS back gesture, no deep-link, no header on the most-used caregiver surface.
- **Why it matters:** Discoverability fails: a caregiver cannot predict where a feature lives because there is no IA convention. The `useState` switcher breaks platform back-navigation and deep-linking for the patient detail/logs/live flow. Mixed paradigms make the app feel unstable.
- **Impact:** Caregiver leaves features unused because they cannot be found; broken back behavior on the patient-detail flow causes disorientation. Business sees low feature adoption undermine the $29/mo value story.
- **Recommendation:** Add a consistent per-patient "actions" section on PatientDetail exposing Check-In, Visit Reports, Health, Live View, Help History, Logs. Convert `PatientsTab`'s `useState` switcher to a real nested stack navigator so back/deep-link/header work uniformly.
- **Expected impact:** Predictable discovery raises feature adoption; restoring native back/deep-link removes a class of disorientation bugs.
- **Evidence:** `src/screens/TimelineScreen.tsx:259`; `src/screens/AlertsScreen.tsx:377`; `src/screens/caregiver/CheckInScreen.tsx:130`; `src/screens/caregiver/PatientsTab.tsx:21,39-62,64-126`; `src/screens/caregiver/PatientDetailScreen.tsx:529,537`.

### [IA-9] Caregiver carries 5 tabs + Vision FAB + notification bell + full-screen urgent overlay — competing alert channels
**Severity:** Medium · **Effort:** Medium

- **Issue:** The same help-alert event surfaces in at least three competing places with no shared resolved-state.
- **Description:** The caregiver surface stacks 5 bottom tabs (`CaregiverTabNavigator.tsx`), a floating Vision AI FAB (`RootNavigator.tsx:615-633`), a header notification bell with its own slide-in help-request panel (`RootNavigator.tsx:559,635-672`), an Alerts tab with a badge (`CaregiverTabNavigator.tsx:78-82`), AND a full-screen red "Help Requested" urgent overlay with pulsing rings (`RootNavigator.tsx:675-727`). Help requests therefore appear in at least three competing places: the Alerts-tab badge, the bell panel, and the urgent overlay.
- **Why it matters:** Three overlapping channels for the same safety-critical event create ambiguity about the source of truth and how to clear an item. A caregiver may dismiss in one surface and still see it unresolved in another, eroding trust in alerting precisely where reliability matters most.
- **Impact:** Caregiver suffers alert fatigue and confusion about whether a help request is truly handled; risk of a real help event being lost between surfaces. Business undermines the core "we'll tell you when something's wrong" promise.
- **Recommendation:** Designate one canonical help-alert surface (the urgent overlay for active, the Alerts tab for history) and have the bell panel and tab badge derive from the same resolved-state so dismissing anywhere clears everywhere. Consider dropping the redundant bell panel.
- **Expected impact:** Single source of truth for help alerts; fewer missed/duplicated dismissals; restored trust in alerting.
- **Evidence:** `src/navigation/CaregiverTabNavigator.tsx:78-82`; `src/navigation/RootNavigator.tsx:559,615-633,635-672,675-727`.

### [IA-11] No global back/home recovery on tab roots — disorientation risk for impaired users
**Severity:** Medium · **Effort:** Medium

- **Issue:** The header logo opens the drawer instead of going home, there is no persistent home affordance, and back behavior is inconsistent.
- **Description:** The global Header (`RootNavigator.tsx:771-797`) has a logo that opens the SideDrawer (`onPress={onOpenDrawer}` at line 774) — and a separate menu icon that also opens the drawer (two drawer affordances, no home affordance). Deep caregiver screens rely on per-screen `onBack` props (e.g. GlassesHub, PatientDetail `handleBack`), but `PatientsTab`'s `useState` switcher (see IA-6) means the OS back gesture does not unwind those views. A confused patient who taps into Faces or Health detail has only the tab bar to escape.
- **Why it matters:** Dementia users frequently get "lost" in apps and need one reliable escape hatch to a known home. Inconsistent back behavior (some native, some hand-rolled, some none) means no dependable recovery path, increasing abandonment and caregiver intervention.
- **Impact:** Patient can get stranded in a sub-view with no obvious way back to Today/Home. Caregiver hits broken back gesture in the patient-detail flow.
- **Recommendation:** Make the header logo always navigate to the role's home tab (not the drawer; route the drawer through the menu icon only). Ensure every deep view is a real navigator route so the OS back gesture and a consistent back button always work.
- **Expected impact:** Reliable single-tap escape to home from anywhere; consistent back behavior; less disorientation-driven abandonment.
- **Evidence:** `src/navigation/RootNavigator.tsx:773-797` (logo `onPress={onOpenDrawer}` at 774, separate menu icon also opens drawer); `src/screens/caregiver/PatientsTab.tsx:21,64-126`.

### [IA-8] Parallel face features (patient Faces tab vs caregiver People tab) with no shared mental model
**Severity:** Low · **Effort:** Small

- **Issue:** The same enrolled-faces dataset is named "Faces" for the patient and "People" for the caregiver with no cross-role linkage in copy.
- **Description:** The patient has a "Faces" tab (`PatientTabNavigator.tsx`, FacesScreen) and the caregiver has a "People" tab (`CaregiverTabNavigator.tsx:19,95`, PeopleScreen); both deal with enrolled known people and both can enroll (`PeopleScreen.tsx:20,63` `enrollFace`, with subtitle "enroll someone for the glasses to recognize"). They are named differently, live on different roles, and nothing tells the caregiver that "People" is the same dataset the patient sees as "Faces." The mock-backed GlassesAlertFeed adds a third face-related surface.
- **Why it matters:** Inconsistent naming for the same conceptual object fractures the shared mental model between the two roles who must collaborate. A caregiver enrolling someone in "People" may not realize it populates the patient's "Faces," and vice versa.
- **Impact:** Caregiver is uncertain whether an enrolled face reaches the patient's glasses/app. Patient hits a naming mismatch when a caregiver tries to guide them by phone ("open Faces" vs "People").
- **Recommendation:** Unify terminology to one term ("People" or "Faces") across both roles, and add copy clarifying that caregiver-enrolled people appear in the patient's view. Show enrollment provenance.
- **Expected impact:** Coherent cross-role mental model; fewer "did it sync?" support questions.
- **Evidence:** `src/navigation/PatientTabNavigator.tsx` (Faces); `src/navigation/CaregiverTabNavigator.tsx:19,95` (People); `src/screens/PeopleScreen.tsx:20,63,283`.

### [IA-10] Tab labels and icons mismatch user goals (Patients tab uses a 'pulse' health icon; Timeline uses 'list')
**Severity:** Low · **Effort:** Small

- **Issue:** The caregiver Patients roster uses a heartbeat 'pulse' icon (which reads as vitals), and Timeline uses a generic 'list' icon shared in spirit with other list-like tabs.
- **Description:** `CaregiverTabNavigator.tsx:17-22` maps Patients → 'pulse' and Timeline → 'list', while the patient Health tab also uses 'pulse' (`PatientTabNavigator.tsx:24`). The "Patients" roster signalled by a heartbeat icon is semantically misleading — pulse reads as vitals/health, not "people I care for." Timeline (an activity feed) with a generic list icon is undifferentiated from People/Alerts which are also list-like.
- **Why it matters:** Icon-to-concept mismatch forces label reading every time, slowing navigation and weakening recognition memory — costly for a stressed caregiver and impossible for a low-literacy/low-vision user relying on iconography.
- **Impact:** Caregiver makes slower, error-prone tab selections. Accessibility: icon-only users cannot distinguish destinations.
- **Recommendation:** Assign goal-aligned, mutually-distinct icons (e.g. Patients → people-circle/heart, Timeline → time/pulse-activity, Alerts → notifications, Care Team → person-add). Reserve 'pulse' for actual health surfaces only.
- **Expected impact:** Faster, lower-error tab recognition; better icon-only accessibility.
- **Evidence:** `src/navigation/CaregiverTabNavigator.tsx:17-22`; `src/navigation/PatientTabNavigator.tsx:20-26`.
