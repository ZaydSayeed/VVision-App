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
