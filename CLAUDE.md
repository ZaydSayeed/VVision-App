# VVision App — Project Context for Claude

## What This App Is
A dementia-care mobile app built with React Native / Expo. There are two user roles:
- **Patient** — sees their daily routine, medications, known faces, and a help button to alert caregivers
- **Caregiver** — sees a dashboard of linked patients, face recognition alerts, activity timeline, and can manage the care team

Authentication is handled by **Supabase**. Data is stored in **MongoDB Atlas**. The backend is an **Express/TypeScript** server (`src/server.ts`) that the app talks to via a local network IP.

---

## How to Run

**Everything at once (recommended):**
```
cd /Users/haadisiddiqui/projects/VVision-App && npm run tunnel
```
Starts backend + Expo with tunnel in one command. Scan QR with Expo Go on your phone.

**Separate terminals (local WiFi only):**
```
# Terminal 1
npm run backend

# Terminal 2
npx expo start
```

**Web browser:**
```
npx expo start --web
```
Or press `w` after starting. Camera features won't work on web.

**Available npm scripts:**
- `npm run tunnel` — backend + expo tunnel (phone on any network)
- `npm run dev` — backend + expo (local WiFi only)
- `npm run backend` — backend only
- `npm run web` — web only

Requires ngrok installed (`brew install ngrok`) and authenticated for tunnel mode.

**Local IP** (update `.env` if network changes):
```
API_BASE_URL=http://192.168.16.109:3000
```
Find current IP with: `ipconfig getifaddr en0`

---

## Tech Stack
- **React Native + Expo** (mobile app)
- **Supabase** (auth — login, signup, session tokens)
- **MongoDB Atlas** (data — routines, meds, faces, alerts)
- **Express + TypeScript** (backend server at `src/server.ts`)
- **expo-linear-gradient** (gradient UI elements)
- **@expo/vector-icons** (Ionicons throughout)
- **@react-navigation/bottom-tabs** v7 (tab navigation)

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
- `src/navigation/RootNavigator.tsx` — top-level routing + white logo header + violet time banner + side drawer
- `src/navigation/PatientTabNavigator.tsx` — 3-tab patient nav with coral FAB
- `src/navigation/CaregiverTabNavigator.tsx` — 5-tab caregiver nav

### Patient Screens
- `src/screens/patient/TodayScreen.tsx` — **main patient home screen** (merged routine + meds + greeting). Uses `useRoutine` + `useMeds`. Time-aware greeting (morning/afternoon/evening/night). Sage accent for tasks, amber for meds. Slide-out notification panel. Delete confirmations via Alert.alert.
- `src/screens/patient/FacesScreen.tsx` — intentionally dark screen (`DARK` palette const). Pulsing glasses status chip. 88×88 initials rings. Modal uses DARK palette. Delete requires confirmation.
- `src/screens/patient/HelpScreen.tsx` — coral gradient bg, large ring button, inline error banner if send fails (catches error from `useHelpAlert.sendHelp()`), shows caregiver name

### Caregiver Screens
- `src/screens/TimelineScreen.tsx` — "Today at a Glance" header, 3-number inline stat strip (Seen Today / Alerts / Most Visits), vertical timeline with 4px color-coded left borders (sage=seen, coral=alert, violet=interaction)
- `src/screens/AlertsScreen.tsx` — two visual identities: coral left-border cards for help requests (hand icon, "Mark as handled" button), dark surface + violet glow cards for AI face detection (scan-circle icon, "AI Alert" badge)
- `src/screens/caregiver/PatientsDashboardScreen.tsx` — patient cards with 5px colored left accent strip (sage=on track, amber=needs attention), progress bars for routine + meds, status pill ("On track" / "Needs attention"), avatar color matches status
- `src/screens/caregiver/PatientStatusScreen.tsx` — caregiver's read-only view of a single patient (slide-out notification reminders panel)

### Components
- `src/components/SideDrawer.tsx` — slide-in left menu (profile, link code, dark mode toggle, sign out). Static styles import `colors` from theme.ts directly.
- `src/components/shared/CheckRow.tsx` — 72px min-height, 44×44 checkbox, 20px label, `accentColor` prop, `subLabelChecked` style (opacity 0.45 when done)
- `src/components/shared/SectionHeader.tsx` — bold section label with optional action
- `src/components/AlertCard.tsx` — used by AlertsScreen for face recognition cards
- `src/components/TimelineItem.tsx` — used by TimelineScreen for event cards

### Config / Context / API
- `src/config/theme.ts` — all design tokens (colors, gradients, spacing, radius, fonts, typography, shadow)
- `src/context/ThemeContext.tsx` — light/dark mode, exposes `colors`, `isDark`, `toggleTheme`
- `src/context/AuthContext.tsx` — user session, `user.role` is `"patient"` or `"caregiver"`
- `src/api/client.ts` — all API calls, handles auth token + offline caching
- `src/server.ts` — Express backend entry point
- `src/server-routes/auth.ts` — Supabase sync, link code generation
- `src/server-routes/patients.ts` — patient linking, link code lookup

---

## Frontend Work

**Always use the `frontend-design` skill before writing any UI code.** This applies to any screen, component, style, or layout change — no exceptions.

---

## Important Notes
- The **link code** (patients share with caregivers to connect) requires the backend to be running. If it's not showing in the side drawer, it's a backend connectivity issue, not a frontend bug.
- The **Faces** feature (face recognition) requires the glasses hardware system running on the same network. Most face-related API calls will fail gracefully with an offline state if the glasses aren't connected.
- **Dark mode** is toggled from the side drawer. The global time banner adapts — uses `gradients.primary` in light mode and `gradients.dark` in dark mode.
- **FacesScreen** deliberately uses its own `DARK` palette constant (not `colors` from theme) so it stays dark even in light mode — this is intentional design.
- The `.env` file has `MONGODB_URI` with real credentials — never commit changes to this file that expose credentials.
- The backend runs on **port 3000** (`src/server.ts`). The app connects to it via `API_BASE_URL` in `.env`.
- To run on **web**: `npx expo start --web` (or press `w` after `npx expo start`). Camera features won't work on web.
- **Old screens** `RoutineScreen.tsx` and `MedsScreen.tsx` still exist in the codebase but are no longer in navigation — their content was merged into `TodayScreen.tsx`.
