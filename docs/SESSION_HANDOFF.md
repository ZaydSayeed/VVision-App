# Session Handoff — App Store Round-3 + Production Hardening

**Status:** Code complete on branch. Remaining work is App Store Connect process (no code). Goal: pass Apple review on the next submission (rejected twice).

- **Branch:** `fix/appstore-review-round3` (branched from `main` @ `342a07f`, 8 commits ahead, **local only — not pushed yet**)
- **Working tree:** clean except untracked `build/` (local Xcode-archive output — **do not commit it**, it's not in git and not gitignored noise)
- **Detailed submission steps:** `docs/APP_STORE_RESUBMISSION.md` ← the partner's main TODO list
- **Original plan:** `~/.claude/plans/ok-now-we-need-graceful-dragonfly.md` and `docs/superpowers/specs|plans/2026-05-18-appstore-readiness.*`

---

## Commits on this branch (oldest → newest)

| Commit | What | Why |
|---|---|---|
| `019f3af` | app.json `isIosBackgroundLocationEnabled: false`; untrack orphan `ios/VelaVision/Info.plist` | **Guideline 2.5.4** — the real root cause of two rejections (see Gotcha #1) |
| `901af28` | CheckInScreen: enabled "Link a patient to get started" CTA when no patient; PatientsTab `startView` param | **Guideline 2.1(a)** — mic was a greyed dead-end |
| `b1b394c` | `src/config/reviewer.ts` + `useSubscription` short-circuit to free tier for reviewer email | **Guideline 2.1(b)** — makes the post-trial paywall reliably reachable |
| `5a7daf3` | `useVoiceSession`: explicit iOS audio session (DoNotMix, no background) | iPad voice robustness |
| `079b4f7` | `client.ts`: cold-start retry (fast → cache → 35s retry; writes single 35s) | Render free tier ~30s spin-up was failing first launch |
| `8609b48` | `validateConfig()` fail-fast; CORS allowlist; request/error logging | Backend hardening |
| `9308d8e` | ErrorBoundary `componentDidCatch` + global JS handler | Crash-reporting funnels (Sentry wire-in points) |
| `28d9355` | `docs/APP_STORE_RESUBMISSION.md` | The submission checklist + copy-paste review notes |

**Verification done:** `npx tsc --noEmit` clean on all changed files; `npx expo config --type introspect --json` → `UIBackgroundModes == ["fetch"]` (location gone). Test suite (`npx vitest run`) **cannot run here** — its `beforeAll` needs a Mongo at `TEST_MONGODB_URI` (pre-existing requirement, not a regression; our changes don't affect test setup).

---

## ⚠️ Gotchas the next person MUST know

1. **iOS native config source of truth is `app.json` + config plugins, NOT `ios/`.** `.gitignore` ignores `/ios`; EAS Build runs `expo prebuild` and regenerates `Info.plist` from `app.json`. **Editing `ios/VelaVision/Info.plist` directly does nothing for EAS builds** — that's exactly why the 2.5.4 rejection repeated twice (prior fixes edited the gitignored plist). Always verify plist changes with `npx expo config --type introspect --json`.

2. **Reviewer test-mode ↔ subscription enforcement conflict.** `REVIEWER_EMAIL` in `src/config/reviewer.ts` forces that account to the **free** tier so the reviewer can reach the paywall. The matching Supabase account must exist **with a demo patient linked** or the mic won't work (re-breaks 2.1a). **If anyone later adds server-side subscription gating to voice/AI/profile, they MUST exempt the reviewer account** or it re-breaks Guideline 2.1(a). This is why subscription enforcement was deliberately deferred (see `docs/APP_STORE_RESUBMISSION.md` §D).

3. **Build/version:** `eas.json` has `appVersionSource: "remote"` + `autoIncrement: true` → EAS owns the build number; `app.json` `buildNumber` is cosmetic. Don't waste time bumping it.

4. **HealthKit 5.1.1(iv) needs no change** — button is already "Continue" + iPad guard exists. Verified, untouched.

---

## What the partner needs to do (process — see `docs/APP_STORE_RESUBMISSION.md` for full steps)

1. Create caregiver account **`appreview@velavision.org`** + link a demo patient to it.
2. Confirm IAP products `vela_starter_monthly` / `vela_unlimited_monthly` are live and attached to this version (else paywall is empty → 2.1(b) fails again).
3. App Store Connect → App Review Information: tick "Sign-in required", enter the creds, paste the review notes (verbatim text is in the doc).
4. `eas build -p ios --profile production` → smoke-test launch → screenshots from iOS Simulator (sizes/screens in the doc) → replace in Media Manager → Submit.

## Deferred (NOT blockers — post-approval; rationale in `docs/APP_STORE_RESUBMISSION.md` §D)

Subscription enforcement (revenue leak, conflicts with reviewer mode — needs design), Sentry/crash reporting (needs account+DSN; hooks are in place), durable file storage for visit-prep PDFs (Render ephemeral disk), in-app data consent flows (legal-wording review), ~17 pre-existing `tsc` errors on `main`.
