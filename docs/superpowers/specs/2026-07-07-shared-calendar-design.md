# Shared Patient Calendar + Apple Calendar Sync + iPhone Widget

Status: approved.

## Problem

Each patient needs a shared calendar that both they and their caregiver(s) can see and use to organize the patient's life — not just medical/condition-related items, but anything (appointments, social visits, personal tasks). Caregivers will do most of the adding; patients should be able to see and manage their own entries too. This should also (a) sync one-way into the native Apple Calendar app on each person's own device, and (b) surface today's items on an iPhone home-screen widget.

This spec covers all three pieces. They ship as three sequential implementation phases (calendar core → Apple Calendar sync → widget) since sync and the widget both depend on the core data model, but are designed together here since the user wants the full picture upfront.

## 1. Data model & backend

New collection `calendar_events`, one document per event, scoped to a single patient:

- `patientId`
- `title`
- `category`: `"medical" | "medication" | "social" | "personal"` — color-coded in the UI
- `startAt`, `endAt` (ISO datetime)
- `notes` (optional)
- `recurrenceRule` (optional RRULE string — iCalendar recurrence format, same format Apple's EventKit uses internally)
- `createdBy` (userId) — enforces the edit-permission rule below
- `completedDates` (array of ISO dates) — tracks which occurrences of a recurring event (e.g. daily medication) have been marked done; also read by the widget for checkmarks
- `appleEventId` (optional, per-device — see Section 3)

The existing `visits` collection (doctor appointments: provider name/role, scheduled time, notes) is absorbed into `calendar_events` with `category: "medical"`. Existing visits screens get rebuilt on top of the new collection; the old `visits.ts` route and collection are retired once migrated.

New routes under `src/server-routes/calendarEvents.ts`, following the existing `visits.ts` pattern (`authMiddleware`, `requirePatientAccess`):

- `POST /:patientId/calendar-events` — create
- `PATCH /:patientId/calendar-events/:id` — edit (only if `createdBy === req.seat.userId`)
- `DELETE /:patientId/calendar-events/:id` — delete (same restriction)
- `GET /:patientId/calendar-events?from=&to=` — list events in a date range, expanding any `recurrenceRule` occurrences server-side using `rrule.js` for the requested window
- `POST /:patientId/calendar-events/:id/complete` — mark an occurrence (by date) as done, appends to `completedDates`

## 2. Permissions & app UI

- Patient and caregiver(s) both see the same calendar for that patient — month/week/day view, following the app's existing screen conventions.
- Anyone (patient or caregiver) can create an event.
- Edit/delete is restricted to whoever created the event (`createdBy`). This means a patient can't accidentally remove a caregiver-added doctor visit, but can freely manage things they added themselves.
- Recurrence in the UI is preset-based (daily / weekly / custom simple picker) — raw RRULE syntax is never shown to the user, only stored internally.
- Push notification (existing `src/server-core/push.ts` system) fires before each event — default 30 min lead — to both the patient and any linked caregivers.

## 3. Apple Calendar sync

- Uses `expo-calendar` (wraps Apple's EventKit). This is native code — requires a fresh EAS/dev-client build; won't work in an already-installed build until rebuilt.
- Opt-in per user, per device, from Settings — Apple requires each device to grant its own calendar permission; this can't be delegated.
- **One-way only**: Vela Vision → Apple Calendar. Creating/editing/deleting an event in the app pushes that change to the phone's default Apple Calendar via EventKit. Edits made directly in Apple Calendar do **not** flow back into Vela Vision — Vela Vision remains the single source of truth. This avoids two-way conflict resolution entirely.
- The EventKit event ID returned on creation is stored (client-side, per device) so later edits/deletes from the app can find and update the correct native calendar entry.
- Recurring events map directly to EventKit's own recurrence rules since both use RRULE.

## 4. iPhone widget

- Native WidgetKit extension (Swift) added via an Expo config plugin. Requires Xcode involvement and a native/EAS build — cannot be built in pure JS/React Native.
- **Content** (confirmed): today's reminders + medications shown as a checklist, with a checkmark/strikethrough when completed, **plus** today's calendar appointments — only appointments scheduled for the current day, nothing from other days — listed in the same view (the "one glance for today" version).
- Caregiver's widget: shows one selected patient's checklist (add multiple widget instances for multiple patients); shows the same completion state the patient sees, so a caregiver can tell what's done without opening the app.
- Patient's widget: always shows their own day, no patient picker.
- Data flow: whenever the main app fetches/updates today's data, it writes a small JSON snapshot into a shared "App Group" container (Apple's on-device sharing mechanism between an app and its widget). The widget's timeline provider reads that local file on a periodic refresh (~15–30 min) and whenever the main app is opened/foregrounded. No network call or auth handling inside the widget's own Swift code.
- Tapping the widget deep-links into the app's calendar/checklist screen.

## Out of scope for this spec

- Two-way Apple Calendar sync (explicitly rejected — one-way only).
- Android widget (not requested; iPhone only).
- Exposing raw recurrence rules to end users.
