# Patient-Scoped Routines & Medications Fetch

Status: approved.

## Problem

`GET /api/routines` and `GET /api/medications` always resolve to the *calling user's own* linked patient via `resolvePatientId` (`src/server-core/patientResolver.ts`), which reads `users.patient_id` — a single legacy link, unrelated to the newer multi-patient `seats` system that `src/server-routes/calendarEvents.ts` already uses. There is no way for a caregiver managing multiple patients to fetch a *different* patient's routines/medications.

This surfaced as a real gap in Phase 3's iPhone widget work: `refreshWidgetForPatient(patientId)` needs a specific patient's routines/medications to build that patient's widget checklist, but the only fetch functions available (`fetchRoutines()`, `fetchMedications()`) always return the caller's own patient — silently wrong (or empty) for any caregiver acting on someone other than their default-linked patient.

## Fix

Add an optional `?patientId=<id>` query parameter to both `GET /api/routines` and `GET /api/medications`.

- **Absent** (every existing call site): unchanged behavior — resolves via `resolvePatientId` to the caller's own linked patient. Zero risk to current callers.
- **Present**: verify access via the existing `userHasPatientAccess(db, userId, patientId)` helper (`src/server-core/seatResolver.ts`, already used by `calendarEvents.ts`) — reject with `403 { detail: "No access to this profile" }` if it returns null — then scope the query to that `patientId` instead of the resolved own-patient id.

No new access-control logic is introduced; this reuses the same helper already trusted for calendar-event access.

## Data flow

1. `src/api/client.ts`'s `fetchRoutines(patientId?: string)` and `fetchMedications(patientId?: string)` gain an optional parameter, appended as `?patientId=...` when provided.
2. `src/services/calendarApi.ts`'s `refreshWidgetForPatient(patientId, ...)` (Phase 3) passes the patient it's actually refreshing, instead of relying on the caller's own default.
3. All other existing callers of `fetchRoutines()`/`fetchMedications()` (patient's own `TodayScreen`, `useRoutine`, `useMeds`) call with no argument, unchanged.

## Testing

- Backend: extend `src/server-routes/routines.test.ts` (or add if absent) and `medications.test.ts` similarly — cases: no `patientId` param behaves as today; `patientId` present + caller has access returns that patient's data; `patientId` present + caller lacks access returns 403.
- Frontend: no new automated test required (thin fetch wrapper, matches existing `calendarApi.ts` precedent of no unit tests on the client layer) — verified via the widget's existing manual on-device checklist.

## Out of scope

- `GET /api/reminders` is NOT touched by this fix (per explicit scope decision) — the widget doesn't use reminders today, and fixing it now would be unrequested scope.
- POST/PATCH/DELETE routes for routines/medications are unaffected — a caregiver still only creates/edits their own default patient's items through the existing UI flows; this fix is read-scoping only, for the widget's background refresh.
