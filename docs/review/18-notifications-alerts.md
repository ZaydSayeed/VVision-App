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
