# Vela Vision — Product Due-Diligence Review

**Subject:** Vela Vision — AI smart-glasses companion app for dementia patients & caregivers (iOS, React Native / Expo + Supabase + MongoDB + Express/Render)
**Date:** 2026-06-16
**Reviewer lens:** Senior PM · UX Researcher · Accessibility Auditor · Dementia-Care Specialist · Mobile Growth Lead · QA Lead — written at the scrutiny of a $10M pre-investment diligence pass.
**Stance:** Adversarial. Nothing is assumed correct. Every finding is grounded in the actual code at a specific `file:line`.

---

## How to read this report

1. **Founder Summary** — executive summary, 90-day roadmap, and the launch-readiness verdict. *Start here.*
2. **Cross-Cutting Deliverables** — Top 25 improvements, four Top-10 lists (dementia UX, caregiver, accessibility, safety), the full Risk Matrix, biggest product risks, and missing differentiators.
3. **Dimension Sections (13)** — the detailed findings, each in the format **Issue → Description → Why it matters → Impact → Severity → Recommendation → Effort → Expected impact → Evidence**.

Finding IDs are stable and cross-referenced throughout (e.g. `SAFE-1` = Safety finding 1, `AI-6` = AI finding 6, `CARE-2` = Caregiver-flows finding 2).

---

## Methodology

- **13 parallel dimension auditors**, each grounded in the real source tree (the in-repo `CLAUDE.md` was found to be materially stale — e.g. it claims 3 patient tabs; the code ships 5 tabs + 2 floating action buttons — so the audit trusts the code, not the docs).
- **Adversarial verification pass** on every Critical/High finding: each "feature X is missing/broken" claim was grep-/read-confirmed against the code before it was allowed to survive, so the report does **not** falsely claim absent features that in fact exist (geofencing, live-stream, voice check-ins, biomarkers, and seats all exist in some form and are assessed on their *real* state).
- **Independent re-verification** of the three load-bearing Critical claims by the lead reviewer:
  - *Help/SOS sends no push* — confirmed at `src/server-routes/helpAlerts.ts:42-56` (insert only; no notification on the path).
  - *Wandering/geofence is dead code* — confirmed: `startLocationWatcher()`/`startGeofencingAsync` in `src/services/locationWatcher.ts` are **never imported or called** anywhere in the app; the server-side zone-exit push (`src/server-routes/patientTokens.ts:38`) therefore can never fire.
  - *AI auto-writes medications without confirmation* — confirmed at `src/server-routes/assistant.ts:196-211` (`insertOne` directly from the LLM tool call; exposed to the patient-side Vision sheet).

## Findings at a glance

| Severity | Count |
|----------|-------|
| 🔴 Critical | 29 |
| 🟠 High | 60 |
| 🟡 Medium | 49 |
| 🟢 Low | 9 |
| **Total** | **147** |

**Verdict: NOT READY.** Detail in the Founder Summary below.

---


# Vela Vision — Due-Diligence Review: Founder Summary

## Executive Summary (for founders)

Vela Vision is a React Native / Expo dementia-care app with a Supabase + MongoDB + Express/Render backend, pivoting from glasses-hardware to a caregiver-first SaaS ($29/mo) sold to the adult child of a dementia patient. The single sharpest strategic problem is that the product is **sold on safety and intelligence it does not actually deliver**: the flagship Help/SOS button sends no push notification and reaches the caregiver only if their app happens to be open and polling (SAFE-1, CG-3, NOTIF-1, FAIL-1), the entire glasses-intelligence value prop is hardcoded mock data falsely framed as "Live" (CG-2, CARE-4, PMF-1, IA-1), and the wandering/geofence safety control is non-functional theater with the only working zone-exit push left as dead code never wired up (CG-8, PMF-2, NOTIF-3, CG-12). The three most dangerous issues are: (1) the silent-failure SOS path, which for a vulnerable cognitively-impaired population is an existential safety and litigation risk and has no escalation chain when a single caregiver does not respond (SAFE-1, SAFE-2, SAFE-11, NOTIF-4); (2) an LLM that writes medications straight to the database with no human confirmation, fabricates missing dosages/times, and is exposed directly to the patient (AI-1, AI-2, AI-6); and (3) a consent vacuum where the patient is livestreamed, geo-tracked, and mood-logged with zero patient-side consent, notice, or on-screen indicator while the business plans pharma data licensing (EMO-1, EMO-8, ASR-4). Quality is honestly **pre-beta**: core caregiver flows are broken end-to-end — the documented onboarding wizard never runs because linking a patient never refreshes `user.patient_id` and link-code caregivers get no seat, so seat-gated features 403 (CARE-1, CARE-2, CARE-3, ASR-1). The app does not actually support multiple patients despite pricing on it — every dashboard resolves to one patient (CG-1). Accessibility is far below the floor for a 45-65 + impaired-patient audience: no Dynamic Type, muted text fails WCAG AA contrast everywhere, the emergency overlay is silent to screen readers, and VoiceOver coverage sits near 13% (A11Y-1, A11Y-2, A11Y-3, A11Y-4). The biggest opportunity is that the genuinely valuable, already-built assets — the working urgent help-alert flow, the care-team/seats model, the Living Profile + memory layer, and the pattern-inference and visit-prep PDF jobs — are buried under vaporware; repositioning around these functional pieces and making the help loop truly reliable would give a defensible, marketable wedge without inventing anything new (PMF-11, CARE-7, PMF-4). The honest state: strong concept, warm patient tone worth protecting (EMO-10), but the safety-critical paths that justify the price are not yet real, and the App Store rejections (2.1 hardware-dependence, 3.1.2(c) EULA, 2.1(b) IAP) are symptoms of an unresolved positioning conflict rather than cosmetic fixes (PMF-6, ASR-5).

## 90-Day Product Roadmap

### Days 0-30 (Stop the bleeding / launch-blockers)

- **Make Help/SOS actually deliver (P0).** Send a high-priority Expo/APNs push from the `POST /api/help-alerts` handler to all caregiver tokens, add a foreground notification handler, and only show the patient "sent" after server ack. Persist taps to a durable offline queue with retry. (SAFE-1, CG-3, NOTIF-1, NOTIF-7, SAFE-9, FAIL-1 — Medium)
- **Fan-out + multi-token push.** One push-token document per (patientId, caregiverId/device); prune `DeviceNotRegistered` everywhere via a single `sendExpoPush` helper. (SAFE-3, FAIL-6 — Medium)
- **Don't auto-log out the patient's Help button.** Role-gate the 30-min inactivity timeout to caregivers only. (FAIL-2 — Small)
- **Fix the broken caregiver funnel.** After `linkPatient()`, refresh `user.patient_id`; transactionally create a `primary_caregiver` seat for link-code caregivers; make `useOnboarding` resolve without a patientId so the wizard runs. (CARE-1, CARE-2, CARE-3, ASR-1 — Small/Medium)
- **Stop shipping fake "Live" safety/medical data.** Gate GlassesHub, Daily Digest, Nutrition, Repetition behind an explicit "Sample — not live" state or remove from the build; remove unreachable hardware/livestream/geofence dead code for review. (CG-2, CARE-4, IA-1, ASR-11, PMF-1, PMF-3 — Medium)
- **Human-in-the-loop AI writes.** Make `create_medication`/`create_task` propose-not-commit with a caregiver confirmation card; never default dosage/time; disable write tools on the patient assistant. (AI-1, AI-2, AI-6 — Medium)
- **Paywall not a hard wall.** Add "Continue free / Maybe later", let caregiver reach a read-only home before the paywall, and only confirm purchase on a verified entitlement. (CARE-6, EMO-5, PMF-5, ASR-2 — Small)
- **App Store hygiene.** Vela-specific EULA covering health/AI/vulnerable-user terms; software-first Faces copy; verify RevenueCat config. (ASR-3, ASR-5, ASR-7 — Small/Medium)

### Days 31-60 (Trust & retention)

- **Escalation + acknowledgement engine.** Re-push primary, fan out to other seats, then SMS/voice (Twilio) on unacknowledged help; write `acknowledged_by/at` on "Responding Now" and push reassurance back to the patient. (SAFE-2, NOTIF-4, CG-8, CG-9, EMO-7 — Large)
- **Closed-loop adherence.** Missed-medication detection + caregiver alert; move reminders off sleeping in-process node-cron to an always-on trigger with local-tz computation and escalating nudges. (SAFE-5, SAFE-6, NOTIF-5, NOTIF-9 — Medium)
- **Real multi-patient support.** Thread explicit `patientId` through every caregiver hook/endpoint; add a patient selector and name every card. (CG-1 — Large)
- **Caregiver can manage the care plan.** Add caregiver CRUD for routines/meds on PatientDetail (backend routes already gated). (CARE-7 — Medium)
- **Device/offline visibility.** Patient + glasses heartbeat/last-seen + low-battery watchdog; NetInfo-driven offline state; durable queue for zone-exit and writes. (SAFE-8, NOTIF-6, FAIL-4, FAIL-5, FAIL-10, FAIL-11 — Medium)
- **Accessibility floor.** Fix muted/amber contrast with a CI contrast lint; Dynamic Type; 44pt targets; VoiceOver labels; announce the emergency overlay. (A11Y-1, A11Y-2, A11Y-3, A11Y-4, A11Y-5, A11Y-7 — Medium/Large)
- **Account recovery + session resilience.** Forgot-password flow; 401 → silent refresh-and-retry; cached-mode launch instead of forced sign-out. (FAIL-3, FAIL-7, FAIL-12 — Small/Medium)
- **Consent layer v1.** Patient onboarding disclosure + per-feature opt-in, persistent "Live" indicator during streaming, HealthKit/licensing boundary. (EMO-1, EMO-2, EMO-9, ASR-4 — Medium/Large)

### Days 61-90 (Differentiation & monetization)

- **Single "is Mom OK right now?" hero status** computed from weighted real signals (meds, routine, falls/wander, freshness), defaulting to Unknown/Needs-attention when data is missing. (CG-4, CG-12, CG-10 — Medium)
- **Make one real intelligence feature the paywall trigger.** Wire pattern inference / repetition or functional wandering alerts as the defensible paid job; re-test willingness to pay. (PMF-4, PMF-1, CG-6 — Medium)
- **Functional geofence editor** (map pin + radius) wired to the existing endpoint, plus `startLocationWatcher` activation. (CG-8, CG-12, PMF-2, NOTIF-3 — Medium)
- **Patient simplification & voice.** Collapse patient surface to ≤3 tabs, add real voice to the patient Vision sheet, large-text/read-aloud, reality-orientation banner, caregiver-controlled Simple Mode tied to Living Profile stage. (IA-2, IA-3, PUF-1, DEM-4, DEM-8, DEM-11 — Medium/Large)
- **AI auditability & safety.** Stamp AI writes with source/model, add undo/report, post-generation medical-advice classifier, calibrate patterns as hypotheses. (AI-3, AI-4, AI-5, AI-7, AI-8 — Small/Medium)
- **Notification governance.** P0-P3 tiering through one central sender, quiet hours, per-type/per-patient controls, face-event throttling, opt-out digest. (NOTIF-2, NOTIF-8, NOTIF-10, NOTIF-12, SAFE-10 — Medium)
- **Care-team control & repositioning.** Seat revoke/remove; foreground the working help-alert + Living Profile as the headline value in store metadata and marketing. (CARE-11, PMF-11, ASR-8 — Medium)

## Brutally Honest Launch-Readiness Verdict

**Verdict: NOT READY.** This is a strong concept executed to demo quality, not production quality, and the gaps are concentrated exactly where they are most dangerous. The flagship safety feature — the Help/SOS button — does not notify a caregiver unless their app is already open and polling (SAFE-1, NOTIF-1, FAIL-1), there is no escalation when no one responds (SAFE-2, NOTIF-4), and the patient's session can silently auto-log-out and disable the button entirely (FAIL-2). For a product sold to families of cognitively-impaired adults, that is not a bug backlog item; it is a foreseeable-harm and litigation exposure that alone disqualifies launch. The AI writes medications to the database with no confirmation and will invent a dosage rather than ask (AI-1, AI-2), and the patient — the person least able to validate it — has direct write access (AI-6). The headline "glasses intelligence" and "Safe Zone" surfaces are mock data and non-functional theater presented as live safety information (CG-2, PMF-1, PMF-2, CG-8), which is both a deceptive-data risk and the reason the product can't honestly answer "why pay $29/mo?" (PMF-4). The basic caregiver funnel is broken end-to-end — linking a patient strands the user in stale state and seat-gated features 403 (CARE-1, CARE-2, CARE-3) — and the app doesn't actually support the multiple patients its pricing assumes (CG-1). Accessibility fails the floor for both the 45-65 buyer and the impaired patient: no Dynamic Type, sub-AA contrast everywhere, and a silent emergency overlay (A11Y-1, A11Y-2, A11Y-4). I have watched products with exactly this profile — beautiful UI, real ambition, simulated core — die in diligence or, worse, in an incident review. The minimum bar before this touches a real dementia patient: a help alert that is **guaranteed to deliver** (push + SMS fallback + durable offline queue + server-confirmed receipt + acknowledgement-driven escalation), every "Live"/mock safety and medical surface either made real or removed, all AI medication writes behind explicit human confirmation with no fabricated safety fields, the broken link→seat→onboarding funnel fixed so the product is actually usable, and a patient consent layer for streaming/location/biometrics. Until those are done and tested end-to-end on physical devices, this is at most an internal/closed pilot with non-vulnerable testers and explicit "not a safety device" disclaimers — it is not ready for the App Store and not ready for a patient.

---



---

# Vela Vision — Cross-Cutting Review Deliverables

Synthesized from the full verified finding set. Every item cites the finding id(s) it draws from. Rankings reflect impact-to-effort for a caregiver-first dementia-care product remediating live Apple rejections.

---

## Top 25 Product Improvements (ranked by impact-to-effort)

1. **Send a high-priority push (and SMS fallback) to all caregivers on a Help tap.** The flagship safety feature currently never pushes; it only works if the app is open and polling. Highest severity, medium effort. [SAFE-1 (Safety), CG-3, NOTIF-1, FAIL-1, AI-noneSAFE-1]
2. **Make the caregiver onboarding wizard actually run on first launch by decoupling readiness from `patientId`.** The entire documented funnel (incl. the paywall the reviewer must see) never executes. [ASR-1, CARE-1]
3. **Refresh `user.patient_id` in AuthContext immediately after linking a patient.** Linking leaves the caregiver in a stale dead state that blocks onboarding, profile, and sensor flows the same session. Critical, small effort. [CARE-2]
4. **Gate the 30-minute inactivity auto-logout on `role === 'caregiver'`.** Today it silently logs out patients and disables the Help button. Critical, small effort. [FAIL-2]
5. **Stop the LLM from committing medications without human confirmation; never default missing dosage/time.** Convert all AI write tools to propose-then-confirm; refuse safety-critical fields instead of inventing them. [AI-1, AI-2, AI-6]
6. **Create a `primary_caregiver` seat on link (mirror auth.ts) and standardize routes on `requirePatientAccess`.** Link-code caregivers get `caregiver_ids` but no seat, so every seat-gated feature 403s. [CARE-3]
7. **Add a durable offline queue for Help intents with retry-until-ack; only show "sent" after server ack.** Removes unbounded silent SOS loss and the retry burden from an impaired user. [SAFE-1 (Patient), SAFE-9 (Safety)]
8. **Add a "Continue with free / Maybe later" skip on the onboarding paywall and move it after the dashboard is seen.** Removes a hard mid-setup dead-end and de-risks the live 2.1(b) rejection. [CARE-6, EMO-5, PMF-5]
9. **Wrap med/task check-off toggles in try/catch with optimistic update + rollback + retry.** Swallowed write errors produce false-negative adherence data and risk double-dosing. Small effort. [SAFE-3 (Patient), FAIL-9]
10. **Collapse the patient surface to ≤3 large tabs (Today, Faces, Help) and remove the patient Vision FAB.** Cuts 7 nav targets to 3 and stops FAB/Help mis-taps. [IA-2, DEM-5, PUF-2]
11. **Remove or honestly relabel the entire GlassesHub / mock-data stack ("Sample — not live").** Six orphaned screens of mock data styled as live telemetry is a deceptive-data App Store + safety risk. [IA-1, CARE-4, CARE-5, CG-2, PMF-1, ASR-11]
12. **Make the Emergency Help overlay multi-sensory and screen-reader announced (sound + haptic + `announceForAccessibility` + assertive live region).** Today the SOS is silent to VoiceOver. [A11Y-4, SAFE-2 (Patient)]
13. **Thread an explicit `patientId` through every caregiver hook/endpoint; add a patient selector.** The app silently resolves to ONE patient, breaking the multi-patient value the $29/mo plan is priced on. [CG-1]
14. **Give caregivers CRUD over routines/meds on PatientDetail (backend routes already exist).** The dashboard is read-only, so the core caregiver job-to-be-done is impossible. [CARE-7, DEM-6]
15. **Replace the caregiver stat strip with a single "Is Mom OK right now?" hero status, computed from weighted signals (meds, routine, falls, freshness, help).** Today status is derived only from pending help count. [CG-4, CG-12]
16. **Move scheduling off in-process node-cron (Render free tier sleeps) to an always-on trigger with a last-fired watermark + backfill.** Time-critical med/safety reminders are silently skipped. [SAFE-5, NOTIF-9]
17. **Darken `muted` text to ~4.5:1 and add a CI contrast lint.** ~180 text instances fail WCAG AA on every background. [A11Y-1, A11Y-7, A11Y-9, PUF-8]
18. **Add unacknowledged-help escalation: re-push primary, fan out to other seats, then SMS/voice fallback.** A single unanswered alert currently has no backstop. [SAFE-2 (Safety), NOTIF-4, SAFE-11]
19. **Make pushTokens one doc per (patient, caregiver/device) and fan out to all.** A single token per patient makes multi-caregiver redundancy structurally impossible. [SAFE-3 (Safety), FAIL-6]
20. **Wire `startLocationWatcher()` / geofence and ship a real map-based safe-zone picker.** Wandering protection is fully built but never invoked, and the "Set Safe Zone" UI is a placeholder. [NOTIF-3, CG-8, CG-12-adjacent, CG-8, PMF-2, FAIL-5, IA-7, CARE-12]
21. **Add missed-medication detection + caregiver alert.** Closes the adherence loop the product is sold on; reuses the centralized sender. [SAFE-6, NOTIF-5]
22. **Add a patient consent + persistent "Live" indicator layer for camera/location/biomarker/health sharing.** Patients are streamed and geo-tracked with zero notice — fails any ethics/IRB review. [EMO-1, EMO-2, EMO-8, EMO-6, EMO-9]
23. **Add forgot-password / account-recovery (Supabase `resetPasswordForEmail`).** A permanent-lockout path for paying caregivers. Small effort. [FAIL-3]
24. **Audit every Touchable for `accessibilityRole`/label and enforce ≥44pt targets.** VoiceOver coverage is ~13% and nav icons fall below HIG minimums. [A11Y-3, A11Y-5, A11Y-11]
25. **Add Dynamic Type support and a patient large-text mode (min body 17–18px).** Fonts are fixed pixels; the 45–65 cohort and low-vision patients can't read the UI. [A11Y-2, DEM-4, PUF-8]

---

## Top 10 Dementia-Specific UX Improvements

1. Collapse the patient surface to ≤3 large destinations and remove the redundant Routine tab + Vision FAB. [DEM-5, IA-2, IA-3]
2. Keep a persistent "Help is on the way" confirmation (no 3s auto-hide) and require explicit confirm before cancelling a sent alert. [DEM-9, PUF-6, EMO-7]
3. Make meds/routine caregiver-managed and read-only check-off on the patient side; replace typing and the +/- TimeSlider with preset chips / native picker. [DEM-6, PUF-3]
4. Make the link/pairing caregiver-initiated; show a large persistent "Connect my caregiver" QR card with read-aloud instead of a memorized code in a drawer. [DEM-1]
5. Replace the unlabeled "sparkles" AI FAB with a large labeled Home card ("Talk to Vision") and add real voice input + TTS. [DEM-2, PUF-1]
6. Add a large persistent reality-orientation banner (full weekday + date + part of day); drop "Good night" framing mid-day. [DEM-8]
7. Pair every status with explicit words ("Taken"/"Not taken yet", "Done"/"To do") in ≥16px — never color alone. [DEM-10, A11Y-6]
8. Add a caregiver-controlled "Simple mode" tied to the Living Profile stage that hides CRUD, analytics, and AI chat. [DEM-11]
9. Replace swipe/slide-out panels (reminders bell, onboarding) with large tappable buttons; keep visible Close, avoid drag-only dismiss. [DEM-3]
10. Move AI consent to the caregiver; present Vision to patients as one-tap suggestion buttons with short single-idea, read-aloud replies. [DEM-7, PUF-9]

---

## Top 10 Caregiver Experience Improvements

1. Make help alerts reach the caregiver anywhere via high-priority push + SMS fallback, not in-app polling. [CG-3, NOTIF-1]
2. Support real multi-patient operation — thread patientId everywhere and label every card with the patient name. [CG-1]
3. Replace the hollow stat strip with a single "All good / Needs attention" hero status from weighted signals. [CG-4, CG-12]
4. Give the dashboard real management power: caregiver CRUD for routines and meds. [CARE-7]
5. Enrich alert/timeline cards with patient name, timestamp, thumbnail/zone, and a primary action (View live, Call, Mark safe). [CG-5]
6. Cut notification fatigue: severity tiers, per-person/time grouping, inline "enroll this face," snooze, and a quiet digest default. [CG-6, NOTIF-8, SAFE-10]
7. Unify help resolution on one `resolveAlert(cause, note)` path; "I'm Responding Now" sets an acknowledged state that pushes reassurance to the patient. [CG-8, CARE-8, CG-9]
8. Add seat revocation / pending-invite cancel restricted to primary_caregiver, with cache cascade-clear. [CARE-11]
9. Always show health/device data with last-updated + explicit "no recent data" and retry, distinguishing "fine" from "no signal." [CG-10, FAIL-11, NOTIF-6]
10. Collapse the double onboarding to one short flow (link patient + name/stage) reaching a limited Home before the paywall. [CG-9, CARE-9, PMF-10, IA-5]

---

## Top 10 Accessibility Improvements

1. Darken `muted` to ~4.5:1 (or restrict to ≥18px bold) and add a contrast lint to CI. [A11Y-1, A11Y-9]
2. Add Dynamic Type scaling, `maxFontSizeMultiplier` on critical buttons, and minHeight rows; QA at iOS XL/XXL as a release gate. [A11Y-2, DEM-4, PUF-8]
3. Make the Emergency Help overlay sound + spoken + assertive live region + a11y focus. [A11Y-4]
4. Raise VoiceOver coverage from ~13% to ~100% with roles, labels, and hints on every Touchable. [A11Y-3]
5. Enforce ≥44pt touch targets / hitSlop via a shared IconButton component. [A11Y-5]
6. Darken amber (~#B86C1E) for white-text surfaces; reserve sage/coral-on-white for ≥18px bold. [A11Y-7]
7. Replace hardcoded hex in CheckInScreen with theme tokens so the voice flow survives dark mode. [A11Y-8]
8. Pair every color status cue with a non-color signal (icon/text/shape); verify grayscale legibility. [A11Y-6, DEM-10]
9. Honor Reduce Motion across the 5 looping animations via a shared `useReducedMotion` hook. [A11Y-10]
10. Hide decorative/ambient views from VoiceOver and group composite cards into single accessible elements. [A11Y-11]

---

## Top 10 Safety Improvements

1. Push + SMS the Help/SOS to all caregivers immediately, persist unacknowledged, re-fire until handled. [SAFE-1 (Safety), NOTIF-1, FAIL-1]
2. Add an acknowledgement-driven escalation engine: re-push primary, fan out to seats, then SMS/voice to an emergency contact. [SAFE-2 (Safety), NOTIF-4, SAFE-11]
3. Persist Help intents to a durable offline queue; confirm only on server ack; native SMS fallback when backend unreachable. [SAFE-9, SAFE-1 (Patient)]
4. Move reminders to always-on scheduling with a last-fired watermark + backfill so doses aren't silently skipped. [SAFE-5, NOTIF-9]
5. Add missed-medication detection with caregiver escalation; track adherence per dose. [SAFE-6, NOTIF-5]
6. Wire geofencing end-to-end (invoke locationWatcher, shorten suppression, set watermark only after confirmed push) + ship a real safe-zone picker. [SAFE-7, NOTIF-3, CG-8, FAIL-5]
7. Add fall detection on the existing accelerometer pipeline (impact + stillness) with a cancel window, framed general-wellness. [SAFE-4]
8. Add device/glasses heartbeat + battery watchdog with caregiver "monitoring offline / low battery" alerts. [SAFE-8, NOTIF-6, FAIL-10, FAIL-11]
9. Make all AI medication writes human-in-the-loop confirmation; never default dosage/time; disable write tools on the patient assistant. [AI-1, AI-2, AI-6]
10. Always surface a "help requested then cancelled" entry to the caregiver; never let a help event disappear without trace. [EMO-7, PUF-6, CG-9]

---

## Risk Matrix

| Risk | Likelihood | Severity | Current Handling | Residual Risk | Mitigation |
|------|-----------|----------|------------------|---------------|------------|
| Wandering / zone-exit | H | Critical | locationWatcher + geofence push fully built but never wired; "Set Safe Zone" is a placeholder; rate-limited to 1/hr; failures swallowed [NOTIF-3, CG-8, SAFE-7, FAIL-5, PMF-2, CARE-12, IA-7] | High — feature is theater, no real protection ships | Wire startLocationWatcher on geofence config, ship map-based picker, durable retry queue, set watermark only after confirmed push, shorten window to 5–10 min |
| Missed medication | H | High | Reminder fires once in a 5-min UTC window, no repeat, no detection/escalation; check-offs swallow errors [SAFE-6, NOTIF-5, NOTIF-9, SAFE-3] | High — no closed loop, false-negative adherence data | Local-tz reminders with escalating nudges, post-time taken_date check → caregiver P1 alert, per-dose adherence |
| Falls | M | High | No fall detection despite accelerometer access [SAFE-4] | High — patient relies on manual button exactly when they can't press it | Impact+stillness detection on existing pipeline, cancel window, route into escalation, general-wellness framing |
| Emergency (Help/SOS) | H | Critical | No push; in-app polling only; client-only retries; can be silently cancelled; overlay silent to VoiceOver [SAFE-1, NOTIF-1, FAIL-1, A11Y-4, EMO-7] | High → existential litigation risk | Immediate high-priority push to all seats + SMS, durable offline queue, ack-driven escalation, multi-sensory overlay, traceable cancel |
| Device / glasses disconnect | M | High | No disconnect/heartbeat state; silent empty catch (stream.ts:32); "silence = safe" ambiguity [SAFE-8, NOTIF-6, FAIL-10] | High — coverage gaps invisible | Server-side heartbeat freshness watchdog, "Glasses offline" banner distinct from app offline, fix silent catch |
| Battery depletion | M | High | No battery monitoring for glasses or patient phone [SAFE-8, NOTIF-6, FAIL-11] | High — protection ends silently | Forward device battery, push P1 at ~20%/10%, dashboard battery status, patient-device last-active indicator |
| False positive (alert noise) | H | Medium | Every unrecognized face becomes an alert; no de-dup/throttle/confidence; single token [CG-6, NOTIF-8, SAFE-10] | Medium → fatigue mutes real emergencies | Server de-dup/debounce, per-person cooldown, confidence thresholds, tiering, caregiver sensitivity controls |
| False negative / missed alert | H | Critical | Inverted priority (noise pushes, life-safety doesn't); foreground-only delivery; no foreground handler [NOTIF-1, NOTIF-2, NOTIF-7] | High | P0–P3 framework via one central sender, P0 bypasses DND + escalates, foreground notification handler |
| Caregiver non-response | M | Critical | No escalation if primary never acknowledges; single token; no SMS/voice fallback [SAFE-2, SAFE-3, NOTIF-4] | High | Timed escalation chain across seats then emergency contact, multi-token fan-out, SMS/voice fallback |
| Backend cold-start / offline during emergency | H | Critical | Render free tier sleeps (~30s); cron skipped while asleep; writes not retried after timeout; offline inferred only from failures [SAFE-5, FAIL-9, FAIL-4] | High | Always-on instance or external scheduler, durable urgent queue with idempotency keys, NetInfo-driven offline state, SMS fallback that bypasses backend |
| Single-caregiver SPOF | H | High | One push token per patient; invite-only with no revocation; no multi-seat fan-out [SAFE-3, CARE-11, CG-1] | High | One token per (patient, caregiver), fan out all sends, multi-patient/multi-seat support, seat revocation |
| AI hallucination of meds/tasks | M | Critical | LLM auto-commits meds with no confirmation; hallucinated dosage/time defaulted; write tools exposed to patient; AI writes indistinguishable from human [AI-1, AI-2, AI-6, AI-3] | High — fabricated dosage liability | Propose-then-confirm cards routed to primary_caregiver, refuse missing safety fields, disable patient write tools, stamp createdBy + undo/report |

---

## Biggest Product Risks (most likely to kill the product or harm a user)

1. **The Help/SOS button doesn't push** — the lifeline only works if the app is open and polling. A backgrounded phone = a missed emergency. This is the single highest-severity, most litigable failure and undermines the entire safety value prop. [SAFE-1, NOTIF-1, FAIL-1, CG-3]
2. **The caregiver onboarding wizard and paywall never run on first launch**, and linking a patient doesn't refresh `patient_id`, leaving new caregivers in a dead stale state — ~100% of the intended funnel (and the reviewer's view of a working paid product) is broken. [ASR-1, CARE-1, CARE-2, CARE-3]
3. **The core differentiator (glasses intelligence) and the safety headline (wandering/geofence) are mock data and non-functional stubs labeled "Live."** This is a deceptive-data App Store + diligence + false-safety risk that also leaves nothing defensible to charge $29/mo for. [CG-2, CARE-4, PMF-1, PMF-2, IA-1, NOTIF-3, CG-8]
4. **No consent/awareness layer for a livestreamed, geo-tracked, biomarker-monitored vulnerable patient** — fails any healthcare ethics/IRB review and blocks the CRO/pharma revenue the model depends on. [EMO-1, EMO-2, EMO-8]
5. **Safety alerting has no escalation, no multi-caregiver redundancy, no offline durability, and runs on a sleeping free-tier cron** — uniformly unmitigated residual risk that prevents any defensible clinical/insurer positioning. [SAFE-2, SAFE-3, SAFE-5, SAFE-9, SAFE-11, NOTIF-4]
6. **The AI writes medications to the database with no human confirmation and fabricates missing dosages**, exposed directly to a cognitively-impaired patient — the highest-liability AI failure mode in a health product. [AI-1, AI-2, AI-6]
7. **The product fails Apple 2.1 because it isn't usable without glasses and the positioning conflict is unresolved**, while accessibility (~13% VoiceOver, no Dynamic Type, failing contrast) compounds App Store and litigation exposure for the 45–65 + low-vision audience. [PMF-6, ASR-3, A11Y-1, A11Y-2, A11Y-3, ASR-11]

---

## Missing Features That Could Become Major Differentiators

1. **Reliable end-to-end safety alerting as a product** — guaranteed push + SMS with server-confirmed receipt, ack-driven escalation across the care team, and durable offline queues. This is the defensible premium feature the multi-seat family plan should be sold on. [SAFE-11, SAFE-2, NOTIF-4, CG-3]
2. **Real wandering protection** — functional map-based safe-zone picker wired to the existing geofence/locationWatcher backend with background alerting; the strongest paid use case in the category. [PMF-2, CG-8, NOTIF-3, IA-7]
3. **Fall detection** on the already-present accelerometer pipeline — the most conspicuous competitive gap, protecting patients exactly when the manual button fails. [SAFE-4]
4. **A trustworthy "Is Mom OK right now?" status** computed from weighted real signals (meds, routine, falls, freshness) — the daily-open reassurance loop that drives caregiver retention. [CG-4, CG-12, PMF-8]
5. **Voice-first patient interaction** (real tap-to-talk + TTS, reusing useVoiceSession) — turns the AI from unusable-by-the-patient into the primary low-friction modality and widens the addressable population. [PUF-1, DEM-2, DEM-7]
6. **Stage-aware "Simple mode" tied to the Living Profile** — extends the usable lifespan of the patient app across disease progression, sustaining the data feed that every revenue line depends on. [DEM-11, PMF-8]
7. **A patient-controlled consent + transparency layer** (per-feature opt-in, persistent "Live" indicator, action receipts for AI writes) — converts the biggest liability into a trust differentiator that unlocks clinical-trial and data-licensing channels. [EMO-1, EMO-8, AI-9, AI-3]
8. **Closed-loop adherence monitoring** — per-dose tracking with missed-med caregiver escalation, strengthening both the daily intervention moment and the de-identified adherence-data asset. [SAFE-6, NOTIF-5]
9. **Care-team coordination + living-profile/memory** repositioned as headline value — existing real engineering currently buried and unmonetized, a defensible non-vaporware wedge. [PMF-11, CARE-11]


---

# Detailed Findings by Dimension


---

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


---

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


---

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


---

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


---

## Accessibility Audit (HIG + WCAG + senior-friendly)

For an app whose entire value proposition is serving presbyopic 45-65 caregivers and cognitively-impaired, often low-vision dementia patients, accessibility is shockingly thin and the gaps were confirmed in code, not just inferred from docs. The muted text token fails WCAG AA contrast across all backgrounds and is used in 180 places; VoiceOver labelling covers roughly 13% of interactive elements; there is zero Dynamic Type, Reduce Motion, or screen-reader-announcement support anywhere in the codebase; and the single most safety-critical flow — the incoming "Help Requested" SOS overlay — is haptics-only with no sound and no spoken announcement. One sub-claim was corrected during verification (expo-av IS used elsewhere, in the voice session hook), but that does not change the conclusion: the help overlay itself plays no sound and never announces to VoiceOver. Every Critical and High finding below was verified against the actual source.

### [A11Y-1] Primary muted text color fails WCAG AA contrast on every background
**Severity:** Critical · **Effort:** Medium

- **Issue:** `colors.muted` (#9590B0) fails WCAG AA contrast on bg, surface, and warm backgrounds.
- **Description:** `colors.muted` is #9590B0 (theme.ts:19) on bg #F4EEFC (theme.ts:4) / surface #F7F5FF (theme.ts:5). Computed contrast ≈2.68-2.89:1 — below the 4.5:1 AA threshold for normal text and below the 3.0:1 large-text floor. Applied in 180 confirmed `color: colors.muted` sites, overwhelmingly on 11-13px caption/label/meta text.
- **Why it matters:** Muted text carries timestamps, statuses, sub-labels, and medication metadata — secondary but often clinically relevant info. Failing contrast at small sizes makes it unreadable for the presbyopic target demographic.
- **Impact:** Caregivers and low-vision patients cannot reliably read status/metadata; clinical timing info is missed; concrete ADA/508 and Apple HIG exposure.
- **Recommendation:** Darken muted to ≈#6E6890 (~4.5:1 on bg) for normal text, or restrict the current value to ≥18px bold. Add a relative-luminance contrast lint to CI so tokens can't regress.
- **Expected impact:** Brings ~180 text instances into WCAG AA compliance and removes a concrete accessibility-litigation/App Store risk.
- **Evidence:** theme.ts:19, :4, :5; computed 2.68/2.82/2.89:1; 180 `color: colors.muted` usages (confirmed via grep).

### [A11Y-2] No Dynamic Type / Larger Text support — fonts are fixed pixel sizes
**Severity:** Critical · **Effort:** Large

- **Issue:** Zero Dynamic Type accommodation; layouts built on fixed pixel dimensions that clip when system text is enlarged.
- **Description:** 0 `allowFontScaling` occurrences confirmed. Typography tokens (theme.ts:99-115) are absolute pixel constants (hero 34, body 15, small 13, caption 11), with 200+ inline small fontSize literals. RN scales text by default, but fixed-height containers (tab bar 72px, fixed-height cards) will clip/overflow at Larger Text, and nothing was QA'd for it.
- **Why it matters:** Apple HIG and the senior-care thesis demand Dynamic Type. A 60-year-old caregiver who already runs iOS Large/XL text hits truncated buttons and clipped med names.
- **Impact:** The core paying demographic gets a broken layout the moment they use the OS accessibility setting they rely on; patients get no in-app enlargement path.
- **Recommendation:** Scale type via `PixelRatio.getFontScale()` (clamped), set `maxFontSizeMultiplier` on critical buttons, convert fixed `height` rows/cards to `minHeight`, and QA every primary screen at iOS XL/XXL. Treat Dynamic Type as a release gate.
- **Expected impact:** Unlocks usability for the majority of the 45-65 cohort running enlarged text and satisfies a hard HIG requirement.
- **Evidence:** theme.ts:99-115; 0 `allowFontScaling`; fixed-height tab bar and card styles.

### [A11Y-4] Emergency "Help Requested" overlay is silent to screen readers and plays no sound
**Severity:** Critical · **Effort:** Medium

- **Issue:** The incoming SOS overlay fires haptics only — no sound, no VoiceOver announcement.
- **Description:** The full-screen help overlay (RootNavigator.tsx:696 "Help Requested") triggers `Haptics.notificationAsync(Error)` plus two Heavy impacts (RootNavigator.tsx:399-401) and a fade-in. Verified: there is no `Sound`/`playAsync`/expo-av/expo-speech call in RootNavigator.tsx, and the entire codebase has 0 `accessibilityLiveRegion` / `announceForAccessibility` / `AccessibilityInfo`. (Note: expo-av does exist in the app — used by `useVoiceSession.ts` — so the library is available; it simply is not used for this alert.) A VoiceOver user focused elsewhere gets no spoken notice their dependent triggered an SOS.
- **Why it matters:** This is the most safety-critical event in the product. A silent, haptic-only, screen-reader-unannounced alert means a blind or distracted caregiver can miss a genuine emergency; haptics alone are unreliable if the phone is on a table.
- **Impact:** Patient safety — a missed help alert can mean an unattended fall, wandering, or medical event; also destroys caregiver trust.
- **Recommendation:** On alert arrival: play an attention sound via the already-present expo-av (respect silent switch with a setting), call `AccessibilityInfo.announceForAccessibility` and set `accessibilityLiveRegion="assertive"` on the overlay so VoiceOver speaks it, and have the overlay grab accessibility focus. Keep the haptics.
- **Expected impact:** Converts a silent, easily-missed SOS into a multi-sensory (sound + haptic + spoken) alert, directly reducing emergency-miss risk on the most vulnerable flow.
- **Evidence:** RootNavigator.tsx:399-401 (haptics only), :696; no sound call in RootNavigator.tsx (confirmed); 0 liveRegion/announce/AccessibilityInfo app-wide; expo-av present at useVoiceSession.ts:2.

### [A11Y-3] VoiceOver coverage ~13% — most interactive elements have no accessibility label
**Severity:** High · **Effort:** Medium

- **Issue:** ~200 interactive elements, only ~26 labelled; icon-only buttons expose no name to VoiceOver.
- **Description:** Confirmed counts: 26 `accessibilityLabel`, 22 `accessibilityRole`, 2 `accessibilityHint` against ~200 Touchable/Pressable. FacesScreen has 15 interactive elements and 0 accessibility labels (confirmed). Icon-only buttons (bell, menu, close, FABs) announce only as "button" — WCAG 4.1.2 (Name, Role, Value) failure.
- **Why it matters:** The dementia-caregiving population overlaps heavily with vision loss; some caregivers are blind. Unlabelled icon buttons make core flows unusable with a screen reader.
- **Impact:** Blind/low-vision caregivers cannot operate managing faces, opening patient detail, or navigating the dashboard.
- **Recommendation:** Audit every Touchable/Pressable: add `accessibilityRole="button"` + descriptive `accessibilityLabel`; add hints for non-obvious actions. Start with FacesScreen, PatientsDashboardScreen, and all header/FAB icons.
- **Expected impact:** Raises VoiceOver coverage from ~13% toward 100%, closing a clear WCAG 4.1.2 violation.
- **Evidence:** 26 label / 22 role / 2 hint vs ~200 touchables (confirmed); FacesScreen.tsx 15 touchables / 0 labels.

### [A11Y-5] Navigation and sheet icon buttons fall below the 44pt minimum touch target
**Severity:** High · **Effort:** Small

- **Issue:** Header and sheet icon buttons are 32-36pt, below the HIG 44pt minimum, with almost no hitSlop compensation.
- **Description:** Confirmed sizes: bellBtn 36×36 and menuBtn 36×36 (RootNavigator.tsx:823,830), closeBtn 34×34 (RootNavigator.tsx:455), VisionSheet close 32×32 (VisionSheet.tsx:215). Only 1 `hitSlop` exists app-wide, so almost none compensate with an expanded tap region.
- **Why it matters:** Motor precision declines with age and with conditions common in this cohort (arthritis, tremor). Sub-44pt targets cause missed taps; for a dementia patient a missed tap adds confusion.
- **Impact:** Older caregivers and tremor/arthritis users mis-tap navigation, notifications, and close buttons; HIG non-compliance flaggable in review.
- **Recommendation:** Set icon-button containers to ≥44×44pt, or keep visual size and add `hitSlop={{top:8,bottom:8,left:8,right:8}}`. Introduce a shared 44pt IconButton component to prevent regression.
- **Expected impact:** Eliminates mis-taps on every primary navigation control for motor-impaired users; low-effort, high-value HIG fix.
- **Evidence:** RootNavigator.tsx:455,823,830; VisionSheet.tsx:215; hitSlop usage = 1 app-wide (confirmed).

### [A11Y-7] Amber accent fails contrast for white text and small-text foreground
**Severity:** High · **Effort:** Small

- **Issue:** White-on-amber pills/badges compute ~2.41:1, failing AA and the large-text floor.
- **Description:** `colors.amber` #E8934A (theme.ts:26) with white text ≈2.41:1 — fails AA (4.5) and the 3.0 large-text floor. Sage white ≈3.75:1 and coral white ≈3.65:1 pass only for large/bold text. Amber is the meds / "needs attention" accent, so white-on-amber chips carrying medication and attention messaging are below readable contrast.
- **Why it matters:** Medication and "needs attention" states are exactly the information that must be readable; a 2.41:1 amber chip is effectively illegible to low-vision users — a WCAG 1.4.3 failure on a clinically meaningful element.
- **Impact:** Low-vision caregivers/patients miss medication and attention cues rendered as white-on-amber.
- **Recommendation:** Darken amber to ≈#B86C1E for white-text surfaces (or use dark text on amber), and reserve sage/coral-on-white for ≥18px bold only. Add to the A11Y-1 contrast lint.
- **Expected impact:** Brings medication/attention chips into WCAG AA compliance for low-vision users.
- **Evidence:** theme.ts:26 (#E8934A); computed white-on-amber 2.41:1, sage 3.75:1, coral 3.65:1.

### [A11Y-8] Voice check-in (CheckInScreen) bypasses theme with hardcoded low-contrast hex and breaks in dark mode
**Severity:** High · **Effort:** Medium

- **Issue:** CheckInScreen uses inline hardcoded slate-gray hex that fails contrast and ignores dark mode.
- **Description:** Confirmed hardcoded literals: #64748b (line 45), #94a3b8 (lines 50, 73, 85), #0f172a (73), #dc2626 (79, 104). #94a3b8 on white ≈2.56:1 — fails AA. These literals never adapt to dark mode (ThemeContext ignored), so in dark mode the transcript/instructions render near-invisible. The transcript Pressables also lack accessibility labels.
- **Why it matters:** Voice check-in is a flagship Plan-C accessibility path for users who can't type. The one flow built for vision/motor-limited users is itself low-contrast and dark-mode-broken, with a tiny gray transcript exactly for the users most likely to rely on it.
- **Impact:** Low-vision users can't read the live transcript/instructions; dark-mode users may see invisible text; the accessibility-first feature is inaccessible.
- **Recommendation:** Replace all hardcoded hex with theme tokens inside the `useMemo(StyleSheet)` pattern; render transcript with `colors.text` at ≥16px; add `accessibilityLabel`/`Role` to the mic Pressables and `accessibilityLiveRegion` on the transcript.
- **Expected impact:** Restores the voice flow's usability in both themes and for low-vision users, and fixes a dark-mode invisibility bug.
- **Evidence:** CheckInScreen.tsx:45,50,73,79,85,104 (confirmed hardcoded hex); #94a3b8 on white ≈2.56:1.

### [A11Y-6] Color-only status signaling (sage/amber/coral) with no text or icon redundancy
**Severity:** Medium · **Effort:** Small

- **Issue:** Patient status is conveyed by accent-strip and avatar color alone, failing WCAG 1.4.1.
- **Description:** The design system signals status purely through color: 4-5px colored left strips and avatar colors (sage=on track, amber=needs attention, coral=alert). Sage (#5C8E7A) and amber (#E8934A) are mid-tone green/orange that are hard to distinguish under red-green CVD (~8% of men).
- **Why it matters:** WCAG 1.4.1 requires color never be the sole means of conveying information. A colorblind caregiver scanning a dashboard cannot tell "on track" from "needs attention" by accent strip alone.
- **Impact:** Colorblind caregivers misread status at a glance; a "needs attention" patient blends in, delaying escalation.
- **Recommendation:** Pair every color cue with a non-color signal — status icon (check vs warning), always-visible text label, or a shape/pattern difference. Verify the dashboard is legible in grayscale.
- **Expected impact:** Makes patient triage reliable for ~8% of male caregivers with CVD and satisfies WCAG 1.4.1.
- **Evidence:** theme.ts:24-29; PatientsDashboardScreen left-accent + avatar-color status per design system.

### [A11Y-9] 11px uppercase section labels too small and low-contrast for seniors
**Severity:** Medium · **Effort:** Small

- **Issue:** 11px uppercase tracked labels, frequently in failing muted gray.
- **Description:** `labelStyle` and `captionStyle` are 11px (theme.ts:113-114); labelStyle adds letterSpacing 1.2 + uppercase. These section labels are repeatedly paired with `colors.muted`. 11px uppercase tracked text in a failing-contrast gray is among the least legible styles for presbyopic eyes.
- **Why it matters:** Section labels provide orientation ("Today's History", "Checking in for") — for a dementia-care app, orientation and predictability are core cognitive-accessibility needs; uppercase further reduces word-shape legibility.
- **Impact:** Seniors and presbyopic caregivers lose structural cues that make screens scannable, raising cognitive load.
- **Recommendation:** Raise label/caption minimum to 13px, drop full uppercase (or keep it only at ≥13px with a darker color), and never pair with the failing muted color — use `subtext` (#3D3560, ~9.85:1) instead.
- **Expected impact:** Makes the orienting structure of every screen legible to the target age group.
- **Evidence:** theme.ts:113-114; widespread labelStyle/captionStyle usage paired with colors.muted.

### [A11Y-10] Looping animations with no Reduce Motion support
**Severity:** Medium · **Effort:** Small

- **Issue:** Five files run continuous loop animations regardless of the iOS Reduce Motion setting.
- **Description:** Confirmed `Animated.loop`/`withRepeat` in RootNavigator.tsx, FacesScreen.tsx (pulsing glasses chip), PatientsDashboardScreen.tsx, HelpScreen.tsx (pulsing ring), SplashScreen.tsx. The codebase has 0 `isReduceMotionEnabled`/`useReducedMotion`/`AccessibilityInfo`, so loops run regardless of the OS preference.
- **Why it matters:** WCAG 2.3.3 / HIG: persistent motion can cause discomfort or vestibular issues, and for a cognitively-impaired patient, constantly-moving UI increases confusion and reduces focus.
- **Impact:** Patients with dementia and vestibular-sensitive users are distracted by perpetual motion they cannot stop from within the app.
- **Recommendation:** Read `AccessibilityInfo.isReduceMotionEnabled()` (and subscribe to its change event), freeze loops to a static state when enabled, via a shared `useReducedMotion`-aware hook.
- **Expected impact:** Honors a system accessibility setting across 5 animated surfaces, reducing distraction for the patient population.
- **Evidence:** Animated.loop/withRepeat in 5 files (confirmed); 0 isReduceMotionEnabled/useReducedMotion app-wide.

### [A11Y-11] Decorative/ambient elements not consistently hidden from VoiceOver
**Severity:** Low · **Effort:** Medium

- **Issue:** Only a handful of decorative Views are hidden from VoiceOver, cluttering the reading order.
- **Description:** Only 7 `accessibilityElementsHidden`/`importantForAccessibility` usages exist app-wide (confirmed: TimelineScreen, BackgroundDecor, TodayScreen), while the design system is heavy with decorative gradients, ambient/blur layers, accent strips, and progress-bar Views. Unmarked, VoiceOver announces them or inserts empty/duplicated stops.
- **Why it matters:** A clean, predictable reading order is essential for the screen-reader users in this cohort; decorative noise plus low label coverage (A11Y-3) compounds into an unusable audio experience.
- **Impact:** Screen-reader users wade through meaningless announcements between real controls, slowing every task.
- **Recommendation:** Mark all purely decorative Views with `accessibilityElementsHidden`/`importantForAccessibility="no-hide-descendants"`, and group composite cards into a single accessible element with a combined label.
- **Expected impact:** Produces a clean, efficient VoiceOver reading order, multiplying the benefit of A11Y-3's label work.
- **Evidence:** 7 accessibilityElementsHidden/importantForAccessibility usages app-wide (TimelineScreen, BackgroundDecor, TodayScreen); decorative gradient/ambient/accent-strip patterns per design system.


---

## Caregiver Experience

The caregiver surface is the stated primary product of the pivot, yet verification confirms it is structurally unable to deliver its core promise. The data layer collapses every caregiver-scoped screen (Timeline, Alerts, People, Help, routines, meds) to a single `user.patient_id`, so the advertised multi-patient "family command center" and the 2-seat Starter plan cannot be honored. The highest-value caregiver screens (Daily Digest, Nutrition, Repetition, Glasses Alerts) render hardcoded mock data, help requests reach a backgrounded phone via no push at all, and the headline "On track" status is driven solely by a manual help press — meaning the app is most reassuring exactly when a non-self-advocating dementia patient is least safe. Every Critical and High finding below was verified against the actual code; none were refuted.

### [CG-1] App does not actually support multiple patients — every core dashboard resolves to ONE patient
**Severity:** Critical · **Effort:** Large

- **Issue:** All caregiver data endpoints are patient-agnostic and the server resolves a single `user.patient_id`.
- **Description:** `fetchPeople()` -> /api/people, `fetchAlerts()` -> /api/alerts, `fetchHelpAlerts()`, `fetchRoutines()`, `fetchMedications()` take no patientId (src/api/client.ts:194-200). Server `resolvePatientId` reads one `user.patient_id` (src/server-core/patientResolver.ts:32-46). The "My Patients" grid (usePatients -> /api/patients/linked) can list several (src/hooks/usePatients.ts:12-24), but Timeline/Alerts/People/Help all reflect the single linked patient regardless of which card was tapped.
- **Why it matters:** The pivot thesis is the adult child caring for a parent — frequently two parents or a shared sibling view. A product sold as a family care command center that silently collapses to one patient is a structural PMF failure.
- **Impact:** Caregiver with 2+ patients sees wrong-patient data with no way to tell whose alert/med/help it is; the priced "family plan"/Starter 2-seat tier cannot be honored by the data layer.
- **Recommendation:** Thread an explicit patientId through every caregiver endpoint and hook (useDashboardData, useHelpAlert, useRoutine, useMeds, usePeople). Add a patient context/selector at the app shell and label every card with the patient name.
- **Expected impact:** Unlocks the core multi-patient/family value prop the $29/mo plan is priced on; eliminates cross-patient data bleed.
- **Evidence:** src/api/client.ts:194-200; src/server-core/patientResolver.ts:32-46; src/hooks/usePatients.ts:12-24; src/screens/caregiver/PatientsDashboardScreen.tsx:286-298

### [CG-2] The most valuable caregiver screens (Daily Digest, Nutrition, Repetition, Glasses Alerts) are hardcoded MOCK data
**Severity:** Critical · **Effort:** Medium

- **Issue:** Safety-critical caregiver screens render static mock fixtures, not live data.
- **Description:** DailyDigestScreen uses `MOCK_DAILY_DIGEST` (src/screens/caregiver/DailyDigestScreen.tsx:12,116), NutritionTimelineScreen uses `MOCK_NUTRITION_EVENTS` (13,41), RepetitionPatternScreen uses `MOCK_REPETITION_WEEK` (13,55), GlassesAlertFeedScreen seeds state from `MOCK_GLASSES_ALERTS` (16,245), and GlassesHubScreen badge counts derive from mocks (13,33-50), all imported from src/data/glassesMockData. These display meals, falls, wandering, confusion, sundowning, sleep, and medication confirmation — none real.
- **Why it matters:** A caregiver who sees "Falls: None" or "Lunch: Observed 12:40pm" will believe and act on it. Presenting fabricated safety data in a healthcare product for a cognitively-impaired population is a false-reassurance hazard and a fraud/liability exposure.
- **Impact:** Patient endangered by false "all safe" reassurance; trust destroyed when numbers never change; potential regulatory/legal exposure for fabricated clinical-adjacent data.
- **Recommendation:** Gate these screens behind a clearly labeled "Sample data — not live" state or remove them from navigation until backed by real endpoints. Never ship simulated safety/medical observations as if real.
- **Expected impact:** Removes the single largest trust-and-liability landmine in the caregiver experience; prevents false-negative safety reassurance.
- **Evidence:** src/screens/caregiver/DailyDigestScreen.tsx:12,116; NutritionTimelineScreen.tsx:13,41; RepetitionPatternScreen.tsx:13,55; GlassesAlertFeedScreen.tsx:16,245; GlassesHubScreen.tsx:13,33-50

### [CG-3] Help requests rely on in-app polling — no server push, so a backgrounded phone never alerts
**Severity:** Critical · **Effort:** Medium

- **Issue:** The help-alert backend handler only inserts to MongoDB; it sends no push, so a locked/backgrounded caregiver phone never rings.
- **Description:** `pendingCount` is derived from useHelpAlert's polling loop (4s active / 15s idle, src/hooks/useHelpAlert.ts:40-46) and surfaces in the urgent overlay (RootNavigator.tsx:374-419). The help-alert POST handler runs `db.collection("help_alerts").insertOne(doc)` with zero push/escalation code (src/server-routes/helpAlerts.ts:42-50); grep confirms no push/token/expo/notif usage anywhere in helpAlerts.ts. Push is wired in streamSessions/patientTokens/device/auth/dailySummary — never for help. The alert only surfaces when the caregiver next foregrounds the app and a poll lands.
- **Why it matters:** Help is the single most time-critical signal in the product. Depending on foreground polling means the core safety promise silently fails exactly when it matters (phone in pocket, asleep, multitasking).
- **Impact:** Patient in crisis goes unanswered; caregiver believes they'll be notified and isn't — the deepest possible trust breach for a safety product.
- **Recommendation:** Send a high-priority, time-sensitive Expo/APNs push from the help-alert POST handler to all linked caregiver push tokens. Keep polling as fallback only. Add delivery confirmation.
- **Expected impact:** Converts help from best-effort-when-app-open to reliable real-time — the difference between a usable and unusable safety feature.
- **Evidence:** src/hooks/useHelpAlert.ts:40-46; src/navigation/RootNavigator.tsx:374-419; src/server-routes/helpAlerts.ts:42-50 (no push)

### [CG-4] No single "is Mom OK right now?" status — the one thing a stressed caregiver wants is absent
**Severity:** High · **Effort:** Medium

- **Issue:** The caregiver home leads with vanity analytics, not a live "is my parent OK now" state.
- **Description:** TimelineScreen renders "Command Center / Today at a Glance" and a 3-stat strip: Seen Today, Alerts, Most Visits (src/screens/TimelineScreen.tsx:229-255). None answers the real question — no prominent last-seen timestamp, no current location / safe-zone state, no last meal, no meds-taken-today yes/no. "Most Visits" (which contact appeared most) is near-useless to a worried child. PatientDetail shows progress bars and a mood strip but no live presence.
- **Why it matters:** A caregiver opens the app in a moment of worry asking one question: is my parent OK at this instant? The IA answers an analytics-flavored question instead.
- **Impact:** Caregiver gets no relief, must call/visit to actually know — undermining the "reduce caregiver burden" value prop and driving abandonment.
- **Recommendation:** Replace the stat strip with a single hero status: a large "All good" / "Needs attention" state plus last seen, safe-zone status, last meal, and meds-taken-today, each with a clear unknown/stale fallback.
- **Expected impact:** Directly delivers the reassurance payoff that drives daily opens and retention for the paying caregiver.
- **Evidence:** src/screens/TimelineScreen.tsx:229-255; src/screens/caregiver/PatientDetailScreen.tsx; src/hooks/useDashboardData.ts

### [CG-5] Alert and timeline cards carry no patient name and no actionable context — they create anxiety
**Severity:** High · **Effort:** Medium

- **Issue:** Alerts use fixed strings with no who/where/photo and only Dismiss as an action.
- **Description:** Timeline alert events render the constant "Unrecognized face detected" / "AI alert · Glasses detected an unknown person" (src/screens/TimelineScreen.tsx:54,60). AlertsScreen help cards show only "Patient needs help" + relative time (AlertsScreen.tsx:321-322); AI cards show "Unrecognized person detected" + an "AI Alert" badge with a Dismiss button (lines 402-419). No location, photo, patient name, or severity. For multi-patient households the missing name makes alerts un-triageable.
- **Why it matters:** An alert that says "unknown person detected" with no image, location, or patient identity provokes alarm while giving nothing to act on — the worst combination, and it trains reflexive dismissal (alert blindness).
- **Impact:** Caregiver anxiety spikes with no path to resolution; ambiguous alerts erode the value of true alerts.
- **Recommendation:** Enrich every alert with patient name, timestamp, captured frame/thumbnail where available, location/zone, and a primary action (View live, Call patient, Mark safe). Distinguish informational vs urgent visually and in copy.
- **Expected impact:** Turns alarming-but-empty notifications into triageable events, reducing reflexive dismissal and increasing trust.
- **Evidence:** src/screens/TimelineScreen.tsx:54,60; src/screens/AlertsScreen.tsx:321-322,402-419

### [CG-6] Notification fatigue: every unrecognized face becomes an alert with no tuning or grouping
**Severity:** High · **Effort:** Medium

- **Issue:** AI face alerts are one-per-event with only a Dismiss action, no severity, grouping, snooze, or "enroll this face."
- **Description:** AI face-detection alerts are listed individually with a single Dismiss control (AlertsScreen.tsx:390-423) and also injected into the Timeline (useDashboardData.ts:95). There is no severity threshold, no grouping by person/time, no snooze, no per-type mute, and no inline way to teach "this is the neighbor." Each unknown face = one more red number on the Alerts badge.
- **Why it matters:** A dementia patient is visited by aides, neighbors, delivery people; a glasses system fires unrecognized-face alerts constantly. With no tuning, the Alerts tab becomes noise the caregiver learns to ignore, masking the rare alert that matters.
- **Impact:** Caregiver desensitization (cry-wolf), missed real alerts, and an Alerts tab that feels like a chore.
- **Recommendation:** Add alert severity/priority, grouping by person and time window, inline "enroll this face," snooze, and per-category notification preferences. Default low-signal events to a quiet digest, not the live feed.
- **Expected impact:** Cuts alert volume dramatically, restoring signal-to-noise so urgent alerts are actually seen.
- **Evidence:** src/screens/AlertsScreen.tsx:390-423; src/hooks/useDashboardData.ts:95

### [CG-8] Safe Zone (geofence) is non-functional theater — no way to actually set a zone
**Severity:** High · **Effort:** Medium

- **Issue:** The "Set Safe Zone" UI only shows an Alert telling the user to contact support; it never writes to the existing geofence endpoint.
- **Description:** PatientDetail surfaces a prominent geofence sheet, but the action shows `Alert.alert("Set Safe Zone", "To set the safe zone, enter the patient's home coordinates. Contact support for full address search.", [{ text: "OK" }])` (src/screens/caregiver/PatientDetailScreen.tsx:563-574). There is no map, no address input, no radius control. A real geofence backend route exists and is untested through this UI (src/server-routes/geofence.ts), so the feature is a dead end despite the backend being present.
- **Why it matters:** Wandering is a top fear in dementia care. Advertising a Safe Zone the caregiver cannot configure is a broken core safety feature and erodes trust; it compounds the mock wandering display in CG-2.
- **Impact:** Caregiver cannot set the wandering protection they came for; false sense that geofencing is available.
- **Recommendation:** Ship a real map-based zone picker (center pin + radius slider) writing to the existing geofence endpoint, or hide the card entirely until it works.
- **Expected impact:** Delivers a real wandering-protection control — a top reason caregivers would pay — instead of trust-eroding theater.
- **Evidence:** src/screens/caregiver/PatientDetailScreen.tsx:550-578; src/server-routes/geofence.ts

### [CG-12] Patient status (On track / Needs attention) is derived only from pending help count — a hollow signal
**Severity:** High · **Effort:** Medium

- **Issue:** The headline patient status flips only on a manual help press; adherence and safety signals are ignored.
- **Description:** Dashboard cards compute `needsHelp = (patient.pendingHelp ?? 0) > 0` and set both accent color and status label from it; `statusLabel = needsHelp ? "Needs attention" : "On track"` (src/screens/caregiver/PatientsDashboardScreen.tsx:287-298). Task and med ratios are computed for the progress bars (291-296) but do NOT affect status. A patient who took zero meds and ate nothing still shows green "On track" unless they pressed Help.
- **Why it matters:** The status pill is the caregiver's primary triage glance across patients. Tying it solely to a manual help press makes it reassuring precisely when the patient is least able to self-advocate — dementia patients often won't or can't press Help.
- **Impact:** Caregiver triages by a green badge that ignores adherence and safety, deprioritizing patients who are actually declining.
- **Recommendation:** Compute status from a weighted set of signals — meds adherence, routine completion, recent falls/wandering, data freshness, plus help — and default to "Needs attention"/"Unknown" when key data is missing rather than green.
- **Expected impact:** Makes the at-a-glance triage signal trustworthy and aligned with actual patient wellbeing.
- **Evidence:** src/screens/caregiver/PatientsDashboardScreen.tsx:287-298; src/screens/caregiver/PatientDetailScreen.tsx

### [CG-7] 15s polling with no real-time channel makes "live" status stale and battery-costly
**Severity:** Medium · **Effort:** Medium

- **Issue:** All caregiver state is short-interval foreground polling; there is no websocket/SSE/push for status.
- **Description:** useDashboardData polls every 15s (POLL_INTERVAL=15000, src/hooks/useDashboardData.ts:6,34), usePatients every 15s (usePatients.ts:5,28), useNotes every 30s (useNotes.ts:23), useHealthSummary is one-shot (useHealthSummary.ts:21). Data is 0–15s stale at best, only while foregrounded, multiplied per linked patient + screen against a Render free tier that cold-starts ~30s.
- **Why it matters:** A monitoring product implicitly promises currentness. Fixed short-interval polling is too slow for an emergency and too aggressive for battery/cost, and it stops entirely in the background.
- **Impact:** Stale dashboards undermine trust; battery drain and redundant server hits degrade UX and raise infra cost as seats scale.
- **Recommendation:** Move urgent state (help, safety) to push/SSE and let ambient stats poll on a slow cadence or refresh-on-focus. Pause polling when backgrounded; resume + immediate fetch on foreground.
- **Expected impact:** Real-time urgent signals, lower battery/server cost, and accurate "now" status.
- **Evidence:** src/hooks/useDashboardData.ts:6,34; src/hooks/usePatients.ts:5,28; src/hooks/useNotes.ts:23; src/hooks/useHealthSummary.ts:21

### [CG-9] Help resolution captures cause/notes from the caregiver but the patient never learns help is coming
**Severity:** Medium · **Effort:** Small

- **Issue:** The caregiver acknowledgement never closes the loop back to the frightened patient.
- **Description:** When a help alert arrives, the caregiver flow is overlay -> Mark as handled -> ResolveSheet to log a cause/note (AlertsScreen.tsx:325-441). The RootNavigator urgent overlay's "Responding now" tap just hides the overlay (RootNavigator.tsx:421-424). Nothing signals back to the patient that a caregiver has seen/acknowledged the request — consistent with the absence of push in CG-3.
- **Why it matters:** For a dementia patient, the anxiety of an unanswered help request compounds confusion. Closing the loop ("Sarah is on her way") is as important as the caregiver action itself.
- **Impact:** Patient remains distressed with no acknowledgement; caregiver "Responding now" tap is purely cosmetic.
- **Recommendation:** When the caregiver acknowledges, push a reassurance state to the patient HelpScreen ("Help is on the way — [name] saw your request"). Persist the acknowledgement timestamp on the alert.
- **Expected impact:** Closes the emotional loop for the patient and makes the caregiver's acknowledgement meaningful.
- **Evidence:** src/screens/AlertsScreen.tsx:325-441; src/navigation/RootNavigator.tsx:421-424

### [CG-10] Health/wellness data fails silently and shows no recency — caregiver can't tell "fine" from "no data"
**Severity:** Medium · **Effort:** Small

- **Issue:** The health strip hides itself entirely when there's no data, swallows errors, and shows no timestamp.
- **Description:** PatientHealthStrip returns null when there is no steps/HR/sleep (`if (!hasAny) return null`, src/components/health/PatientHealthStrip.tsx:14) and useHealthSummary captures errors into a never-surfaced `error` state with no retry/poll (src/hooks/useHealthSummary.ts:13-21). When data shows there is no timestamp — "6,200 steps" could be live or three days stale.
- **Why it matters:** Absence-of-data and good-news look identical, which is dangerous: a dead sensor reads as "nothing to worry about." Recency and explicit "no data since X" states are essential for monitoring trust.
- **Impact:** Caregiver may be falsely reassured by stale or missing biometrics; silent failures hide that the monitoring chain is broken.
- **Recommendation:** Always render the health strip with an explicit "no recent data" state and a last-updated timestamp per metric; surface load errors with a retry.
- **Expected impact:** Distinguishes "all well" from "we've lost the signal," preventing false reassurance.
- **Evidence:** src/components/health/PatientHealthStrip.tsx:14; src/hooks/useHealthSummary.ts:13-21

### [CG-11] PatternsCard and Check In are bolted onto the caregiver home with weak integration and inconsistent design
**Severity:** Low · **Effort:** Small

- **Issue:** A hardcoded-hex Check In button and a non-theme PatternsCard ignore the design system and break dark mode.
- **Description:** TimelineScreen injects a raw `#6366f1` Check In button with inline styles and `fontWeight:'700'` (src/screens/TimelineScreen.tsx:258-265) plus a PatternsCard using literal hex colors and no theme tokens. PatternsCard silently returns null with no empty/loading state and never re-fetches.
- **Why it matters:** These are the proactive-insight and engagement hooks for the caregiver, yet they look pasted-in, break dark mode, and give no feedback when empty — signalling an unfinished product to the exact paying user the pivot courts.
- **Impact:** Caregiver perceives a lower-quality, inconsistent product; the insights feature is invisible when it has nothing to show.
- **Recommendation:** Rebuild Check In and PatternsCard with theme tokens (colors/fonts/spacing), add loading/empty states, and integrate Check In into a coherent action area.
- **Expected impact:** Consistent, dark-mode-correct UI and discoverable insights, raising perceived quality of the primary paid surface.
- **Evidence:** src/screens/TimelineScreen.tsx:258-265; src/components/PatternsCard.tsx


---

## Safety & Risk Audit

This is the highest-liability dimension of the product and the code does not back the safety claims. Every verification confirmed the draft: the single most safety-critical feature — the patient Help/SOS button — writes a DB row and sends no notification of any kind, relying entirely on the caregiver having the app open and foregrounded to discover it via polling. There is no acknowledgement-driven escalation, no multi-caregiver fan-out (push tokens are last-write-wins, one per patient), no fall detection, no missed-medication detection, no device/battery watchdog, and reminders run on in-process node-cron that silently misses ticks while the Render free-tier backend sleeps. One detail in the offline-SOS finding was corrected (POST uses a 35s cold-start timeout, not 8s), but the durable-queue gap it describes is real. Before any clinical, insurer, pharma, or consumer safety marketing claim, the alerting stack needs to be rebuilt as a dedicated workstream with guaranteed delivery, escalation, and watchdogs.

### [SAFE-1] Help/SOS button sends NO push to caregiver — emergency only seen if app is open
**Severity:** Critical · **Effort:** Medium

- **Issue:** The patient Help button persists a DB row but triggers zero notification to the caregiver.
- **Description:** `POST /api/help-alerts` only calls `db.collection("help_alerts").insertOne` (helpAlerts.ts:42-56) — no Expo push, no SMS, no email. The caregiver-side urgent red overlay (RootNavigator.tsx:374-386) is driven by `pendingCount` from `useHelpAlert`, which discovers new alerts only by polling `fetchHelpAlerts` every 4s active / 15s idle (useHelpAlert.ts:40-46), and only while the caregiver app is mounted and foregrounded. If the phone is locked or the app backgrounded, a patient pressing Help produces nothing. A working caregiver push path already exists (device.ts:136-151, patientTokens.ts:58-82) but the Help route never calls it.
- **Why it matters:** The Help button is the patient's lifeline during a fall, pain, or confusion. An SOS that silently does nothing unless the caregiver is staring at the app is worse than none, because the family believes they are protected.
- **Impact:** Patient: a real emergency goes unanswered until the caregiver next opens the app. Caregiver: false security then catastrophic liability. Business: a single "the app didn't alert me when Mom fell" incident invites wrongful-death litigation and destroys the brand.
- **Recommendation:** In `POST /api/help-alerts`, after `insertOne`, immediately send a high-priority Expo push (sound, priority "high") to the caregiver token(s) — mirror device.ts:136-151. Add Twilio SMS fallback. Persist as unacknowledged and re-fire until handled. Treat as P0.
- **Expected impact:** Converts the core safety feature from non-functional-when-backgrounded to reliably delivered; removes the worst-case harm and existential litigation risk.
- **Evidence:** src/server-routes/helpAlerts.ts:42-56; src/hooks/useHelpAlert.ts:40-46; src/navigation/RootNavigator.tsx:374-386; contrast src/server-routes/device.ts:136-151.

### [SAFE-2] No escalation if caregiver never acknowledges a Help alert
**Severity:** Critical · **Effort:** Large

- **Issue:** An unacknowledged help alert sits "pending" forever with no second-tier notification.
- **Description:** A `help_alert` stays pending until a caregiver manually dismisses or resolves it (helpAlerts.ts:58-133). There is no timer, no escalation to other care-team members, no emergency-contact fallback, and no auto-call. `dailySummary.ts` only counts help alerts in a once-a-day 08:00 UTC digest (dailySummary.ts:82-93) — useless for an active emergency. No escalation job exists anywhere in `src/server-jobs/`.
- **Why it matters:** Single-caregiver coverage is fragile by definition. Real PERS/medical-alert systems escalate through a contact tree and ultimately to a monitoring center or 911. Without escalation the entire safety value collapses to "one specific person must be paying attention right now."
- **Impact:** Patient: unattended emergency. Caregiver: missing one alert leaves no backstop. Business: undermines the caregiver-burden value prop and any safety/clinical marketing claim.
- **Recommendation:** Add an escalation engine: if a help alert is unacknowledged after N minutes, push/SMS the next care-team seat, then an emergency contact, with configurable timeouts. Capture escalation tiers in the patient profile during onboarding.
- **Expected impact:** Turns a single-point-of-failure alert into a resilient response chain — the difference between a toy and a real safety product, and a prerequisite for clinical/insurance positioning.
- **Evidence:** src/server-routes/helpAlerts.ts:58-133; src/server-jobs/dailySummary.ts:82-93; no escalation job in src/server-jobs/.

### [SAFE-11] Risk matrix exposes uniformly high residual risk — mitigations absent, not weak
**Severity:** Critical · **Effort:** Large

- **Issue:** Across the alerting stack, safety-critical paths are mitigation-absent, not merely weak — a systemic pattern.
- **Description:** Consolidated matrix (risk | residual): Help/SOS not delivered when backgrounded — DB row + foreground polling only, no push (helpAlerts.ts:42) | CRITICAL. Caregiver doesn't acknowledge — no escalation (helpAlerts.ts:58-133) | CRITICAL. Fall — cadence only, no detection (gait.ts) | HIGH. Missed medication — patient nudge once/day, no caregiver alert (fireReminders.ts:62) | HIGH. Wandering — phone-dependent geofence, 1hr rate limit, write-before-push (patientTokens.ts:44-69) | HIGH. Device/battery depletion — none | HIGH. Network outage during emergency — client retries, no durable queue (useHelpAlert.ts:56) | HIGH. Backend asleep during reminder — window passes (scheduler.ts:14) | HIGH. Single-caregiver SPOF — one token per patient (streamSessions.ts:147) | HIGH. False positive/negative — none (device.ts:114) | MEDIUM.
- **Why it matters:** Every row that should be the product's strongest engineering is currently absent. There is no safety-critical engineering discipline (no escalation, no delivery confirmation, no watchdogs, no durable queues) anywhere in the stack.
- **Impact:** Patient: multiple independent paths to an unhandled emergency. Caregiver: false confidence across the board. Business: the safety claims that justify the price and clinical/pharma positioning are not backed by the code — the central due-diligence red flag.
- **Recommendation:** Treat safety alerting as a dedicated workstream with explicit SLAs: guaranteed push+SMS with server-confirmed receipt, acknowledgement-driven escalation, durable offline queues, always-on scheduling, device/battery watchdogs. Test end-to-end (phone-locked, offline, backend-asleep) before any safety marketing claim.
- **Expected impact:** Converts the highest-liability dimension from systemically unmitigated to defensible; prerequisite for clinical, insurer, or pharma partnerships and honest safety marketing.
- **Evidence:** Synthesis of helpAlerts.ts:42-133; gait.ts; fireReminders.ts:62; patientTokens.ts:44-69; scheduler.ts:14; useHelpAlert.ts:56; streamSessions.ts:147; device.ts:114.

### [SAFE-3] Single caregiver push token per patient — multi-caregiver escalation structurally impossible
**Severity:** High · **Effort:** Medium

- **Issue:** Push tokens are stored one-per-patient with last-write-wins, so only one caregiver device can ever be notified.
- **Description:** Caregiver push lives in the `pushTokens` collection keyed by `patientId` via `updateOne({patientId},{$set:{...expoPushToken...}})` (streamSessions.ts:147-150). Every consumer does `findOne({patientId})` and pushes to that single token (device.ts:136, patientTokens.ts:58). When a second caregiver registers, their token overwrites the first (`caregiverId` is stored in the doc but is not part of the match key), so which caregiver is notified is non-deterministic last-write-wins.
- **Why it matters:** The pivot is explicitly caregiver-first with care teams and sibling invites. A care team where only one randomly-chosen member receives alerts defeats the purpose and creates a silent single point of failure exactly where redundancy is the point.
- **Impact:** Patient: alert may go to the least-available caregiver. Caregiver: siblings think they are covered but receive nothing. Business: the advertised "care team" does not actually distribute alerts.
- **Recommendation:** Make `pushTokens` one document per (patientId, caregiverId/deviceId) and fan out pushes to all active tokens. De-dup and prune `DeviceNotRegistered` tokens (logic already at streamSessions.ts:194-196).
- **Expected impact:** Makes every alert reach the whole care team, enabling real redundancy and the SAFE-2 escalation chain.
- **Evidence:** src/server-routes/streamSessions.ts:147-150; src/server-routes/device.ts:136; src/server-routes/patientTokens.ts:58.

### [SAFE-4] No fall detection despite being a dementia product with accelerometer access
**Severity:** High · **Effort:** Large

- **Issue:** The accelerometer pipeline computes walking cadence only — there is no fall/impact detection anywhere.
- **Description:** `gait.ts` captures accelerometer magnitudes and computes cadence via peak detection (computeCadence, captureGaitWindow, gait.ts:1-35). A grep across `src/lib`, `src/server-routes`, and `src/server-jobs` finds no fall/impact/high-g logic. "Fell" exists only as a manual post-hoc resolution cause (helpAlerts.ts:87).
- **Why it matters:** Falls are a leading cause of injury and death in elderly dementia patients, and a fallen, confused patient frequently cannot reach the Help button. Automatic fall detection is the headline feature of competing medical-alert devices and a baseline category expectation.
- **Impact:** Patient: falls go undetected when the patient cannot self-summon help. Business: a glaring gap versus Apple Watch / Life Alert; weakens any safety claim.
- **Recommendation:** Add fall detection on the existing accelerometer pipeline (high-magnitude impact followed by stillness), gate behind general-wellness language, and on detection trigger the help/escalation flow (SAFE-1/SAFE-2) with a patient cancel window. Never frame as medical/diagnostic.
- **Expected impact:** Closes the most conspicuous safety-feature gap versus competitors and protects patients exactly when the manual button fails.
- **Evidence:** src/lib/biomarkers/gait.ts:1-35; src/server-routes/helpAlerts.ts:87.

### [SAFE-5] Reminders run on in-process node-cron on a Render free tier that sleeps — time-critical reminders silently skipped
**Severity:** High · **Effort:** Medium

- **Issue:** Scheduled jobs use in-process cron with a hard 5-minute due-window, so reminders are permanently missed whenever the backend is asleep.
- **Description:** All scheduled jobs are `node-cron` inside the Express process (scheduler.ts:7-24, started at server.ts:179). `fireReminders` runs every 5 min with a 5-minute due-window (`isReminderDueNow`, fireReminders.ts:18-27) and sets `notified_date` once fired (fireReminders.ts:62,76-79). Render free tier spins down after ~15 min idle (CLAUDE.md). While asleep no cron ticks fire; if the server is asleep during a reminder's 5-min window the reminder is permanently missed — never retried, no catch-up/backfill on wake.
- **Why it matters:** Medication-adherence reminders are a primary clinical value and revenue pitch. A reminder engine that drops doses whenever the free-tier backend is idle is both a patient-safety risk and a data-integrity problem for the adherence data being licensed.
- **Impact:** Patient: missed medication reminders cause missed doses. Caregiver: believes reminders are firing. Business: corrupts the adherence dataset (a stated revenue stream) and undermines the core SaaS feature.
- **Recommendation:** Move scheduling to an always-on trigger (Render cron, external scheduler hitting an endpoint, or a paid always-on instance). Replace the hard 5-min window with a "last fired" watermark and backfill on wake. Add alerting on missed cron runs.
- **Expected impact:** Guarantees medication and safety reminders actually fire, protecting patients and producing trustworthy adherence data for licensing.
- **Evidence:** src/server-jobs/scheduler.ts:7-24; src/server.ts:179; src/server-jobs/fireReminders.ts:18-27,62,76-79; CLAUDE.md Render free-tier note.

### [SAFE-6] No missed-medication detection or caregiver escalation
**Severity:** High · **Effort:** Medium

- **Issue:** Nothing detects a dose whose time passed without being marked taken, and the caregiver is never notified of a miss.
- **Description:** `medications.ts` only stores/clears a `taken_date` flag (medications.ts:20,63,89-93). No server job scans for medications past their reminder time but unmarked, and no caregiver notification fires on a miss. `fireReminders` nudges only the patient, once per day, then sets `notified_date` and never re-prompts (fireReminders.ts:62-79). A missed reminder simply becomes a missed dose with zero caregiver visibility until the 08:00 digest (which counts help alerts, not missed meds — dailySummary.ts:82-93).
- **Why it matters:** The caregiver-first value prop is "know if Mom took her pills." Without missed-dose detection there is no closed loop. Dementia patients frequently miss or double-dose; silent omission is a real clinical harm.
- **Impact:** Patient: undetected missed doses, no double-dose guard. Caregiver: no adherence visibility — the headline reason they pay $29/mo. Business: weakens SaaS value and adherence-data quality.
- **Recommendation:** Add a job that, a configurable interval after a med's scheduled time, checks `taken_date` and if unmarked pushes the caregiver a "dose not confirmed" alert and re-nudges the patient. Track adherence per dose, not a daily flag. Feed into the escalation engine.
- **Expected impact:** Delivers the closed-loop adherence monitoring the product is sold on and materially improves medication safety.
- **Evidence:** src/server-routes/medications.ts:20,63,89-93; src/server-jobs/fireReminders.ts:62-79; src/server-jobs/dailySummary.ts:82-93.

### [SAFE-7] Geofence/wandering alert depends on patient phone foreground task and rate-limits to once per hour
**Severity:** High · **Effort:** Medium

- **Issue:** Wandering alerts depend on the patient carrying a charged, permissioned phone, are suppressed for a full hour after one alert, and record the suppression timestamp before the push is confirmed.
- **Description:** Detection relies on Expo region monitoring registered on the patient phone (locationWatcher.ts:10-23, 43-52), firing only on Exit. The server then pushes the caregiver (patientTokens.ts:38-94). Two problems: (1) it depends entirely on the patient phone carrying background-location permission with no fallback if the phone is left home or permission denied; (2) zone-exit is hard rate-limited to once per hour (patientTokens.ts:44-51) and `lastZoneAlert` is written BEFORE the push (patientTokens.ts:64-69), so a return-and-re-exit within the hour — or a failed first push — yields no further alert for up to an hour.
- **Why it matters:** Wandering is one of the highest-acuity dementia risks. A one-hour suppression window plus write-before-confirm can silence the exact alerts that matter during an active episode.
- **Impact:** Patient: active wandering under-alerted; a failed first push suppresses the next hour. Caregiver: false confidence in geofencing. Business: "wandering protection" is materially weaker than implied.
- **Recommendation:** Reduce the suppression window (5-10 min), set `lastZoneAlert` only AFTER a confirmed successful push, add re-entry/re-exit handling, consider a server-side geofence backstop from periodic pings, and tell caregivers geofencing requires the patient phone carried/charged/permissioned.
- **Expected impact:** Makes wandering alerts timely and resilient to transient push failures, improving the highest-acuity scenario.
- **Evidence:** src/services/locationWatcher.ts:10-23,43-52; src/server-routes/patientTokens.ts:44-69.

### [SAFE-8] No device/glasses disconnect or battery-depletion monitoring
**Severity:** High · **Effort:** Medium

- **Issue:** No heartbeat, freshness watchdog, battery telemetry, or disconnect alert — monitoring can silently go dark.
- **Description:** Grep across `src/server-routes` and `src/server-jobs` finds no battery/heartbeat/disconnect logic; only `people.ts` `last_seen` on faces (people.ts:47,186), a `stream.ts` last_seen freshness read (stream.ts:23-27), and a stale-token prune (streamSessions.ts:195). If the glasses die, lose network, or the patient phone depletes, all dependent safety features (geofencing, glasses /alert, biomarkers) stop and no one is told.
- **Why it matters:** A safety system that can silently go dark is dangerous precisely because users assume coverage. Battery depletion and disconnects are the most common real-world failure for elderly users who forget to charge devices.
- **Impact:** Patient: protection silently lapses. Caregiver: no warning monitoring stopped. Business: "always watching" promise quietly broken; correlates with churn when gaps are discovered.
- **Recommendation:** Add device heartbeats with a server-side freshness watchdog: if no heartbeat/location/battery ping for N minutes, push the caregiver a "monitoring offline / low battery" alert. Show device + battery status on the caregiver dashboard. Treat low battery as a first-class warning.
- **Expected impact:** Eliminates silent-failure blind spots; converts unknown coverage gaps into actionable warnings.
- **Evidence:** No battery/heartbeat/disconnect matches in src/server-routes or src/server-jobs; only src/server-routes/stream.ts:23-27 and streamSessions.ts:195.

### [SAFE-9] Help-send retries client-side only — offline patient SOS has no durable queue
**Severity:** High · **Effort:** Medium

- **Issue:** A patient SOS sent offline relies on in-session retries with no persistent queue or auto-resend on reconnect, and POST has no offline fallback.
- **Description:** On Help, `sendHelp` retries the POST at most 3 times with 1.5s/3s backoff (useHelpAlert.ts:48-73). `createHelpAlert` is a plain POST (client.ts:333-335); the write path uses the 35s `COLD_START_TIMEOUT_MS` (client.ts:123-130), so cold-start is tolerated per attempt — but if the phone is fully offline, all retries fail and the patient is shown an error with NO persistent queue and no auto-resend on reconnect. Unlike GET, POST has no cached fallback (client.ts:133-150). The cognitively-impaired patient is then expected to notice the error banner and re-press. (Note: the draft's "8s fast timeout / exhaust within seconds" claim was corrected — POST uses the 35s timeout — but the durable-queue gap stands.)
- **Why it matters:** Emergencies and network outages co-occur (a wandering patient may be out of coverage). The moment the SOS most needs durability is when this design gives up, and a confused patient will not understand the error.
- **Impact:** Patient: SOS lost during the conditions it is most needed; relies on the impaired user to retry. Caregiver: never learns the patient tried. Business: amplifies the SAFE-1 liability.
- **Recommendation:** Persist help intents to a local durable queue and flush on reconnect (mirror the eventBatcher offline pattern). Retry with longer backoff for minutes, confirm to the patient only on server-acknowledged delivery, and consider a native SMS-to-caregiver fallback when the backend is unreachable.
- **Expected impact:** Makes the SOS survive offline/cold-start conditions and removes the retry burden from a cognitively-impaired user.
- **Evidence:** src/hooks/useHelpAlert.ts:48-73; src/api/client.ts:123-150,333-335.

### [SAFE-10] No false-positive / false-negative governance on alerts
**Severity:** Medium · **Effort:** Medium

- **Issue:** The glasses /alert endpoint pushes the caregiver immediately with no debounce, de-dup, or confidence gating, inviting alert fatigue.
- **Description:** `POST /api/device/alert` (device.ts:114-158) accepts any type/message with priority 1-4 from the hardware and immediately pushes the caregiver — no debounce, de-duplication, confidence threshold, or suppression. Face-recognition "unknown_face" alerts (alerts.ts:9-32) likewise have no confidence gating or escalation suppression. There is no mechanism to distinguish a real emergency from a noisy sensor, and no acknowledgement-deadline tying false negatives to escalation.
- **Why it matters:** Alert fatigue is the documented killer of medical-alert systems: too many false positives train caregivers to ignore notifications, which causes them to miss the real one. For a vulnerable population this directly translates to missed emergencies.
- **Impact:** Caregiver: desensitization from noisy alerts, leading to ignored real alerts. Patient: real emergency dismissed as "probably another false alarm." Business: high alert volume drives uninstalls.
- **Recommendation:** Add server-side de-dup/debounce and confidence thresholds for sensor/face alerts, tier them visually, let caregivers tune sensitivity, and track per-patient false-positive rates. Reserve high-priority push + sound strictly for help/fall/wandering.
- **Expected impact:** Reduces alert fatigue, preserving caregiver responsiveness for true emergencies and lowering churn.
- **Evidence:** src/server-routes/device.ts:114-158; src/server-routes/alerts.ts:9-32.


---

## AI Product Review

The AI surface of this app is the single most dangerous part of the product as built. A temperature-0.7 LLM with `tool_choice:"auto"` writes medications, tasks, and reminders directly into a dementia patient's care record with no confirmation, no provenance, no human-in-the-loop, and no undo — and the same write-capable assistant is mounted on the patient side, handing the most cognitively-impaired user the most powerful write capability. Every claim below was verified against the actual code in `assistant.ts`, `VisionSheet.tsx`, `RootNavigator.tsx`, the patterns pipeline, the report/PDF generators, and the biomarker library; none were refuted. The one adjustment is AI-9: the assistant does carry a visible "AI Assistant" label in its header and consent screen, so the real gap is in-use action transparency, not identity disclosure.

### [AI-1] LLM writes medications to the database with no human confirmation
**Severity:** Critical · **Effort:** Medium

- **Issue:** The `create_medication` tool inserts straight into the medications collection the moment the model calls it.
- **Description:** In `assistant.ts` the tool runs at temperature 0.7 with `tool_choice:"auto"`; on a tool call it does `db.collection("medications").insertOne(...)` with no confirmation, review, or approval. The client just fires `triggerMedReload()` and the med appears in the patient's schedule.
- **Why it matters:** Medication management for a dementia patient is a life-safety function. A hallucinated, misheard, or over-eagerly interpreted utterance ("I think I should take more vitamin D") becomes a persisted med with no second human in the loop before the write commits.
- **Impact:** Patient (invented/wrong meds in their schedule, adherence confusion), caregiver (false trust the list is authoritative), business (catastrophic liability and App Store medical-claim exposure).
- **Recommendation:** Make all write tools propose-not-commit — the LLM returns a structured suggestion rendered as a confirmation card ("Add Donepezil 10mg at 8AM? Confirm / Edit / Cancel") requiring an explicit human tap before `insertOne`. For medications, route confirmation to the `primary_caregiver` seat; never auto-commit from a patient utterance.
- **Expected impact:** Eliminates the single highest-liability AI failure mode; converts a silent-write system into an auditable human-in-the-loop one.
- **Evidence:** `src/server-routes/assistant.ts:122-138,196-211`; `src/components/VisionSheet.tsx:144-147`

### [AI-2] Hallucinated medication dosage/time silently defaulted instead of refused
**Severity:** Critical · **Effort:** Small

- **Issue:** Missing safety-critical fields are filled with fabricated defaults rather than a clarifying question.
- **Description:** `create_medication` defaults dosage to `"as prescribed"` and time to `"9:00 AM"` (assistant.ts:201-203), and the tool description instructs the model to default rather than ask (lines 131-132). `create_task` defaults time to `"9:00 AM"` (line 186). So a med with no real dosage gets a confident-looking but invented schedule.
- **Why it matters:** Defaulting safety-critical fields produces output that looks authoritative ("Donepezil — as prescribed — 9:00 AM") but encodes a guess. A caregiver scanning the list cannot distinguish a real prescribed dose from a system-invented placeholder.
- **Impact:** Patient (takes med at fabricated time), caregiver (cannot trust schedule accuracy), business (clinical-claim risk).
- **Recommendation:** Never default safety-critical fields. If dosage or time is missing, return a clarifying question to the user instead of inventing a value. Flag any inferred field as "needs confirmation" in the UI.
- **Expected impact:** Removes fabricated dosages/times from the med list; forces explicit human input for safety fields.
- **Evidence:** `src/server-routes/assistant.ts:116,130-132,184-205`

### [AI-6] Write-capable AI assistant exposed directly to the cognitively-impaired patient
**Severity:** Critical · **Effort:** Medium

- **Issue:** The same VisionSheet that can create meds/tasks/reminders is mounted on the patient side with no caregiver gate.
- **Description:** `VisionSheet` is rendered on both the patient and caregiver branches of `RootNavigator.tsx` (lines 316 and 614). The patient can trigger med/task writes by typing or via suggestion chips, hitting the same `create_medication` tool path.
- **Why it matters:** A dementia patient may repeat, confabulate, or misstate. Letting their utterances auto-write to their own care record (especially meds) with no caregiver in the loop inverts the safety model: the most-impaired user has the most-powerful write capability.
- **Impact:** Patient (self-induced erroneous care data), caregiver (record corrupted by patient confusion without their knowledge).
- **Recommendation:** Disable write tools (`create_medication` especially) on the patient-side assistant, or require caregiver approval for any patient-initiated write. Keep the patient assistant read/comfort-only; reserve writes for the caregiver seat.
- **Expected impact:** Removes the inverted-trust failure mode; aligns write authority with the user best able to validate it.
- **Evidence:** `src/navigation/RootNavigator.tsx:316,614`; `src/components/VisionSheet.tsx:37-41,144-147`; `src/server-routes/assistant.ts:88-138`

### [AI-3] AI-created items are indistinguishable from human-entered items
**Severity:** High · **Effort:** Medium

- **Issue:** Tasks and medications written by the AI carry no provenance field at all.
- **Description:** Reminders get `source:"app"` (assistant.ts:171) but the `routines` and `medications` inserts have no source/createdBy field (lines 184-189, 199-205). No patient or caregiver screen surfaces "created by Vision AI"; a UI grep for `createdBy`/`aiGenerated`/AI-source labels returned zero matches.
- **Why it matters:** Trust and auditability require knowing what the AI did. A caregiver reviewing the med/routine list cannot tell which entries a human clinician typed and which an LLM generated from a patient's possibly-confused statement.
- **Impact:** Caregiver (cannot audit or trust AI actions, cannot spot AI errors), business (no audit trail for incident review).
- **Recommendation:** Stamp every AI write with `createdBy:"vision_ai"`, the source utterance, model id, and timestamp. Render an "AI-suggested" badge on those rows and a caregiver activity feed of all AI writes.
- **Expected impact:** Creates the audit trail required for clinical trust and incident review; lets caregivers spot and correct AI errors.
- **Evidence:** `src/server-routes/assistant.ts:166-211` (reminders have `source:"app"`, tasks/meds none); UI grep for AI-source labels returned no matches

### [AI-4] Inferred patterns presented as fact — confidence and evidence count computed then hidden
**Severity:** High · **Effort:** Small

- **Issue:** Confidence and evidence count are computed and stored but never shown.
- **Description:** `inferPatterns.ts` asks Gemini for patterns with `confidence` (0-1) and `evidenceCount`, and `patternSchema` (patterns.ts:7-15) validates and stores them. But `PatternsCard.tsx` renders only `title` + `description` under the heading "Patterns we've noticed" (lines 23,27-28). Neither field is displayed; a grep for `confidence` across `.tsx` returns zero hits.
- **Why it matters:** An LLM-inferred behavioral pattern over 30 days of sparse events is a hypothesis, not a finding. Stripping confidence and evidence count and titling it "Patterns we've noticed" presents a 0.4-confidence guess identically to a 0.95 one, manufacturing false certainty for a caregiver making care decisions.
- **Impact:** Caregiver (acts on low-confidence guesses as validated), patient (care changes from spurious correlations), business (medical-decision-influence liability).
- **Recommendation:** Display confidence as a band ("Possible pattern" vs "Strong pattern") and show "seen N times" (evidenceCount). Add a "Was this helpful? Yes/No" feedback control. Reframe copy to "Possible patterns — please verify."
- **Expected impact:** Turns over-confident fact-display into calibrated, dismissable hypotheses; adds the only pattern feedback loop in the app.
- **Evidence:** `src/server-jobs/inferPatterns.ts:30-44`; `src/server-routes/patterns.ts:7-15`; `src/components/PatternsCard.tsx:20-28`

### [AI-5] Only guardrail against medical advice is one unenforced system-prompt line
**Severity:** High · **Effort:** Medium

- **Issue:** The sole defense against medical advice is a single prompt instruction, and the same line tells the model to hide that it is AI.
- **Description:** `assistant.ts:69` contains "Never give medical advice. Never mention that you are AI." There is no output classifier, post-generation filter, blocklist, or logging of flagged outputs. The "never mention you are AI" instruction also directly contradicts the UI's own "AI Assistant" label (VisionSheet.tsx:428), undermining transparency.
- **Why it matters:** Prompt-level instructions are routinely bypassed by phrasing, and a temperature-0.7 model talking to a dementia patient about meds/symptoms is exactly where it drifts into advice. Telling the model to deny being AI prevents the user from calibrating trust.
- **Impact:** Patient (may receive and act on unfiltered medical advice from a system told to deny it is AI), business (regulatory/medical-claim exposure, already flagged in App Store review notes).
- **Recommendation:** Add a post-generation safety classifier that blocks/redirects medical-advice outputs to "Please ask your doctor," log every block, and red-team the prompt. Remove "Never mention that you are AI" — disclose AI identity for trust and likely legal-disclosure reasons.
- **Expected impact:** Replaces an unenforced instruction with an actual guardrail; restores user-facing AI transparency.
- **Evidence:** `src/server-routes/assistant.ts:66-69`; `src/components/VisionSheet.tsx:428`

### [AI-8] Doctor-facing PDF embeds an ungrounded AI narrative labeled "professional clinical summary"
**Severity:** High · **Effort:** Small

- **Issue:** Unverified Gemini text is dropped into a clinician PDF with no AI-generated/unverified disclaimer.
- **Description:** `reports.ts:73` prompts Gemini to "Write a professional clinical summary paragraph" from caregiver check-in notes, and the raw output is placed in the PDF under "Summary" (reportPdf.ts:116-117) with no caveat. The patterns section (reportPdf.ts:119-130) likewise lists AI patterns with no uncertainty note. Only the biomarker section carries a "not diagnostic" disclaimer (reportPdf.ts:134-136).
- **Why it matters:** A PDF handed to a real clinician carries implied authority. Calling an unverified LLM narrative a "clinical summary" invites a doctor to treat hallucinated or mis-weighted content as a vetted record.
- **Impact:** Patient (clinician decides partly on AI hallucination), caregiver (presents AI text as their own observation), business (significant medical-document liability).
- **Recommendation:** Prefix the summary with "AI-generated from caregiver notes — please verify against the source logs (appendix)." Drop "clinical" from the prompt. Add the same uncertainty caveat to the patterns section that already exists for biomarkers.
- **Expected impact:** Removes implied clinical authority from unverified AI text in doctor-facing documents; reduces document liability.
- **Evidence:** `src/server-routes/reports.ts:66-85`; `src/server-core/reportPdf.ts:115-130,134-136`

### [AI-10] AI failure/unavailability degrades to a dead-end with no fallback
**Severity:** High · **Effort:** Medium

- **Issue:** Chat failure is a dead-end, and a failed tool write is invisible to the user who may believe the action succeeded.
- **Description:** If Groq is down or times out, `VisionSheet.tsx:159-165` shows "Sorry, I couldn't connect right now. Please try again." with no retry, offline path, or alternative. On the backend a tool insert failure returns a soft "Sorry, I couldn't save that" to the model (assistant.ts:177-179,193-194,208-209), but the failure is invisible to the user, and the second completion can still reply "Done!" Render free-tier cold starts (~30s) make timeouts common.
- **Why it matters:** For a memory-impaired user relying on the assistant for meds/reminders, a silent or dead-end failure is a safety issue — the user believes an action succeeded when it did not. A partial tool failure the LLM glosses over is especially dangerous.
- **Impact:** Patient (believes a med/reminder was set when it failed), caregiver (gap in care record with no error surfaced), business (reliability perception, churn).
- **Recommendation:** Surface tool-write failures explicitly to the user ("I couldn't save that medication — please try again or add it manually"). Verify the write succeeded before the model claims success. Add retry/backoff for the chat call and a clear offline state.
- **Expected impact:** Prevents false-success on failed safety-critical writes; turns dead-ends into recoverable states.
- **Evidence:** `src/components/VisionSheet.tsx:159-168`; `src/server-routes/assistant.ts:177-179,234`

### [AI-7] No way to correct, undo, or flag a wrong AI write
**Severity:** Medium · **Effort:** Medium

- **Issue:** After the assistant inserts a med/task/reminder there is no AI-specific correction, undo, or feedback path.
- **Description:** The insert paths in `assistant.ts:158-239` write with no audit record and no undo token; `VisionSheet.tsx:131-169` has no correction control. The only recourse is the generic delete in the routine/med screens, which doesn't tie back to the AI action or feed any signal.
- **Why it matters:** Trustworthy AI requires a cheap correction loop. Without one, errors silently accumulate in the care record, the system never improves, and caregivers have no first-class way to report a hallucination.
- **Impact:** Caregiver (laborious manual cleanup with no AI context), business (no error telemetry to measure or reduce hallucination rate).
- **Recommendation:** Add an undo on every AI write (toast: "Vision added Donepezil — Undo") and a "Report this" control that logs the utterance, model output, and correction for monitoring and eval improvement.
- **Expected impact:** Establishes the missing feedback loop; produces the hallucination-rate telemetry needed to improve the model.
- **Evidence:** `src/server-routes/assistant.ts:158-239` (no audit/undo); `src/components/VisionSheet.tsx:131-169` (no correction path)

### [AI-9] Patient has no visibility into what the AI is doing or what it knows about them
**Severity:** Medium · **Effort:** Medium

- **Issue:** No in-use action receipts, and no signal that the full care record is injected into every prompt.
- **Description:** The consent screen (VisionSheet.tsx:436-497) is a one-time gate; during use there is no live indication that the patient's full routine, meds, reminders, and 20-turn history are injected into every prompt (assistant.ts:35-86), nor any signal when the AI takes an action (writing a med) versus chatting. Conversations auto-prune to 20 turns, silently dropping context. (Note: a static "AI Assistant" label does exist in the header, line 428 — so identity is disclosed; the gap is action transparency.)
- **Why it matters:** Transparency is a dignity and trust requirement. A patient given no signal that the assistant just modified their medication list cannot meaningfully understand or control the system acting on their care.
- **Impact:** Patient (no agency or understanding of an AI shaping daily care), business (consent/transparency gaps for a vulnerable population).
- **Recommendation:** Show an in-chat action receipt when the AI writes something ("I added a reminder for your walk at 6PM") and give the patient/caregiver a view of what context the AI is using.
- **Expected impact:** Improves patient agency and informed use; closes a transparency gap for a vulnerable cohort.
- **Evidence:** `src/components/VisionSheet.tsx:436-497,428`; `src/server-routes/assistant.ts:35-86`

### [AI-11] Biomarkers fed to caregivers/PDFs come from crude unvalidated heuristics presented as trends
**Severity:** Medium · **Effort:** Medium

- **Issue:** Noisy single-sensor heuristics are rendered as directional trends with arrows and sparklines.
- **Description:** Gait cadence is naive peak detection on phone accelerometer magnitudes with a fixed 0.3g threshold (gait.ts:6-19); typing "cadence" is mean keystroke interval (typing.ts:7-15). The PDF labels these "Wellness Trends" with up/down arrows from a +/-5% threshold (reports.ts:126-129) plus a sparkline (reportPdf.ts:142-152). The "not diagnostic" disclaimer (reportPdf.ts:134-136) is present, but confidence/sample-quality is never shown.
- **Why it matters:** Even labeled "wellness," a trend arrow and sparkline communicate meaningful change. A caregiver seeing "Gait Cadence ↓" may alarm or, worse, dismiss a real decline, based on sensor noise from a phone in a pocket.
- **Impact:** Caregiver (false alarms or false reassurance from noisy heuristics), patient (unwarranted care escalation/de-escalation), business (wellness-vs-medical claim line is legally sensitive per project notes).
- **Recommendation:** Suppress trend arrows below a noise-aware significance threshold and require a minimum sample count/quality. Show data-sufficiency ("based on 4 short windows — low confidence"). Make the uncertainty visible in the trend itself, not just a footnote.
- **Expected impact:** Reduces false signals from noisy biomarkers; strengthens the wellness-not-diagnostic posture already legally flagged.
- **Evidence:** `src/lib/biomarkers/gait.ts:6-19`; `src/lib/biomarkers/typing.ts:7-15`; `src/server-routes/reports.ts:126-141`; `src/server-core/reportPdf.ts:132-153`


---

## Notification & Alert Audit

The notification layer is the most safety-critical and least coherent subsystem in the product, and verification against the code confirms the draft findings rather than refuting them. The single life-safety feature — the patient Help/SOS button — sends no push at all (it relies entirely on the caregiver having the app foregrounded and polling), while low-value events like the morning digest and live-view invites do push; a full geofencing/wandering pipeline exists but is dead code because `startLocationWatcher()` is never called; and reminder times are compared in UTC with no timezone handling, so a "9:00 AM" reminder fires at the wrong local hour. There is no central sender, no priority/channel framework, no escalation, no foreground handler, and no user-facing notification controls or quiet hours. All 12 findings were verified against the source and none were refuted.

### [NOTIF-1] Patient Help button sends NO push to caregiver — depends entirely on app being open and polling
**Severity:** Critical · **Effort:** Medium

- **Issue:** The flagship SOS feature never fires a push; it only surfaces if the caregiver's app is open and polling.
- **Description:** `POST /api/help-alerts` (helpAlerts.ts:42-56) inserts a `help_alerts` doc and returns — zero push code. The caregiver learns of it only via `useHelpAlert.ts` polling (4s active / 15s idle, lines 43-46) and the urgent overlay in RootNavigator, which fires only on an in-app `pendingCount` increase while foregrounded. Locked phone, backgrounded app, or suspended JS timer = the request is never surfaced. Meanwhile working push paths exist for device alerts (device.ts:134-150) and livestream invites (streamSessions.ts:172-202).
- **Why it matters:** This is the single life-safety feature for a cognitively-impaired user who may have fallen, be in pain, or be wandering. An alert visible only when the caregiver is staring at the open app is effectively no alert system.
- **Impact:** PATIENT: a genuine emergency goes unanswered because the phone was locked. CAREGIVER: false sense of security; total trust loss on first miss. BUSINESS: one "my mother pressed help and no one came" incident is existential reputational and liability risk for a $29/mo safety product.
- **Recommendation:** On `help_alerts` insert, immediately send an Expo push to all caregiver `pushTokens` for the patient — title "Help Requested", sound "default", priority "high", iOS critical/time-sensitive interruption level, `data.type: "help_request"`. Add a tap handler that opens the urgent overlay. Keep the in-app overlay as a secondary surface, not the primary.
- **Expected impact:** Converts the flagship safety feature from "works only if app is open" to "reaches the caregiver anywhere," closing the single largest safety/liability gap in the product.
- **Evidence:** src/server-routes/helpAlerts.ts:42-56 (no push); src/hooks/useHelpAlert.ts:43-46 (polling only); src/navigation/RootNavigator.tsx:375-419 (overlay fires from in-app count delta); contrast src/server-routes/device.ts:134-150 and src/server-routes/streamSessions.ts:172-202.

### [NOTIF-3] Wandering / zone-exit push is fully built but never wired up (dead code)
**Severity:** Critical · **Effort:** Small

- **Issue:** A complete geofencing/wandering-alert pipeline exists but is never started at runtime.
- **Description:** Server zone-exit push exists (patientTokens.ts:38-94, hourly rate-limit, "has left their safe zone" copy) and a client geofence task POSTs on Exit events (locationWatcher.ts). But `startLocationWatcher()` — the only function that requests location permission and calls `Location.startGeofencingAsync` — is never called. Verified: `grep -rn "startLocationWatcher" src/` returns only its own definition at src/services/locationWatcher.ts:25. Geofencing never starts, the OS never fires Exit events, the zone-exit push never sends.
- **Why it matters:** Wandering is a leading cause of injury and death in dementia. Shipping code that appears to provide wandering alerts but does nothing is worse than absence — a caregiver who configured a geofence believes they are protected when they are not.
- **Impact:** PATIENT: wanders unnoticed; severe injury/death risk. CAREGIVER: false protection. BUSINESS: dangerous gap between apparent and actual capability; liability.
- **Recommendation:** Call `startLocationWatcher()` from patient-app startup once a geofence is configured, and re-invoke on geofence change. Add a settings surface showing geofencing status. Verify background Exit events on a physical device. Until wired, do not market or imply wandering protection.
- **Expected impact:** Activates an entire inert safety feature; turns wandering protection from a phantom into a real P0 alert.
- **Evidence:** src/services/locationWatcher.ts:25 (defined); `grep -rn "startLocationWatcher" src/` → only the definition, no callers; server path at src/server-routes/patientTokens.ts:38-94.

### [NOTIF-2] Inverted priority hierarchy: low-value alerts get push, the life-safety alert does not
**Severity:** High · **Effort:** Medium

- **Issue:** Informational pushes interrupt the caregiver while the actual emergency does not.
- **Description:** Push is wired for livestream invites (streamSessions.ts:176, MAX-importance channel), the 8am morning summary (dailySummary.ts:98-103), patient reminders (fireReminders.ts:70), and zone-exit (patientTokens.ts:72-82). The one thing that does not push is the patient Help/SOS (NOTIF-1). Each sender hand-rolls its own title/sound/priority with inconsistent values (some `priority:"high"`, some none, sound only at priority≥4 in device.ts). There is no unified tier/channel scheme.
- **Why it matters:** A notification system's credibility depends on importance mapping to interruptiveness. When informational pushes are louder than emergencies, caregivers either ignore everything (fatigue) or panic at trivia.
- **Impact:** CAREGIVER: alert fatigue and mistrust; cannot distinguish "mom fell" from "here is her step count." BUSINESS: undermines the core caregiver-burden-reduction value prop.
- **Recommendation:** Adopt a P0-P3 framework: P0 life-safety (help, fall, zone-exit) — critical/time-sensitive, repeat+escalate, bypass DND; P1 health-urgent (missed critical med, glasses offline, low battery) — high-priority push; P2 actionable (livestream invite) — normal push; P3 informational (daily summary, routine face-seen) — in-app/digest only. Centralize all sends through one server module that stamps tier+channel+sound+priority from a single table.
- **Expected impact:** Restores notification credibility; cuts interrupt volume on noise while guaranteeing emergencies break through; directly reduces alert-fatigue churn.
- **Evidence:** src/server-jobs/dailySummary.ts:98-103; src/server-jobs/fireReminders.ts:70; src/server-routes/streamSessions.ts:176-186; src/server-routes/patientTokens.ts:72-82; src/server-routes/device.ts:134-150; absence in src/server-routes/helpAlerts.ts:42-56.

### [NOTIF-4] No escalation or repeat for an unacknowledged help request
**Severity:** High · **Effort:** Large

- **Issue:** Once a help alert is created, nothing chases it — no repeat, no escalation, no fallback.
- **Description:** No server timer re-pushes, escalates to a second seat, or falls back to SMS/voice if the primary caregiver does not respond. The urgent overlay only re-shows when `pendingCount` increases (RootNavigator.tsx:375-386); the "Responding Now" handler is `setUrgentVisible(false)` (RootNavigator.tsx, `handleRespondingNow`) — it hides the overlay locally and records no server-side acknowledgment and notifies the patient of nothing. (Note: the glasses alert ack in GlassesAlertFeedScreen.tsx:251 is separate, client-only state and does not apply to help alerts.) If the only caregiver is asleep or driving, the request dies silently. scheduler.ts (lines 1-24) has no escalation cron.
- **Why it matters:** Emergencies require guaranteed delivery and escalation. A single unread push is not acceptable for life-safety, and the product explicitly supports multi-seat households that should fan out and escalate.
- **Impact:** PATIENT: emergency unanswered when the primary caregiver is unavailable. CAREGIVER: no backup despite paying for a multi-seat family plan. BUSINESS: the family-plan value prop fails in the one scenario that matters.
- **Recommendation:** Add a server job: unresolved after ~3 min re-push primary; after ~6 min push all other seats; after ~10 min trigger SMS/voice fallback (Twilio). Record `acknowledged_by/at` when a caregiver taps "Responding Now" and push that acknowledgment to the patient.
- **Expected impact:** Guarantees an emergency reaches someone; converts the multi-seat plan into a genuine 24/7 safety net and a defensible premium feature.
- **Evidence:** src/server-routes/helpAlerts.ts (no escalation logic); src/navigation/RootNavigator.tsx (`handleRespondingNow` only sets `setUrgentVisible(false)`); src/server-jobs/scheduler.ts:1-24 (no escalation cron).

### [NOTIF-5] No missed-medication alert to the caregiver
**Severity:** High · **Effort:** Medium

- **Issue:** Reminders fire to the patient but no caregiver alert is raised when a med is never marked taken.
- **Description:** fireReminders.ts pushes a med/task reminder to the PATIENT at the scheduled time (lines 47-84) using `patientPushTokens`. There is no follow-up: if the patient never marks the med taken, no caregiver alert fires. The 8am summary (dailySummary.ts) reports `medsDoneCount/medsTotalCount` retrospectively for the prior day — there is no near-real-time "Mom hasn't taken her 9am pill." Adherence data licensing is one of three stated revenue pillars, yet there is no adherence alerting loop.
- **Why it matters:** Missed medications are a primary clinical risk and a primary reason caregivers worry. A next-morning retrospective summary is far too late to intervene.
- **Impact:** PATIENT: missed critical meds go uncorrected for up to a day. CAREGIVER: no actionable adherence alerting — the headline reason to pay. BUSINESS: adherence-data product undermined; weak differentiation vs a free reminder app.
- **Recommendation:** Add a cron that, X minutes after a med reminder fires, checks `taken_date` and, if unmarked, pushes the caregiver a P1 "Reminder: [Patient] may have missed [med] at [time]." Make the window per-medication configurable. Reuse the centralized sender from NOTIF-2.
- **Expected impact:** Turns reminders into a closed adherence loop; gives caregivers the daily intervention moment that justifies the subscription and strengthens the adherence-data stream.
- **Evidence:** src/server-jobs/fireReminders.ts:47-84 (patient-only, no follow-up); src/server-jobs/dailySummary.ts:79-103 (retrospective only); src/server-jobs/scheduler.ts:13-15.

### [NOTIF-6] No glasses-offline / low-battery alert despite glasses being the safety sensor
**Severity:** High · **Effort:** Medium

- **Issue:** When the glasses go offline or die, there is silence — indistinguishable from "everything is fine."
- **Description:** Verified `grep -rn "battery" src/` returns only a code comment in useDashboardData.ts:6. No notification fires when the glasses go offline, lose connectivity, or run low on battery. The SSE stream and dashboard polling silently show stale data. The device-alert endpoint (device.ts:97) is push-from-glasses, so when the glasses are off there is simply no signal.
- **Why it matters:** All passive safety (face recognition, fall, live view) flows through the glasses. A dead device silently disables every safety feature while the caregiver assumes coverage. Silence must never read as safety.
- **Impact:** PATIENT: all passive monitoring silently disabled. CAREGIVER: false sense of coverage. BUSINESS: even post-pivot, the device is the safety differentiator; silent failure destroys trust.
- **Recommendation:** Track glasses last-heartbeat server-side; if no heartbeat for >X minutes during waking hours, push a P1 "Glasses offline — monitoring paused." Forward device battery and push a P1 low-battery warning at ~20%/10%. Show a persistent in-app "device offline" banner.
- **Expected impact:** Eliminates silent-failure blind spots; ensures caregivers know when protection is actually active, which is core to trusting the system.
- **Evidence:** `grep -rn "battery" src/` → only src/hooks/useDashboardData.ts:6 comment; src/server-routes/device.ts:97-156 (push only when glasses actively send).

### [NOTIF-9] Reminder push fires once with a 5-minute window, no repeat, and uses fragile UTC time matching
**Severity:** High · **Effort:** Medium

- **Issue:** Reminders compare against UTC wall-clock, fire once, and never repeat.
- **Description:** `fireRemindersForAll` runs every 5 min (scheduler.ts:14) and fires only if `isReminderDueNow` is true within a 5-min window, once per day via the `notified_date` guard (fireReminders.ts:60-62). It never repeats. Critically, `isReminderDueNow` compares the reminder's parsed hour/minute against `now.getUTCHours()`/`getUTCMinutes()` (fireReminders.ts:23-24) with no timezone handling — a reminder stored as "9:00 AM" fires at 9:00 UTC, off by the user's UTC offset. The `*/5` cron with a 5-min window also risks edge misses at boundaries.
- **Why it matters:** For a dementia patient, a single un-repeated reminder is trivially missed, and a reminder firing at the wrong hour actively confuses and erodes trust in the routine system — a patient-side core feature.
- **Impact:** PATIENT: reminders arrive at the wrong time or are missed entirely. CAREGIVER: adherence suffers, summaries look bad. BUSINESS: routine/adherence value undermined.
- **Recommendation:** Store and compute reminder times in the patient's local timezone (persist a tz offset / IANA zone and convert before comparing). Re-notify (2-3 escalating nudges) until the item is marked done or snoozed, then trigger the caregiver missed-med alert (NOTIF-5). Align the window exactly with the cron cadence.
- **Expected impact:** Reminders fire at the correct local time and actually land, materially improving adherence and routine reliability on the patient surface.
- **Evidence:** src/server-jobs/fireReminders.ts:18-27 (UTC comparison), :47-84 (single fire, `notified_date` guard); src/server-jobs/scheduler.ts:14.

### [NOTIF-7] No foreground notification handler; pushes won't display while app is open
**Severity:** Medium · **Effort:** Small

- **Issue:** Pushes arriving while the app is foregrounded show no banner/sound.
- **Description:** Verified `grep -rn "setNotificationHandler" src/` returns no matches. By default `expo-notifications` does not present a banner/sound for a push that arrives while the app is foregrounded. A caregiver actively on another screen would not get a heads-up for an incoming zone-exit, livestream invite, or (once fixed) help push. The only response listener is src/screens/caregiver/PatientsTab.tsx:41 (livestream tap only).
- **Why it matters:** Engaged in-app caregivers are exactly the users you most want to reach; failing to surface an emergency push because they happen to be in-app is a subtle but serious gap.
- **Impact:** CAREGIVER: misses time-sensitive pushes while using the app. PATIENT: delayed response. BUSINESS: inconsistent, unreliable alerting.
- **Recommendation:** Add `Notifications.setNotificationHandler` at app root returning `shouldShowBanner`/`shouldPlaySound` true for P0/P1 types; map `data.type` to in-app handling (e.g. `help_request` → open the urgent overlay immediately instead of waiting for the next poll).
- **Expected impact:** Guarantees foreground delivery of urgent pushes and unifies push + overlay so the overlay no longer depends on polling timing.
- **Evidence:** `grep -rn "setNotificationHandler" src/` → no matches; only tap-handler is src/screens/caregiver/PatientsTab.tsx:41.

### [NOTIF-10] Daily summary pushes to every patient unconditionally — no opt-out, quiet hours, or relevance gate
**Severity:** Medium · **Effort:** Medium

- **Issue:** A non-urgent digest pushes to all caregivers at a fixed 08:00 UTC, often the middle of the night locally, even with nothing to report.
- **Description:** `runDailySummaries` iterates ALL `pushTokens` and sends a "Good morning" push to every caregiver at 08:00 UTC (dailySummary.ts:52-103, scheduler.ts:19). 08:00 UTC is ~1-3am for US users. No timezone/quiet-hours awareness, no per-user opt-out, no suppression when there is nothing material (it sends even with no sleep, no steps, no meds, 0 help alerts), and it consumes a high-priority interruption channel for a P3 message.
- **Why it matters:** An informational digest waking caregivers at 2am is a fast route to disabling notifications entirely — which also disables genuine emergency pushes.
- **Impact:** CAREGIVER: woken by non-urgent pushes; likely silences notifications app-wide. BUSINESS: self-inflicted opt-out hurts retention and safety.
- **Recommendation:** Schedule the summary in each caregiver's local morning (per-user tz), make it opt-in/opt-out, suppress when there is nothing material, and deliver as a P3 quiet push (no sound, time-sensitive off). Respect global quiet hours for all non-P0 notifications.
- **Expected impact:** Stops training caregivers to mute notifications; preserves the high-priority channel for emergencies and keeps the digest welcome and relevant.
- **Evidence:** src/server-jobs/dailySummary.ts:52-103 (iterates all tokens, no gate); src/server-jobs/scheduler.ts:19 (08:00 UTC fixed).

### [NOTIF-8] Face-detection / "seen" alerts have no throttling — alert-fatigue and dignity risk
**Severity:** Medium · **Effort:** Medium

- **Issue:** Face events surface with no de-duplication, cooldown, or grouping.
- **Description:** alerts.ts (lines 9-32) simply lists whatever is in the `alerts` collection, and useDashboardData polls every 15s, rebuilding a timeline surfacing every "seen" and every alert. No de-dup, cooldown, or grouping — repeated sightings of the same person each become an entry. These are in-app today (not push), but the design has no concept of throttling, so any future "notify on unknown face" push would spam.
- **Why it matters:** Constant "seen Person X" churn trains caregivers to ignore the alerts surface, and continuous logging of who the patient interacts with raises dignity/surveillance concerns for a vulnerable adult.
- **Impact:** CAREGIVER: noise drowns out meaningful events. PATIENT: dignity — every social contact logged and surfaced. BUSINESS: the alerts surface loses signal value.
- **Recommendation:** De-duplicate face events with a per-person cooldown (one "seen" per person per N hours), group repeated unknown-face sightings into a single rolling alert with a count, and gate any face-based push behind a meaningful threshold. Add a caregiver toggle for face-event verbosity.
- **Expected impact:** Cuts low-value face noise, preserves signal for genuine unknown-person concerns, and reduces the surveillance feel for the patient.
- **Evidence:** src/server-routes/alerts.ts:9-32 (no throttle); src/hooks/useDashboardData.ts:6,32-38 (15s poll); buildTimeline surfaces every event.

### [NOTIF-11] Notification permission UX is patient-degraded and copy is misleading
**Severity:** Medium · **Effort:** Small

- **Issue:** Patients silently lose reminders on denial with no recovery, and caregiver denied-copy promises help alerts that do not push.
- **Description:** The patient push registration (RootNavigator.tsx:206-235) silently `return`s on denial — no fallback, no explanation ever. The caregiver path on denial shows "To get help alerts, go to Settings…" (RootNavigator.tsx:178-184), but help alerts do not push at all (NOTIF-1), so the copy promises a capability that does not exist. Permission is requested cold at first login with no priming/rationale screen.
- **Why it matters:** Notification grant rate gates every push in the system. Cold requests with no rationale and misleading recovery copy suppress opt-in for a product whose core value depends on it.
- **Impact:** PATIENT: silently loses reminders with no recovery path. CAREGIVER: misled about what notifications provide; lower grant rate. BUSINESS: the entire push system is throttled by poor permission UX.
- **Recommendation:** Add a pre-permission priming screen ("We use notifications to alert you the moment [Patient] needs help") before the OS prompt. Provide a patient-side denied-state recovery banner deep-linking to Settings. Fix the caregiver denied-state copy once help push exists, and surface notification status in settings.
- **Expected impact:** Raises notification opt-in (typically 15-30 points with priming), directly increasing reach of every safety alert.
- **Evidence:** src/navigation/RootNavigator.tsx:178-184 (caregiver denied copy references help alerts), :206-235 (patient path silently returns on denial, no priming).

### [NOTIF-12] No quiet-hours, snooze, per-type, or per-patient notification controls
**Severity:** Medium · **Effort:** Medium

- **Issue:** Caregivers have no granular controls, so reducing noise means the OS-level all-or-nothing toggle that also kills emergencies.
- **Description:** Verified `grep -rni "quiet hours|do not disturb|snooze"` returns nothing. No user-facing control to mute non-urgent categories, set quiet hours, snooze a noisy patient, or choose which types push. A caregiver managing multiple patients cannot tune per-patient.
- **Why it matters:** Without granularity, any noise (reminders, face events, summaries) drives caregivers to the nuclear option of disabling all notifications, silencing emergencies too. Granularity is what lets you keep P0 loud while quieting P3.
- **Impact:** CAREGIVER: no way to reduce noise without losing safety alerts. BUSINESS: drives the very opt-outs that make the product unsafe.
- **Recommendation:** Build a notifications-preferences screen: per-category toggles (reminders, face events, digest, live view, help — help non-disableable), global quiet hours for non-P0 tiers, and per-patient muting for multi-patient caregivers. Enforce server-side via the central sender (NOTIF-2), never suppressing P0.
- **Expected impact:** Lets caregivers self-tune noise instead of disabling everything, preserving emergency reach while reducing fatigue-driven churn.
- **Evidence:** `grep -rni "quiet hours|do not disturb|snooze" src/` → no matches; no notification settings screen exists alongside SideDrawer.


---

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


---

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


---

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


---

## Technical Product Audit (Edge Cases & Failure States)

I verified all twelve findings against the actual code and refuted none — every claim of a missing or broken safety path holds up. The picture is alarming for a vulnerable-population product: the two most safety-critical signals (the Help/panic button and the geofence wandering alert) are fire-and-forget paths that depend on the recipient already staring at the app or that silently die in a `console.error`, even though the exact push infrastructure to deliver them already exists and is used by other features (glasses alerts, zone-exit). Compounding failure modes — a non-role-gated 30-minute logout that disables the patient's Help button, forced sign-out on Render cold-starts, no forgot-password flow, and no patient-device or glasses liveness signal — mean a caregiver can hold a "working" app that is in fact a dead safety net with no visible indication. These are not exotic edge cases; they are the normal first-action-of-the-day and phone-left-on-the-counter scenarios for this demographic.

### [FAIL-1] Patient Help/panic button sends NO push notification — caregiver only learns via in-app polling
**Severity:** Critical · **Effort:** Medium

- **Issue:** The single most safety-critical event in the app reaches no one unless the caregiver app is already open in the foreground.
- **Description:** `POST /api/help-alerts` (helpAlerts.ts:42-56) inserts a `help_alerts` document and returns — it never sends an Expo push. The caregiver only learns of a help request through `useHelpAlert` polling (useHelpAlert.ts:40-46: 4s active / 15s idle) and the urgent overlay fired off `pendingCount` changes (RootNavigator.tsx:374-386). All of this requires the caregiver app foregrounded and running. The push infrastructure already exists: a caregiver token is stored in the `pushTokens` collection keyed by `patientId` and is used by zone-exit (patientTokens.ts:58-86) and glasses alerts (device.ts:136-151).
- **Why it matters:** A panic signal that depends on the recipient already watching the app is not a panic signal. The token registration (RootNavigator.tsx:197) exists precisely to deliver this, yet the most urgent event type doesn't use it.
- **Impact:** Patient presses Help during a fall/wandering/medical event and no caregiver is alerted; caregiver believes the alert system works and discovers requests hours late; a single "the panic button didn't notify me" incident destroys trust and invites liability.
- **Recommendation:** In `POST /api/help-alerts`, after `insertOne`, look up the caregiver token(s) for that `patient_id` and send a high-priority Expo push (sound + priority high), mirroring device.ts:139-151. Send to ALL linked caregivers (current `pushTokens.findOne` returns only one). Add an SMS/phone escalation fallback (Twilio) if no push is accepted within N seconds. Treat delivery as guaranteed, not best-effort polling.
- **Expected impact:** Converts the lifeline feature from foreground-only to true emergency alerting; closes the highest-severity safety gap in the app.
- **Evidence:** src/server-routes/helpAlerts.ts:42-56 (no push); src/hooks/useHelpAlert.ts:40-46 (poll only); src/navigation/RootNavigator.tsx:374-386 (foreground overlay); src/server-routes/device.ts:136-151 + src/server-routes/patientTokens.ts:58-86 (push infra already exists)

### [FAIL-2] 30-minute inactivity auto-logout is not role-gated — silently disables the patient's Help button
**Severity:** Critical · **Effort:** Small

- **Issue:** A normal idle period silently signs a dementia patient out and drops them at a login wall they cannot pass.
- **Description:** `SESSION_TIMEOUT_MS = 30 min` (AuthContext.tsx:49); `resetInactivityTimer` (57-64) calls `supabase.auth.signOut()` unconditionally regardless of role; backgrounding counts as inactivity (75-78). A patient who sets the phone down for 30+ minutes is signed out and, on pickup, faces an email+password login — which a cognitively-impaired patient cannot complete — so Help, Faces, routine, and meds all become inaccessible.
- **Why it matters:** An inactivity timeout is sensible for the paying caregiver but actively dangerous for the patient: it disables every safety feature precisely when the patient is least able to recover. The timeout was never scoped to role.
- **Impact:** Patient locked out of their own safety app, cannot send Help; caregiver finds the patient device "stopped working" with no obvious cause; patient-side abandonment and support burden.
- **Recommendation:** Gate the timeout on `user.role === "caregiver"`. Patient sessions should persist indefinitely (single-purpose, supervised device). If a patient-side control is desired, use a far longer window and a caregiver-set PIN, never an email/password login wall.
- **Expected impact:** Eliminates silent patient lockouts; keeps the Help button always available on the patient device.
- **Evidence:** src/context/AuthContext.tsx:49 (30min const), 57-64 (signOut for all roles), 71-84 (background = inactivity), 86-102 (patient observers but no role gate on timeout)

### [FAIL-5] Wandering/zone-exit geofence notify swallows network failure silently — lost safety alert
**Severity:** Critical · **Effort:** Medium

- **Issue:** A failed geofence-exit POST is permanently dropped with only a `console.error`; the caregiver is never told the patient left the safe zone.
- **Description:** The background `GEOFENCE_TASK` (locationWatcher.ts:10-23) fires on Exit and POSTs `/api/notifications/zone-exit` with no timeout and no retry. If the fetch throws (offline, cold-start), it is caught and only `console.error`'d (20-22). iOS may wake the app only briefly for this event, so a single failed POST = a missed wandering alert with no queue or retry. (The server side patientTokens.ts:38-90 does rate-limit and push correctly — but only if the POST arrives at all.)
- **Why it matters:** Wandering is one of the deadliest risks in dementia care, and the geofence exit is the trigger for the entire wandering pipeline. A fire-and-forget POST with a silent catch can fail to report a patient leaving home and nobody will ever know it failed.
- **Impact:** Patient wanders unsupervised, caregiver not alerted; caregiver trusts a geofence that silently no-ops on any network hiccup; catastrophic liability if a wandering incident occurs while the app "should have" alerted.
- **Recommendation:** Queue zone-exit events through a durable urgent queue (or eventBatcher) so a failed POST retries on next connectivity, with a bounded timeout and exponential backoff. At minimum persist the event locally and flush on reconnect. Never let a wandering event die in a `console.error`.
- **Expected impact:** Wandering alerts survive transient network failure and cold starts; closes a silent safety-data-loss path.
- **Evidence:** src/services/locationWatcher.ts:10-23 (catch only console.error, no timeout/retry/queue; raw fire-and-forget fetch 16-19)

### [FAIL-3] No forgot-password / account-recovery flow anywhere in the app
**Severity:** High · **Effort:** Small

- **Issue:** A caregiver who forgets their password has no in-app path back into the account holding the patient's entire care record.
- **Description:** Grep for `forgot|reset|recover|resetPasswordForEmail` across `src` returns zero matches. `LoginScreen.tsx` has only email + password fields (332-345) with no "Forgot password?" affordance. Supabase's `resetPasswordForEmail` is never called.
- **Why it matters:** Account recovery is table-stakes for any paid SaaS, doubly so when the account gates a dependent patient's care data. The 45–65 target demographic forgets passwords routinely; with no recovery, a forgotten password = permanent loss of access to the Living Profile, seat, link code, and care-team config.
- **Impact:** Caregiver locked out of the paid product and the patient's record; likely churn or a support ticket unresolvable without manual DB intervention; direct revenue loss for a $29/mo subscription.
- **Recommendation:** Add a "Forgot password?" link calling `supabase.auth.resetPasswordForEmail` with a deep-link redirect, plus a ResetPassword screen handling the recovery token. A few hours of work that removes a hard account-loss failure mode.
- **Expected impact:** Removes a permanent-lockout failure path; recovers otherwise-churned paying caregivers.
- **Evidence:** src/screens/LoginScreen.tsx:320-345 (only email/password, no recovery); grep `forgot|reset|recover` across src = 0 matches

### [FAIL-4] Offline state inferred only from failed requests — no OS connectivity listener (NetInfo)
**Severity:** High · **Effort:** Medium

- **Issue:** The app only "discovers" it's offline after a request fails AND cache exists, giving inconsistent offline UX and long hangs on poor connections.
- **Description:** No `@react-native-community/netinfo` or any connectivity listener exists (grep = 0). The offline flag is set solely inside `client.ts` when a fetch throws and cached data exists (134-158), via `onNetworkChange`. NetworkContext is plain `useState` with no subscription. Consequences: (1) a fresh, uncached screen shows a spinner/error rather than "offline"; (2) the app keeps attempting full FAST/COLD-START timeouts because it never proactively knows it's offline; (3) the flag is cleared only on a later successful request, so transient blips leave the banner inconsistent.
- **Why it matters:** Patients and their phones live in real-world dead zones (basements, care facilities). Reactive per-request offline detection is confusing and slow, and a caregiver needs to instantly know whether what they see is live or stale.
- **Impact:** Stale data shown without a clear indicator on uncached screens; multi-second hangs on poor connections; feels unreliable on care-facility wifi.
- **Recommendation:** Add NetInfo, drive `NetworkContext.isOffline` from `NetInfo.addEventListener`, and short-circuit/shorten request timeouts when offline is already known. Show the OfflineBanner from OS state regardless of per-screen cache.
- **Expected impact:** Instant, consistent offline awareness; eliminates hangs on known-offline screens; data freshness always communicated.
- **Evidence:** src/context/NetworkContext.tsx (plain state); src/api/client.ts:107,134-158 (offline only set on failure+cache); grep NetInfo = 0

### [FAIL-6] Stale Expo push tokens cleaned up in only 1 of 5 push call sites — silent notification rot on device migration
**Severity:** High · **Effort:** Medium

- **Issue:** Only one of five push senders removes a dead `DeviceNotRegistered` token, so after a phone change urgent alerts can silently go to a dead device.
- **Description:** Only `streamSessions.ts:194-197` inspects the ticket for `DeviceNotRegistered` and deletes the stale token. The others — device.ts:136-151 (glasses urgent alert), patientTokens.ts:71-89 (zone-exit), fireReminders.ts, dailySummary.ts — at best `console.error` the ticket and never remove the dead token. Tokens upsert by userId/patientId, so a re-login refreshes them, but if the user never logs in on the new device under the same path, the stale token lingers and every urgent alert evaporates.
- **Why it matters:** Push is the delivery channel for reminders, glasses alerts, zone-exit, and daily summaries. A stale token means those notifications vanish with only a server-side `console.error` — the same silent-failure pattern that is dangerous for safety alerts. Device migration is common in this demographic.
- **Impact:** Patient misses medication/reminder pushes after a phone change; caregiver misses glasses/zone alerts to an old device; "I stopped getting notifications" churn with no visible cause.
- **Recommendation:** Factor a single `sendExpoPush` helper that inspects the ticket and deletes/marks `DeviceNotRegistered` tokens, and use it everywhere (device.ts, patientTokens.ts, both jobs). Also implement Expo receipt-checking for delayed errors.
- **Expected impact:** Eliminates silent notification loss after device migration; consolidates four duplicated push implementations into one correct one.
- **Evidence:** src/server-routes/streamSessions.ts:194-197 (only cleanup); src/server-routes/device.ts:136-151, src/server-routes/patientTokens.ts:71-89, src/server-jobs/fireReminders.ts, src/server-jobs/dailySummary.ts (console.error only, no cleanup)

### [FAIL-7] syncProfile failure on app launch forces a full sign-out instead of degraded/cached operation
**Severity:** High · **Effort:** Medium

- **Issue:** A transient backend cold-start on the first launch of the day kicks an already-authenticated user completely out.
- **Description:** On session restore (AuthContext.tsx:117-129) and on login/signup (180-192, 217-229), if `syncProfile()` throws, the catch shows "We couldn't set up your account. Please sign in again." and calls `supabase.auth.signOut()`. Render free-tier cold starts (~30s, acknowledged in CLAUDE.md) are the normal first-request-of-the-day experience, so a routine spin-up signs out an authenticated user.
- **Why it matters:** Treating a transient sync failure as "your account is broken, sign out" is fragile and hostile — brutal for a patient who then hits a login wall (compounds FAIL-2) or a caregiver who just wanted to glance at their patient.
- **Impact:** Patient signed out by a cold start and cannot recover; caregiver signed out on first morning launch; the app looks broken at exactly the launch users notice most.
- **Recommendation:** On `syncProfile` failure, keep the Supabase session and proceed with the cached `patient_id` (persist last-known `patient_id` in AsyncStorage). Show a non-destructive "Reconnecting…" state and retry in background. Reserve forced sign-out for genuine 401/invalid-session, not network/cold-start errors.
- **Expected impact:** Removes spurious sign-outs on cold start; app opens to cached data and self-heals when the backend wakes.
- **Evidence:** src/context/AuthContext.tsx:117-129 (restore signOut on sync fail), 180-192 (signup), 217-229 (login)

### [FAIL-10] No Bluetooth/glasses-disconnect handling or state in the app — silent on the hardware the product is built around
**Severity:** High · **Effort:** Large

- **Issue:** The app has no glasses connectivity/health signal, so a dead or unpaired device is indistinguishable from "all clear."
- **Description:** There is no BLE connection state, disconnect detection, or UI telling the patient/caregiver the glasses are offline. Faces detection arrives via `stream.ts` SSE, which polls `people.last_seen` every 3s and swallows all DB errors with an empty catch (stream.ts:32). The app has no awareness of whether the glasses are powered, charged, paired, or in range — only the absence of new data.
- **Why it matters:** For a safety device, "no signal" must be loudly distinguished from "all clear." A caregiver relying on glasses-based recognition/alerts has no way to know the glasses died or lost Bluetooth. This is also the failure mode behind the live Apple 2.1 rejection (app non-functional without hardware).
- **Impact:** Caregiver gets a false sense of security, reading glasses silence as "patient fine"; patient loses face-recognition assistance with no notice; reinforces the App Store 2.1 problem.
- **Recommendation:** Surface explicit glasses connectivity/last-heartbeat status (battery, last-seen) from the hardware backend, with a prominent "Glasses offline" banner distinct from app offline. Distinguish "no alerts because all clear" from "no alerts because device is down." Fix the silent empty catch in stream.ts:32.
- **Expected impact:** Eliminates the dangerous "silence = safe" ambiguity; directly supports the App Store 2.1 remediation.
- **Evidence:** src/server-routes/stream.ts:17-37 (3s poll, empty catch ~line 32, no device-health concept); grep BLE/bluetooth/glasses-connection absent in client

### [FAIL-11] Patient phone dying / going offline is invisible to the caregiver — no heartbeat or last-seen
**Severity:** High · **Effort:** Medium

- **Issue:** If the patient's phone dies, every phone-dependent safety mechanism silently stops and the caregiver cannot tell "calm and safe" from "phone dead for 6 hours."
- **Description:** Nothing reports patient-device liveness. Push tokens are stored (patientTokens.ts) but there is no last-active/heartbeat write from the patient app and no caregiver-facing "patient's phone last seen X ago" (grep `heartbeat|lastActive|last_active` for the patient device = 0). The health/geofence/sensor pipelines all go quiet identically whether the patient is fine or the phone is off. The caregiver dashboard polls server data (useDashboardData every 15s) but only updates when the patient device is online; its staleness is never surfaced as a device-down warning.
- **Why it matters:** Help button, geofence wandering detection, health sync, and sensors all depend on a live patient phone. The ambiguity between "patient calm" and "phone dead, any emergency undetected" is itself a hazard for a safety product.
- **Impact:** Caregiver unknowingly relies on a dead safety net; emergencies undetectable while the phone is off; trust-destroying gap between perceived and actual monitoring coverage.
- **Recommendation:** Have the patient app write a lightweight heartbeat (on foreground + periodic background fetch) and show the caregiver a "Patient device last active X ago" indicator that turns to a warning past a threshold. Optionally push the caregiver if the device hasn't checked in for N hours.
- **Expected impact:** Caregivers can trust the monitoring is live; dead-phone gaps become visible instead of silent.
- **Evidence:** grep heartbeat/lastActive for patient device absent; src/hooks/useDashboardData (polls data not device-health); src/services/locationWatcher.ts + healthSync.ts depend on a live device with no liveness signal

### [FAIL-8] Sensor/biomarker event queue can grow unbounded and silently lose data on flush failure
**Severity:** Medium · **Effort:** Medium

- **Issue:** The passive-sensor queue has no size cap and no flush timeout, so a long offline period grows it until an AsyncStorage write throws and the event is lost unhandled.
- **Description:** `eventBatcher.ts` queues passive events to AsyncStorage and flushes via `authFetch`. (1) `flush()` re-queues remaining chunks on per-chunk failure (good) but has no timeout, so a cold-starting backend can hang; (2) `queueEvent` pushes forever and only triggers a flush at >=20, so a long offline period grows the queue without bound until an AsyncStorage write fails, at which point `queueEvent` throws and the event is lost — and the homekit call sites (homekit/index.ts) don't await/catch it; (3) offline flush failures are entirely silent.
- **Why it matters:** These signals feed pattern inference and "general wellness" biomarkers that the product may surface to caregivers and license to pharma. Silent unbounded growth then data loss undermines both the caregiver feature and the data-licensing asset's integrity.
- **Impact:** Gaps in behavioral baselines and degraded pattern inference (which already needs >=10 events); corrupts the de-identified data asset that is a stated revenue stream; AsyncStorage bloat degrades app performance.
- **Recommendation:** Cap the queue (e.g. drop oldest beyond N=5000 with a metric), add a request timeout to `flush`, wrap `queueEvent` call sites in try/catch, and surface persistent flush failure to a diagnostic so silent loss is observable.
- **Expected impact:** Bounded storage, no silent biomarker loss, observable flush health — protects both the wellness feature and the data-licensing asset.
- **Evidence:** src/lib/eventBatcher.ts (no cap, flush at 20, no timeout, silent offline failure); src/lib/homekit/index.ts (queueEvent not awaited/caught)

### [FAIL-9] Write requests never retried after cold-start timeout — and the user is given no clear recoverable error
**Severity:** Medium · **Effort:** Large

- **Issue:** A single failed write (add med, resolve help alert) on a cold start is lost silently, creating dangerous state divergence between app and server.
- **Description:** `client.ts` `request()` intentionally does NOT auto-retry non-GET requests (avoiding duplicate POSTs) — reasonable — but uses a single COLD_START_TIMEOUT_MS attempt and throws a raw error on failure. `useHelpAlert.sendHelp` wraps creates in its own 3× retry (good), but `resolveAlert` (useHelpAlert.ts:80-83) and other writes (createRoutine, createMedication, enrollFace) surface the raw error with no offline queue. On a Render cold start a med add or a help-RESOLVE simply fails with no durable retry.
- **Why it matters:** A silently-failed "add medication" or failed "resolve help alert" (which clears the urgent overlay) creates dangerous divergence: the caregiver believes a med exists or a help was handled when the server never recorded it. Cold starts make this a routine first-action-of-the-day failure.
- **Impact:** Caregiver adds a med that doesn't save, or resolves an alert that stays open (or vice-versa); patient missing meds in their routine; data-integrity erosion of the core care record.
- **Recommendation:** For idempotent-safe writes, add a client-generated idempotency key so a single safe retry rides out cold starts without dupes. For non-idempotent writes, queue-and-confirm with explicit UI ("Saving… / Couldn't save, tap to retry"). Never let a med or help-resolve write fail silently.
- **Expected impact:** Care-record writes survive cold starts; eliminates silent loss of meds/routines/resolutions.
- **Evidence:** src/api/client.ts:123-158 (writes single-attempt, no retry/queue); compensating retry only in src/hooks/useHelpAlert.ts:48-73 for create, not for resolve (80-83)

### [FAIL-12] Token expiry mid-session forces sign-out with no silent refresh-and-retry
**Severity:** Medium · **Effort:** Medium

- **Issue:** A 401 from a just-expired token triggers a hard sign-out instead of a transparent token refresh and retry.
- **Description:** The auth token is captured once into module state via `setAuthToken`/`setAuthFetchToken` at login and on `onAuthStateChange` (AuthContext.tsx:143-144); `client.ts` attaches it. On a 401, `onAuthExpired` fires and signs the user out entirely (client.ts:97-100 → AuthContext.tsx:106-109) with no attempt to call `refreshSession` and retry. Supabase's `onAuthStateChange` does push refreshed tokens, but a request in flight with a just-expired token races into a hard sign-out. `authFetch.ts` similarly holds a single cached `_authToken` with no refresh.
- **Why it matters:** Hard sign-out on a recoverable expired token is jarring for caregivers and dangerous for patients (re-couples to FAIL-2: a patient cannot get back through login). Token expiry is a routine, expected event that should be invisible.
- **Impact:** Patient gets random unrecoverable sign-outs; caregiver kicked to login mid-task losing context; friction and perceived instability.
- **Recommendation:** On 401, call `supabase.auth.refreshSession()`, update `setAuthToken`/`setAuthFetchToken`, and retry the original request once before falling back to sign-out. Read the freshest `access_token` from the Supabase session at request time rather than relying solely on the cached module variable.
- **Expected impact:** Token refresh becomes transparent; eliminates a class of spurious mid-session sign-outs.
- **Evidence:** src/api/client.ts:97-100 (401 → onAuthExpired → signOut, no refresh/retry); src/context/AuthContext.tsx:106-109,143-144 (cached module token); src/api/authFetch.ts:3-7 (single cached _authToken, no refresh)
