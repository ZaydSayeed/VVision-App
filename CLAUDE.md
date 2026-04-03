# VVision App — Project Context for Claude

## What This App Is
A dementia-care mobile app built with React Native / Expo. There are two user roles:
- **Patient** — sees their daily routine, medications, known faces, and a help button to alert caregivers
- **Caregiver** — sees a dashboard of linked patients, face recognition alerts, activity timeline, and can manage the care team

Authentication is handled by **Supabase**. Data is stored in **MongoDB Atlas**. The backend is an **Express/TypeScript** server (`src/server.ts`) that the app talks to via a local network IP.

---

## How to Run

**Terminal 1 — Backend:**
```
cd /Users/haadisiddiqui/projects/VVision-App && npm run backend
```

**Terminal 2 — App:**
```
cd /Users/haadisiddiqui/projects/VVision-App && npx expo start
```

For tunnel mode (phone not on same WiFi):
```
npx expo start --tunnel
```
Requires ngrok installed (`brew install ngrok`) and authenticated.

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
- Primary purple: `#7B5CE7`
- Gradient: `["#7B5CE7", "#A695F5"]` horizontal left→right
- Background: `#FFFFFF` (white)
- Surface (cards): `#F7F5FF` (light lavender)
- Border: `#E8E4F5`
- `typography` and `shadow` token objects added for consistent sizing and elevation

### Fonts
- **DM Sans only** — `DMSans_400Regular` and `DMSans_500Medium`
- `fonts.display` and `fonts.displayLight` map to DM Sans

### Key UI Patterns
- **Global time banner** — violet gradient strip in `RootNavigator.tsx` showing live time (left) + date (right), visible on every screen. Adapts to dark mode.
- **White screen headers** — each screen owns its own header with a bold title and subtitle. No per-screen gradient bars.
- **"Hello, [Name]!" greeting** — PatientStatusScreen has a large greeting with avatar initials + date pills
- **White shadow cards** — `backgroundColor: colors.bg`, `borderRadius: radius.lg`, purple-tinted shadow. Cards use `colors.bg` (pure white), NOT `colors.surface`.
- **Pill buttons** — `borderRadius: radius.pill` (999), solid violet fill
- **Bottom tab bar** — no top border, subtle upward shadow, icon size 24, center FAB elevated purple circle
- **Help tab icon** — `hand-left-outline` (not alert-circle)
- **Modal sheets** — `borderRadius: 28` top corners, drag handle bar, `colors.bg` background
- **Side drawer** — white bg, rounded right corners (24), row-style profile (no gradient header)
- **Login screen** — white bg, logo circle, pill mode toggle (Sign In / Sign Up), lavender inputs, violet submit button

### Navigation Structure
**Patient tabs (5):** Status | Routine | Help (FAB center) | Meds | Faces
**Caregiver tabs (5):** Timeline | People | Alerts | Patients | Care Team
- Side drawer accessed via hamburger icon (top right of global header)

---

## Key Files
- `src/config/theme.ts` — all colors, spacing, fonts, radius, typography, shadow tokens
- `src/context/ThemeContext.tsx` — light/dark mode, exposes `colors`, `isDark`, `toggleTheme`
- `src/context/AuthContext.tsx` — user session, `user.role` is `"patient"` or `"caregiver"`
- `src/navigation/RootNavigator.tsx` — top-level routing + white logo header + violet time banner + side drawer
- `src/navigation/PatientTabNavigator.tsx` — patient bottom tabs with center FAB
- `src/navigation/CaregiverTabNavigator.tsx` — caregiver bottom tabs
- `src/components/SideDrawer.tsx` — slide-in left menu (profile, link code, dark mode toggle, sign out)
- `src/components/shared/CheckRow.tsx` — white card-style checkbox row used in Routine + Meds
- `src/components/shared/SectionHeader.tsx` — bold 18px section label with optional "View All" action
- `src/api/client.ts` — all API calls to the backend, handles auth token + offline caching
- `src/server.ts` — Express backend entry point
- `src/server-routes/auth.ts` — Supabase sync, link code generation
- `src/server-routes/patients.ts` — patient linking, link code lookup

---

## Important Notes
- The **link code** (patients share with caregivers to connect) requires the backend to be running. If it's not showing in the side drawer, it's a backend connectivity issue, not a frontend bug.
- The **Faces** feature (face recognition) requires the glasses hardware system running on the same network. Most face-related API calls will fail gracefully with an offline state if the glasses aren't connected.
- **Dark mode** is toggled from the side drawer. The global time banner adapts — uses `gradients.primary` in light mode and `gradients.dark` in dark mode.
- The `.env` file has `MONGODB_URI` with real credentials — never commit changes to this file that expose credentials.
- The backend runs on **port 3000** (`src/server.ts`). The app connects to it via `API_BASE_URL` in `.env`.
- To run on **web**: `npx expo start --web` (or press `w` after `npx expo start`). Camera features won't work on web.
