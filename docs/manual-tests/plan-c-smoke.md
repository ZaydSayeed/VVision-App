# Plan C Smoke Tests (Expo Go + physical device)

Voice features require microphone access; simulator mics are unreliable.

1. **Permission** — First launch of CheckInScreen prompts for mic. Allow → button goes from "Connecting…" to "Listening…" within 2s.
2. **Happy path** — Record "Mom had a tough morning but smiled when I put on her favorite hymn." Stop. Transcript appears. Tap Save → returns to home.
3. **Verify write** — From Postman or `curl`, `GET /api/profiles/:patientId/memory/search?q=hymn` returns at least one result.
4. **Connection drop** — Turn airplane mode on mid-record. UI transitions to `error` state within 5s; user can retry.
5. **Fallback to text** — Tap the "Voice not working?" link. Text screen opens. Type, save, confirm write.
6. **Gemini key missing** — Unset `GEMINI_API_KEY`, restart backend. `POST /api/live/session/:id` returns 500 with "GEMINI_API_KEY not set". UI shows error state.
