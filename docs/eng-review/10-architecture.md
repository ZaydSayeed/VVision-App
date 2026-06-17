## Architecture & System Map

Vela Vision is a **React Native + Expo (TypeScript) client and an Express/TypeScript backend living in a single npm package**, with MongoDB Atlas for data, Supabase for auth, and all AI (Groq, Gemini, Mem0) confined to the server. The fundamentals are sound: the client/server *code* boundary is clean (no client file imports `express`/`mongodb`/`server-*`), the backend has real input hardening (zod, helmet, rate-limit, ObjectId guards), and the server is conventionally layered (`server.ts` → `server-routes/*` → `server-core/*` + `server-jobs/*`). The architecture maturity is dragged down, however, by **client-side organization debt**: a handful of 600–1030-LOC "god" screens that conflate data-fetching, animation, modals, push-notification registration and styling; **two parallel HTTP layers** (`api/client.ts` and `api/authFetch.ts`) each carrying their own duplicated module-level token singleton; a **global mutable pub/sub** (`reminderEvents.ts`) used as an event bus between unrelated components; and **~16 hooks that each fetch and poll independently with no shared cache layer** (no React Query / SWR / store). None of these are fatal, but together they signal a codebase that grew feature-first without an enforced module/state architecture. Overall maturity: **early-growth / "works but under-architected" — roughly 2.5 / 5.**

### System Map

| Layer | Location | Responsibility | Notes |
|---|---|---|---|
| **RN Client — UI** | `src/screens/*` (39), `src/components/*` (24) | Screens + presentational components | Several god screens (see findings) |
| **RN Client — State** | `src/context/*` (3: Auth/Theme/Network), `src/hooks/*` (18) | Session, theme, connectivity, per-feature data | No Redux/Query; Context + hooks only |
| **RN Client — Data access** | `src/api/*` (11 files) | HTTP calls to Express | **Two HTTP wrappers** (`client.ts`, `authFetch.ts`) |
| **RN Client — Navigation** | `src/navigation/*` (5) | Root + Caregiver/Patient/Onboarding navigators | `RootNavigator.tsx` is 887 LOC |
| **Cross-cutting (client)** | `src/utils/reminderEvents.ts`, `src/providers/PurchasesProvider.tsx`, `src/lib/*` | Pub/sub bus, RevenueCat, HomeKit/biomarkers/eventBatcher | Global mutable singletons |
| **Shared** | `src/types/index.ts` | TS types used by both client & server | Only true shared surface |
| **Server — entry** | `src/server.ts` | Express app, helmet/cors/rate-limit, mounts ~30 routers | Single process |
| **Server — routes** | `src/server-routes/*` (52) | REST endpoints, zod-validated | Clean per-feature split |
| **Server — core** | `src/server-core/*` (18) | db, config, security/token cache, seatResolver, memory, liveBridge | DI-free, direct imports |
| **Server — jobs** | `src/server-jobs/*` (11) | node-cron: pattern inference, visit prep, daily summary | Started by `scheduler.ts` |
| **External** | — | Supabase (JWT), MongoDB Atlas, Groq, Gemini, Mem0, RevenueCat | AI keys server-only |

### Data Flow

```
Supabase (login) ──JWT──► AuthContext.setAuthToken() ─┐
                                                       ├─► api/client.ts singleton (authToken)
                          AuthContext.setAuthFetchToken()└─► api/authFetch.ts singleton (_authToken)
                                                       │
  Screen ── useRoutine/useMeds/... ──► api/* ──fetch(Bearer JWT)──► Express (server.ts)
                                                       │                    │
                                                       │           server-core/security (verify+cache JWT)
                                                       │                    │
                                                       │           server-routes/* (zod) ──► MongoDB Atlas
                                                       │                    │
                                                       │           AI: Groq/Gemini/Mem0 (server-only)
  401 ◄──────────────────────────────────────────────┘ onAuthExpired() → sign out
  offline ◄── onNetworkChange() → NetworkContext banner; GET falls back to AsyncStorage cache
  AI creates task/med/reminder ──► VisionSheet.triggerTaskReload() ──► reminderEvents bus ──► TodayScreen.reload()
```

### State management

No global store. State lives in **3 Contexts** (`AuthContext`, `ThemeContext`, `NetworkContext`) plus **18 feature hooks**. Each data hook independently fetches and 4 of them (`useDashboardData`, `useHelpAlert`, `useNotes`, `usePatients`) poll on their own `setInterval`. There is **no shared request cache, dedup, or invalidation layer** (`grep` for react-query/swr/zustand/redux/jotai = NONE). Cross-component "data changed" signaling is bolted on via the global `reminderEvents` callback bus rather than via shared cache invalidation.

### Before / After (target architecture)

| Concern | Today | Recommended |
|---|---|---|
| HTTP layer | 2 wrappers, 2 token singletons | 1 `apiClient` module, 1 token source |
| Server data sync | 16 independent fetch hooks + 4 pollers + manual pub/sub | React Query (cache, dedup, invalidation) — pub/sub disappears |
| God screens | TodayScreen 1030, RootNavigator 887 | Extract sub-components, move push/notif setup to a service/provider |
| Repo layout | 1 package.json (client+server deps mixed) | npm/pnpm workspaces: `packages/app` + `packages/server` + `packages/shared-types` |
| Cross-component events | mutable module singletons | query invalidation / typed EventEmitter |

---

### [ARCH-01] Two parallel HTTP layers each with a duplicated token singleton
**Severity:** High · **Effort:** Medium
- **Issue / root cause:** There are two independent fetch wrappers — `api/client.ts` (rich: timeout, cold-start retry, offline AsyncStorage cache, 401 handling, network callback) and `api/authFetch.ts` (thin: just injects the token). Each holds its **own** module-level mutable token (`authToken` in client.ts:18, `_authToken` in authFetch.ts:3), and `AuthContext` must remember to update **both** on every auth transition (`setAuthToken` + `setAuthFetchToken` called together 6 times in `AuthContext.tsx`). 16 files use `authFetch`, 23 use `client`. The `authFetch` path silently loses all of client.ts's resilience (no cold-start retry, no offline cache, no 401→sign-out, no network banner) — so newer features (seats, health, patterns, voice, reports) behave differently offline than older ones, and a future call site that forgets one `set*` leaves a stale/empty token.
- **Recommendation / refactor:** Collapse to one HTTP module. Keep client.ts's resilience as the base `request()`, expose a single `authFetch`-style raw-Response variant from the same module sharing one token cell, and delete `authFetch.ts`. `AuthContext` then calls a single `setAuthToken`. Migrate the 16 `authFetch` callers (mechanical).
- **Evidence:** `src/api/authFetch.ts:3-7`; `src/api/client.ts:18,22`; `src/context/AuthContext.tsx:74,125,156,188,225,256`

### [ARCH-02] `TodayScreen.tsx` (1030 LOC) is a god component conflating ~6 responsibilities
**Severity:** High · **Effort:** Large
- **Issue / root cause:** A single function component wires **4 data hooks** (`useRoutine`, `useMeds`, `useReminders`, `useHelpAlert`, `useNotes`), **23 `useState`**, a live clock interval, two `Animated.Value` slide-panel animations, an add-task modal, a notes-history modal, the `reminderEvents` registration, direct `updateRoutine`/`authHeaders` API calls (bypassing its own hooks), and a `StyleSheet.create` block starting at line 217 (~800 LOC of layout). Greeting logic, notification panel, task CRUD, med CRUD and reminders all live in one render tree. This is unreviewable, untestable (zero RN component tests exist), and any change risks unrelated regressions.
- **Recommendation / refactor:** Decompose into `<TodayHeader>`, `<TaskList>`, `<MedList>`, `<NotificationPanel>`, `<AddTaskModal>`, each owning its slice; lift the live clock to a `useClock` hook; move styles to a colocated `TodayScreen.styles.ts`. Target <250 LOC for the screen container. Same pattern applies to `RootNavigator.tsx` (887 — see ARCH-03), `FacesScreen.tsx` (613), `SideDrawer.tsx` (593), `VisionSheet.tsx` (588), `PatientDetailScreen.tsx` (583).
- **Evidence:** `src/screens/patient/TodayScreen.tsx:1,51,56-117,217` (23 `useState`, styles at 217)

### [ARCH-03] `RootNavigator.tsx` (887 LOC) mixes navigation with push registration, deep-links, app-state and an inline Header
**Severity:** High · **Effort:** Large
- **Issue / root cause:** Beyond defining the Caregiver/Patient stacks, this one file owns: `Notifications.setNotificationHandler` config (line 66), **two** separate push-token registration `useEffect` blocks with permission prompts and Android channels (lines 170 & 219), foreground deep-link URL handling (line 132), network wiring `setOnNetworkChange` (line 156), animated FAB "ring" pulse logic (lines 426-461), and an entirely inlined `Header` component with its own `StyleSheet` (lines 802-887). Navigation structure is buried under cross-cutting platform concerns. The duplicated push-registration logic is a latent bug source.
- **Recommendation / refactor:** Extract `usePushRegistration()` hook (collapse the two blocks into one), a `<NotificationsProvider>` for the handler/channels, a `useDeepLinks()` hook, and move `Header` to `src/components/`. RootNavigator should shrink to the navigator tree + provider wiring (~200 LOC).
- **Evidence:** `src/navigation/RootNavigator.tsx:66,132,156,170,219,426,802`

### [ARCH-04] Global mutable pub/sub (`reminderEvents.ts`) used as a cross-component event bus
**Severity:** Medium · **Effort:** Medium
- **Issue / root cause:** `reminderEvents.ts` exposes four module-level mutable callback slots (`_reminderReloadCb`, `_taskReloadCb`, `_medReloadCb`, `_onboardingResetCb`), each a **single-subscriber** register/trigger pair. `VisionSheet` calls `triggerTaskReload()` after the AI creates an item; `TodayScreen` registers the reload. This is a hidden, untyped, single-listener global that breaks silently if two screens register, if the producer fires before the consumer mounts (the trigger is a no-op), or if the consumer unmounts without unregistering (stale closure pointing at a dead component). It exists only because there is no shared cache to invalidate.
- **Recommendation / refactor:** Eliminate it by adopting React Query (ARCH-06) and replacing `triggerTaskReload()` with `queryClient.invalidateQueries(['routines'])` — the bus disappears entirely. If a store is not adopted near-term, at minimum replace with a typed multi-subscriber `EventEmitter` returning an unsubscribe function used in `useEffect` cleanup.
- **Evidence:** `src/utils/reminderEvents.ts:2-43`; producers `src/components/VisionSheet.tsx:145-147`; consumers `src/screens/patient/TodayScreen.tsx:60-62`

### [ARCH-05] Client and server share one `package.json` (64+9 deps mixed) — no workspace boundary
**Severity:** Medium · **Effort:** Large
- **Issue / root cause:** A single `package.json` (`"main": "index.ts"`, no `workspaces` field) mixes client deps (`react-native`, `expo-*`, `@react-navigation`) with server deps (`express`, `mongodb`, `helmet`, `multer`, `pdfkit`, `nodemailer`, `node-cron`, `ws`). The Render deploy ships the entire RN/Expo dependency tree it never uses, and the Metro bundler's dependency graph is polluted with Node-only packages. The `dev`/`tunnel` scripts even start the backend and Expo together in one process tree. The code boundary is clean today, but nothing *enforces* it — one accidental `import "mongodb"` in a screen would only fail at Metro bundle time, and dead-weight server deps inflate the mobile install footprint.
- **Recommendation / refactor:** Split into npm/pnpm workspaces: `packages/app` (Expo), `packages/server` (Express), `packages/shared` (the `src/types` surface — currently the only legitimately shared code). This makes the boundary structural, slims each install, and lets server CI run `tsc` independently (today the build skips `tsc`, hiding ~14 type errors). Large move but high long-term leverage; can be staged behind the dependency-hygiene cleanup.
- **Evidence:** `package.json:4` (`"main": "index.ts"`, no `workspaces`); scripts `package.json:6-7`; server entry `src/server.ts:2-31`

### [ARCH-06] ~16 hooks fetch/poll independently with no shared cache, dedup, or invalidation
**Severity:** Medium · **Effort:** Large
- **Issue / root cause:** State is Context (3) + hooks (18) with **no** data-layer library (confirmed: react-query/swr/zustand/redux/jotai all absent). Each data hook owns its own loading/error/data and refetch logic; four (`useDashboardData`, `useHelpAlert`, `useNotes`, `usePatients`) run their own `setInterval` pollers. Consequences: the same endpoint is fetched and cached independently by multiple mounted screens (no request dedup), there is no central staleness/invalidation (hence the `reminderEvents` hack), and offline caching is reimplemented ad-hoc inside `client.ts` rather than as a real cache. At ~24k LOC and growing, this is the size where hand-rolled fetch hooks start producing inconsistent UI and duplicate network traffic. Context+hooks is the *right* call for genuinely global state (auth/theme/network) — it is the wrong call for *server* state.
- **Recommendation / refactor:** Adopt **TanStack Query (React Query)** for all server-derived data: replaces the bespoke fetch/loading/error/poll/cache code in the 16 hooks, gives free dedup + background refetch + invalidation (killing ARCH-04), and keeps the existing client.ts as the `queryFn`. Keep the 3 Contexts for true global UI state. Do *not* introduce Redux — it would be over-engineering at this scale.
- **Evidence:** `package.json` (no data lib); pollers `src/hooks/useDashboardData.ts`, `useHelpAlert.ts`, `useNotes.ts`, `usePatients.ts` (all `setInterval`)

### [ARCH-07] Dependency injection is absent — auth wiring relies on imperative module singletons set at the right time
**Severity:** Low · **Effort:** Medium
- **Issue / root cause:** There is no DI; modules import each other directly and shared state is module-level mutable singletons (`authToken`, `onAuthExpired`, `onNetworkChange` in client.ts; `_authToken` in authFetch.ts). Correctness depends on `AuthContext` and `RootNavigator` calling `setAuthToken`/`setOnAuthExpired`/`setOnNetworkChange`/`setAuthFetchToken` in the right order at mount. This is a temporal-coupling trap: a code path that issues a request before these are wired sends an unauthenticated call, and it is invisible to the type system. (No import cycle exists today — client.ts does not import context — so the risk is wiring order, not circularity.)
- **Recommendation / refactor:** Wrap the token + callbacks in a small `ApiSession` object created once and passed via a Context/provider (or have `request()` read the token from a single getter that AuthContext owns). This removes the "did everyone remember to call the setter" failure mode and naturally folds into the ARCH-01 single-HTTP-layer consolidation.
- **Evidence:** `src/api/client.ts:18-32`; `src/api/authFetch.ts:3-7`; wiring scattered across `src/context/AuthContext.tsx:118-256` and `src/navigation/RootNavigator.tsx:156`
