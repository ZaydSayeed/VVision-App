# Vela Vision — Product Due-Diligence Review

**Subject:** Vela Vision — AI smart-glasses companion app for dementia patients & caregivers (iOS, React Native / Expo + Supabase + MongoDB + Express/Render)
**Date:** 2026-06-16
**Reviewer lens:** Senior PM · UX Researcher · Accessibility Auditor · Dementia-Care Specialist · Mobile Growth Lead · QA Lead — written at the scrutiny of a $10M pre-investment diligence pass.
**Stance:** Adversarial. Nothing is assumed correct. Every finding is grounded in the actual code at a specific `file:line`.

---

## How to read this report

1. **Founder Summary** — executive summary, 90-day roadmap, and the launch-readiness verdict. *Start here.*
2. **Cross-Cutting Deliverables** — Top 25 improvements, four Top-10 lists (dementia UX, caregiver, accessibility, safety), the full Risk Matrix, biggest product risks, and missing differentiators.
3. **Dimension Sections (13)** — the detailed findings, each in the format **Issue → Description → Why it matters → Impact → Severity → Recommendation → Effort → Expected impact → Evidence**.

Finding IDs are stable and cross-referenced throughout (e.g. `SAFE-1` = Safety finding 1, `AI-6` = AI finding 6, `CARE-2` = Caregiver-flows finding 2).

---

## Methodology

- **13 parallel dimension auditors**, each grounded in the real source tree (the in-repo `CLAUDE.md` was found to be materially stale — e.g. it claims 3 patient tabs; the code ships 5 tabs + 2 floating action buttons — so the audit trusts the code, not the docs).
- **Adversarial verification pass** on every Critical/High finding: each "feature X is missing/broken" claim was grep-/read-confirmed against the code before it was allowed to survive, so the report does **not** falsely claim absent features that in fact exist (geofencing, live-stream, voice check-ins, biomarkers, and seats all exist in some form and are assessed on their *real* state).
- **Independent re-verification** of the three load-bearing Critical claims by the lead reviewer:
  - *Help/SOS sends no push* — confirmed at `src/server-routes/helpAlerts.ts:42-56` (insert only; no notification on the path).
  - *Wandering/geofence is dead code* — confirmed: `startLocationWatcher()`/`startGeofencingAsync` in `src/services/locationWatcher.ts` are **never imported or called** anywhere in the app; the server-side zone-exit push (`src/server-routes/patientTokens.ts:38`) therefore can never fire.
  - *AI auto-writes medications without confirmation* — confirmed at `src/server-routes/assistant.ts:196-211` (`insertOne` directly from the LLM tool call; exposed to the patient-side Vision sheet).

## Findings at a glance

| Severity | Count |
|----------|-------|
| 🔴 Critical | 29 |
| 🟠 High | 60 |
| 🟡 Medium | 49 |
| 🟢 Low | 9 |
| **Total** | **147** |

**Verdict: NOT READY.** Detail in the Founder Summary below.

---
