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
