<h1 align="center">Vela Vision — Caregiver Dashboard</h1>

<p align="center">
Mobile companion app for the D-Vision dementia-assist smart glasses.<br>
Real-time monitoring, caregiver notes, and unknown face alerts — all from your phone.
</p>

---

## Overview

This is the **caregiver-facing mobile app** for the Vela Vision smart glasses system. It connects to the same MongoDB Atlas database as the D-Vision glasses, giving caregivers a live dashboard to monitor their patient's interactions, manage known contacts, and receive alerts when an unrecognized person is detected.

Built with **Expo (React Native)** and **TypeScript**.

---

## Features

| Feature | Description |
|---------|-------------|
| Timeline feed | Chronological view of all sightings, interactions, and alerts |
| Stat chips | At-a-glance: seen today, active alerts, most frequent visitor, last activity |
| People directory | Cards for each enrolled person with name, relation, and seen count |
| Caregiver notes | Tap-to-edit notes on any person — synced to MongoDB in real time |
| Interaction history | Expandable log of past interactions per person |
| Unknown face alerts | Push-style alerts when the glasses detect an unrecognized face |
| Dismiss with haptics | Swipe away alerts with haptic feedback |
| Pull-to-refresh | Pull down on any screen to refresh data |
| Auto-polling | Data refreshes every 5 seconds + SSE support for instant updates |
| Dark UI | Glassmorphism dark theme matching the D-Vision brand |

---

## Architecture

```
D-Vision Smart Glasses (Raspberry Pi)
        │
        ▼
   MongoDB Atlas  ◄──────  FastAPI Backend (dashboard.py)
        │                         │
        ▼                         ▼
  Vela Vision App ◄─────── REST API + SSE
  (this repo)              /api/people
                           /api/alerts
                           /stream/events
```

### App Structure

```
src/
├── api/client.ts              # REST client + SSE connection
├── config/
│   ├── api.ts                 # Backend URL
│   └── theme.ts               # Design tokens (colors, spacing, radii)
├── types/index.ts             # Person, Alert, VitalsReading, TimelineEvent
├── hooks/useDashboardData.ts  # Data fetching, polling, stats computation
├── screens/
│   ├── TimelineScreen.tsx     # Event feed + stat strip
│   ├── PeopleScreen.tsx       # Person cards
│   └── AlertsScreen.tsx       # Unknown face alerts
└── components/
    ├── StatChip.tsx
    ├── PersonCard.tsx          # Notes editing, interaction history
    ├── TimelineItem.tsx
    └── AlertCard.tsx
```

---

## Quick Start

> Requires **Node.js 18+** and the **Expo Go** app on your phone.

### 1. Clone and install

```sh
git clone https://github.com/ZaydSayeed/VVision-App.git
cd VVision-App
npm install
```

### 2. Configure the backend URL

Edit `src/config/api.ts` and set `API_BASE_URL` to your machine's LAN IP:

```ts
export const API_BASE_URL = "http://192.168.1.100:8000";
```

> Use your computer's local IP (not `localhost`) so the phone can reach the backend.

### 3. Start the D-Vision backend

In the D-Vision (Dementia-Assist) project:

```sh
pip install -e ".[dashboard]"
python -m dvision.dashboard
# Backend running at http://0.0.0.0:8000
```

### 4. Run the app

```sh
npx expo start
```

Scan the QR code with **Expo Go** (Android) or the Camera app (iOS).

---

## API Endpoints

The app consumes these endpoints from the D-Vision FastAPI backend:

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/people` | All enrolled people (excludes face embeddings) |
| `GET` | `/api/alerts` | Last 20 unrecognized face alerts |
| `DELETE` | `/api/alerts/{id}` | Dismiss an alert |
| `POST` | `/api/people/{name}/notes` | Update caregiver notes. Body: `{"notes": "..."}` |
| `GET` | `/stream/events` | SSE stream for real-time updates |

---

## Data Models

### Person

```json
{
  "_id": "ObjectId",
  "name": "Sarah",
  "relation": "Mother",
  "last_seen": "2026-03-08T15:30",
  "seen_count": 12,
  "notes": "Prefers to be called Mom. Allergic to penicillin.",
  "interactions": [
    { "timestamp": "2026-03-08T15:30", "summary": "Recognized at front door" }
  ]
}
```

### Alert

```json
{
  "_id": "ObjectId",
  "type": "unknown_face",
  "timestamp": "2026-03-08T15:45"
}
```

---

## Environment

| Variable | Purpose |
|----------|---------|
| `API_BASE_URL` | FastAPI backend address (set in `src/config/api.ts`) |
| `MONGODB_URI` | MongoDB Atlas connection string (backend-side) |
| `MONGODB_DB_NAME` | Database name, default: `dvision` |

See `.env.example` for reference.

---

## Tech Stack

- **Expo / React Native** — cross-platform mobile
- **TypeScript** — full type safety
- **React Navigation** — bottom tab navigator
- **expo-haptics** — tactile feedback on alert dismiss
- **expo-linear-gradient** — gradient UI elements
- **MongoDB Atlas** — shared database with the smart glasses
- **FastAPI** — backend REST API + SSE

---

## Related

- [D-Vision Smart Glasses](https://github.com/HassanKhan20/D-Vision) — the glasses-side face recognition system this app connects to

---

## Living Profile API (v1 foundation)

Base: `https://vvision-app.onrender.com/api/profiles`

| Method | Path | Purpose |
|---|---|---|
| GET  | `/mine` | Get current user's linked profile |
| PATCH| `/mine` | Update profile fields (stage, history, triggers, routines, meds, providers) |
| POST | `/:patientId/seats` | Invite a sibling/aide to this profile (primary_caregiver only) |
| GET  | `/:patientId/seats` | List seats and pending invites |
| POST | `/accept-invite` | Accept a seat invite by token |
| POST | `/:patientId/memory` | Write a memory event to the profile (Mem0) |
| GET  | `/:patientId/memory/search?q=...` | Semantic search on the profile's memory |

See `docs/superpowers/specs/2026-04-13-caregiver-living-profile-design.md` for design rationale.

### Events & Sensors (Plan D)
| Method | Path | Purpose |
|---|---|---|
| POST | `/api/profiles/:patientId/events` | Ingest batch of passive events (max 100/batch) |
| GET | `/api/profiles/:patientId/events?since=&kind=` | Read recent events (last 24h default) |

Event kinds: `motion`, `door`, `presence`, `sleep`, `gait`, `typing_cadence`, `voice_sample`.

### Pattern Learning + Visit Prep (Plan F)
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/profiles/:patientId/patterns` | List detected patterns |
| POST | `/api/profiles/:patientId/patterns/:patternId/dismiss` | Dismiss a pattern |
| POST | `/api/profiles/:patientId/visits` | Schedule a visit |
| GET | `/api/profiles/:patientId/visits` | List upcoming visits |
| DELETE | `/api/profiles/:patientId/visits/:visitId` | Delete a visit |
| GET | `/api/profiles/:patientId/visits/:visitId/prep.pdf` | Download visit prep PDF |

Cron jobs: nightly (03:00 UTC) pattern inference; every 6h visit prep generation.
PDFs write to `uploads/visit-prep/` — ephemeral on Render free tier, swap to S3 for prod.

### Voice Check-In (Plan C)
| Method | Path | Purpose |
|---|---|---|
| POST | `/api/live/session/:patientId` | Get config to open a Live WebSocket |
| WS | `/api/live/ws?patientId=...` | Bridged connection to Gemini Live |

Client hook: `useVoiceSession(patientId)` in `src/hooks/useVoiceSession.ts`.

---

## License

MIT
