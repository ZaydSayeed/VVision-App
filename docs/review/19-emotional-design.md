## Emotional Design Review

This dimension exposes the product's deepest contradiction: a warm, dignity-preserving patient experience (HelpScreen, TodayScreen) bolted onto an architecture that watches the patient — location, live video, biometrics, mood — entirely from the caregiver side with no patient consent, notice, or on-screen indicator. Verification against the code confirmed the surveillance asymmetry is real: the patient device silently registers geofencing and POSTs zone-exit events (`locationWatcher.ts:16-23`), every geofence/stream route is gated only by `requireSeat` (caregiver), and `src/screens/patient/*` contains zero live/location indicators. Caregiver onboarding sells "see your patient in real time" while patient onboarding never mentions monitoring at all. The caregiver alert experience over-corrects into panic (blood-red full-screen klaxon, triple heavy haptics, no severity tiering) — the opposite of the "peace of mind" value prop. Every Critical and High finding was confirmed in code; one Medium (EMO-4) was adjusted because a Skip path does exist, though the cold framing critique stands.

### [EMO-1] Patient is livestreamed and geo-tracked with zero consent, notice, or on-screen indicator
**Severity:** Critical · **Effort:** Large

- **Issue:** A cognitively-impaired adult is location-tracked and (per architecture) livestreamed with no patient-facing consent, toggle, or "live" indicator anywhere.
- **Description:** Geofencing and live video are entirely caregiver-controlled. The patient's own device silently registers a geofence task and POSTs zone-exit events with no UI; every geofence route is gated only by `requireSeat` (a caregiver seat). The only consent flow in the entire patient app is for the Vision AI text chat.
- **Why it matters:** Covert surveillance of a vulnerable adult is the single highest ethical/legal risk. Many early-stage dementia patients retain capacity to consent; recording someone who cannot see they are recorded is a dignity violation and, under GDPR/BIPA/two-party-consent law, a liability. It directly contradicts the "stay independent and dignified" mission.
- **Impact:** Patient: stripped of autonomy, may feel betrayed on discovery. Caregiver: exposed to legal/ethical liability they were never warned of. Business: the finding most likely to fail an IRB/ethics review, block CRO partnerships, and become a press/App-Store story.
- **Recommendation:** Add a patient consent + awareness layer: (1) one-time patient onboarding disclosing location, camera, biomarker and health-data sharing in plain language with per-feature opt-in; (2) a persistent, non-dismissable on-screen "Live" indicator while a stream session is active, mirroring iOS's camera indicator; (3) an ambient cue when location sharing is on. Store patient consent server-side, not just the caregiver's seat grant.
- **Expected impact:** Converts the product's biggest liability into a trust differentiator; required to pass any healthcare ethics/IRB review and to defensibly market to CROs.
- **Evidence:** `locationWatcher.ts:16-23` (silent zone-exit POST from patient device), `:43-52` (silent geofence registration); `geofence.ts:30,46` (routes gated only by `requireSeat`); `LiveStreamScreen.tsx:15-42` (caregiver-only, no patient indicator); grep of `src/screens/patient/*` found zero live/location indicators; only consent flow in app is the AI chat.

### [EMO-2] Caregiver onboarding sells surveillance while patient onboarding hides it entirely
**Severity:** Critical · **Effort:** Medium

- **Issue:** The two roles are sold opposite stories about the same data flows — informational asymmetry between watcher and watched.
- **Description:** Caregiver slide copy is "See your patient's daily progress, medication status, and activity in real time." (`OnboardingScreen.tsx:79`). The patient's 3 slides (`OnboardingScreen.tsx:31-59`) cover only "Your Day" and "Get Help" — never location, live video, biomarkers, mood logging, or that a caregiver sees activity "in real time." The word "patient" (vs "parent"/"loved one") throughout the caregiver UI frames the relationship as clinical control.
- **Why it matters:** Informational asymmetry between the watcher and the watched is the textbook definition of a consent failure. The caregiver believes monitoring is normal and endorsed; the patient has no idea. The mismatch is trivially discoverable by anyone comparing the two flows.
- **Impact:** Patient: deceived about the nature of the app on their own phone. Caregiver: false confidence the patient agreed. Business: indefensible in an ethics review.
- **Recommendation:** Add a patient onboarding slide that plainly states what the caregiver can see and what is collected, in warm non-clinical language ("Your family member [Name] can see when you've done your routine and can check in on you"). Mirror disclosures across both roles. Replace "your patient" with the patient's name or "your loved one" in caregiver copy.
- **Expected impact:** Closes the consent-asymmetry gap, materially de-risks the ethics review, and softens the controlling tone that erodes the family dynamic.
- **Evidence:** `OnboardingScreen.tsx:79` (caregiver "in real time"), `:88` (caregiver "Smart Alerts"); `OnboardingScreen.tsx:31-59` (patient slides omit all monitoring); "patient" used throughout `RootNavigator.tsx` (e.g. `:698` "Your patient needs immediate assistance").

### [EMO-3] Red full-screen alarm with triple heavy haptics maximizes caregiver panic instead of reassurance
**Severity:** High · **Effort:** Medium

- **Issue:** Every help tap fires a maximal-emergency red klaxon with no severity tiering, training the caregiver into chronic anxiety and alarm fatigue.
- **Description:** A help request shows a full-screen blood-red gradient (`#7B0000→#C0392B→#E74C3C`), an Error haptic plus two Heavy impact bursts, three expanding pulse rings, a "Help Requested" headline and "Your patient needs immediate assistance. Please respond now." The overlay fires whenever `pendingCount` increases, with no context or severity differentiation.
- **Why it matters:** The paying user is a stressed 45-65yo adult child. A klaxon for a parent merely confused about a TV remote trains chronic anxiety. Dementia help-buttons are pressed frequently and often non-urgently; a system that screams every time guarantees burnout or learned ignoring (a dangerous false-negative). The mission is to REDUCE caregiver burden — this amplifies it.
- **Impact:** Caregiver: cortisol spikes, guilt, alarm fatigue, churn. Patient: at risk if the caregiver desensitizes. Business: the core SaaS value is "peace of mind" — this delivers the opposite.
- **Recommendation:** Tier the response: a calm firm card for routine help, escalating to the red overlay only for fall/wander/repeat-within-N-minutes signals. Replace the triple-heavy-haptic burst with a single notification haptic. Soften copy to action-oriented reassurance ("Mom tapped Help — tap to call or message"). Show cause data when available.
- **Expected impact:** Reduces alarm fatigue and false-negative risk, lowers caregiver stress (the #1 retention driver), and keeps real emergencies salient.
- **Evidence:** `RootNavigator.tsx:399-401` (Error + 2x Heavy haptics), `:678` (red gradient), `:696-699` (alarm copy), `:687-693` (3 pulse rings); `:380-382` overlay fires whenever `pendingCount` increases with no severity tiering.

### [EMO-5] Paywall blocks the caregiver mid-setup while their parent's care is being configured
**Severity:** High · **Effort:** Medium

- **Issue:** A cold commerce paywall is the literal gate to finishing a parent's dementia-care profile.
- **Description:** The caregiver onboarding wizard ends with `PaywallStep`, and the wizard fully blocks `CaregiverHome` until complete — `RootNavigator.tsx:554-556` returns `<OnboardingNavigator/>` whenever onboarding isn't complete and no `patient_id` exists. The paywall copy is generic commerce ("Pick your plan", "Full access to all caregiver tools. Cancel anytime.") with no acknowledgment that the user is here because a parent has dementia.
- **Why it matters:** A 45-65yo who just entered their parent's stage, triggers, and life story (`ProfileStoryStep`) is emotionally raw. A cold paywall in front of finishing care setup reads as exploiting a crisis for conversion, risks abandonment, and is exactly the dark-pattern Apple flags under 2.1(b)/3.1.
- **Impact:** Caregiver: feels manipulated at a vulnerable moment, lowering trust and conversion quality. Business: rage-churn, worse reviews, App Store review exposure on the live 2.1(b) issue.
- **Recommendation:** Let the caregiver reach a functional (if limited) home and see the profile before the hard paywall, so value precedes payment. Reframe copy with empathy/outcome ("Keep [Name]'s care team connected"). Never make the paywall the gate to completing a parent's care profile.
- **Expected impact:** Improves trust-led conversion and retention, reduces crisis-exploitation perception, lowers App Store rejection risk on the live 2.1(b) subscription issue.
- **Evidence:** `RootNavigator.tsx:554-556` (onboarding hard-gates home); `PaywallStep.tsx` (paywall is final wizard step); `PaywallScreen.tsx:374,376` (generic commerce copy); `ProfileStoryStep.tsx` (emotionally heavy step just before).

### [EMO-7] HelpScreen "Cancel Request" lets a confused patient retract a real emergency with no caregiver awareness
**Severity:** High · **Effort:** Small

- **Issue:** A one-tap, no-confirm retraction silently removes an emergency from the caregiver's view.
- **Description:** After sending help, the patient sees a "Cancel Request" button that calls `dismissAlert` and clears the sent state (`HelpScreen.tsx:65-71`). A disoriented patient who tapped Help then forgets why can cancel — and the caregiver overlay disappears when `pendingCount` hits zero (`RootNavigator.tsx:383-385`). There is no "are you sure?" and no signal to the caregiver that a request was raised then withdrawn.
- **Why it matters:** The target user has impaired judgment and memory. A silent one-tap retraction is a false-negative safety hole dressed as autonomy: a patient who genuinely needs help can talk themselves out of it and the caregiver never knows.
- **Impact:** Patient: real emergency can vanish unaddressed. Caregiver: loses awareness of a distress event, defeating the core safety promise. Business: a single bad outcome here is an existential safety/PR risk.
- **Recommendation:** Keep cancellation (autonomy matters) but (1) confirm intent gently, and (2) ALWAYS surface a "help requested then cancelled" entry to the caregiver so a human can judge follow-up. Never let a help event disappear without trace.
- **Expected impact:** Closes a real false-negative safety gap while preserving dignity; protects the caregiver peace-of-mind value prop and the company from a missed-emergency incident.
- **Evidence:** `HelpScreen.tsx:65-71` (handleCancel dismisses with no caregiver trace), `:351-353` (Cancel Request button); `RootNavigator.tsx:383-385` (overlay hidden when `pendingCount===0`).

### [EMO-8] LiveStreamScreen bakes in a one-directional, patient-powerless surveillance model
**Severity:** High · **Effort:** Large

- **Issue:** A video feed the patient cannot start, see, or stop — the surveillance archetype — even as a stub.
- **Description:** `LiveStreamScreen` (caregiver-only) shows the patient's name over a black frame with a single red control using a phone "call" icon labeled "End." The patient has no equivalent screen, no ability to decline or end, and no way to know a session is live. Currently a "coming soon" stub, but the entire control model is one-directional.
- **Why it matters:** Even as a stub, the architecture institutionalizes the patient's powerlessness. Shipping it makes watching a dementia patient like a security camera — the antithesis of dignified care and a contradiction of the marketed "independence" value.
- **Impact:** Patient: reduced to a monitored object with no agency. Business: as built, cannot survive an ethics/privacy review; invites regulatory and reputational harm when shipped.
- **Recommendation:** Before shipping live video, design the patient side first: an incoming "live view request" the patient accepts/declines, an always-visible "you are live" indicator, and a patient-accessible "end" control. Default to consent-per-session, not standing caregiver access. Treat the stub as a placeholder for a two-sided, consent-driven experience.
- **Expected impact:** Prevents shipping a feature that would fail ethics review; converts a liability into a trust feature where patients control their own visibility.
- **Evidence:** `LiveStreamScreen.tsx:15-42` (caregiver-only controls, name over black frame, single End button, no patient-side screen); `geofence.ts:30,46` and seat-gated stream routes confirm caregiver-only control.

### [EMO-4] ResolveSheet primes caregivers to clinically categorize a parent's distress
**Severity:** Medium · **Effort:** Small

- **Issue:** The post-help flow defaults toward reducing a parent's distress to a clinical taxonomy chip and a support-ticket "Mark as Handled."
- **Description:** After a help request the caregiver sees `ResolveSheet` titled "What happened?" with chips Confusion/Pain/Anxiety/Fell/Wandered/Sundowning/Other, subtitle "Select a cause to log this request. This helps track patterns over time.", and a "Mark as Handled" CTA. A "Skip" button does exist (so logging is technically optional), but the layout and copy prime clinical labeling as the primary path. (Adjusted from the draft's "mandatory" claim — a Skip path is present at `ResolveSheet.tsx:211`.)
- **Why it matters:** Reducing a parent's distress to "Sundowning" and labeling resolution "Handled" is emotionally cold for a caregiver grieving their parent's decline. Surfacing "track patterns over time" as the rationale in an emotional moment also reveals the data-capture motive (pattern inference / licensing), a trust risk.
- **Impact:** Caregiver: feels like a data-entry clerk for their parent's crisis; compounds grief and guilt. Business: if the data-capture motive becomes obvious, it feeds privacy backlash about the licensing model.
- **Recommendation:** Make the Skip/"Done" path visually primary and the taxonomy genuinely secondary ("Add a note for later (optional)"). Soften "What happened?"/"Mark as Handled" to "How is [Name]?" / "All set". Don't surface "track patterns over time" in an emotional moment.
- **Expected impact:** Removes emotional coldness at the most sensitive moment and reduces the perception of unpaid clinical labeling, protecting trust in the SaaS relationship.
- **Evidence:** `ResolveSheet.tsx:180-181` (title + "track patterns" subtitle), `:185-196` (clinical cause chips), `:211` (Skip path exists), `:220` ("Mark as Handled" CTA); invoked from `RootNavigator.tsx`.

### [EMO-6] Patient mood check-in is silently logged to caregiver pattern data with no recipient disclosure
**Severity:** Medium · **Effort:** Small

- **Issue:** "How are you feeling today?" (incl. "Confused"/"Sad") POSTs to `/api/mood` with no indication it is stored, shared, or fed into pattern inference.
- **Description:** TodayScreen shows Happy/Tired/Confused/Sad emoji and POSTs the answer to `/api/mood` (`TodayScreen.tsx:200-204`). It is framed as a friendly daily check-in but functions as an emotional-surveillance data point with no recipient disclosure.
- **Why it matters:** Asking a dementia patient to label themselves "Confused" or "Sad" is already fraught; silently transmitting it to an adult child and a pattern backend compounds the EMO-1 consent gap. Patients who realize their mood is being reported may stop using it honestly, corrupting the data and the relationship.
- **Impact:** Patient: dignity/privacy harm; may feel watched/judged. Caregiver: receives mood data the patient didn't knowingly share. Business: weakens integrity of the mood data central to the licensing thesis.
- **Recommendation:** Disclose the recipient at capture ("This helps [Name] know how you're doing today") and make it opt-in. Avoid clinically loaded self-labels like "Confused"; consider neutral options. Cover mood sharing under the EMO-1 consent layer.
- **Expected impact:** Restores honesty and dignity to a daily-touched feature, improving emotional safety and the quality of the data being monetized.
- **Evidence:** `TodayScreen.tsx:702-708` (mood UI incl. "Confused"/"Sad"), `:200-209` (silent POST to `/api/mood`, no recipient disclosure).

### [EMO-9] HealthKit consent buries caregiver data-sharing inside a benefit clause
**Severity:** Medium · **Effort:** Small

- **Issue:** The only patient health-data screen that mentions sharing minimizes it as "keep your care team in the loop."
- **Description:** `HealthOnboardingScreen.tsx:69` tells the patient Vela uses Apple Health "to show your steps, heart rate, sleep, and activity over time — and to keep your care team in the loop," with bullets only about read-only access and changing settings. Continuous sharing of heart rate, sleep, and activity to the adult child is folded into a soft benefit clause, not a distinct consent.
- **Why it matters:** "Keep your care team in the loop" sounds friendly but means "your child will see your heart rate and sleep." For an emotionally sensitive population, framing-vs-informed-consent is the difference between trust and felt betrayal later.
- **Impact:** Patient: under-informed about intimate biometric sharing. Business: weak consent undermines the legitimacy of HealthKit data flowing into caregiver views and biomarker products.
- **Recommendation:** Split the consent: one line for read-only Apple Health access, and a separate explicit statement (with its own confirmation) that data is shared with named caregivers ("[Name] will be able to see your activity and sleep summaries"). Align with the EMO-1 consent layer.
- **Expected impact:** Turns a buried disclosure into genuine informed consent, reducing betrayal risk and strengthening the defensibility of biometric data use.
- **Evidence:** `HealthOnboardingScreen.tsx:69` ("keep your care team in the loop" as benefit clause), `:71-72` (bullets omit sharing).

### [EMO-10] Genuine strengths: patient HelpScreen and TodayScreen tone are warm and dignity-preserving — protect them
**Severity:** Low · **Effort:** Small

- **Issue:** Several patient moments are emotionally excellent and should be the documented bar to defend during remediation.
- **Description:** HelpScreen leads with reassurance not alarm and uses a slow "breathing" pulse described in-code as "calm, alive" (`HelpScreen.tsx:76-87`). TodayScreen opens with a time-aware first-name greeting, frames progress positively ("You're all caught up!"), and uses warm cream/sage/amber tones with gentle non-blaming error states.
- **Why it matters:** This proves the team CAN design with empathy; the surveillance/consent failures above are therefore fixable choices, not capability limits. Documenting the good baseline prevents remediation from accidentally degrading the patient experience while it hardens consent and caregiver flows.
- **Impact:** Patient: these moments build real confidence and reduce anxiety. Business: the warm patient tone is a genuine differentiator worth protecting.
- **Recommendation:** Codify this tone as a documented voice/UX guideline (reassuring, first-name, non-clinical, never alarming the patient) and apply the SAME standard to consent disclosures and caregiver alert copy that currently fall short. Use HelpScreen as the reference for delivering hard information warmly.
- **Expected impact:** Preserves the product's strongest emotional asset and provides a concrete template for fixing the cold/alarming surfaces above.
- **Evidence:** `HelpScreen.tsx:76-87` (calm breathing pulse); `TodayScreen.tsx` warm greeting and "You're all caught up!" / gentle error states.
