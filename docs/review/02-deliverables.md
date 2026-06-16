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
