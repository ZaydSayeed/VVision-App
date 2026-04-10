# Design: Home Screen Restructure + Caregiver Notes + Help Alert Delay Fix

**Date:** 2026-04-09

---

## 1. Help Alert Delay Fix

### Problem
`useHelpAlert` polls every 15 seconds. This causes up to a 15-second delay in both directions:
- Patient sends help → caregiver doesn't see it for up to 15s
- Caregiver marks handled → patient doesn't see the update for up to 15s

### Solution: Adaptive Polling
Change `useHelpAlert` to poll at two rates:
- **4 seconds** when the situation is active (patient has a pending/sent alert, or caregiver has pending help alerts)
- **15 seconds** when idle (no pending alerts)

The hook already has `alerts` state and `sending`/`sentAt` — use those to detect active state and switch intervals dynamically. No backend changes needed.

---

## 2. Caregiver Notes Feature

### Overview
Caregivers can write notes/instructions for a patient. The most recently pinned note appears on the patient's Today screen. Tapping it opens a full notes history. Only one note can be pinned at a time — pinning a new note unpins the previous one.

### Data Model
New `caregiverNotes` collection in MongoDB:
```
{
  _id: ObjectId,
  patientId: string,       // links to patient
  caregiverId: string,     // Supabase user ID of author
  caregiverName: string,   // denormalized for display
  text: string,            // note content (max 500 chars)
  pinned: boolean,         // only one per patient can be true
  timestamp: ISO string,
}
```

### Backend Routes (new)
- `GET /api/notes?patientId=<id>` — returns all notes for the given patient. Patients use their own ID; caregivers pass the target patient's ID. Auth token determines permission.
- `POST /api/notes` — caregiver creates a note `{ patientId, text, pinned }`; if `pinned: true`, unpins all previous notes for that patient first
- `PATCH /api/notes/:id/pin` — pin/unpin a specific note (toggles; unpins others if pinning)
- `DELETE /api/notes/:id` — caregiver deletes a note

All routes validate with Zod and guard ObjectId before use.

### Caregiver Side — Where Notes Are Written
Notes are written from `PatientStatusScreen` (caregiver's view of a single patient). A new "Notes" section is added below the existing content with a note card matching the patient home screen style. It includes:
- The pinned note displayed with violet left border + thumbtack icon
- A violet `+` button on the bottom right of the card to open the add-note bottom sheet
- A `N notes ›` tap target to see the full notes history
- Swipe-to-delete on notes in the history view
- Tap thumbtack on any note in history to re-pin it

### AI Assistant Integration
The existing AI assistant chat can log notes via intent detection. When the caregiver says something like "leave a note for John: remember to take meds", the AI calls the `POST /api/notes` endpoint and confirms the note was saved.

### Patient Side — Today Screen (see section 3)
The pinned note appears on the patient's Today screen. The patient cannot write or edit notes — read-only.

### `useNotes` Hook
New hook exposing:
- `pinnedNote` — the single pinned note (or null)
- `notes` — full list for expanded view
- `reload`
- Polls every 30 seconds (notes are not urgent)

---

## 3. Today Screen Restructure

### Layout (top to bottom)
1. **Greeting** — "Good morning, John" (existing, kept as-is)
2. **Caregiver note card** — violet left border, shows pinned note text + caregiver name + timestamp. Top right: `N notes ›` tap target to open expanded view. If no note exists, card shows a placeholder ("No notes from your caregiver yet"). The card is **read-only** for patients — no `+` button. The `+` for writing notes lives on the caregiver's `PatientStatusScreen` (see section 2).
3. **Split columns** — two equal-height cards side by side:
   - **Left — Medications** (amber accent): list of meds with checkboxes, progress bar, amber `+` button bottom right
   - **Right — Tasks** (sage accent): tasks and reminders unified in one list with checkboxes, progress bar, sage `+` button bottom right

Reminders are folded into the Tasks column — no separate "Reminders" header or section. The existing `useReminders` and `useRoutine` data is merged into a single list sorted by time.

### Add Note Bottom Sheet (caregiver only, lives on PatientStatusScreen)
The `+` on the note card in `PatientStatusScreen` opens a bottom sheet with:
- Drag handle centered at top
- Thumbtack icon top right: outline = unpinned, filled violet = pinned. Tapping toggles.
- Text input (multiline, max 500 chars)
- "Save Note" button (violet pill)

### Expanded Notes View
Tapping the `N notes ›` area opens a modal/screen:
- Back chevron + "Notes from [caregiver name]" header
- Pinned note at top with "Pinned" label
- "Previous Notes" section below with older notes listed newest-first
- Each note shows timestamp and text

### Removed from Today Screen
- Standalone Reminders section (merged into Tasks)
- Reminders section header

---

## 4. Out of Scope
- Push notifications (would require a different infrastructure; polling is sufficient for now)
- Multiple caregivers leaving notes simultaneously (last-pin wins)
- Note editing (delete and re-create)
