## Dementia-Specific UX

Verified against the actual patient surface, this dimension holds up poorly: the app ships one complexity level to all impairment stages, leans heavily on abstract unlabeled iconography (`sparkles` FAB, `flower-outline` mascot, color-only status), and places working-memory and data-entry tasks (typing drug names, +/- time tapping, transcribing an 8-char link code) directly on the patient — exactly the cognitive load dementia degrades first. Most draft findings were confirmed in code; two were adjusted for accuracy: the Vision sheet does expose a visible "X" close button (so the "trapped modal" claim is narrowed to the bell-revealed reminder panel and swipe onboarding), and task/med "done" state is signaled by a filled sage checkmark checkbox plus strikethrough (not strikethrough alone), though the literal word "Done"/"Taken" and redundant status text are still absent. No finding was fully refuted — every claimed-missing capability (read-aloud/expo-speech, QR linking, large-text mode, simplified stage mode) was grep-confirmed absent. The safety-critical paths (help-alert auto-clearing confirmation, same-screen emergency Cancel, patient-entered medication data) are the most urgent and are genuine.

### [DEM-6] Patient is forced to do data entry (typing meds, multi-tap time setting) the population cannot reliably perform
**Severity:** High · **Effort:** Medium

- **Issue:** Patient surface requires free-text drug-name entry and repetitive +/- time tapping that dementia impairs.
- **Description:** Adding a medication/task on the patient side requires typing free text (name + dosage) and setting a time with `TimeSlider`, which only offers +/- buttons in 15-minute steps from a 9:00 AM default — reaching 8:00 PM is ~44 taps. The "+" add buttons and Edit/Delete live on the patient surface.
- **Why it matters:** Spelling drug names, recalling dosages, and precise repetitive tapping are high-cognitive-load tasks dementia degrades; patient-entered meds also risk clinically wrong entries (misspelled drug, wrong dose/time).
- **Impact:** Patient cannot complete setup or enters incorrect medication data (a safety risk) and feels they are "failing" the app.
- **Recommendation:** Make meds/routine caregiver-managed by default; render them read-only check-off items on the patient surface (the 44px check action is appropriate). If patient entry stays, replace the +/- `TimeSlider` with a native time picker or large preset chips (Morning/Noon/Evening) and remove drug-name free text in favor of caregiver-curated lists.
- **Expected impact:** Removes an impossible/error-prone task, improves med-data accuracy (patient safety), and shifts authoring to the capable caregiver per the pivot.
- **Evidence:** src/components/shared/TimeSlider.tsx:26-51,101-107 (15-min +/- from 9:00 default); src/screens/patient/TodayScreen.tsx (patient "+" add + name/dosage inputs); src/components/patient/TaskDetailSheet.tsx (Edit/Delete).

### [DEM-9] Help-sent confirmation is transient and the help action can be cancelled in confusing ways
**Severity:** High · **Effort:** Small

- **Issue:** "Help is on the way" reassurance auto-clears after 3s and a same-screen Cancel silently retracts a real emergency alert.
- **Description:** After tapping help, the resolved state ("Your caregiver is on the way!") auto-clears after a 3-second `setTimeout` (HelpScreen.tsx:48-52). While sent, the button is disabled (line 305) and a "Cancel Request" outline button appears (lines 350-354) that calls `dismissAlert` (handleCancel, lines 65-71), retracting the alert.
- **Why it matters:** For a vulnerable user, reassurance must be stable; a vanishing message re-triggers panic ("did it work?"), and a same-screen Cancel that retracts an emergency request is a dangerous decision to put in front of a confused person.
- **Impact:** Patient anxiety from vanishing confirmation, or — worse — accidental cancellation of a real help request.
- **Recommendation:** Keep a persistent, large "Help is on the way" confirmation until the caregiver actually resolves it (do not auto-hide after 3s). Require an explicit confirm step before cancelling a sent alert ("Are you sure you no longer need help?") and visually de-emphasize Cancel relative to the reassurance.
- **Expected impact:** Prevents accidental retraction of emergency alerts and keeps the patient continuously reassured — protects the safety-critical path.
- **Evidence:** src/screens/patient/HelpScreen.tsx:48-52 (3s auto-hide), 305 (disabled when sent), 350-354 + 65-71 (Cancel Request retracts alert).

### [DEM-1] Link code relies on patient memory and is buried behind an abstract hamburger drawer
**Severity:** High · **Effort:** Medium

- **Issue:** Patient must open a hamburger drawer, find an 8-char code, and transcribe/relay it — with no QR or read-aloud alternative.
- **Description:** Pairing requires the patient to open the side drawer, find "Caregiver Link Code", read an opaque alphanumeric code (SideDrawer.tsx:107-129, tap-to-copy only), and share it. No on-screen prompt walks them there and there is no QR alternative (grep: zero QR-code code in src/). An AcceptInvite flow already exists (RootNavigator.tsx:312).
- **Why it matters:** Holding/transcribing an abstract token is exactly the working-memory and sequencing task early-to-moderate dementia degrades first. If the patient can't link, the caregiver-first paying product never activates.
- **Impact:** Patient cannot self-link and gets blocked; caregiver onboarding stalls; activation lost at the most critical funnel step.
- **Recommendation:** Make linking caregiver-initiated by default (caregiver sends an invite link the patient taps to accept via the existing AcceptInvite flow). On the patient side, surface a large persistent "Connect my caregiver" card on Home with a QR code and "Show this to your helper" copy; never require typing/remembering a code. Increase legibility and add read-aloud.
- **Expected impact:** Removes the single biggest patient-side activation blocker; raises pairing rate and cuts caregiver support burden.
- **Evidence:** src/components/SideDrawer.tsx:107-129 (link code in drawer, tap-to-copy); src/navigation/RootNavigator.tsx:301 (hamburger opens drawer), 312 (AcceptInvite exists).

### [DEM-2] Primary AI help is hidden behind an abstract floating 'sparkles' FAB with no label
**Severity:** High · **Effort:** Small

- **Issue:** The flagship Vision assistant is reachable only via a 56px unlabeled gradient `sparkles` FAB that overlaps scroll content.
- **Description:** The Vision AI trigger is a 56px floating gradient circle at bottom:108/right:24 with a bare `sparkles` Ionicon and no text label (RootNavigator.tsx:244-253, 317-321). The "Vision / AI Assistant" title only appears inside the sheet (VisionSheet.tsx:421-429).
- **Why it matters:** Abstract unlabeled iconography is a top documented dementia-UX failure mode; a novel `sparkles` symbol has no real-world referent, and a content-overlapping floating button reads as decoration, not a control.
- **Impact:** Patient never discovers or uses the assistant meant to reduce confusion; the core differentiator goes unused.
- **Recommendation:** Replace the unlabeled FAB with a large, persistent, labeled Home card/button reading "Ask for help" / "Talk to Vision" with a concrete icon and word. If a FAB is retained, add a visible text label and a larger touch target, and stop overlapping scroll content.
- **Expected impact:** Turns the AI assistant from undiscoverable to a primary support path; measurable lift in patient assistant engagement.
- **Evidence:** src/navigation/RootNavigator.tsx:244-253 (visionFab style), 317-321 (sparkles icon, no label); src/components/VisionSheet.tsx:421-429 (title only inside sheet).

### [DEM-4] Typography is too small and there is no large-text mode or read-aloud for impaired users
**Severity:** High · **Effort:** Medium

- **Issue:** Body/label text runs 10–15px with uppercase letter-spacing, and there is no font-size control, high-contrast mode, or read-aloud anywhere on the patient surface.
- **Description:** Size tokens are small (body 15, small 13, caption 11; theme.ts:99-114) and TodayScreen uses 10–14px labels for titles, notes, and progress. There is no in-app font-size control, no high-contrast mode, and grep confirms zero text-to-speech (no expo-speech / Speech) anywhere in src/.
- **Why it matters:** Dementia frequently co-occurs with low vision and reduced contrast sensitivity; 10–14px uppercase letter-spaced labels are below accessibility guidance for this population, and the absence of read-aloud excludes later-stage/low-literacy users entirely. Fixed numeric fontSize values mean OS Dynamic Type may not rescale them.
- **Impact:** Patients with low vision cannot read tasks, meds, or reminders — directly defeating the medication/routine safety purpose.
- **Recommendation:** Raise patient-surface minimum body to >=18px and item/label text to >=16px non-uppercase; add a one-tap "Larger text" toggle; add an expo-speech read-aloud speaker control on Home, task, and med items. Verify Dynamic Type actually scales these fixed sizes.
- **Expected impact:** Brings the patient surface to a usable size/contrast for the real population; reaches low-vision and low-literacy patients.
- **Evidence:** src/config/theme.ts:99-114 (size tokens 10-15px); src/screens/patient/TodayScreen.tsx:407,810,881 (10-14px labels); grep: no expo-speech/Speech in src/.

### [DEM-7] Vision assistant is a multi-step chat gated by a dense legal consent wall naming 'Groq, Inc.'
**Severity:** Medium · **Effort:** Medium

- **Issue:** Before using Vision the patient must read a corporate/legal consent screen ("Groq, Inc.") and then compose free-text chat messages.
- **Description:** The `consented === false` branch renders a consent wall with "WHAT IS SENT", "WHO RECEIVES IT — Groq, Inc., an AI service provider in the United States", "HOW IT IS USED" (not used to train Groq's models), a privacy-policy link, and Allow / Don't Allow buttons (VisionSheet.tsx:436-497). Usage then requires typed free-text chat and reading multi-line replies.
- **Why it matters:** Open-ended chat imposes language-generation and reading-comprehension demands degraded in dementia, and a legal consent gate is incomprehensible to the target user, who either taps Allow without understanding (no real informed consent) or taps Don't Allow and loses the feature.
- **Impact:** Patient gives meaningless consent (privacy/ethics risk for a vulnerable user) or is blocked from the assistant — either way the support feature fails.
- **Recommendation:** Move AI consent to the caregiver during their onboarding (caregiver-first pivot), not the patient. Present Vision to patients as simple suggestion buttons / voice prompts with short single-idea replies plus read-aloud, and keep any patient-facing consent to one plain sentence.
- **Expected impact:** Restores genuine informed consent (handled by the competent party) and makes the assistant usable by impaired patients via constrained interactions.
- **Evidence:** src/components/VisionSheet.tsx:436-497 (consent wall, "Groq, Inc."), 503+ (free-text chat input).

### [DEM-3] Core interactions depend on swipe/slide-out panels that dementia users cannot discover (partially mitigated for the Vision sheet)
**Severity:** Medium · **Effort:** Medium

- **Issue:** Reminders hide behind a bell-revealed slide-out panel and onboarding is a horizontal swipe carousel, with no labeled alternative affordance. (The Vision sheet, however, does have a visible "X" close button.)
- **Description:** Reminders open in a right-side slide-out panel via a small bell icon (TodayScreen.tsx:96-108, 654-661). The Vision sheet can be dragged to expand/dismiss via PanGestureHandler with dy>80 thresholds (VisionSheet.tsx:391-419) — but it also exposes a visible "X" close button (lines 431-433), so the worst "trapped, no exit" case does not apply there. Onboarding is a horizontal paging ScrollView (OnboardingScreen.tsx:322-330).
- **Why it matters:** Hidden gestures (swipe-to-reveal, drag-to-dismiss) have no visible affordance and rely on procedural memory and motor precision that decline in dementia; the bell-revealed reminders panel and swipe-only onboarding give no obvious tappable alternative.
- **Impact:** Patient cannot reliably reach reminders or advance onboarding without discovering an undocumented gesture.
- **Recommendation:** Replace the bell-revealed panel with a large tappable "Today's reminders" button; ensure the onboarding "Next" button is the primary path (make swipe optional). Keep the Vision sheet's visible Close and avoid making drag the only dismiss anywhere.
- **Expected impact:** Eliminates gesture-discovery dead-ends in reminders and onboarding and increases successful completion of those flows.
- **Evidence:** src/screens/patient/TodayScreen.tsx:96-108, 654-661 (bell-opened slide panel); src/components/VisionSheet.tsx:391-419 (pan dismiss) + 431-433 (visible X close); src/screens/OnboardingScreen.tsx:322-330 (horizontal paging).

### [DEM-5] Patient navigation is overloaded: 5 bottom tabs + a floating FAB, with a redundant Routine tab duplicating Home
**Severity:** Medium · **Effort:** Medium

- **Issue:** The patient bar has 5 tabs (Home, Faces, Help, Routine, Health) plus a separate Vision FAB, and Routine re-shows the same tasks+meds as Home.
- **Description:** PatientTabNavigator renders Home, Faces, Help (coral FAB), Routine, and Health (lines 103-130); RoutineScreen and TodayScreen both use `useRoutine` + `useMeds`, so two tabs lead to overlapping content. The separate Vision `sparkles` FAB is layered on top (RootNavigator.tsx:317).
- **Why it matters:** Dementia UX guidance is to minimize choices and avoid duplicate paths; two tabs showing "the same stuff" actively breaks the user's mental model of where their day lives.
- **Impact:** Patient is disoriented by too many destinations and unsure which tab "has my list"; navigation errors and abandonment.
- **Recommendation:** Collapse to at most 3 clear destinations (e.g., My Day, People, Help). Remove the redundant Routine tab (already merged into Today) and fold Health and the Vision FAB into Home as labeled cards rather than separate tabs/floating controls.
- **Expected impact:** Lower decision load and a single coherent "where my day lives" model; fewer wrong-tab errors.
- **Evidence:** src/navigation/PatientTabNavigator.tsx:103-130 (5 tabs incl. Routine + Health); src/screens/patient/RoutineScreen.tsx (duplicates useRoutine/useMeds); src/navigation/RootNavigator.tsx:317 (extra Vision FAB).

### [DEM-8] Time-aware greeting can disorient (e.g. 'Good night' midday) and Home omits the date
**Severity:** Medium · **Effort:** Small

- **Issue:** Home greets by device clock ("Good night" from 9pm–5am) and shows no day/date; the date only lives in the top banner.
- **Description:** `getGreeting` returns "Good night" for any time outside 05:00–21:00 (TodayScreen.tsx:44-49). The patient Home header shows greeting + first name but no day/date (lines 644-652); the date appears only in the global top banner (RootNavigator).
- **Why it matters:** Temporal disorientation is a hallmark dementia symptom; an app saying "Good night" when the patient thinks it is daytime reinforces confusion. Reality-orientation best practice is to state day, date, and time-of-day prominently in plain language on the main screen.
- **Impact:** Patient is mildly disoriented or distressed; a missed reality-orientation opportunity right where they look most.
- **Recommendation:** Add a large, persistent reality-orientation banner on Home with full weekday + date + part of day in plain words ("Today is Monday, June 16. It is the afternoon."). Keep the greeting neutral/positive and drop the "Good night" framing that reads as "go to sleep" mid-day.
- **Expected impact:** Adds a clinically valuable orientation cue and removes a source of confusion at no real cost.
- **Evidence:** src/screens/patient/TodayScreen.tsx:44-49 (getGreeting), 644-652 (header has greeting+name, no date); src/navigation/RootNavigator.tsx (date only in top banner).

### [DEM-10] Status is communicated largely by color and abstract icons, without redundant words
**Severity:** Medium · **Effort:** Medium

- **Issue:** On-track/attention status rides on color (sage/amber/coral) and abstract icons with little literal text; the word "Done"/"Taken" is absent.
- **Description:** Status uses small colored Ionicons (amber `medkit`, sage `leaf`, violet `calendar-clear`), a decorative `flower-outline` mascot (TodayScreen.tsx:642), sage/amber progress bars, and tiny uppercase labels. Completed items DO get a filled sage checkbox with a checkmark icon (lines 841-842) in addition to strikethrough + muted text (line 407) — so the "done" cue is not strikethrough-alone — but there is no literal "Done"/"Taken" word, and on-track vs needs-attention is carried by color. Progress is "2 of 4 done" in 10px text.
- **Why it matters:** Dementia users and the high rate of co-occurring color-vision/contrast deficits in the elderly need redundant literal cues (word + icon + shape), not color alone or novel abstract icons (`flower`, `sparkles`). Color-only on-track/attention signaling is not perceivable to all users.
- **Impact:** Patient may misread whether they are "on track" and whether a med is taken — medication adherence signals are misunderstood.
- **Recommendation:** Pair every status with an explicit word ("Taken" / "Not taken yet", "Done" / "To do") in >=16px text and a "Done" chip alongside the existing checkbox; replace decorative abstract icons with literal captioned ones; never use color as the sole status carrier.
- **Expected impact:** Makes task/med status unambiguous regardless of color perception or icon literacy, improving adherence comprehension.
- **Evidence:** src/screens/patient/TodayScreen.tsx:407 (strikethrough+muted) + 841-842 (filled checkmark checkbox), 642 (flower mascot), 810 (10px color progress); src/config/theme.ts (sage/amber/coral as status).

### [DEM-11] No simplified / moderate-stage mode — one complex UI is shown to all impairment levels
**Severity:** Medium · **Effort:** Large

- **Issue:** The same dense multi-feature UI (camera face enrollment, Health trend cards, AI chat, CRUD) ships to every patient regardless of disease stage.
- **Description:** The patient app always presents Faces enrollment with camera (FacesScreen.tsx:111-129, launchCameraAsync + enrollFace), four expandable Health metric cards with trends (HealthScreen.tsx:21-90, ExpandableMetricCard), AI chat, and add/edit/delete CRUD. There is no setting to strip the UI to a minimal "big buttons, few choices" mode, even though the Living Profile models a `stage` field.
- **Why it matters:** Dementia is progressive; a UI usable at MCI is overwhelming at moderate stage. Best-in-class dementia apps offer a caregiver-configurable simplified mode that hides authoring/analytics and leaves check-off + help. Shipping one complexity level guarantees the app outgrows its user as they decline.
- **Impact:** Patient is overwhelmed as they progress and abandons the app when care need is highest; caregiver loses the patient-side data feed.
- **Recommendation:** Add a caregiver-controlled "Simple mode" reducing the patient surface to large check-off lists + a big Help button + read-aloud, hiding Faces enrollment, Health analytics, AI chat, and all CRUD. Tie complexity to the Living Profile `stage` field.
- **Expected impact:** Extends the usable lifespan of the patient app across progression; retains the patient data feed longer, supporting caregiver/data-licensing revenue lines.
- **Evidence:** src/navigation/PatientTabNavigator.tsx:103-130 (Faces/Health/CRUD always present); src/screens/patient/HealthScreen.tsx:21-90 (4 expandable metric cards); src/screens/patient/FacesScreen.tsx:111-129 (patient camera enrollment); CLAUDE.md Living Profile `stage` field.
