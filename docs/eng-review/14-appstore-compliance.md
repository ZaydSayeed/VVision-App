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
