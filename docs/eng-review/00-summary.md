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
