# VVision-App Full Audit Fixes — Design Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Fix every bug, UX gap, and rough edge found in the full codebase audit. Ship as a single branch with parallel subagent execution across 5 clusters.

**Architecture:** Five independent fix clusters (backend, hooks, patient screens, caregiver screens, polish) executed in parallel by separate subagents, all committing to the same branch. One TestFlight build at the end.

**Tech Stack:** React Native + Expo (old arch), Express/TypeScript backend on Render, MongoDB Atlas, Supabase auth.

---

## Cluster 1: Backend Fixes

### seatResolver.ts
- Wrap both `requirePatientAccess` and `requireSeat` middleware bodies in `try/catch`
- On catch: call `next(err)` so Express global error handler responds with 500
- Remove the `(async () => {})()` fire-and-forget pattern — use `async (req, res, next) =>` directly

### streamSessions.ts
- Validate `patientId` is a non-empty string before use
- If missing or invalid: return `res.status(400).json({ detail: "patientId is required" })`
- Remove unsafe `as string` cast

### health.ts — heart rate upsert
- Remove the `recordedAt` fallback: `r.recordedAt ?? \`${r.date}T00:00:00.000Z\``
- If a heart rate reading has no `recordedAt`, skip it entirely (log a warning)
- Heart rate readings without timestamps are ambiguous and should not be stored

### Console.log cleanup (server-routes/)
- Remove all `console.log()` calls from every server route file
- Keep `console.error()` for genuine errors only
- Files to clean: `assistant.ts`, `health.ts`, `routines.ts`, `medications.ts`, `helpAlerts.ts`, `notes.ts`, `people.ts`, `patients.ts`, `auth.ts`

---

## Cluster 2: Hook Fixes

### useRoutine.ts + useMeds.ts — stale patientId
- Add `patientId` to the `useCallback` dependency array of the `load` function in both hooks
- This ensures data re-fetches when `patientId` arrives after mount (e.g. auth loads async)
- Pattern: `const load = useCallback(async () => { ... }, [patientId])`

### useHelpAlert.ts — double-send race condition
- Add a `sendingRef = useRef(false)` guard
- At the start of `sendHelp`: if `sendingRef.current === true`, return early
- Set `sendingRef.current = true` before the request, `false` in the finally block
- This prevents multiple in-flight requests from rapid taps

### VisionSheet.tsx — message ID collision + stale ref
- Replace `id: String(Date.now())` with `id: Math.random().toString(36).slice(2) + Date.now().toString(36)`
- Fix stale `snapTo` closure: wrap the keyboard show/hide handlers in `useCallback` with `snapTo` in deps, or use a ref for `snapTo`

---

## Cluster 3: Patient Screen Fixes

### TodayScreen.tsx — error state persistence
- Clear `taskError` when Add Task modal closes (both Cancel and successful Add)
- Clear `editError` when Edit Task modal closes
- Clear `medError` when Add Med and Edit Med modals close
- Pattern: add `setTaskError("")` to every `onPress` that closes the modal

### TodayScreen.tsx — reminders null join
- Line where `r.time` and source are joined: wrap in `.filter(Boolean)`
- `[r.time, r.source === "glasses" ? "via glasses" : "via app"].filter(Boolean).join(" · ")`

### HelpScreen.tsx — debounce rapid taps
- Add `const sendingRef = useRef(false)` 
- Guard `handlePress`: if `sendingRef.current` return early
- Set true before request, false in finally

### RootNavigator.tsx — AsyncStorage onboarding timeout
- Wrap `AsyncStorage.getItem(ONBOARDING_KEY)` in `Promise.race` with a 3-second timeout
- Timeout resolves to `null` (treats as not onboarded — safe default)
- Prevents permanent blank splash if AsyncStorage is corrupted

### AuthContext.tsx — syncProfile silent failure
- If `syncProfile()` throws, call `signOut()` and show `Alert.alert("Sign in error", "We couldn't set up your account. Please sign in again.")`
- Never leave the user logged in with `patient_id` unpopulated

---

## Cluster 4: Caregiver Screen Fixes

### PatientsDashboardScreen.tsx — loading skeleton
- While `loading === true`, render 3 placeholder cards
- Each placeholder: same card shape as real patient card, with `backgroundColor: colors.surface`, `opacity: 0.5`
- Use a simple `Animated.loop(Animated.sequence([fade to 0.3, fade to 0.7]))` pulse on the placeholders
- Replace with real cards once data arrives

### FacesScreen.tsx — delete loading + error state
- Add `deletingId: string | null` state (tracks which face is being deleted)
- While `deletingId === face.id`: show `ActivityIndicator` in place of delete button
- If delete throws: show `Alert.alert("Couldn't delete", "Check your connection and try again.")`
- Clear `deletingId` in finally block

### useDashboardData.ts — formatRelativeTime fallback
- In `formatRelativeTime`: wrap the entire parsing + formatting in try/catch
- On catch or invalid date: return `"recently"` instead of the raw ISO string

### RootNavigator.tsx — push notification error
- If `Notifications.getExpoPushTokenAsync()` throws:
  - Show `Alert.alert("Notifications off", "To get help alerts, enable notifications in Settings → Vela Vision → Notifications.")` once (guard with AsyncStorage key so it only shows once per install)
  - Do not crash or retry

---

## Cluster 5: Polish

### ErrorBoundary.tsx — dark mode fix
- Remove `import { colors } from "../config/theme"` (static import, ignores dark mode)
- Replace with hardcoded fallback values inline: `#7B5CE7` (violet), `#0F0D18` (dark bg), `#FFFFFF` (white text)
- ErrorBoundary should never depend on context — it's the last resort

### Progress bar `any` cast
- In TodayScreen.tsx and RoutineScreen.tsx: replace `width: ... as any` with properly typed percentage string
- Pattern: `width: \`${Math.round((done / total) * 100)}%\`` — TypeScript accepts string literals for width

### Accessibility labels — high-impact only
Add `accessibilityLabel` and `accessibilityHint` to:
- Help button (HelpScreen): `accessibilityLabel="Send help alert"` `accessibilityHint="Notifies your caregiver immediately"`
- Task checkbox (TodayScreen + RoutineScreen): `accessibilityLabel={\`Mark ${task.label} as complete\`}`
- Medication checkbox: `accessibilityLabel={\`Mark ${med.name} as taken\`}`
- Add Task FAB: `accessibilityLabel="Add task or medication"`
- All 5 patient tab bar buttons: add `accessibilityLabel` matching tab name

### Error copy standardization
Audit every error string in: TodayScreen, RoutineScreen, HelpScreen, FacesScreen, AuthContext, all hooks.
- Fetch failures: "Couldn't load [thing]. Check your connection and try again."
- Write failures: "Couldn't save. Check your connection and try again."
- Delete failures: "Couldn't delete. Check your connection and try again."
- Remove all variations ("Could not save", "Failed to load", "Something went wrong")

---

## What is NOT in scope
- No new features
- No navigation restructuring
- No database schema changes
- No RevenueCat / paywall work
- No Daily.co livestream fixes (separate native module issue)

## Success criteria
- No CRITICAL or HIGH issues from the audit remain
- App loads correctly even when AsyncStorage is slow
- All error states clear properly between modal opens
- Heart rate data accumulates correctly across a day
- Help button cannot fire duplicate requests
- Loading states visible on all async operations
