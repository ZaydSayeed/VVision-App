# Plan F Smoke Tests

1. Schedule a visit 2 days out. Run `processDueVisits(db)` manually via a one-off script or `node -e`. Confirm PDF appears in `uploads/visit-prep/<patientId>/<visitId>.pdf`.
2. Open PDF — correct patient name, provider, medications, event summary, patterns.
3. With <10 events in last 30d, `runInferenceAll` returns no patterns for that patient (correctly skips).
4. With >10 events, inference produces 0–5 patterns in the `patterns` collection.
5. Client — Patterns card shows patterns; Dismiss removes them.
6. Visits screen shows visit after scheduling; Download button appears after prep is generated.
