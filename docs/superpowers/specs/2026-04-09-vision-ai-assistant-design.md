# Vision AI Assistant — Design Spec

**Date:** 2026-04-09  
**Status:** Approved

---

## Goal

Add a patient-facing AI assistant ("Vision") to the VVision-App that:
- Lives in the app header as a small sparkle icon with a green online dot
- Opens as a bottom sheet chat panel when tapped
- Shares context seamlessly with the smart glasses (same MongoDB, same reminders, same conversation history)
- Uses Groq API (Gemma 4) for inference — works on any network, no local Ollama required

---

## Architecture

### Shared MongoDB as Sync Layer

The glasses (VelaVision) and the app both read/write the same MongoDB Atlas database. Two new collections are added:

- **`reminders`** — created by either glasses or app, shown in both places
- **`conversations`** — chat history per patient, read by both glasses and app as context

The glasses continue using local Ollama. The app uses Groq API. Both get the same context from MongoDB.

```
Patient App (Groq) ──┐
                     ├── MongoDB Atlas ── Smart Glasses (Ollama)
Reminders/Convos ────┘
```

---

## Data Models

### `reminders` collection
```ts
{
  _id: ObjectId,
  patient_id: string,        // links to patients collection
  text: string,              // "Call Sarah"
  time: string,              // "10:00 AM" (optional)
  recurrence: string,        // "once" | "daily" | "every 2 hours" (optional)
  source: "glasses" | "app", // where it was created
  created_at: Date,
  completed_date: string,    // ISO date string, null if not done
}
```

### `conversations` collection
```ts
{
  _id: ObjectId,
  patient_id: string,
  role: "user" | "assistant",
  content: string,
  created_at: Date,
}
```
Keep last 20 messages per patient (enforced on write — delete oldest when count > 20).

---

## Frontend Changes (VVision-App)

### 1. Header icon — `src/navigation/RootNavigator.tsx`

Add a `VisionButton` component rendered **between the logo and the hamburger**, patient-only (hidden for caregivers via `user.role`).

**Appearance:**
- 26×26 circle, border `1.5px solid colors.violet`, background `colors.violet50`
- Sparkle SVG icon (Ionicons `sparkles-outline` or custom SVG) in `colors.violet`
- Small 7×7 green dot (top-right) when Groq is reachable — `colors.sage`, white border
- Tapping opens the `VisionSheet` bottom sheet

### 2. Bottom sheet — `src/components/VisionSheet.tsx` (new file)

A `Modal` with `animationType="slide"` anchored to the bottom. Covers ~70% of screen height. Background is `colors.bg` (white/dark-aware). Does not replace any existing screen.

**Structure:**
```
[handle bar]
[Vision header: sparkle avatar | "Vision" title + "AI Assistant" subtitle | close X]
[divider line]
[ScrollView: chat messages]
[input bar: text input + mic button (violet gradient pill)]
```

**Message bubbles:**
- Vision messages: `colors.surface` background, `colors.text`, left-aligned with sparkle avatar
- Patient messages: `colors.violet` background, white text, right-aligned, no avatar

**Context sent to Groq on every message:**
- Last 20 conversation turns (from `conversations` collection)
- Today's routines + meds (fetched from existing API)
- Upcoming reminders (from new `/api/reminders`)
- Patient first name

**After each response:** save both the user message and assistant reply to `conversations` via `POST /api/conversations`.

### 3. Reminders section — `src/screens/patient/TodayScreen.tsx`

Add a new `<RemindersSection>` component below the medications list (above the bottom tab bar). Follows the same pattern as the existing routine/meds sections:

- Section label: "REMINDERS" (11px, uppercase, `colors.muted`)
- Each reminder: white card, `radius.xl`, violet left border (4px), bell icon (`Ionicons bell-outline`), reminder text + time + source ("via glasses" / "via app")
- Pull-to-refresh includes reminders reload

### 4. New hook — `src/hooks/useReminders.ts` (new file)

Mirrors `useRoutine` pattern:
```ts
{ reminders, addReminder, deleteReminder, loadError, reload }
```
Backed by `GET/POST/DELETE /api/reminders`.

### 5. API client additions — `src/api/client.ts`

Add:
- `fetchReminders()` — `GET /api/reminders`
- `addReminder(data)` — `POST /api/reminders`
- `deleteReminder(id)` — `DELETE /api/reminders/:id`
- `sendMessage(text)` — `POST /api/assistant/chat` (returns `{ reply: string }`)
- `saveConversationTurn(role, content)` — `POST /api/conversations`
- `fetchConversations()` — `GET /api/conversations`

---

## Backend Changes (VVision-App server)

### New route files

**`src/server-routes/reminders.ts`**
- `GET /api/reminders` — fetch reminders for `patient_id` (from token)
- `POST /api/reminders` — create reminder (Zod: `text`, optional `time`, `recurrence`, `source`)
- `DELETE /api/reminders/:id` — delete by id (ObjectId guard)

**`src/server-routes/assistant.ts`**
- `POST /api/assistant/chat` — main chat endpoint
  1. Verify patient auth
  2. Fetch last 20 conversations from MongoDB
  3. Fetch today's routines, meds, reminders from MongoDB
  4. Build system prompt with context
  5. Call Groq API (`llama-3.3-70b-versatile` or `gemma2-9b-it` — whichever available on Groq free tier)
  6. Return `{ reply: string }`
- Rate limited to 30 requests/minute per user

**`src/server-routes/conversations.ts`**
- `GET /api/conversations` — last 20 for patient
- `POST /api/conversations` — save a turn (`role`, `content`)
  - After insert, delete oldest if count > 20

### MongoDB updates — `src/server-core/database.ts`
Add `reminders` and `conversations` collections with indexes:
- `reminders`: index on `patient_id`
- `conversations`: index on `patient_id` + `created_at`

### Environment variable
Add `GROQ_API_KEY` to `.env` and server config. Backend reads it for the Groq SDK call.

---

## VelaVision Glasses Changes (`/Users/haadisiddiqui/projects/VelaVision`)

### 1. Write reminders to shared MongoDB

In `src/dvision/reminders.py`, when a reminder is created via voice ("remind me to call Sarah at 10"), also write it to the shared MongoDB `reminders` collection (same URI as VVision-App's `MONGODB_URI`).

### 2. Read reminders from shared MongoDB

The glasses' reminder scheduler should also poll the shared `reminders` collection so reminders set in the app show up on the glasses.

### 3. Read/write conversations

In `src/dvision/assistant.py`, after each exchange:
- Save the user query + Vision reply to `conversations` collection
- On context build, fetch last 10 conversations from MongoDB for context

---

## System Prompt (Groq)

```
You are Vision, a warm and patient AI assistant built into smart glasses and a companion app
for someone who needs help remembering things.

Keep responses to 1-3 short sentences. Use a warm, reassuring tone.
Never give medical advice. Never mention that you are AI.
It is okay to repeat information — the person may ask the same thing multiple times.

PATIENT: {first_name}
CURRENT TIME: {time}
TODAY: {date}

TODAY'S ROUTINE:
{routines}

TODAY'S MEDICATIONS:
{medications}

UPCOMING REMINDERS:
{reminders}

RECENT CONVERSATION:
{conversation_history}
```

---

## What Is NOT Changing

- Bottom tab bar (Today | Help | Faces)
- Menu/side drawer
- Any caregiver screens
- Any existing Today screen content (routine, meds, greeting)
- FacesScreen, HelpScreen
- Auth flow
- All existing API routes

---

## Files to Create
- `src/components/VisionSheet.tsx`
- `src/hooks/useReminders.ts`
- `src/server-routes/reminders.ts`
- `src/server-routes/assistant.ts`
- `src/server-routes/conversations.ts`

## Files to Modify
- `src/navigation/RootNavigator.tsx` — add Vision icon button (patient-only)
- `src/screens/patient/TodayScreen.tsx` — add RemindersSection
- `src/api/client.ts` — add new API methods
- `src/server-core/database.ts` — add new collections + indexes
- `src/server.ts` — register new routes
- `src/types/index.ts` — add Reminder + ConversationTurn types
- `/Users/haadisiddiqui/projects/VelaVision/src/dvision/reminders.py` — write to shared MongoDB
- `/Users/haadisiddiqui/projects/VelaVision/src/dvision/assistant.py` — read/write conversations
- `/Users/haadisiddiqui/projects/VelaVision/src/dvision/config.py` — add shared MongoDB URI

---

## Spec Self-Review

- No TBD sections
- No emoji in UI spec
- Architecture matches feature descriptions
- Caregiver exclusion handled at icon render level (`user.role === "patient"`)
- Rate limiting on assistant route prevents abuse
- Conversation pruning (max 20) prevents unbounded DB growth
- VelaVision changes are minimal and scoped to reminders + conversations only
