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
