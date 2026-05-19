# App Store Resubmission — Round 3 Checklist

Branch: `fix/appstore-review-round3`. Submission being addressed: `4510345c-fce4-4c87-aee6-c61949df9dab` (Build 1.0(11), reviewed on iPad Air 11" M3 / iPadOS 26.5).

---

## A. Code fixes — DONE on branch (verify they're in the build)

| Guideline | Fix | Where |
|---|---|---|
| 2.5.4 location | `isIosBackgroundLocationEnabled: false` so prebuild stops adding `location` to UIBackgroundModes | `app.json` |
| 2.1(a) mic greyed out | Enabled "Link a patient to get started" CTA when no patient linked | `src/screens/caregiver/CheckInScreen.tsx`, `PatientsTab.tsx` |
| 2.1(b) post-trial IAP | Reviewer account deterministically lands in expired-trial/free state | `src/config/reviewer.ts`, `src/hooks/useSubscription.ts` |
| 5.1.1(iv) HealthKit | Already "Continue" + iPad guard (no change needed) | `src/screens/patient/HealthOnboardingScreen.tsx` |
| iPad voice | Explicit iOS audio session config | `src/hooks/useVoiceSession.ts` |

**Verified:** `npx expo config --type introspect --json` → `UIBackgroundModes == ["fetch"]` (no `location`).

---

## B. App Store Connect — MUST DO before resubmitting (process, not code)

### B1. Create the reviewer demo account
- Sign up a **caregiver** account with email **exactly** `appreview@velavision.org` (must match `REVIEWER_EMAIL` in `src/config/reviewer.ts`). Pick a password — record it for B3/B4.
- Create a second **patient** demo account, get its link code, and **link it to the caregiver account** (Patients tab → add patient → enter code). Without a linked patient the reviewer cannot test voice check-in (Guideline 2.1a).
- No RevenueCat/sandbox setup needed for trial state — the app forces this account to the post-trial "free" tier in code.

### B2. In-App Purchase products live
- Confirm `vela_starter_monthly` and `vela_unlimited_monthly` exist in App Store Connect, are in the **"Ready to Submit"** state, and are **attached to this app version**.
- Confirm the RevenueCat offering containing both packages is **current/published** (production).
- If these aren't live, the paywall renders with no purchasable plans → automatic 2.1(b) failure again.

### B3. App Review Information (App Store Connect → this version → App Review Information)
- Check **"Sign-in required"**.
- **User name:** `appreview@velavision.org`
- **Password:** _<the password from B1>_
- Paste this into **Notes** (edit credentials/price if they differ):

```
DEMO ACCOUNT
Username: appreview@velavision.org
Password: <password>
This is a caregiver account with one patient already linked. Its free trial is
expired, so it is on the free tier — used to demonstrate the post-trial purchase
flow below.

POST-TRIAL IN-APP PURCHASE FLOW (Guideline 2.1(b))
1. Log in with the demo account above.
2. Open the "Care Team" tab → tap "Invite" (invite a care-team member).
3. Because the trial has expired (free tier), the app shows the subscription
   paywall ("Pick your plan").
4. Two auto-renewing subscriptions are offered, both purchased via Apple
   In-App Purchase (StoreKit, through RevenueCat):
     • Starter — 2 care-team seats
     • Unlimited — unlimited seats
   Each includes a 7-day free trial. There is no external/web purchase path.

VOICE CHECK-IN (Guideline 2.1(a))
The demo account has a patient linked, so on the "Check In" screen the
microphone "Start" button is enabled and functional. If an account has no
patient linked, the screen now shows an enabled "Link a patient to get
started" button (it is never a disabled dead-end).

LOCATION / GEOFENCING (Guideline 2.5.4)
The only location feature is an optional patient "Safe Zone": caregiver opens a
patient's profile → Safe Zone → sets a home address + radius. If the patient's
device leaves the radius, the caregiver is alerted. This uses iOS region
monitoring, which does not require the "location" background mode — the
"location" entry has been removed from UIBackgroundModes (UIBackgroundModes is
now ["fetch"] only).

HEALTHKIT (Guideline 5.1.1(iv))
Health onboarding is informational; the button is labeled "Continue". HealthKit
is iPhone-only — on iPad the screen shows an "available on iPhone" message.
```

### B4. Build & version
- `eas.json` uses `appVersionSource: "remote"` with `autoIncrement: true` → EAS sets the build number (it auto-increments past 11). The `app.json` `buildNumber` is cosmetic.
- Build from this branch: `eas build -p ios --profile production`.
- After install, smoke-test launch (no location-related launch crash — there were prior "iOS 26 launch crash" fixes; the config is now consistent).

### B5. Screenshots (Guideline 2.3.10) — do LAST, after the build
- Capture from the **iOS Simulator** (clean iOS status bar; Simulator → Device → Override Status Bar → set time 9:41, full battery, full signal).
- Required sizes: iPhone 6.9" (1320×2868), iPhone 6.7" (1290×2796), iPad Pro 13" (2064×2752).
- Suggested screens: Caregiver Timeline, Patient status/dashboard, Patient Today, Patient Help, Paywall ("Pick your plan").
- App Store Connect → this version → Previews and Screenshots → **View All Sizes in Media Manager** → delete the old (HTML-mockup) images for every size → upload the new Simulator screenshots → Save.

### B6. Submit
- Confirm B1–B5 done, then submit for review (or `eas submit -p ios`).

---

## C. Production-hardening shipped alongside (this branch)

- **Render cold-start resilience** — `src/api/client.ts`: GETs do a fast attempt, fall back to cache if offline, otherwise retry once with a 35s window; writes use a single 35s attempt. Prevents a network error on first launch when the backend is spinning up (also de-risks the reviewer hitting a cold server).
- **Backend env-var fail-fast** — `src/server-core/config.ts` `validateConfig()` (called from `server.ts`): refuses to start with a clear message if `MONGODB_URI` / `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are missing; warns on missing optional keys.
- **CORS tightened** — `src/server.ts`: browser origins limited to localhost + `*.velavision.org`; native app requests (no Origin) and Expo Go unaffected.
- **Observability hooks (no new dependency)** — `ErrorBoundary.componentDidCatch` logs render crashes; a global JS error handler in `App.tsx` chains RN's default; backend request logging now includes status + latency and the error handler logs method/path/stack. Each is a single funnel where a crash reporter (e.g. Sentry) can be wired later.

---

## D. Deferred — recommended AFTER approval (not submission blockers)

- **Subscription enforcement.** "Voice check-ins / Coach AI / Living Profile" are advertised as paid but not gated server-side (only seat-invite returns 402). Revenue leak, not an Apple blocker. **Deliberately not done now:** the reviewer account is forced to the free tier, so gating voice check-ins would re-disable the mic and re-break Guideline 2.1(a); and gating endpoints without client-side paywall routing would make features error on tap (new 2.1 risk). Needs a proper paywall-routing design + reviewer exemption — do post-approval.
- **Crash reporting (Sentry/Bugsnag).** Hook points are in place (`ErrorBoundary.componentDidCatch`, the `App.tsx` global handler, backend error handler) — needs an account + DSN to finish.
- **Durable file storage.** Visit-prep PDFs are written to Render's ephemeral disk (lost on redeploy). Move to S3/GCS (needs a bucket + credentials) or a Render persistent disk.
- **In-app data consent.** Only the AI assistant has a consent gate. A health-data app should add explicit consent for face enrollment, HealthKit sync, and background location. Wording needs legal review (wellness-vs-medical language) — design with the frontend-design skill.
- **Pre-existing TypeScript errors.** ~17 `tsc` errors exist on `main`, unrelated to these changes (Babel strips types so runtime is unaffected). Worth a cleanup pass.
