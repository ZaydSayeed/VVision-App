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
