# Vela Vision — Engineering Due-Diligence Review

**Date:** 2026-06-16 · **Stack:** React Native/Expo (TypeScript) client + Express/TypeScript backend + MongoDB Atlas + Supabase (NOT native iOS/Swift) · **Reviewer lens:** Principal iOS/RN architect + Staff engineer + Security + App Store + Performance + Code-quality auditor.

> Correction vs draft: `tsc --noEmit` currently exits **0** (clean) — the "~14 type errors" figure some sections cite was a stale snapshot; the *process* finding (the build/CI never runs `tsc`) still stands. A `typecheck` npm script was added as part of the Step-15 changes.

---

# Engineering Due Diligence — Vela Vision (Cross-Cutting Summary)

> Scope: RN/Expo (TypeScript) client + Express/TypeScript backend (one repo), MongoDB Atlas, Supabase auth, Render hosting, AI via Groq/Gemini/Mem0 (server-side). ~185 TS/TSX files, ~24.3k LOC in `src/`. Reviewed 2026-06-16. Findings below are grounded in `file:line` evidence; the per-dimension detail files live alongside this summary. The product/UX review (`docs/Vela-Vision-Product-Review-2026-06-16.md`) is intentionally **not** repeated here.

## Executive Summary (engineering)

Vela Vision is a functionally broad, fast-moving product (caregiver SaaS + patient app + AI assistant + HealthKit + voice + geofencing + livestream) carried on a structurally thin engineering foundation. The single most important finding is a **process gap, not a code gap**: the build never runs `tsc`, has no lint, and has no CI — Metro/Babel only strip types, so the ~14 pre-existing type errors in committed code ship silently (CQ-1). Everything downstream (god components, dead code, doc/code drift) is a symptom of having no automated gate to catch regressions.

The architecture is coherent at the boundary level — client code never imports server modules, the Express layer is consistently Zod-validated with `ObjectId.isValid` guards, and the recent hardening PRs (SOS queue, escalation engine, AI med-safety, opt-in consent) show real safety maturity. But the interior is brittle: client and server share **one `package.json` (64 runtime deps, no workspaces)**; six god components (TodayScreen 1030 LOC, RootNavigator 887, FacesScreen 613, SideDrawer 593, VisionSheet 588, PatientDetailScreen 583) concentrate state, styles, navigation, push-registration and deep-links; **two parallel HTTP layers** (`client.ts` + `authFetch.ts`) each maintain a duplicated token singleton wired by imperative call-order; and **~16 hooks each poll independently** with no shared cache, dedup, or invalidation, papered over by a global mutable pub/sub event bus (`reminderEvents.ts`).

The two existential risks are **security/privacy** and **App-Store approval**, both on safety-critical surfaces. An **unauthenticated Gemini Live WebSocket** (`liveBridge.ts`) is an open AI relay and PHI-exfiltration vector; patient PHI is shipped to Groq/Mem0/Gemini with **no consent gate, no disclosure, and no BAA/DPA evidence**; Supabase JWTs sit in plaintext AsyncStorage; and a pharma data-licensing business model is stated with **zero de-identification code** behind it. On the store side, `expo-location` requests background permission with **no iOS usage string and no caller** (guaranteed crash + rejection), several permissions (Mic/HomeKit/Motion) are declared for coming-soon features, the AI is prompted to **deny that it is AI** while processing health input, and the privacy manifest is empty and gitignored. Observability is effectively zero: no crash reporting wired anywhere (Sentry only in comments), ~150 raw `console.*` calls (several logging `patientId`/`userId`), and a safety-critical escalation cron running on a Render free-tier node that sleeps when idle.

None of this is fatal, and much is small-effort: the highest-ROI fixes (CI+tsc, remove dead WebRTC SDKs, fix the location permission, gut the unauthenticated WS, wire Sentry) are days, not weeks. But the gap between product ambition and engineering plumbing is wide, and the absence of any client-side test or type gate means velocity is currently being bought on credit.

## Code Quality Scorecard

| Dimension | Score | Justification |
|---|---|---|
| Architecture | 5/10 | Clean client/server boundary and consistent route validation, but two HTTP layers, no workspace split, and 16 uncoordinated pollers undercut it (ARCH-01, ARCH-05, ARCH-06). |
| Maintainability | 4/10 | Six 580–1030 LOC god components concentrate ~6 responsibilities each; refactors are blocked by zero component tests (CQ-2, CQ-3, ARCH-02). |
| Readability | 6/10 | DM-Sans/theme tokens are disciplined, but `useMemo(StyleSheet.create,[colors])` ceremony is copy-pasted across 48 files and ~1,500 LOC of card/modal styles are re-declared (CQ-4, CQ-5). |
| Scalability | 4/10 | In-process `node-cron` assumes a single instance — scaling >1 node fires duplicate SOS escalations and emails on a safety path (DEP-8, RPT-4). |
| Security | 3/10 | Unauthenticated Gemini Live WS, PHI to third-party AI with no consent/BAA, plaintext JWT storage — two Critical + two High on PHI surfaces (SEC-01, SEC-02, SEC-03, SEC-04). |
| Performance | 6/10 | Context values rebuilt every render and unmemoized god components, but no egregious hot loops; charts render on JS thread (RPT-5, RPT-7, RPT-8). |
| Testing | 3/10 | ~142 vitest tests cover backend/pure logic only; **zero** RN component/hook tests — the riskiest files (SOS, escalation, optimistic toggles) are untested (CQ-10, RPT-2). |
| Accessibility | 6/10 | An AA-contrast pass landed recently; deeper a11y (focus order, screen-reader labels) unverified — out of engineering scope here, covered in product review. |
| Reliability | 4/10 | Idempotent escalation logic is good, but it runs on a sleeping free-tier cron with no dead-man's-switch, and there's no crash reporting to know when anything fails (RPT-1, RPT-4). |
| App Store Readiness | 3/10 | Guaranteed-crash background-location permission with no usage string, coming-soon permissions, empty gitignored privacy manifest, AI-denies-it's-AI prompt (DEP-2, AC-1, AC-2, AC-3, AC-6). |
| Developer Experience | 3/10 | No CI, no typecheck, no lint, no client tests; one mixed `package.json`; correctness rests on manual review (CQ-1, ARCH-05, DEP-3). |
| Technical Debt | 4/10 | Dead `glassesMockData.ts` (294 LOC), dead WebRTC SDKs (~4MB), doc/code drift on RoutineScreen, 14 latent type errors — accumulating but bounded (CQ-6, CQ-7, DEP-1). |
| Dependency Health | 4/10 | 64 runtime deps mixing client+server, `@types/*` and `@expo/ngrok` misfiled as runtime, deprecated `expo-av`, ~4MB unused native WebRTC (DEP-1, DEP-3, DEP-4, DEP-5). |

## Top 50 Improvements (ranked by impact-to-effort)

Ranked by impact ÷ effort. Critical/High-severity Small/Medium-effort items rise to the top.

1. Fix `expo-location` background permission: add NSLocation usage strings or gate the call behind a flag — prevents a guaranteed runtime crash + App-Store rejection (DEP-2, AC-3).
2. Add `typecheck: tsc --noEmit` + ESLint + a minimal GitHub Action gating PRs (~1 hr; surfaces the 14 latent type errors) (CQ-1).
3. Authenticate the Gemini Live WebSocket — short-lived signed session token validated at WS upgrade; do not ship voice until closed (SEC-01).
4. Wire `@sentry/react-native` (App.tsx + ErrorBoundary + SOS failure branches) and `@sentry/node` (server error + unhandledRejection) — highest-ROI reliability fix (RPT-1).
5. Delete the "Never mention that you are AI" clause from the Vision system prompt; add a one-time AI/not-medical-advice disclosure (AC-1).
6. Remove `@daily-co/react-native-daily-js` + `@daily-co/react-native-webrtc` (~4MB native, 0 imports) — also removes an unused-permission rejection vector (DEP-1, RPT-6).
7. Strip Mic/HomeKit/Motion permission strings for coming-soon features; re-add only in the version that ships the working flow (AC-2).
8. Move `@expo/ngrok` and six `@types/*` packages out of runtime `dependencies` into `devDependencies` (DEP-4).
9. Delete dead `glassesMockData.ts` (294 LOC) and the genuinely-dead `MedsScreen.tsx`; add a `knip`/`ts-prune` step (CQ-6, CQ-7).
10. Add an AI/memory consent category and gate the assistant + memory routes on it (currently consent covers only health/activity) (SEC-02).
11. Make `REVENUECAT_WEBHOOK_SECRET` and `CRON_SECRET` required (fail-fast) in prod; confirm signature + constant-time comparison (SEC-07).
12. Move the escalation cron off the sleeping free-tier node-cron to an external always-on trigger + dead-man's-switch monitor (RPT-4, DEP-8).
13. Memoize `ThemeContext`/`AuthContext` provider values (`useMemo`) — one-line, app-wide re-render reduction (RPT-5).
14. Back Supabase session + pending-invite token with `expo-secure-store` instead of plaintext AsyncStorage (SEC-04).
15. Resolve the RoutineScreen doc/code drift: either remove the live tab or fix CLAUDE.md (CQ-7).
16. Fix the zone-exit notification to fan out via `getCaregiverPushTokens` instead of a single nondeterministic `findOne` (RPT-9).
17. Declare `ITSAppUsesNonExemptEncryption: true` + standard exemption for an HTTPS/JWT app (AC-4).
18. Pause the 15s dashboard poll when `AppState !== active` / screen unfocused (mirror useHelpAlert pattern) (RPT-10).
19. Move the privacy manifest into source via `ios.privacyManifests` in app.json and populate `NSPrivacyCollectedDataTypes` (AC-6).
20. Collapse the two parallel HTTP layers: keep `client.ts`, expose a raw-Response variant on one token cell, delete `authFetch.ts`, migrate 17 callers (ARCH-01, ARCH-07).
21. Soften HealthKit/HomeKit purpose strings from clinical "monitor"/"detect sundowning" to wellness framing (AC-7).
22. Smoke-test then remove unused polyfills (`react-native-url-polyfill`, `react-native-get-random-values`) and `react-native-web`/`concurrently` if confirmed unused (DEP-6, DEP-7).
23. Reconcile `UIBackgroundModes` with HealthKit background delivery — add entitlement or remove `enableBackgroundDelivery()` (AC-5).
24. Extract one `applyAlertUpdate()` helper from the three near-identical help-alert mutation routes (one place to audit alert authz) (CQ-9).
25. Introduce a `useThemedStyles(factory)` hook to kill the `[colors]` dep-array footgun across 48 files (CQ-4).
26. Add `src/config/styles.ts` factories (card/sectionLabel/pill/modalSheet) and adopt `SectionHeader` everywhere (~1,500 LOC collapse) (CQ-5).
27. Introduce a `pino` structured logger with `patientId`/`userId`/`email` redaction; replace ~150 `console.*`; strip client logs in prod (CQ-8, RPT-3, SEC-08).
28. Always derive `patientId` from `req.seat`/`req.auth`, enforce `z.string()` on external ids, add mongo-sanitize middleware (SEC-09).
29. Add a Supabase token-cache deny-list/eviction hook + hash tokens as map keys; document the 5-min revocation window (SEC-06).
30. Migrate `useVoiceSession` off deprecated `expo-av` to `expo-audio` before the next SDK upgrade forces it (DEP-5).
31. Move face images to encrypted object storage with signed expiring URLs + retention tied to person deletion (or store embedding only) (SEC-05).
32. Decompose TodayScreen (1030 LOC) into header/task/med/notification/modal components + `useClock` hook (CQ-2, ARCH-02, RPT-7).
33. Decompose RootNavigator (887 LOC): `usePushRegistration`, `useInviteDeepLink`, `<UrgentAlertOverlay>`, `<VisionFab>` (CQ-3, ARCH-03).
34. Add `@testing-library/react-native` + `jest-expo`; first wave on SOS send/ack/escalation + optimistic-toggle rollback (CQ-10, RPT-2).
35. Replace the global mutable `reminderEvents.ts` bus with React Query `invalidateQueries` (or a typed multi-subscriber emitter) (ARCH-04).
36. Adopt TanStack Query for all 16 server-derived hooks — free dedup/refetch/invalidation, kills ARCH-04, reuses `client.ts` as queryFn (ARCH-06).
37. Scrub `userId`/`patientId` from the account-deletion logs; fail (don't return `success:true`) when service-role key is missing (AC-8).
38. Build explicit revocable licensing consent + a real Safe-Harbor de-identification step before any pharma export; legal review (SEC-03).
39. Execute BAAs/DPAs with Groq/Mem0/Google (or self-host) and minimize the PHI payload to each (SEC-02).
40. Confirm Supabase RLS is enabled least-privilege on every table; treat the bundled anon key as public (SEC-10).
41. Downsample/memoize/lazy-mount gifted-charts to avoid JS-thread frame drops on wellness cards (RPT-8).
42. Decompose the remaining god components (FacesScreen 613, SideDrawer 593, VisionSheet 588, PatientDetailScreen 583) to <250 LOC (ARCH-02).
43. Split the repo into npm/pnpm workspaces: `app` / `server` / `shared` (Render stops installing the mobile native graph) (ARCH-05, DEP-3).
44. Document the single-instance cron constraint until the leader-lock/external scheduler lands (DEP-8).
45. Wrap auth token + callbacks in a single `ApiSession`/Context to remove temporal-coupling wiring order (folds into ARCH-01) (ARCH-07).
46. Add a `babel-plugin-transform-remove-console` for production client builds (CQ-8).
47. Extract a reusable `<ItemFormModal>` from the three near-identical TodayScreen modals (CQ-2).
48. Add a CI `knip`/`ts-prune` orphan-detection step to prevent future dead code (CQ-6).
49. Add patient-vs-caregiver navigation-gating tests and the consent-gate test (RPT-2).
50. Lift `allItems`/`doneItems` stat computation to a single `useMemo` (currently duplicated IIFEs at TodayScreen :803-823 and :870-884) (CQ-2).

(50 distinct, evidence-backed items — no padding.)

## Refactor Roadmap

**Quick Wins (1–3 days)**
- Fix the `expo-location` background permission crash/rejection (DEP-2, AC-3).
- Add `tsc --noEmit` + ESLint + a GitHub Action gating PRs; triage the 14 latent type errors (CQ-1).
- Remove dead WebRTC SDKs, `glassesMockData.ts`, dead `MedsScreen.tsx`, misfiled `@types/*` + `@expo/ngrok` (DEP-1, DEP-4, CQ-6, CQ-7, RPT-6).
- Strip coming-soon permission strings; soften clinical purpose strings; fix the encryption declaration (AC-2, AC-7, AC-4).
- Delete the "never mention you are AI" prompt clause (AC-1).
- Make webhook/cron secrets required; memoize Context provider values; gate the dashboard poll on AppState (SEC-07, RPT-5, RPT-10).
- Wire Sentry on client + server (RPT-1).

**Short-term (1–2 weeks)**
- Authenticate the Gemini Live WS; add an AI/memory consent gate + in-app disclosure (SEC-01, SEC-02, AC-1).
- Move Supabase session/invite token to SecureStore (SEC-04).
- Move escalation cron to an always-on trigger + dead-man's-switch; fix the zone-exit fan-out (RPT-4, RPT-9, DEP-8).
- Collapse the two HTTP layers into one token cell; delete `authFetch.ts` (ARCH-01, ARCH-07).
- Introduce `pino` + redaction; replace `console.*`; populate the source-controlled privacy manifest (CQ-8, RPT-3, SEC-08, AC-6).
- Extract `applyAlertUpdate()`, `useThemedStyles`, and `src/config/styles.ts` factories (CQ-9, CQ-4, CQ-5).

**Medium-term (1–2 months)**
- Decompose the six god components, starting with TodayScreen + RootNavigator (CQ-2, CQ-3, ARCH-02, ARCH-03, RPT-7).
- Stand up `@testing-library/react-native` and cover SOS/escalation/consent/optimistic-toggle paths (CQ-10, RPT-2).
- Adopt TanStack Query across the 16 hooks; delete the `reminderEvents` bus (ARCH-06, ARCH-04).
- Migrate `expo-av` → `expo-audio`; encrypt face-image storage (DEP-5, SEC-05).
- Token-cache invalidation hook + id-source hardening + mongo-sanitize (SEC-06, SEC-09).

**Long-term**
- Split into npm/pnpm workspaces (`app`/`server`/`shared`) so CI runs server `tsc` independently and Render stops installing the mobile graph (ARCH-05, DEP-3).
- Build the data-licensing privacy plumbing: revocable consent, Safe-Harbor de-identification, executed BAAs/DPAs, honest App Privacy label, legal review (SEC-03, SEC-02).
- Move in-process scheduling to a leader-lock/external scheduler to enable horizontal scaling on the safety-critical path (DEP-8).

## Dependency Removal Candidates

| Package | Why | Evidence | Action |
|---|---|---|---|
| `@daily-co/react-native-daily-js` | 0 imports; livestream "coming soon"; ~1.1MB+288KB native | package.json:18-19; 0 `@daily-co` imports in src | Uninstall now (keep server `streamSessions.ts` REST) (DEP-1) |
| `@daily-co/react-native-webrtc` | 0 imports; ~2.6MB native compile step | package.json:18-19 | Uninstall now (DEP-1) |
| `react-native-web` | 0 src imports; camera unsupported on web anyway | package.json:78 | Uninstall (re-add for web preview) (DEP-7) |
| `concurrently` | Referenced by no script (scripts use shell `&`) | package.json:88 | Uninstall or wire into `scripts.dev` (DEP-7) |
| `react-native-url-polyfill` | 0 import hits; supabase client built without it | package.json:77; supabase.ts:1-10 | Smoke-test login, then uninstall (DEP-6) |
| `react-native-get-random-values` | 0 import hits | package.json:70 | Smoke-test login, then uninstall (DEP-6) |
| `@expo/ngrok` | Dev tunnel tool misfiled in runtime deps | package.json:22 | Move to devDependencies (DEP-4) |
| `@types/cors,express,multer,node-cron,pdfkit,ws` | Build-only types in runtime deps | package.json:31-36 | Move to devDependencies (DEP-4) |
| `expo-av` | Deprecated in SDK 54; gates voice | package.json:40; useVoiceSession.ts:2 | Migrate to `expo-audio`, then remove (DEP-5) |

Estimated immediate win from items 1–4: ~4MB native code + a native compile step removed, plus one closed App-Store unused-permission vector.

## Final Architecture Score and App Store Readiness Score

**Architecture: 5/10.** The macro boundary is genuinely good — client never imports server code, every Express route is Zod-validated with `ObjectId.isValid` guards, and the recent safety hardening is real. But the score is dragged down by structural debt that compounds: two parallel HTTP layers wired by call-order (ARCH-01), one `package.json` mixing 64 client+server deps with no workspace boundary (ARCH-05), 16 hooks polling independently with a global mutable event bus as the coordination mechanism (ARCH-06, ARCH-04), and six god components that make the system hard to change safely (ARCH-02, ARCH-03). It is a sound skeleton with brittle connective tissue.

**App Store Readiness: 3/10.** There is at least one guaranteed-rejection-and-crash item live today: `expo-location` requests background permission with no NSLocation usage string and no caller (DEP-2, AC-3). Compounding it: Mic/HomeKit/Motion permissions declared for coming-soon features (AC-2), an empty gitignored privacy manifest with no collected-data declaration (AC-6), an AI system prompt instructed to deny it is AI while handling health input (AC-1), a likely-false encryption declaration (AC-4), and a manifest/HealthKit background-mode mismatch (AC-5). Every one of these is Small effort, so the score can move to ~7/10 within the Quick Wins window — but as it stands today, a reviewer would bounce this build.

## Engineering Verdict

This is a product that has run far ahead of its engineering process. The codebase is not incompetent — the client/server boundary is clean, routes are uniformly Zod-validated, and the recent SOS/escalation/consent hardening shows the team can build safety-critical features carefully. But the absence of any automated gate is the root cause behind most findings: there is no CI, no lint, and the build never runs `tsc`, so 14 type errors and a pile of dead code ship invisibly, and the riskiest files have zero tests to refactor against. The two areas that should worry leadership most are security/privacy and App-Store approval, because both sit on safety-critical, PHI-bearing surfaces — an unauthenticated AI WebSocket, PHI shipped to three third-party AI vendors with no consent gate or BAA evidence, plaintext JWT storage, and a pharma-data-licensing business model with literally zero de-identification code behind it. On the store side there is at least one guaranteed crash-and-rejection (background location with no usage string and no caller). The good news is that the highest-impact fixes are cheap: CI+tsc, removing ~4MB of dead WebRTC SDKs, fixing the location permission, authenticating the WS, and wiring Sentry are all days of work, not weeks. The god components and missing test suite are the expensive, slow-burn debt that will throttle velocity if left, but they are not blocking today. Net: a fundable, fixable codebase whose biggest liability is process discipline, not raw skill — but the privacy/compliance posture must be closed before any data-licensing or voice feature is allowed to ship.

## VC Technical Due-Diligence Concern

The thing a DD team would flag first is the **privacy/compliance posture on PHI**, because it is simultaneously a legal liability and the foundation of two of the three stated revenue streams: patient health data is shipped to Groq, Mem0, and Gemini with no consent gate, no in-app disclosure, and no evidence of executed BAAs/DPAs, while the deck monetizes "de-identified" data licensing with zero de-identification code in the repo — that is a misrepresentation-and-HIPAA-exposure cocktail that can sink an acquisition or trigger regulatory action. Second, they would distrust **velocity claims**, because there is no CI, no typecheck in the build, 14 known type errors in committed code, and zero client-side tests — meaning the team has been shipping a healthcare app on manual review alone, and any reported burn-down rate is uninsured against regression. Third, the **single-instance, free-tier-cron escalation path on a life-safety SOS feature** is a reliability and scaling landmine: it sleeps when idle, has no monitoring, and fires duplicate alerts the moment you scale past one node. Fourth, the **bus-factor and architecture risk** — six god components (one over 1,000 LOC), a global mutable event bus, and two competing HTTP layers — signals that institutional knowledge lives in a few heads and that refactoring is dangerous without the missing test net. Finally, the **App-Store approval risk is concrete, not theoretical** (a guaranteed-crash location permission, coming-soon permissions, an AI told to hide that it's AI), which directly threatens the distribution channel the whole business depends on. None of these are unfixable, but together they say "promising product, immature engineering governance" — and on a healthcare data play, governance is exactly what a DD team will not give a pass on.


---

# Detailed Findings by Dimension


---

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


---

## Code Quality, Complexity & Tech Debt

The codebase is competently written and internally consistent — a single design-system, one obvious convention for every screen, and a clean client/server boundary — but it carries the structural debt of a fast-moving solo/small-team product. The defining problem is **scale-by-copy-paste**: a 1,030-line `TodayScreen`, an 887-line `RootNavigator` that mixes navigation, push registration, deep-link parsing and a full urgent-alert UI in one file, and the `useMemo(() => StyleSheet.create({...}), [colors])` block duplicated across **48 files** (often 100–360 lines of near-identical card/header/section-label/modal styles per file). There is **no `tsc`, lint, or CI in the build pipeline at all** — Metro/Babel strip types, so any type error or dead import ships silently; this is the single highest-leverage gap because it removes the cheapest possible safety net from a healthcare app. Dead code is real but modest (`glassesMockData.ts` 294 LOC fully orphaned; `RoutineScreen.tsx` 436 LOC still mounted as a live tab despite CLAUDE.md declaring it removed). None of this is a blocker, but left unchecked it compounds: every new screen today costs ~150 lines of boilerplate and every refactor touches a 1,000-line file.

> **Correction to the brief:** The "14 pre-existing `tsc` errors" claim does **not** reproduce on the current `main` tree — `npx tsc --noEmit --strict` (TS 5.9.3, `strict: true` via `expo/tsconfig.base`) returns **0 errors**. The errors were likely fixed in this session's hardening PRs. The *structural* finding still stands and is arguably worse: because `tsc` never runs in the build, those 14 errors lived in committed code undetected — and the next 14 will too.

### System map — the six God components

| File | LOC | Responsibilities crammed in | What it should be |
|---|---|---|---|
| `src/screens/patient/TodayScreen.tsx` | 1,030 | greeting, hero card, mood check-in, caregiver notes, meds card, tasks card, notification slide-panel, add-task modal, edit-task modal, add-med modal, chooser sheet — 9 `useState` modals + ~330 lines of `StyleSheet` | A 150-line screen composing `<MedsCard>`, `<TasksCard>`, `<NotifPanel>`, `<AddItemModals>` |
| `src/navigation/RootNavigator.tsx` | 887 | routing, splash, onboarding gate, deep-link/invite parsing (2 effects), caregiver+patient push-token registration (2 effects, ~80 lines), urgent-alert overlay with 3 pulse animations, notif panel, header | Pure navigator (~120 LOC) + extracted `usePushRegistration`, `useInviteDeepLink`, `<UrgentAlertOverlay>` |
| `src/screens/caregiver/PatientDetailScreen.tsx` | 583 | — | — |
| `src/screens/patient/FacesScreen.tsx` | 613 | — | — |
| `src/components/SideDrawer.tsx` | 593 | — | — |
| `src/components/VisionSheet.tsx` | 588 | consent gate, keyboard tracking, pan-gesture snap, chat list, input bar, ~210 lines of style | Split consent screen + chat into 2 components |

### Duplication inventory (ranked by payoff)

| Pattern | Occurrences | Est. duplicated LOC | Fix |
|---|---|---|---|
| `useMemo(() => StyleSheet.create({...}), [colors])` wrapper | **48 files** | ~200 (the boilerplate) | `useThemedStyles(factory)` hook |
| Card / header / section-label / pill / modal-sheet style blocks | ~20+ screens | ~1,500–2,500 | shared `cardStyles(colors)`, reuse existing `<SectionHeader>` |
| Help-alert state mutation routes (`dismiss`/`resolve`/`acknowledge`) | 3 routes, 1 file | ~90 | one `updateAlert` helper |
| Optimistic toggle handlers (`toggleComplete`/`toggleTaken`/`toggleTaken`-style) | ~4 hooks | ~120 | generic `useOptimisticToggle` |
| Add/Edit modal JSX in `TodayScreen` (task/edit-task/med) | 3 blocks | ~120 | one `<ItemFormModal>` |
| Vision FAB (LinearGradient + Ionicons) | 2 copies in `RootNavigator` (lines 330, 649) | ~30 | `<VisionFab>` component |

---

### Before / after — high-value simplification #1: `useThemedStyles`

Every one of 48 screens repeats this ceremony, and forgetting the `[colors]` dep silently breaks dark mode:

```tsx
// BEFORE — in 48 files
const styles = useMemo(() => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  /* ...80–360 lines... */
}), [colors]);
```

```tsx
// AFTER — src/hooks/useThemedStyles.ts (write once)
export function useThemedStyles<T extends StyleSheet.NamedStyles<T>>(
  factory: (c: AppColors) => T
): T {
  const { colors } = useTheme();
  return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
}

// in each screen
const styles = useThemedStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.bg },
  /* ... */
}));
```
**Win:** removes the repeated `useMemo`/`useTheme`/dep-array boilerplate (~3–5 lines × 48 ≈ **150–200 LOC**) and makes the dark-mode dep array impossible to forget. Mechanical, low-risk.

### Before / after — high-value simplification #2: collapse the 3 help-alert routes

`dismiss`, `resolve`, and `acknowledge` in `helpAlerts.ts` are the same shape: `ObjectId.isValid` guard → scoped `updateOne` → re-fetch → `alertOut`.

```ts
// AFTER — one helper
async function applyAlertUpdate(req, res, filter: object, updates: object) {
  if (!ObjectId.isValid(String(req.params.alertId)))
    return void res.status(400).json({ detail: "Invalid ID" });
  const db = getDb();
  const _id = new ObjectId(String(req.params.alertId));
  const r = await db.collection("help_alerts").updateOne(
    { _id, patient_id: req.patientId!, ...filter }, { $set: updates });
  if (!r.matchedCount) return void res.status(404).json({ detail: "Not found or already closed" });
  const doc = await db.collection("help_alerts").findOne({ _id });
  res.json(alertOut(doc));
}
```
Each route becomes a 1-line call. **Win:** ~60–90 LOC and one place to get the `patient_id`/closed-state scoping right.

---

### [CQ-1] No `tsc` / lint / CI in the build — type errors and dead imports ship silently
**Severity:** High · **Effort:** Small
- **Issue / root cause:** `package.json` has no `typecheck` or `lint` script and there are no `.github/workflows`. Metro/Babel only strip types — they never check them. `tsconfig.json` sets `strict: true`, so the safety exists but is never invoked. The brief's "14 committed type errors" is direct proof the gap let real errors through (they're gone now, but nothing prevents the next batch). For a healthcare app this is the cheapest missing guardrail.
- **Recommendation / refactor:** Add `"typecheck": "tsc --noEmit"` + ESLint, and a minimal GitHub Action running `npm run typecheck && npm test` on PR. Gate merges on it. ~1 hour of work.
- **Evidence:** `package.json` scripts (no `tsc`/`lint`/`typecheck`); no `.github/workflows`; `tsconfig.json` (`strict: true`).

### [CQ-2] `TodayScreen.tsx` is a 1,030-line God component
**Severity:** High · **Effort:** Large
- **Issue / root cause:** One function owns 9 modal/panel states, three add/edit forms, two progress cards, a slide-out notification panel, and a ~330-line `StyleSheet`. The Tasks card even duplicates an IIFE computing `allItems`/`doneItems` twice (lines 803–823 and 870–884). Hard to test, hard to change safely, every edit risks unrelated UI.
- **Recommendation / refactor:** Extract `<MedsCard>`, `<TasksCard>`, `<NotificationPanel>`, and a single reusable `<ItemFormModal>` (replaces add-task/edit-task/add-med). Lift `allItems`/`doneItems` to one `useMemo`. Target: screen drops to ~150–200 LOC; net ~−400 LOC after dedup.
- **Evidence:** `src/screens/patient/TodayScreen.tsx:1-1030`; duplicated stat IIFE at `:803-823` and `:870-884`; three near-identical modals at `:924-970, :997-1027`.

### [CQ-3] `RootNavigator.tsx` mixes navigation with push, deep-links, and a full alert UI
**Severity:** High · **Effort:** Large
- **Issue / root cause:** 887 lines spanning routing, splash/onboarding gating, two ~40-line push-token registration effects (caregiver `:170-216`, patient `:219-248`) that differ only in role/endpoint, cold-start + foreground invite deep-link parsing (`:122-145`), and a 3-ring animated urgent-alert overlay with its own 120-line stylesheet (`:469-586, :708-777`). The Vision FAB is even duplicated inline (`:330-334` and `:649-665`).
- **Recommendation / refactor:** Extract `usePushRegistration(role)` (unifies both effects), `useInviteDeepLink()`, `<UrgentAlertOverlay>`, and `<VisionFab>`. Navigator shrinks to ~120 LOC; net ~−300 LOC and far easier to reason about routing.
- **Evidence:** `src/navigation/RootNavigator.tsx:170-248` (dup push effects), `:122-145` (deep-link), `:469-586`+`:708-777` (overlay), `:330-334`+`:649-665` (dup FAB).

### [CQ-4] `useMemo(StyleSheet.create, [colors])` duplicated across 48 files
**Severity:** Medium · **Effort:** Small
- **Issue / root cause:** Mandated by CLAUDE.md for dark mode, but copy-pasted verbatim into 48 files. Beyond boilerplate, it's a correctness footgun — omitting `[colors]` silently breaks dark mode with no warning (no lint rule catches it).
- **Recommendation / refactor:** Introduce `useThemedStyles(factory)` (see sketch #1). Migrate incrementally. Removes ~150–200 LOC and the dep-array footgun.
- **Evidence:** 48 files match `useMemo(() => StyleSheet.create`; e.g. `TodayScreen.tsx:217-551`, `RootNavigator.tsx:250-267`+`:469-586`, `VisionSheet.tsx:171-377`.

### [CQ-5] Repeated card/header/section-label/modal style blocks instead of shared style helpers
**Severity:** Medium · **Effort:** Medium
- **Issue / root cause:** The same card (`borderRadius: radius.xl`, violet shadow, 4px accent), section-label (11px uppercase letterSpacing 1.2 muted), pill, and bottom-sheet modal styles are redefined in ~20+ screens. A `<SectionHeader>` shared component already exists but is not used everywhere. Changing the card look means editing dozens of files.
- **Recommendation / refactor:** Add `src/config/styles.ts` exporting `card(colors)`, `sectionLabel(colors)`, `pill(colors)`, `modalSheet(colors)` factories; adopt the existing `<SectionHeader>`. Conservatively ~1,500 LOC of duplicated style objects collapse.
- **Evidence:** `TodayScreen.tsx:319-518` (note/full-card/modal styles) vs identical patterns in `RootNavigator.tsx:495-515`, `VisionSheet.tsx:223-271`; unused-everywhere `src/components/shared/SectionHeader.tsx`.

### [CQ-6] Dead code: `glassesMockData.ts` (294 LOC) fully orphaned; other removed components linger in git but file remains
**Severity:** Medium · **Effort:** Small
- **Issue / root cause:** `src/data/glassesMockData.ts` (294 LOC) has **0** import references anywhere in `src`. It ships in the bundle and confuses readers about whether glasses data is real. (Several other components — `StatChip`, `AmbientHearts`, `GradientHeader`, `CheckRow`, etc. — are already deleted in the working tree per `git status`, confirming an in-progress cleanup; finish it.)
- **Recommendation / refactor:** Delete `glassesMockData.ts`. Add a `ts-prune`/`knip` step (or the CI from CQ-1) to catch future orphans automatically.
- **Evidence:** `grep -rE "from ['\"].*glassesMockData['\"]" src` → 0 hits; file present at `src/data/glassesMockData.ts` (294 LOC).

### [CQ-7] `RoutineScreen.tsx` (436 LOC) is documented as removed but is a live tab — doc/code drift
**Severity:** Medium · **Effort:** Small
- **Issue / root cause:** CLAUDE.md states "Old screens `RoutineScreen.tsx` and `MedsScreen.tsx` still exist… but are no longer in navigation — their content was merged into `TodayScreen.tsx`." In reality `PatientTabNavigator.tsx:10,134` still imports and mounts `RoutineScreen` as the live "Routine" tab. So either the doc is wrong (patients see a duplicate, supposedly-dead screen) or the nav was never updated. Either way it's a 436-LOC trust hazard. (`MedsScreen.tsx` has 0 refs and *is* dead.)
- **Recommendation / refactor:** Decide intent: if merged into Today, remove the tab and delete `RoutineScreen.tsx`; if still wanted, fix CLAUDE.md. Delete the genuinely-dead `MedsScreen.tsx`.
- **Evidence:** `src/navigation/PatientTabNavigator.tsx:10` + `:134` (live import/mount); `RoutineScreen.tsx` 436 LOC; `MedsScreen` → 0 import refs.

### [CQ-8] ~150 `console.*` statements, no structured logging, ~129 on the server with occasional PII
**Severity:** Medium · **Effort:** Medium
- **Issue / root cause:** 150 `console.log/warn/error` in `src`, 129 of them server-side, with no log levels, no redaction, and no crash reporting (Sentry only appears in comments). Several server logs include identifiers/PII context — e.g. `dailySummary.ts:105` logs `patientId`, `auth.ts:97` logs a Supabase email-fetch failure. On a healthcare backend, plaintext PII in logs is a compliance smell.
- **Recommendation / refactor:** Replace with a thin `logger` (pino) exposing `info/warn/error` + redaction of id/email fields; wire the already-referenced Sentry on client `ErrorBoundary` and server error handler. Strip client `console.log` in production via Babel `transform-remove-console`.
- **Evidence:** `grep -rc console.*` → 150 (`src`), 129 (`server-*`); `src/server-jobs/dailySummary.ts:105`, `src/server-routes/auth.ts:97`, `src/server-routes/reports.ts:213`.

### [CQ-9] Three help-alert mutation routes are near-identical
**Severity:** Low · **Effort:** Small
- **Issue / root cause:** `dismiss` (`:78-104`), `resolve` (`:113-152`), `acknowledge` (`:157-199`) in `helpAlerts.ts` repeat the same validate→scoped-update→refetch→`alertOut` skeleton, so the security-critical `patient_id` scoping and closed-state guard are written three times.
- **Recommendation / refactor:** Extract one `applyAlertUpdate(req, res, filter, updates)` helper (sketch #2). ~60–90 LOC removed; one place to audit alert authorization.
- **Evidence:** `src/server-routes/helpAlerts.ts:78-104, 113-152, 157-199`.

### [CQ-10] Zero React-Native component/hook tests; the largest, riskiest files are untested
**Severity:** Medium · **Effort:** Large
- **Issue / root cause:** ~142 vitest tests cover backend/pure logic only. The God components (TodayScreen, RootNavigator, VisionSheet) and every hook (`useRoutine`, `useHelpAlert`, optimistic toggles, the urgent-alert escalation logic) have no tests — exactly the code most likely to regress during the refactors above.
- **Recommendation / refactor:** Add `@testing-library/react-native` + jest-expo; start with the safety-critical paths (help-alert send/ack/escalation, optimistic toggle rollback). Pairs naturally with extracting components in CQ-2/CQ-3 (small units are testable).
- **Evidence:** test runner is vitest backend-only (`package.json` `test`); no RN test deps; God files `TodayScreen.tsx`/`RootNavigator.tsx`/`VisionSheet.tsx` have no co-located tests.


---

## Dependency & Framework Rationalization

One `package.json` carries 64 runtime + 9 dev dependencies and bolts a full React Native / Expo mobile client onto a full Express/MongoDB backend, with no separation between the two. The single worst offender is dead WebRTC weight: `@daily-co/react-native-daily-js` and `@daily-co/react-native-webrtc` ship ~4MB of native code and are never imported anywhere in `src/` — the Daily.co integration that actually exists is a *server-side* REST call (`src/server-routes/streamSessions.ts`), so the native client SDKs add binary size, build time, and App-Store-WebRTC scrutiny for zero feature. A cluster of packages is misfiled in runtime `dependencies` that belong in `devDependencies` (all `@types/*`, `@expo/ngrok`), two polyfills (`react-native-url-polyfill`, `react-native-get-random-values`) are installed but imported nowhere, and `expo-av` is deprecated in Expo SDK 54. Separately, `expo-location` requests background location permission with no matching iOS usage string in `app.json` — a hard runtime crash and a review rejection, not merely tech debt. The good news: the client/server *code* boundary is clean (no client file imports `mongodb`/`express`), so the dependency mess is packaging hygiene, not architectural rot — it is mechanically fixable.

### System map — where deps actually run

| Surface | Representative deps |
| --- | --- |
| **Client (mobile)** | react-native, react, expo + `expo-*`, @react-navigation/*, @react-native-async-storage, react-native-purchases, react-native-health, react-native-gifted-charts (+svg), @supabase/supabase-js |
| **Server (Express on Render)** | express, mongodb, helmet, cors, express-rate-limit, multer, pdfkit, nodemailer, node-cron, ws, zod, groq-sdk, @google/genai, mem0ai, dotenv, tsx |
| **Dead / never imported** | @daily-co/react-native-daily-js, @daily-co/react-native-webrtc, react-native-web, react-native-url-polyfill, react-native-get-random-values |
| **Misplaced (runtime → dev)** | @expo/ngrok, @types/cors, @types/express, @types/multer, @types/node-cron, @types/pdfkit, @types/ws |

### Per-dependency assessment (notable)

| Dependency | Purpose | Used where | Criticality | Risk | Recommendation |
| --- | --- | --- | --- | --- | --- |
| @daily-co/react-native-daily-js | WebRTC video client SDK | **none** (0 src imports) | None | ~290KB JS + native; WebRTC App-Store scrutiny | **Remove** |
| @daily-co/react-native-webrtc | Native WebRTC module | **none** (0 src imports) | None | ~2.6MB native; bloats IPA, ejects from Expo Go | **Remove** |
| react-native-web | RN-for-browser shim | **none** (0 src imports) | None | Pulls extra deps; camera unsupported on web anyway | **Remove** |
| react-native-url-polyfill | URL polyfill for Supabase | **none** (not imported) | Unknown | Installed but unreferenced | **Remove** (verify Supabase at runtime first) |
| react-native-get-random-values | crypto.getRandomValues polyfill | **none** (not imported) | Unknown | Installed but unreferenced | **Remove** (verify first) |
| react-native-svg | SVG primitives | transitive (peer of gifted-charts) | Medium | Required peer dep — `^15.4.0` | **Keep** (move to explicit-but-required) |
| react-native-gifted-charts | Health metric charts | health/ExpandableMetricCard, MetricCard | Medium | Maintained; pulls svg | **Keep** |
| @google/genai | Gemini (patterns, reports, memories) | server-jobs/*, server-routes/memories,reports | High | Server-only; API key handling | **Keep (server)** |
| groq-sdk | Vision AI assistant | server-routes/assistant*, assistantTools | High | Server-only | **Keep (server)** |
| mem0ai | Memory layer | server-core/memory.ts | High | Server-only; single wrapper point (good) | **Keep (server)** |
| react-native-health | HealthKit bridge | services/healthkit.ts | High | iOS-only native; bare workflow | **Keep (client)** |
| react-native-purchases | RevenueCat IAP | providers/PurchasesProvider, PaywallScreen | Critical | Revenue path; native | **Keep (client)** |
| pdfkit | Visit-prep / report PDFs | server-jobs/visitPrepPdf, server-core/reportPdf | Medium | Server-only | **Keep (server)** |
| nodemailer | Report email | server-core/reportEmail.ts | Medium | Server-only | **Keep (server)** |
| multer | Face photo upload | server-routes/people.ts | High | Server-only; upload validation present | **Keep (server)** |
| ws | Voice live bridge | server-core/liveBridge.ts | Medium | Server-only | **Keep (server)** |
| node-cron | Scheduled jobs | scheduler, escalateHelpAlerts, cron route | High | Server-only; single-instance assumption | **Keep (server)** |
| expo-av | Audio recording (voice) | hooks/useVoiceSession.ts | High | **Deprecated in SDK 54** (→ expo-audio) | **Replace** |
| expo-sensors | Gait biomarker | lib/biomarkers/gait.ts | Medium | Native | Keep (client) |
| expo-location | Wandering watcher | services/locationWatcher.ts | High | **Missing iOS usage string → crash/rejection** | Keep code, **fix app.json** |
| expo-task-manager | Background task host | services/locationWatcher.ts | Medium | Pairs with location | Keep (client) |
| @expo/ngrok | Dev tunnel (`expo --tunnel`) | none (CLI only) | Dev-only | In runtime deps | **Move to devDependencies** |
| @types/* (cors/express/multer/node-cron/pdfkit/ws) | Type stubs | build-time only | Dev-only | In runtime deps | **Move to devDependencies** |
| concurrently | Parallel script runner | **not used in any script** (scripts use `&`) | None | Dev dead weight | **Remove** (or wire into `dev`) |

### Before / after — runtime dependency count

| | Runtime deps | Native modules | Misfiled types |
| --- | --- | --- | --- |
| **Before** | 64 | incl. 3 Daily/WebRTC native | 6 `@types/*` + ngrok in runtime |
| **After (this plan)** | ~56 | Daily/WebRTC removed | 0 (all moved to dev) |

### Dependency Rationalization Plan
1. **Remove dead weight** (no code change, just `npm uninstall`): `@daily-co/react-native-daily-js`, `@daily-co/react-native-webrtc`, `react-native-web`, `concurrently`. Verify `react-native-url-polyfill` and `react-native-get-random-values` aren't needed by Supabase at runtime (smoke-test login), then remove.
2. **Re-file misplaced deps** into `devDependencies`: `@expo/ngrok`, `@types/cors`, `@types/express`, `@types/multer`, `@types/node-cron`, `@types/pdfkit`, `@types/ws`.
3. **Migrate `expo-av` → `expo-audio`** before the next SDK bump forces it.
4. **Fix the `expo-location` permission gap** in `app.json` (blocker — see below).
5. **Split client vs server via npm workspaces** (`packages/app`, `packages/server`, optional `packages/shared` for the zod schemas already shared across the boundary). The Render deploy then installs only server deps; the mobile bundle stops shipping `express`/`mongodb`/`pdfkit`/etc. in its dependency graph and `npm audit` / Dependabot noise gets scoped per-surface.

### Removal-Candidates list
- `@daily-co/react-native-daily-js` — 0 imports
- `@daily-co/react-native-webrtc` — 0 imports (~2.6MB native)
- `react-native-web` — 0 imports
- `react-native-url-polyfill` — 0 imports (verify Supabase first)
- `react-native-get-random-values` — 0 imports (verify first)
- `concurrently` — referenced by no script
- Move (not remove): `@expo/ngrok` + all `@types/*` → devDependencies

### Estimated savings
- **Native/IPA:** removing the Daily WebRTC modules drops ~4MB of installed native code (`du`: webrtc 2.6MB + daily-js 1.1MB + rn-daily-js 288KB) and removes a native compile step from EAS builds, shortening build time and reducing the IPA. It also keeps the project closer to managed Expo (WebRTC forces a bare/dev-client workflow).
- **JS bundle:** dropping `react-native-web` and the two unused polyfills trims the Metro graph modestly (~hundreds of KB of transitive JS).
- **Dependency graph:** workspace split removes ~15 server-only packages from the mobile install, cutting client `node_modules` and audit surface.

---

### [DEP-1] Dead WebRTC native SDKs ship ~4MB of native code for an unbuilt feature
**Severity:** High · **Effort:** Small
- **Issue / root cause:** `@daily-co/react-native-daily-js` and `@daily-co/react-native-webrtc` are declared as runtime deps but imported in zero `src/` files (grep returns nothing). The Daily.co integration that exists is purely server-side REST (`DAILY_BASE = "https://api.daily.co/v1"`), so the client SDKs deliver no feature while adding ~2.9MB (`@daily-co/*`) + 2.6MB WebRTC of native/JS weight, forcing a bare/dev-client workflow and inviting App-Store WebRTC/background scrutiny.
- **Recommendation / refactor:** `npm uninstall @daily-co/react-native-daily-js @daily-co/react-native-webrtc`. Re-add only when the livestream client is actually built. Keep `streamSessions.ts` (server REST) as-is.
- **Evidence:** `package.json:18-19`; `src/server-routes/streamSessions.ts:43` (`DAILY_BASE`); 0 imports across `src/`.

### [DEP-2] expo-location requests background permission with no iOS usage string — runtime crash + rejection
**Severity:** Critical · **Effort:** Small
- **Issue / root cause:** `src/services/locationWatcher.ts:28` calls `Location.requestBackgroundPermissionsAsync()`, but `app.json` declares no `NSLocationWhenInUseUsageDescription` / `NSLocationAlwaysAndWhenInUseUsageDescription` (only Camera/Photo/Mic/Motion/HomeKit/Health are present). On iOS a missing location usage string is a **hard crash** the moment the permission is requested, and shipping a location-using binary without the string/`UIBackgroundModes` is an App-Store rejection.
- **Recommendation / refactor:** Add the location usage strings to `app.json` `infoPlist` (and `location` to `UIBackgroundModes` only if true background updates are used — current code comments note it avoids `startLocationUpdatesAsync`). If wandering detection isn't shipping at launch, gate the call behind a feature flag so the permission is never requested.
- **Evidence:** `src/services/locationWatcher.ts:28`; `app.json:22-30` (no `NSLocation*` keys); `app.json:27-28` (`UIBackgroundModes: ["fetch"]`).

### [DEP-3] Single package.json mixes client and server — no dependency isolation
**Severity:** High · **Effort:** Large
- **Issue / root cause:** One `package.json` declares the mobile client (react-native, expo-*, navigation, purchases, health) and the Express backend (express, mongodb, multer, pdfkit, nodemailer, node-cron, ws) together. The Render deploy installs the entire mobile native graph it never runs, the mobile build's dependency tree carries server packages, and `npm audit` / Dependabot can't distinguish which surface a CVE actually affects.
- **Recommendation / refactor:** Adopt npm workspaces: `packages/app` (client), `packages/server` (Express), `packages/shared` (the zod schemas already shared across the boundary). Each surface installs only its deps; CI/audit scope per package.
- **Evidence:** `package.json:17-82` (client deps `react-native:68`, server deps `express:56`, `mongodb:61`, `multer:62`, `pdfkit:65`, `nodemailer:64`, `node-cron:63`, `ws:80` co-mingled).

### [DEP-4] @types/* and @expo/ngrok misfiled in runtime dependencies
**Severity:** Medium · **Effort:** Small
- **Issue / root cause:** Six `@types/*` packages and `@expo/ngrok` (a dev-only tunnel for `expo start --tunnel`) sit in `dependencies`. Type stubs are build-time-only and `@expo/ngrok` is never imported in code — none should ship in a production install. This inflates the runtime graph and the Render production `npm install --omit=dev` would still pull them.
- **Recommendation / refactor:** Move `@expo/ngrok`, `@types/cors`, `@types/express`, `@types/multer`, `@types/node-cron`, `@types/pdfkit`, `@types/ws` into `devDependencies` (where `@types/nodemailer`, `@types/react`, `@types/supertest` already correctly live).
- **Evidence:** `package.json:22` (`@expo/ngrok`), `package.json:31-36` (`@types/*` in dependencies); contrast `package.json:84-86` (correctly-placed types in devDependencies).

### [DEP-5] expo-av is deprecated in Expo SDK 54 and gates the voice feature
**Severity:** Medium · **Effort:** Medium
- **Issue / root cause:** `src/hooks/useVoiceSession.ts:2` imports `Audio` from `expo-av`, which Expo deprecated in SDK 54 (the project is on `expo ~54.0.33`) in favor of `expo-audio`/`expo-video`. `expo-audio` is not installed. The voice check-in path (a first-class shipped feature per CLAUDE.md) is built on a module slated for removal in the next SDK, creating a forced migration on the next upgrade.
- **Recommendation / refactor:** Migrate `useVoiceSession` to `expo-audio` (`npx expo install expo-audio`) and remove `expo-av`. Note the code comment at `useVoiceSession.ts:41` already flags the chunked-WAV limitation — fold the migration into that planned rework.
- **Evidence:** `package.json:40` (`expo-av ~16.0.8`), `src/hooks/useVoiceSession.ts:2,34-37`; no `expo-audio` in `package.json`.

### [DEP-6] Two crypto/URL polyfills installed but imported nowhere
**Severity:** Low · **Effort:** Small
- **Issue / root cause:** `react-native-url-polyfill` and `react-native-get-random-values` are runtime deps but grep finds no import in `src/`, `index.ts`, or `App.tsx`. `src/config/supabase.ts` constructs the Supabase client without importing either polyfill. They are either genuinely dead, or relied upon implicitly (a fragile pattern — a polyfill that must be side-effect-imported but isn't will silently fail).
- **Recommendation / refactor:** Smoke-test Supabase login/session after removing them. If auth still works, `npm uninstall` both. If they ARE needed, import them explicitly as the first line of `index.ts` so the dependency is traceable.
- **Evidence:** `package.json:70,77`; `src/config/supabase.ts:1-10` (no polyfill import); 0 import hits across `src`/`index.ts`/`App.tsx`.

### [DEP-7] react-native-web and unused concurrently add dev/build weight with no consumer
**Severity:** Low · **Effort:** Small
- **Issue / root cause:** `react-native-web` (runtime dep) has 0 src imports and the project's own docs note camera features don't work on web — there is no real web target. `concurrently` (devDep) is referenced by no script; `scripts.dev`/`tunnel` use shell `&` instead. Both are dead packages inflating install size and audit surface.
- **Recommendation / refactor:** `npm uninstall react-native-web concurrently`. If a web preview is desired later, re-add `react-native-web`; if parallel scripts are wanted, wire `concurrently` into `scripts.dev` (more robust than `&`).
- **Evidence:** `package.json:78` (`react-native-web`), `package.json:88` (`concurrently`); 0 src imports; `package.json:6-7` use `&` not `concurrently`.

### [DEP-8] node-cron in-process scheduler assumes a single server instance
**Severity:** Medium · **Effort:** Medium
- **Issue / root cause:** `node-cron` runs escalation, daily-summary, and pattern-inference jobs in-process (`src/server-jobs/scheduler.ts`, `escalateHelpAlerts.ts`). This is correct for one Render instance, but if the backend is ever scaled to >1 instance every cron fires N times — duplicate SOS escalations and duplicate emails on a dementia-safety path. This is a dependency-choice risk, not a current bug.
- **Recommendation / refactor:** Document the single-instance constraint, or move scheduling to a leader-elected lock (Mongo TTL lock) / external scheduler (Render Cron Jobs) before horizontal scaling. Keep `node-cron` for single-instance today.
- **Evidence:** `package.json:63`; `src/server-jobs/scheduler.ts`, `src/server-jobs/escalateHelpAlerts.ts` (in-process cron registration).


---

## Security & Privacy

The backend has a respectable baseline — helmet, CORS allowlist, express-rate-limit, Zod validation, ObjectId guards, a 5-minute Supabase token cache, and an opt-in consent layer with audit fields — which is more than most seed-stage apps ship. But for an app handling dementia-patient PHI (faces, health metrics, behavioral biomarkers, free-text check-ins), the gaps that remain are serious and several are HIPAA-adjacent. The single worst issue is an **unauthenticated WebSocket** (`/api/live/ws`) that opens a Gemini Live session on the company's API key with a caller-supplied `patientId` — an open relay and a billing/PHI-exfiltration hole flagged only by a `// TODO`. Equally important: **patient PHI is streamed to three third-party AI vendors (Groq, Mem0, Gemini) with no consent gate and no disclosure**, while the strategy doc openly contemplates **data-licensing to pharma** — a combination that needs a BAA/DPA story and a privacy policy before it can ship. On the client, the Supabase session token lives in **AsyncStorage (plaintext)** rather than the iOS Keychain/SecureStore. None of this is unfixable, but the licensing ambition is far ahead of the privacy plumbing.

### System map — where PHI lives and who it leaves to

| Sink | Data | Encrypted at rest? | BAA/DPA needed? | Consent-gated? |
|---|---|---|---|---|
| MongoDB Atlas | routines, meds, faces+embeddings, help alerts, check-in logs, health metrics, consent | Atlas-managed (default) | Yes (PHI) | partial (health/events only) |
| Groq (`assistant.ts`) | patient first name, full routine, meds list, reminders, last 20 conversation turns | n/a (3rd-party LLM) | **Yes** | **No** |
| Mem0 (`memory.ts`) | raw check-in text scoped by `patient_id` | n/a (3rd-party) | **Yes** | **No** |
| Gemini Live (`liveBridge.ts`) | live caregiver voice audio | n/a (3rd-party) | **Yes** | **No** |
| Device (AsyncStorage) | Supabase JWT, pending invite token, sensor prefs | **No (plaintext)** | n/a | n/a |
| Render disk `uploads/faces` | enrolled face JPEGs | **No (ephemeral, plaintext)** | Yes | n/a |

### Draft App Privacy Nutrition Label

| Data type | Collected | Linked to user | Used for tracking |
|---|---|---|---|
| Name, email | Yes | Yes | No |
| Health & fitness (HealthKit heart rate, etc.) | Yes | Yes | No |
| Sensitive info (cognitive/dementia status, behavioral biomarkers: gait, typing cadence, voice) | Yes | Yes | No |
| Photos (enrolled faces + face embeddings) | Yes | Yes | No |
| Audio (voice check-ins / live voice) | Yes | Yes | No |
| Precise location (geofence) | Yes | Yes | No |
| User content (notes, check-in free text, AI conversations) | Yes | Yes | No |
| Purchases (RevenueCat) | Yes | Yes | No |
| Diagnostics / crash | None wired | — | — |

Note: the **Tier-2 facial/biometric/location data-licensing** debate in CLAUDE.md, if pursued, would flip several rows to "used for tracking / shared with third parties for purposes other than app functionality," which materially changes both the label and App Review posture.

---

### [SEC-01] Unauthenticated Gemini Live WebSocket — open AI relay + PHI exfiltration
**Severity:** Critical · **Effort:** Medium
- **Issue / root cause:** `attachLiveBridge` upgrades any WS connection to `/api/live/ws` straight into a Gemini Live session with no auth — the code literally says `// TODO: validate auth (Supabase JWT...)`. The `patientId` is taken from the query string and never checked against a seat. Anyone on the internet can open sessions, burn the company's `GEMINI_API_KEY`, and stream audio in/out. The REST `POST /api/live/session/:patientId` *is* guarded by `requireSeat`, but it just hands back the WS URL — and the WS itself is wide open, so the guard is cosmetic.
- **Recommendation / refactor:** Issue a short-lived signed session token from the guarded REST endpoint; require it (e.g. in `Sec-WebSocket-Protocol` or a query param) in the upgrade handler, validate it against the seat for `patientId`, and reject otherwise. Rate-limit upgrades. Do not ship voice until this is closed.
- **Evidence:** `src/server-core/liveBridge.ts:9-13` (no-auth upgrade, TODO), `src/server-routes/live.ts:12-19`

### [SEC-02] Patient PHI sent to Groq/Mem0/Gemini with no consent gate and no disclosure
**Severity:** Critical · **Effort:** Large
- **Issue / root cause:** The assistant builds a system prompt containing the patient's first name, entire routine, full medication list with dosages, reminders, and the last 20 conversation turns, then sends it to Groq. `memory.ts` writes raw check-in text to Mem0. None of these paths consult the `consent` layer — `getConsent`/`hasConsent` is only enforced for `healthMetrics` (health.ts) and biomarker `events`. So a patient who has consented to nothing still has their meds and conversations shipped to two US AI vendors. There is no privacy policy reference, no BAA/DPA mention, and no in-app disclosure that AI features transmit PHI to third parties.
- **Recommendation / refactor:** Add an `aiAssistant`/`memory` consent category and gate both routes on it. Execute BAAs (or DPAs) with Groq, Mem0, and Google before processing PHI, or self-host. Add a clear in-app disclosure + privacy policy. Minimize the payload (drop dosages/full conversation unless needed).
- **Evidence:** `src/server-routes/assistant.ts:36-92` (context fetch + prompt), `src/server-core/memory.ts:35-39`, consent only covers two categories in `src/server-core/consent.ts:10-11`

### [SEC-03] Data-licensing-to-pharma ambition outruns the privacy/legal plumbing
**Severity:** High · **Effort:** Large
- **Issue / root cause:** CLAUDE.md commits to Tier-1 de-identified data licensing to pharma and leaves Tier-2 (facial/biometric/location under consent) as an open debate. The codebase has **no de-identification pipeline, no re-identification-risk controls, no separate export/consent ledger for licensing, and no "sale of data" consent toggle**. The existing consent layer is for *care-team sharing*, not third-party licensing, and the App Privacy label currently declares "not used for tracking" — which licensing would contradict. Behavioral/cognitive data on a clinically vulnerable population is the highest-scrutiny category under HIPAA, GDPR special-category, and state biometric laws (BIPA).
- **Recommendation / refactor:** Do not collect-now-license-later by default. Build an explicit, revocable, separately-recorded licensing consent; a real de-identification step (HIPAA Safe Harbor / expert determination) before any export; and legal review before the first byte leaves. Keep the Nutrition Label honest about it.
- **Evidence:** CLAUDE.md "Product Direction" (Tier-1 decided / Tier-2 debate); no de-id code anywhere in `src/server-*`; consent scope `src/server-core/consent.ts:10-11`

### [SEC-04] Supabase session JWT stored in AsyncStorage (plaintext), not Keychain/SecureStore
**Severity:** High · **Effort:** Medium
- **Issue / root cause:** `supabase.ts` configures `storage: AsyncStorage` for session persistence. AsyncStorage is an unencrypted on-device store (SQLite/plist) — on a jailbroken or backed-up device the long-lived refresh token is recoverable, granting full account access to a PHI app. No `expo-secure-store` usage exists anywhere in `src/`. The 30-min inactivity timeout (and patient-exempt logic) is a UX control, not at-rest protection.
- **Recommendation / refactor:** Back Supabase persistence with `expo-secure-store` (Keychain/Keystore) via a small `SecureStore`-backed storage adapter. Also move the `@vela/pending_invite` token there.
- **Evidence:** `src/config/supabase.ts:9-14`, no SecureStore in repo (grep negative), `src/context/AuthContext.tsx:209,246` (invite token in AsyncStorage)

### [SEC-05] Face photos written unencrypted to Render's ephemeral disk
**Severity:** Medium · **Effort:** Medium
- **Issue / root cause:** Enrolled face images are saved to local disk (`uploads/faces/<uuid>.jpg`) with no encryption. This is biometric data (BIPA/GDPR special category) sitting in plaintext on a shared Render instance; on the free tier it is also ephemeral (data loss risk), and disk persistence has weaker access controls than Atlas. The face *embedding* is kept in Mongo (and correctly projected out of list responses), but the raw JPEG is the more sensitive artifact.
- **Recommendation / refactor:** Move face images to encrypted object storage (S3 SSE / GCS CMEK) with signed, expiring URLs and access logging; or store the embedding only and discard the raw image after enrollment. Add a retention/deletion policy tied to person deletion.
- **Evidence:** `src/server-routes/people.ts:14` (`UPLOAD_DIR = uploads/faces`), `:29-33` (diskStorage), CLAUDE.md note that Render storage is ephemeral

### [SEC-06] Supabase token cache cannot be invalidated on revocation within its TTL
**Severity:** Medium · **Effort:** Small
- **Issue / root cause:** `authMiddleware` caches `token -> userId` for 5 minutes keyed by the raw token. A user who is disabled/signed-out server-side still passes auth for up to 5 minutes because the cache is only checked against its own `expiresAt`, never against Supabase revocation. For a single-user-per-token model this is a small window, but combined with long-lived refresh tokens it weakens "revoke now" guarantees. The eviction sweep also only runs when the map exceeds 1000 entries, so memory can hold many live tokens.
- **Recommendation / refactor:** Keep the TTL short (it is) but document the revocation window; consider a deny-list hook on logout, and cap/evict by size+age proactively. Hash tokens before using them as map keys so a heap dump doesn't leak bearer tokens.
- **Evidence:** `src/server-core/security.ts:40-48,70-77`

### [SEC-07] No webhook signature verification visible for RevenueCat; CRON via shared secret
**Severity:** Medium · **Effort:** Small
- **Issue / root cause:** `REVENUECAT_WEBHOOK_SECRET` and `CRON_SECRET` exist in config and are treated as *optional* (server boots and warns if unset). The RevenueCat webhook is mounted before the rate limiter; if the secret is unset in an environment, subscription-state spoofing (free → unlimited) and unauthenticated cron triggering become possible. Optionality is convenient for dev but risky if it bleeds into prod.
- **Recommendation / refactor:** Promote both to *required* in any non-dev environment (fail-fast in `validateConfig` when `NODE_ENV=production`). Confirm the RevenueCat handler actually verifies the signature/authorization header (not audited here) and the cron route rejects on missing/secret-mismatch with constant-time compare.
- **Evidence:** `src/server-core/config.ts:21,24,46-58` (optional), `src/server.ts:110,113` (mounted before general limiter)

### [SEC-08] Request logger and error handler write request paths (which embed patientId) to stdout
**Severity:** Low · **Effort:** Small
- **Issue / root cause:** The global logger logs `req.path` for every request and the error handler logs `req.path` + full stack. Many routes are `/api/profiles/:patientId/...`, so patient identifiers land in Render's plaintext log stream with no redaction, retention policy, or access control. A handful of route logs also print `patientId` directly (`dailySummary.ts:105`, `health.ts:48`). The earlier "150 console.* logging userId/patientId everywhere" claim is overstated — direct PII logging is limited — but path-based identifier leakage is real and systemic.
- **Recommendation / refactor:** Use a structured logger with a redaction pass for `:patientId`/`:id` path segments and never log stacks containing PHI to a third-party log sink without a BAA. Define a log retention policy.
- **Evidence:** `src/server.ts:86,170`, `src/server-jobs/dailySummary.ts:105`, `src/server-routes/health.ts:48`

### [SEC-09] MongoDB query-injection surface where patient_id strings are not ObjectId-guarded
**Severity:** Low · **Effort:** Small
- **Issue / root cause:** ObjectId guards are applied well for `:id` params, but many collections are filtered by `patient_id` as a *string* (`find({ patient_id: req.patientId })`). Because Express JSON bodies can contain objects, any route that ever lets a `patient_id`/filter value come from `req.body` without Zod-coercing it to a string is exposed to operator injection (`{$ne: null}` / `{$gt: ""}`). The audited routes derive `patient_id` from auth/seat resolution (safe), but the pattern is fragile and one careless route reintroduces it.
- **Recommendation / refactor:** Centralize: always derive `patientId` from `req.seat`/`req.auth`, never from the body; enforce `z.string()` on every externally-supplied id; consider `mongo-sanitize` middleware as defense-in-depth.
- **Evidence:** `src/server-routes/conversations.ts:30,65`, `routines.ts:40`, `reports.ts:47`, `patients.ts:275-277`

### [SEC-10] Supabase anon key & URL embedded in committed app.json (acceptable, but note RLS dependency)
**Severity:** Low · **Effort:** Small
- **Issue / root cause:** `app.json extra` ships the Supabase URL and anon JWT in the client bundle. This is by-design for Supabase (the anon key is public), and `.env` with `MONGODB_URI` is correctly gitignored (only `.env.example` is tracked) — so this is NOT a leaked-secret finding. The real risk is that the anon key's safety depends entirely on Supabase Row-Level Security being correctly configured; if RLS is permissive, the embedded key is a direct DB read path. RLS posture was not auditable from this repo.
- **Recommendation / refactor:** Verify RLS is enabled and least-privilege on every Supabase table; treat the anon key as public and assume an attacker has it. Confirm no service-role key is ever shipped to the client (it is not — `supabaseServiceRoleKey` is server-only).
- **Evidence:** `app.json:50-51` (anon key in extra), `.gitignore:36-38` (.env ignored), `src/server-core/config.ts:13` (service role server-side only)


---

## App Store / Expo Build Compliance

Vela Vision has clearly done a remediation pass — `PaywallScreen` now has the full auto-renewable subscription disclosure, EULA + Privacy links, a Restore button, and a non-trapping "Maybe later" path; `DELETE /api/auth/me` cascades hard across ~24 collections plus Supabase admin delete; and a `PrivacyInfo.xcprivacy` with required-reason API declarations exists. That is genuinely above the median Expo app. But this dimension is not clean. The single highest-risk item is a server prompt that instructs the AI to **"Never mention that you are AI"** (`assistant.ts:74`) while it processes patient health/cognitive input through Groq/Gemini — that is a direct collision with Guideline 5.1.2 / generative-AI disclosure expectations and a plausible rejection. Compounding it: three Info.plist permission strings (Microphone, HomeKit, and an implied background-Location) are declared/requested for "coming soon" features with no shipping UI, `ITSAppUsesNonExemptEncryption:false` is almost certainly a false declaration given HTTPS + auth crypto, and `locationWatcher.ts` requests **background** location with no usage string and no caller — a latent runtime crash and a metadata-rejection magnet. Because `/ios` is gitignored, the committed privacy manifest is a regenerated artifact, so any required-reason or permission gap must be fixed in `app.json` (the source of truth), not the generated file.

### System map — declared permissions vs. actual usage

| Info.plist key (app.json) | Backing feature | Actually used in `src/`? | Verdict |
|---|---|---|---|
| `NSCameraUsageDescription` | Add face photo | Yes — `FacesScreen.tsx:114`, `PeopleScreen.tsx:46` (expo-image-picker) | Justified |
| `NSPhotoLibraryUsageDescription` | Pick face photo | Yes — image-picker | Justified |
| `NSMicrophoneUsageDescription` | "voice check-ins" | Partial — `CheckInScreen.tsx` / `useVoiceSession.ts` exist; feature is Plan C "coming soon" | Risk if voice not shipping |
| `NSMotionUsageDescription` | "activity patterns" | Weak — only `gait.ts` / homekit refs; no `expo-sensors` Pedometer wiring shipped | Risk |
| `NSHomeKitUsageDescription` | wandering/door events | `homekit/index.ts` is a bare-workflow stub w/ try-catch fallback; not in Expo Go; SmartHomeStep onboarding only | High rejection risk (coming-soon) |
| `NSHealthShareUsageDescription` | HealthKit read | Yes — `healthkit.ts`, `healthSync.ts` | Justified (see claim-language finding) |
| `NSLocation*UsageDescription` | wandering/geofence | **MISSING** — yet `locationWatcher.ts:26-28` requests fg+bg location | Crash + metadata gap |
| `UIBackgroundModes: ["fetch"]` | health observers / push | `healthSync` registers HK observers; push uses remote-notification | Under-declared for HK background delivery |
| `ITSAppUsesNonExemptEncryption: false` | — | App uses HTTPS + Supabase JWT crypto | Likely false declaration |

### Before / after — what review will catch

| Item | Current state | Needed for clean approval |
|---|---|---|
| AI disclosure | "Never mention that you are AI" (`assistant.ts:74`) | Disclose AI assistance; never instruct concealment; add in-UI "AI-generated" affordance |
| Coming-soon permissions | Mic/HomeKit/Motion strings shipped without working features | Strip permissions for any feature not in the reviewed build |
| Background location | bg permission requested, no usage string, no caller | Remove dead code OR add `NSLocation*` strings + `location` background mode + real feature |
| Encryption declaration | `false` | Set per actual usage (almost certainly exempt-`true`, or add ECCN docs) |
| Privacy manifest source | only in generated `/ios` (gitignored) | Declare required-reason + collected-data types via `app.json`/plugin so prebuild regenerates them |

### [AC-1] AI assistant is instructed to hide that it is AI while processing patient health input
**Severity:** High · **Effort:** Small
- **Issue / root cause:** The Vision system prompt ends with `Never give medical advice. Never mention that you are AI.` (`src/server-routes/assistant.ts:74`). The same endpoint runs patient cognitive/routine/medication context through Groq (`llama-3.3-70b-versatile`) and the app also uses Gemini/Mem0. Apple Guideline 5.1.2 and the generative-AI review posture expect apps to *disclose* AI involvement, especially in a health-adjacent context — and explicitly instructing the model to conceal its nature is the opposite. A reviewer who triggers the assistant and sees a humanlike "I'm your helper" with no AI affordance can reject under 5.1.2 / 1.4.1 (medical) / 4.0.
- **Recommendation / refactor:** Delete the "Never mention that you are AI" clause. Add a one-time in-UI disclosure ("Responses are AI-generated and may be wrong; not medical advice") on `VisionSheet`/check-in surfaces, and keep the existing "no medical advice" + human-review-of-doses guard (`assistant.ts:164`). Document AI processing in the privacy policy.
- **Evidence:** `src/server-routes/assistant.ts:71-74`, `assistant.ts:164`

### [AC-2] Microphone, HomeKit, and Motion permissions declared for "coming soon" features
**Severity:** High · **Effort:** Small
- **Issue / root cause:** `app.json` declares `NSMicrophoneUsageDescription`, `NSHomeKitUsageDescription`, and `NSMotionUsageDescription` (`app.json:24-26`). Per project notes and code, HomeKit is a bare-workflow stub that no-ops in Expo Go (`src/lib/homekit/index.ts`), voice is Plan C "coming soon," and Motion has no shipped `expo-sensors` capture. Apple Guideline 2.1 / 5.1.1 rejects apps that request permissions for functionality not present in the reviewed build — a reviewer who never sees a mic prompt or a HomeKit pairing flow but sees the purpose strings will flag them.
- **Recommendation / refactor:** Remove permission strings for any capability not in the submitted build. Re-add them in the version that actually ships voice/HomeKit/motion, each paired with a working in-app flow that triggers the prompt. If voice check-in *is* shipping, keep mic and ensure the prompt fires during review (provide a reviewer walkthrough).
- **Evidence:** `app.json:24-26`; `src/lib/homekit/index.ts`; CLAUDE.md "Voice UI (Plan C)" / "Sensors (Plan D)"

### [AC-3] Background location requested with no usage string and no caller — runtime crash + metadata gap
**Severity:** High · **Effort:** Small
- **Issue / root cause:** `src/services/locationWatcher.ts:26-28` calls `requestForegroundPermissionsAsync()` then `requestBackgroundPermissionsAsync()`, but `app.json` declares **no** `NSLocationWhenInUseUsageDescription` / `NSLocationAlwaysAndWhenInUseUsageDescription` and no `location` background mode. On iOS, requesting location without the usage string is a hard crash. The module has **no caller anywhere in `src/`** — it is dead code that, if ever wired, crashes; if shipped with strings added, it requests *Always* location (the most scrutinized permission) for a wandering feature that isn't live.
- **Recommendation / refactor:** Delete `locationWatcher.ts` (and any geofence UI) from the build until geofencing actually ships. When it ships: add both location usage strings + `location` in `UIBackgroundModes`, request When-In-Use first and only escalate to Always with a clear in-context primer, and provide a reviewer demo.
- **Evidence:** `src/services/locationWatcher.ts:7,26-28`; no `NSLocation*` key in `app.json`; no importer of `locationWatcher` in `src/`

### [AC-4] `ITSAppUsesNonExemptEncryption: false` is likely a false declaration
**Severity:** Medium · **Effort:** Small
- **Issue / root cause:** `app.json:31` declares `ITSAppUsesNonExemptEncryption: false`. The app uses HTTPS to Render, Supabase JWT auth, and token caching — i.e. it *uses* encryption. The honest answer is usually "yes, but exempt" (standard HTTPS exemption), declared as `true` with the exemption, not a blanket `false`. A wrong export-compliance answer is a common automated rejection / TestFlight block and can be treated as a misrepresentation.
- **Recommendation / refactor:** Confirm with the standard Apple export-compliance flow; for an HTTPS-only app the correct setup is `ITSAppUsesNonExemptEncryption: true` plus claiming the exemption (or providing the App Store Connect export-compliance answers). Do not leave a bare `false` if any non-standard crypto exists.
- **Evidence:** `app.json:31`; `src/api/client.ts` (HTTPS + auth token), `src/server-core/security.ts` (token cache)

### [AC-5] `UIBackgroundModes: ["fetch"]` under-declares HealthKit background delivery
**Severity:** Medium · **Effort:** Small
- **Issue / root cause:** `healthSync.ts:49` calls `enableBackgroundDelivery()` which registers HealthKit observers (`healthkit.ts:131-141`), and push uses Expo remote notifications. Yet `app.json:27-29` only lists `fetch`. HealthKit observer/background delivery requires HealthKit background entitlement, and silent remote notifications require `remote-notification`. Conversely, if HK background delivery and remote push are *not* actually used at launch, the registration code is misleading. Either way the declaration and the code disagree.
- **Recommendation / refactor:** Reconcile: if HK background delivery ships, add the HealthKit background entitlement and verify `remote-notification` if silent push is used; if not, remove the `enableBackgroundDelivery()` observer registration so the app's behavior matches the manifest. Keep background modes minimal — each unused mode is a 2.5.4 rejection vector.
- **Evidence:** `src/services/healthkit.ts:131-141`, `src/services/healthSync.ts:49-50`, `app.json:27-29`

### [AC-6] Privacy manifest lives only in gitignored generated `/ios`; required-reason + collected-data not driven from source
**Severity:** Medium · **Effort:** Medium
- **Issue / root cause:** `PrivacyInfo.xcprivacy` exists and declares FileTimestamp/UserDefaults/DiskSpace/BootTime reasons, but `NSPrivacyCollectedDataTypes` is **empty** (`ios/VelaVision/PrivacyInfo.xcprivacy:43-44`) even though the app collects health data, contacts/photos (faces), and identifiers. Critically, `/ios` is gitignored, so this file is a `expo prebuild` artifact — any EAS rebuild regenerates it from `app.json`/plugins, silently discarding hand-edits. There is no `privacyManifests` config in `app.json`, so the empty collected-data declaration is what ships. Apple now requires `NSPrivacyCollectedDataTypes` to match the App Privacy "Nutrition Label" and rejects mismatches.
- **Recommendation / refactor:** Move the privacy manifest into source: add `ios.privacyManifests` in `app.json` (or a config plugin) declaring `NSPrivacyCollectedDataTypes` for health, photos, user content, and identifiers, with linkage/tracking flags matching the App Store Connect privacy answers. Verify it survives `expo prebuild`. Do not rely on editing the generated file.
- **Evidence:** `ios/VelaVision/PrivacyInfo.xcprivacy:43-44`; `.gitignore:44` (`/ios`); no `privacyManifests` key in `app.json`

### [AC-7] HealthKit "wellness" claim language is mostly safe but inconsistent at the data-collection boundary
**Severity:** Low · **Effort:** Small
- **Issue / root cause:** The codebase generally hedges correctly — `reportPdf.ts:135` ("General wellness observations only — not intended as diagnostic measures"), `biomarkers/gait.ts:4`, `biomarkers/typing.ts:3`. But the HealthKit purpose string (`app.json:30`, `app.json:63`) says health data is used "to help your care team **monitor** your wellbeing," and HomeKit copy (`app.json:26`) says "help detect **wandering or sundowning**" — *sundowning* is a clinical dementia term and "detect" leans diagnostic. Health/medical reviewers (1.4.1 / 5.1.3) scrutinize exactly this language, especially when a *third party* (caregiver) monitors a patient.
- **Recommendation / refactor:** Soften purpose strings to non-clinical framing ("share general wellness trends with your care circle"; replace "detect sundowning" with "notice unusual nighttime activity"). Keep the existing diagnostic disclaimers and consider surfacing them in-UI on health/biomarker screens, not just the PDF.
- **Evidence:** `app.json:26,30,63`; `src/server-core/reportPdf.ts:135`; `src/lib/biomarkers/gait.ts:4`

### [AC-8] Account-deletion cascade is strong but has two completeness gaps
**Severity:** Low · **Effort:** Small
- **Issue / root cause:** `DELETE /api/auth/me` (`auth.ts:169-286`) is well built — UI exists in `SideDrawer.tsx` with a typed confirmation, it cascades both `patient_id`/`patientId` shapes across ~24 collections, deletes the Supabase auth user, and best-effort cleans Mem0. Two gaps: (a) it logs `userId`/`patientId` in several `console.error` calls (`auth.ts:72-73,129-130`) — PII in logs; (b) if `SUPABASE_SERVICE_ROLE_KEY` is unset it merely logs and still returns `success:true` (`auth.ts:258-259`), so the Mongo data is gone but the auth identity survives — the user "deleted" their account yet can still sign in. Apple 5.1.1(v) expects deletion to actually revoke the account.
- **Recommendation / refactor:** Scrub PII from logs (log opaque request IDs, not user/patient IDs). If the service-role key is missing, treat Supabase deletion failure as a 500 (or queue a retry) rather than reporting success — a partial deletion that leaves the login alive is a compliance and trust hazard.
- **Evidence:** `src/server-routes/auth.ts:169-286`, specifically `:72-73`, `:129-130`, `:258-259,281`; `src/components/SideDrawer.tsx:261-271`


---

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
