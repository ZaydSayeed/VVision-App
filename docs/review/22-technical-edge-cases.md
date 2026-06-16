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
