## Reliability, Performance, Observability & Testing

The team did real reliability work this session — the SOS path is now genuinely durable (a persisted help queue that survives crash/kill in `useHelpAlert.ts` + `services/helpQueue.ts`), the escalation engine claims levels atomically before paging, caregiver push tokens fan out to the whole care team keyed by `(patientId, caregiverId)`, and there are ~142 backend/pure-logic vitest tests. Credit where due. But two gaps are still wide open and they are the riskiest part of a safety-critical dementia app: **observability is effectively zero** (no crash reporter wired, ~150 raw `console.*` calls, several logging patient/user IDs into stdout), and there is **ZERO React-Native component or hook test coverage** — the SOS send, navigation/role gating, and consent flows that this product literally exists to deliver are validated by nothing on the client. Performance is "fine for now" but carries known foot-guns: `ThemeContext` hands a fresh object to every consumer on each render, the 1030-LOC `TodayScreen` is unmemoized at the top, and the bundle ships two heavy Daily.co WebRTC native modules that are never imported. None of this blocks launch functionally, but the observability + client-test gap means the first production SOS failure will be invisible and unreproducible.

### System map

| Concern | Mechanism | Status |
|---|---|---|
| Render crashes | `ErrorBoundary.tsx` (catches, shows retry) | Present, but `componentDidCatch` only `console.error`s — no reporter |
| Crash/error reporting | Sentry referenced **only in comments** (`server.ts:81`, `ErrorBoundary.tsx:22`) | Not wired |
| Structured logging | Raw `console.*` (~150 in src) + a request-timing `console.log` (`server.ts:86`) | No logger, no redaction |
| Backend tests | vitest, ~142 tests, mongodb-memory-server fallback | Good coverage of routes/jobs/pure logic |
| Client tests | none for components/hooks | **ZERO** |
| Caregiver polling | `useDashboardData` 15s `setInterval` | OK (throttled from 5s) |
| SOS polling | `useHelpAlert` adaptive 4s active / 15s idle | OK |
| SOS durability | `helpQueue` persisted intent + foreground/interval flush | Strong |
| Escalation | `escalateHelpAlerts` atomic level claim | Strong logic; **runs on sleeping node-cron** |
| Offline cache | `api/client.ts` GET cache w/ timestamps | Present |

### Polling & re-render hot spots

| Location | Cost | Note |
|---|---|---|
| `useDashboardData.ts:6,34` | 2 requests / 15s while caregiver screen mounted | Fine; not visibility-gated (polls in background) |
| `useHelpAlert.ts:84` | 2 requests / 4s during active SOS | Acceptable for safety; bursts on every SOS |
| `ThemeContext.tsx:40` | new `{colors,isDark,toggleTheme}` object every ThemeProvider render → all `useTheme()` consumers re-render | Easy `useMemo` fix, broad blast radius |
| `TodayScreen.tsx` (1030 LOC) | re-renders whole tree on any of its many state hooks | No top-level memo; God component |

---

### [RPT-1] No crash/error reporting wired anywhere — production failures are invisible
**Severity:** High · **Effort:** Medium
- **Issue / root cause:** The app has an `ErrorBoundary` and a global Express error handler, but neither reports anywhere. `ErrorBoundary.componentDidCatch` just `console.error`s and the comment literally says "Wire a crash reporter here when one is added (e.g. Sentry.captureException…)". `server.ts:81-82` says the same. For a safety-critical SOS app, a render crash on the Help screen or a swallowed SOS-delivery failure would produce zero signal — no alert, no stack, no breadcrumb. The durable SOS queue's `catch {}` blocks (`useHelpAlert.ts:51-53,60-62,102-104`) silently eat failures by design; with no reporter, a chronically failing send is undetectable.
- **Recommendation / refactor:** Wire `@sentry/react-native` on the client (init in `App.tsx`, `Sentry.captureException` inside `ErrorBoundary.componentDidCatch` and inside the SOS queue's failure branches with a `level: "fatal"` tag) and `@sentry/node` on the backend (in the `server.ts` error handler + `unhandledRejection` handler). This is the single highest-ROI reliability fix — small surface, enormous diagnostic payoff for the exact paths that must not fail silently.
- **Evidence:** `src/components/ErrorBoundary.tsx:20-24`, `src/server.ts:81-82,170,177`, `src/hooks/useHelpAlert.ts:51-53,60-62,102-104`

### [RPT-2] ZERO client (component/hook) test coverage — every critical client flow is untested
**Severity:** High · **Effort:** Large
- **Issue / root cause:** All ~142 tests are backend/pure-logic. There is not a single React-Native component or hook test. That means the **SOS send hook** (`useHelpAlert` — retry/queue orchestration), **role-based navigation gating** (patient vs caregiver, onboarding-complete gating in `RootNavigator`), and the **consent flow** are validated only manually. `helpQueue` itself has a unit test (`services/helpQueue.test.ts`), which is good — but the hook that wires queue + polling + foreground-flush + UI state (the part that actually fails in the field) has none. The God components (`TodayScreen` 1030 LOC, `RootNavigator` 887) are the most logic-dense and the least covered.
- **Recommendation / refactor:** Add `@testing-library/react-native` + `jest`/vitest-RN config and write a focused first wave: (1) `useHelpAlert` — assert a tap enqueues, a failed flush surfaces `sendError` and keeps retrying, a re-foreground triggers flush; (2) navigation gating — patient never reaches caregiver tabs and vice versa; (3) consent gate blocks the protected path until accepted. Prioritize these three over chasing coverage % — they are the load-bearing flows.
- **Evidence:** `src/hooks/useHelpAlert.ts` (no test), `src/navigation/RootNavigator.tsx` (887 LOC, no test), test inventory: 33 `*.test.ts` files, all `src/server-*`, `src/lib`, `src/config`, `src/services` — zero `.test.tsx`

### [RPT-3] ~150 raw console calls, several logging patient/user IDs — PII-in-logs risk
**Severity:** Medium · **Effort:** Medium
- **Issue / root cause:** ~150 `console.*` calls across src. On the backend these land in Render's plaintext log stream, and several interpolate identifiers: `dailySummary.ts:105` logs `patientId`, `patients.ts:180` logs a context object after a seat insert, plus the request logger at `server.ts:86` logs every path. For a health app handling dementia-patient data, unstructured IDs in a third-party log aggregator is a compliance/PII exposure. There is also no log levels / no way to silence debug noise in prod.
- **Recommendation / refactor:** Introduce a thin structured logger (pino) with a redaction allowlist (never log raw `patientId`/`userId`/email — hash or omit), replace `console.*` in `server-*`, and gate client `console.log` behind `__DEV__`. Pair with RPT-1 so the logger and Sentry share one funnel.
- **Evidence:** `src/server-jobs/dailySummary.ts:105`, `src/server-routes/patients.ts:180`, `src/server.ts:86`, grep: 150 `console.*` in `src/`

### [RPT-4] Escalation + cron run on Render free-tier node-cron that sleeps when idle
**Severity:** High · **Effort:** Medium
- **Issue / root cause:** `scheduler.ts` registers four `node-cron` jobs including the every-minute help-alert escalation. But on Render's free tier the process sleeps when idle, so an unanswered SOS will **not escalate until the next inbound request wakes the server** — exactly the scenario (no caregiver responding) where the box is most likely idle. The code honestly documents this (`escalateHelpAlerts.ts:70-73`) and there is a `/cron` HTTP endpoint to externally poke it, but nothing guarantees that poke fires. There is no uptime monitor / heartbeat alerting on the cron either.
- **Recommendation / refactor:** Drive escalation from an external always-on trigger (a paid Render cron service, a GitHub Actions scheduled `curl` to `/cron`, or upgrade the dyno) and add a dead-man's-switch monitor (e.g. an alert if the escalation endpoint hasn't run in >2 min). The escalation *logic* is solid and idempotent — the only gap is the trigger reliability and its monitoring.
- **Evidence:** `src/server-jobs/scheduler.ts:10-25`, `src/server-jobs/escalateHelpAlerts.ts:70-73`, `src/server-routes/cron.ts:20`

### [RPT-5] ThemeContext value is a fresh object every render — re-renders every consumer
**Severity:** Medium · **Effort:** Small
- **Issue / root cause:** `ThemeContext.Provider value={{ colors: …, isDark, toggleTheme }}` allocates a new object on every `ThemeProvider` render. `useTheme()` is consumed by virtually every screen and component (it's the design-system entry point), so any provider re-render cascades a re-render through the whole app, defeating the per-component `useMemo(StyleSheet)` discipline the codebase otherwise enforces.
- **Recommendation / refactor:** Wrap the value in `useMemo(() => ({ colors, isDark, toggleTheme }), [isDark])`. One-line fix, app-wide render reduction. Same pattern should be applied to `AuthContext.tsx:272` (also a bare object literal value).
- **Evidence:** `src/context/ThemeContext.tsx:40`, `src/context/AuthContext.tsx:272`

### [RPT-6] Dead heavy native deps (Daily.co WebRTC) ship in the bundle
**Severity:** Medium · **Effort:** Small
- **Issue / root cause:** `@daily-co/react-native-daily-js` and `@daily-co/react-native-webrtc` are in `dependencies` but never imported in `src` (livestream is "coming soon"). WebRTC is one of the largest native modules in the RN ecosystem — it inflates the binary, pulls camera/mic native code, and is part of why Camera/Mic permissions are declared for features that don't exist yet (App-Store unused-permission risk). `react-native-web` and `react-native-svg` also have 0 direct src uses.
- **Recommendation / refactor:** Remove the Daily.co packages until livestream actually ships; re-add behind the V2 work. Drop `react-native-web`/`react-native-svg` if confirmed unused. This shrinks the binary, removes the unused-permission rejection vector, and de-risks the next App Store submission.
- **Evidence:** `package.json:18-19` (`@daily-co/*`), `package.json:71` (`react-native-gifted-charts` — actually used, keep), grep: 0 `@daily-co` imports in `src/`

### [RPT-7] TodayScreen (1030 LOC) has no top-level memoization and concentrates state
**Severity:** Medium · **Effort:** Large
- **Issue / root cause:** `TodayScreen.tsx` is 1030 LOC with ~32 hook usages (`useState`/`useEffect`/`useMemo`/`useCallback`). It merges routine + meds + greeting + notification panel + AI-reload listeners into one component, so any single state change re-renders the entire screen including the task and med lists. List rows are not extracted into memoized children, so on a large routine every toggle re-renders every row. This is the patient's primary home screen — the one most likely to feel janky on older devices.
- **Recommendation / refactor:** Extract task-row and med-row into `React.memo` children with stable `onToggle`/`onDelete` callbacks, split the notification panel and AI-reload wiring into sub-components/hooks, and consider `FlatList` if the routine can grow. This also directly improves testability (RPT-2) and maintainability.
- **Evidence:** `src/screens/patient/TodayScreen.tsx` (1030 LOC, 32 hook calls)

### [RPT-8] gifted-charts renders on the JS thread inside ExpandableMetricCard
**Severity:** Low · **Effort:** Medium
- **Issue / root cause:** `react-native-gifted-charts` (used in `MetricCard.tsx` and `ExpandableMetricCard.tsx`) renders via SVG on the JS thread. For long HealthKit time series this can drop frames on expand/animate, and the cards are inside scrollable lists. Not a correctness issue, but a JS-thread blocking risk on the sensor/wellness screens.
- **Recommendation / refactor:** Cap/downsample the series passed to the chart (e.g. ≤60 points), memoize the data array, and lazy-mount the chart only when the card is expanded. Low priority unless the wellness screens are on the launch critical path.
- **Evidence:** `src/components/health/ExpandableMetricCard.tsx`, `src/components/health/MetricCard.tsx`, `package.json:71`

### [RPT-9] zone-exit notification still uses single-token findOne (residual fan-out gap)
**Severity:** Medium · **Effort:** Small
- **Issue / root cause:** The help-alert path was correctly fixed to fan out to all caregivers via `getCaregiverPushTokens` (`push.ts:22-25`, keyed by `(patientId, caregiverId)` in `streamSessions.ts:151-153`). But the geofence **zone-exit** push still does `pushTokens.findOne({ patientId })` and notifies only one token (`patientTokens.ts:58-59`). If a patient wanders off, only one caregiver device is paged — and which one is nondeterministic. Same SPOF the SOS path just eliminated, left behind on the wandering-detection path (also safety-critical for dementia).
- **Recommendation / refactor:** Replace the `findOne` with the existing `getCaregiverPushTokens` + `sendExpoPush` fan-out helper. Small change, reuses already-tested code, closes a real safety gap.
- **Evidence:** `src/server-routes/patientTokens.ts:58-62`, contrast `src/server-core/push.ts:22-25`

### [RPT-10] Caregiver dashboard polls in the background (no visibility gating)
**Severity:** Low · **Effort:** Small
- **Issue / root cause:** `useDashboardData` starts a 15s interval on mount with no `AppState`/focus gating, so it keeps firing two network requests every 15s even when the app is backgrounded or the screen is unfocused. `useHelpAlert` correctly listens to `AppState` for its flush; the dashboard doesn't for its poll. Minor battery/data waste and needless Render wake-ups.
- **Recommendation / refactor:** Pause the interval when `AppState !== "active"` (and ideally when the screen is unfocused via `useFocusEffect`), mirroring the `AppState` pattern already used in `useHelpAlert.ts:73-78`.
- **Evidence:** `src/hooks/useDashboardData.ts:32-38` (no AppState), vs `src/hooks/useHelpAlert.ts:73-78`
