# Plan D Smoke Tests

1. **Gait capture** — During a voice check-in, walk in a circle. `GET /api/profiles/:patientId/events?kind=gait` returns a doc with non-zero cadence.
2. **Typing capture** — Type 40 characters in TextCheckIn. Check `?kind=typing_cadence`. `wpm` between 20 and 120.
3. **Sensor toggle off** — Disable gait in settings. Do a voice check-in. No gait event appears for the new window.
4. **Queue offline** — Put phone in airplane mode. Trigger gait capture. Expect event queued in AsyncStorage. Re-enable network → event appears in backend within 2 min.
5. **HomeKit pair** — On iOS, enable smart home. Trigger motion on a paired HomeKit motion sensor. `GET /api/profiles/:patientId/events?kind=motion` shows the event within 10s.
