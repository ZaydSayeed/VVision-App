# VVision App — Project Context for Claude

## What This App Is
A dementia-care mobile app built with React Native / Expo. There are two user roles:
- **Patient** — sees their daily routine, medications, known faces, and a help button to alert caregivers
- **Caregiver** — sees a dashboard of linked patients, face recognition alerts, activity timeline, and can manage the care team

Authentication is handled by **Supabase**. Data is stored in **MongoDB Atlas**. The backend is an **Express/TypeScript** server (`src/server.ts`) deployed on **Render** at `https://vvision-app.onrender.com`.

---

## How to Run

**Start the app (backend is always running on Render — no need to start it):**
```
npx expo start
```
Scan QR with Expo Go on your phone. Works from any network.

**Web browser:**
```
npx expo start --web
```
Or press `w` after starting. Camera features won't work on web.

**Local backend (only if you need to test backend changes locally):**
```
npm run backend
```
Update `app.json` `apiBaseUrl` to your local IP first (`ipconfig getifaddr en0`), and revert it to the Render URL when done.

---

## Tech Stack
- **React Native + Expo** (mobile app)
- **Supabase** (auth — login, signup, session tokens)
- **MongoDB Atlas** (data — routines, meds, faces, alerts)
- **Express + TypeScript** (backend server at `src/server.ts`)
- **expo-linear-gradient** (gradient UI elements)
- **@expo/vector-icons** (Ionicons throughout)
- **@react-navigation/bottom-tabs** v7 (tab navigation)
- **zod** (input validation on all backend routes)
- **express-rate-limit** (auth + link endpoints rate limited)
- **helmet** (security headers on all responses)
- **expo-image-manipulator** (compress photos to ≤500KB before upload)

---

## Design System

### Colors (src/config/theme.ts)
Full token set — both `lightColors` and `darkColors` exported. `AppColors = typeof lightColors` for TypeScript.

**Core palette:**
- `colors.violet` — primary brand (#7B5CE7 light / #9B8BFF dark)
- `colors.bg` — screen background (#FFFFFF light / #0F0D18 dark)
- `colors.surface` — card background (#F7F5FF light / #1A1630 dark)
- `colors.text`, `colors.muted`, `colors.border`, `colors.subtext`
- `colors.violet50`, `colors.violet100`, `colors.violet300` — tint scale

**Patient warm palette (also available to caregiver side):**
- `colors.warm` / `colors.warmSurface` — cream backgrounds
- `colors.sage` / `colors.sageSoft` — green accent (routine, "on track" states)
- `colors.amber` / `colors.amberSoft` — orange accent (meds, "needs attention" states)
- `colors.coral` / `colors.coralSoft` — red accent (help alerts, errors)

**Gradients (`gradients` export):**
- `gradients.primary` — `["#7B5CE7", "#A695F5"]`
- `gradients.dark` — `["#2B2340", "#3D3560"]`
- `gradients.coral` — `["#D95F5F", "#E87878"]`
- `gradients.sage` — `["#5C8E7A", "#7AB5A0"]`
- `gradients.amber` — `["#E8934A", "#F0AD72"]`

### Fonts
- **DM Sans only** — `DMSans_400Regular` and `DMSans_500Medium`
- Use `fonts.regular` or `fonts.medium` (spread into styles)

### Spacing / Radius
- `spacing`: xs(4) sm(8) md(12) lg(16) xl(20) xxl(24) xxxl(32) xxxxl(48)
- `radius`: sm(8) md(12) lg(16) xl(24) pill(999)

### Component Patterns
- **All StyleSheets inside `useMemo(() => StyleSheet.create({...}), [colors])`** — required for dark mode to work correctly
- **Static style files** that reference `colors` must `import { colors } from "../config/theme"` (the static export)
- **Pill buttons** — `borderRadius: radius.pill`, solid violet fill
- **Cards** — `borderRadius: radius.xl`, `colors.bg` background, violet-tinted shadow
- **Section labels** — 11px, uppercase, letterSpacing 1.2, `colors.muted`
- **Progress bars** — 6px height, `colors.surface` track, colored fill, `radius.pill`
- **Left accent strips** — 4-5px wide colored left border on cards to communicate status

---

## Navigation Structure

### Patient (3 tabs — consolidated from 5)
**Today | Help (coral FAB center) | Faces**
- `PatientTabNavigator.tsx` — 3 tabs, coral LinearGradient FAB for Help
- Filled icons (not outline) for all tabs
- Warm tab bar background (`colors.warm`)

### Caregiver (5 tabs)
**Timeline | People | Alerts | Patients | Care Team**
- `CaregiverTabNavigator.tsx` — 13px labels, Title Case, `colors.bg` background, 26px icons
- Badge on Alerts tab for unread count

- Side drawer accessed via hamburger icon (top right of global header)

---

## Key Files

### Navigation
- `src/navigation/RootNavigator.tsx` — top-level routing + white logo header + violet time banner + side drawer. Checks onboarding completion on first login. Vision FAB on both patient and caregiver sides.
- `src/navigation/PatientTabNavigator.tsx` — 3-tab patient nav with coral FAB
- `src/navigation/CaregiverTabNavigator.tsx` — 5-tab caregiver nav

### Onboarding
- `src/screens/OnboardingScreen.tsx` — 3-screen swipeable onboarding shown once after signup (not on regular login). Patient screens: Welcome, Your Day, Get Help. Caregiver screens: Welcome, Stay Connected, Smart Alerts. Completion tracked per-user in AsyncStorage (`@vela/onboarding_complete:{userId}`). Has Skip button and dot indicators.

### Patient Screens
- `src/screens/patient/TodayScreen.tsx` — **main patient home screen** (merged routine + meds + greeting). Uses `useRoutine` + `useMeds`. Time-aware greeting (morning/afternoon/evening/night). Sage accent for tasks, amber for meds. Slide-out notification panel. Delete confirmations via Alert.alert. Pull-to-refresh reloads both routines and meds. Listens for AI-triggered task/med reload events.
- `src/screens/patient/FacesScreen.tsx` — uses theme colors (light/dark aware). Pulsing glasses status chip. 88×88 initials rings with violet gradients. Modal uses theme colors. Delete requires confirmation. Shows cache age ("last synced X ago") when offline. Pull-to-refresh supported.
- `src/screens/patient/HelpScreen.tsx` — coral gradient bg, large ring button, inline error banner if send fails. Auto-retries up to 3 times with exponential backoff. Shows "Sending…" state. Pull-to-refresh reloads recent alerts.

### Caregiver Screens
- `src/screens/TimelineScreen.tsx` — "Today at a Glance" header, 3-number inline stat strip (Seen Today / Alerts / Most Visits), vertical timeline with 4px color-coded left borders (sage=seen, coral=alert, violet=interaction). Pull-to-refresh supported.
- `src/screens/AlertsScreen.tsx` — two visual identities: coral left-border cards for help requests (hand icon, "Mark as handled" button), dark surface + violet glow cards for AI face detection (scan-circle icon, "AI Alert" badge). Pull-to-refresh supported.
- `src/screens/caregiver/PatientsDashboardScreen.tsx` — patient cards with 5px colored left accent strip (sage=on track, amber=needs attention), progress bars for routine + meds, status pill ("On track" / "Needs attention"), avatar color matches status. Pull-to-refresh supported.
- `src/screens/caregiver/PatientStatusScreen.tsx` — caregiver's read-only view of a single patient (slide-out notification reminders panel)

### Components
- `src/components/VisionSheet.tsx` — AI assistant bottom sheet (chat UI). Half-screen by default, swipe up for full. Auto-snaps to full when keyboard opens. Manual keyboard height tracking (not KeyboardAvoidingView). Suggestion chips when chat is empty. Triggers task/med/reminder reloads when AI creates items. Available on both patient and caregiver sides.
- `src/components/SideDrawer.tsx` — slide-in left menu (profile, link code, dark mode toggle, sign out). Static styles import `colors` from theme.ts directly.
- `src/components/shared/CheckRow.tsx` — 72px min-height, 44×44 checkbox, 20px label, `accentColor` prop, `subLabelChecked` style (opacity 0.45 when done)
- `src/components/shared/SectionHeader.tsx` — bold section label with optional action
- `src/components/AlertCard.tsx` — used by AlertsScreen for face recognition cards
- `src/components/TimelineItem.tsx` — used by TimelineScreen for event cards

### Hooks
- `src/hooks/useRoutine.ts` — exposes `tasks`, `addTask`, `toggleComplete`, `deleteTask`, `isCompletedToday`, `loadError`, `reload`
- `src/hooks/useMeds.ts` — exposes `meds`, `addMed`, `toggleTaken`, `deleteMed`, `isTakenToday`, `loadError`, `reload`
- `src/hooks/useHelpAlert.ts` — exposes `alerts`, `pendingCount`, `sending`, `sentAt`, `sendError`, `sendHelp`, `dismissAlert`, `clearSentState`, `reload`. `sendHelp` auto-retries 3× with backoff.
- `src/hooks/useCaregiver.ts` — caregiver data, exposes `loadError`
- `src/hooks/useDashboardData.ts` — polls every 15s (was 5s), `computeStats` and `buildTimeline` memoized
- `src/hooks/useNotes.ts` — caregiver notes with 30s polling

### Utils
- `src/utils/reminderEvents.ts` — cross-component data reload callbacks. Exports `triggerReminderReload`/`registerReminderReload`, `triggerTaskReload`/`registerTaskReload`, `triggerMedReload`/`registerMedReload`. Used by VisionSheet to notify TodayScreen when AI creates items.

### Config / Context / API
- `src/config/theme.ts` — all design tokens (colors, gradients, spacing, radius, fonts, typography, shadow). `shadow.sm/md/lg/fab` tokens. `typography.heroStyle/titleStyle/bodyStyle` etc.
- `src/context/ThemeContext.tsx` — light/dark mode, exposes `colors`, `isDark`, `toggleTheme`
- `src/context/AuthContext.tsx` — user session, `user.role` is `"patient"` or `"caregiver"`. 30-minute inactivity timeout auto-signs out.
- `src/api/client.ts` — all API calls, auth token + offline caching with timestamps. Compresses photos to 800px/70% before upload. 8s request timeout.
- `src/server.ts` — Express backend entry point. helmet, CORS, rate limiting, 1mb body limit, global error handler, `/health` + `/ready` endpoints.
- `src/server-core/linkCode.ts` — shared 8-char link code generator (used by auth + patients routes)
- `src/server-core/security.ts` — Supabase token cache with 5-minute TTL
- `src/server-routes/auth.ts` — Supabase sync with Zod validation
- `src/server-routes/patients.ts` — patient linking, link code lookup. `DELETE /api/patients/mine/unlink` (caregiver unlinks). `DELETE /api/patients/mine/caregivers/:id` (patient removes caregiver).
- `src/server-routes/people.ts` — face enroll/delete. MIME type + 5MB upload validation.
- `src/server-routes/assistant.ts` — Vision AI chat endpoint. Uses Groq SDK with `llama-3.3-70b-versatile` and tool calling. Three tools: `create_reminder`, `create_task`, `create_medication`. Fetches patient's routines, meds, reminders, conversations as context. Returns `{ reply, reminderCreated, taskCreated, medicationCreated }`.
- `src/server-routes/notes.ts` — caregiver notes CRUD with ownership checks
- `src/server-routes/routines.ts`, `medications.ts`, `helpAlerts.ts`, `caregiverProfiles.ts` — all have Zod validation + ObjectId guards

---

## Frontend Work

**Always use the `frontend-design` skill before writing any UI code.** This applies to any screen, component, style, or layout change — no exceptions.

---

## Important Notes
- The **link code** (patients share with caregivers to connect) requires the backend to be running. If it's not showing in the side drawer, it's a backend connectivity issue, not a frontend bug.
- The **Faces** feature (face recognition) requires the glasses hardware system running on the same network. Most face-related API calls will fail gracefully with an offline state if the glasses aren't connected.
- **Dark mode** is toggled from the side drawer. The global time banner adapts — uses `gradients.primary` in light mode and `gradients.dark` in dark mode.
- **FacesScreen** now fully respects the app theme — light mode shows a clean bright layout, dark mode stays deep purple.
- The `.env` file has `MONGODB_URI` with real credentials — never commit changes to this file that expose credentials.
- The backend is deployed on **Render** (`https://vvision-app.onrender.com`). The app connects via `apiBaseUrl` in `app.json`. The `.env` `API_BASE_URL` is only used for local backend development.
- **Render free tier** spins down after inactivity — first request after idle takes ~30s. Pull-to-refresh on any screen will retry.
- To run on **web**: `npx expo start --web` (or press `w` after `npx expo start`). Camera features won't work on web.
- **Old screens** `RoutineScreen.tsx` and `MedsScreen.tsx` still exist in the codebase but are no longer in navigation — their content was merged into `TodayScreen.tsx`.
- **All backend routes** validate input with Zod and guard `req.params.id` with `ObjectId.isValid()` before use.
- **Offline caching** stores a timestamp alongside data. FacesScreen shows "last synced X ago" when offline.
- **CheckRow** uses a native-driver opacity overlay for its flash animation (not background color) — keeps 60fps on check/uncheck.
