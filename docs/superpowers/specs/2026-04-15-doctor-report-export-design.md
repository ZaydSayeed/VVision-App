# Doctor Report Export — Design Spec

## Overview

On-demand PDF report that caregivers generate and share with doctors. Includes AI-summarized check-in logs, full log appendix, biomarker trends with sparklines, medications, patterns, and family notes — all scoped to a caregiver-selected date range.

Replaces the existing cron-based visit prep generation (which was never surfaced to users).

## Entry Points

### Side Drawer

New "Visit Reports" menu item in `SideDrawer.tsx`.

- **1 linked patient** — navigates directly to the Visit Reports screen scoped to that patient.
- **2+ linked patients** — shows a patient picker first, then navigates.

### Patient Detail Card

New "Doctor Reports" card on `PatientDetailScreen.tsx` with two actions:

- **Schedule visit** — opens the schedule-visit form.
- **Generate report** — opens the export flow.

Both scoped to the patient being viewed (no picker).

## Visit Reports Screen

Replaces the orphaned `VisitsScreen.tsx`. Single screen for the selected patient.

### List View

Shows upcoming + past visits. Each row: provider name, date, status pill ("Upcoming" / "Completed" / "Report ready").

### Actions

- "Schedule visit" button → opens form (provider name, date/time).
- "Generate report" button → opens the export flow. Works with or without a scheduled visit (fully ad-hoc).

### Doctors Section

Per-patient saved doctors (name + email). Managed inline on this screen or via a "Save this doctor for next time?" prompt during the first export flow.

## Export Flow

Two-step bottom sheet triggered by "Generate report".

### Step 1 — Date Range

Preset buttons:

- Last 7 days
- Last 30 days
- Last 90 days
- Custom range (two date pickers)

Tap a preset or confirm custom → advances to Step 2.

### Step 2 — Delivery

Three options:

- **Share** — builds PDF on backend, client downloads the buffer, opens the native iOS/Android share sheet (Mail, Messages, AirDrop, Files, etc.).
- **Email to doctor** — shows list of saved doctors (name + email). Tap one to send. If none saved, inline field to add email + "Save this doctor?" checkbox. Backend sends via Gmail SMTP with PDF attached.
- **Copy link** — uploads PDF to backend, returns a short-lived URL (24h expiry). URL copied to clipboard.

## PDF Content

All log/biomarker sections scoped to the date range the caregiver selected.

### 1. Header

Patient name, dementia stage, date range covered, generation timestamp. If tied to a scheduled visit: provider name + appointment date.

### 2. Medications

Full current meds list (name, dose, schedule). Not date-scoped — always shows the complete current list regardless of date range.

### 3. AI Summary

Gemini 2.5 Flash generates a ~200-word narrative summarizing check-in logs within the date range. Covers mood trends, sleep changes, notable incidents, behavioral shifts.

### 4. Patterns Detected

AI-inferred patterns from Plan F's nightly inference job (if any exist for this patient). Titles + descriptions.

### 5. Biomarker Trends

Gait cadence (accelerometer) and typing cadence stats for the date range. Each biomarker shows:

- Current average vs. prior-period average
- Trend direction (↑ stable ↓)
- Sparkline mini-chart rendered via PDFKit vector drawing (line chart from data points, no image dependency)

Disclaimer at top of section: *"General wellness observations only — not intended as diagnostic measures."*

**Legal note:** Plan D's original rules state "never mark a biomarker as diagnostic" and "any change to wellness-vs-medical claim language requires a legal review." Presenting biomarker data in a doctor-facing PDF is a change in claim context. This spec proceeds with a general wellness disclaimer, but a legal review is recommended before handing these PDFs to clinicians in a real care setting.

### 6. Family Notes

Caregiver notes entered via the existing notes feature, scoped to the date range.

### 7. Appendix: Full Check-In Logs

Every check-in log within the date range in chronological order. Each entry: date, time, source badge (Voice / Text), full verbatim content.

## Technical Changes

### Backend — New Endpoints

All gated by `requirePatientAccess` middleware.

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/profiles/:patientId/doctors` | List saved doctors |
| POST | `/api/profiles/:patientId/doctors` | Add doctor (name + email) |
| DELETE | `/api/profiles/:patientId/doctors/:doctorId` | Remove doctor |
| POST | `/api/profiles/:patientId/report` | Generate PDF, return buffer |
| POST | `/api/profiles/:patientId/report/email` | Generate + email PDF to a saved doctor |
| POST | `/api/profiles/:patientId/report/link` | Generate + upload PDF, return short-lived URL |

**Request bodies:**

- `/report` — `{ startDate: string, endDate: string, visitId?: string }`
- `/report/email` — `{ startDate: string, endDate: string, doctorId: string, visitId?: string }`
- `/report/link` — `{ startDate: string, endDate: string, visitId?: string }`

### Backend — PDF Builder

Expand `buildVisitPrepBuffer` in `src/server-jobs/visitPrepPdf.ts` (or extract to `src/server-core/reportPdf.ts`) to accept:

- `checkinLogs: Array<{ content, source, capturedAt }>`
- `aiSummary: string`
- `biomarkers: { gait: { avg, priorAvg, trend, dataPoints }, typing: { avg, priorAvg, trend, dataPoints } }`
- `familyNotes: Array<{ content, createdAt }>`

Sparklines rendered via PDFKit's `doc.moveTo().lineTo().stroke()` path API — a simple polyline from normalized data points. No external chart library needed.

### Backend — Email

Use Nodemailer with the existing Gmail SMTP config (`GMAIL_ADDRESS`, `GMAIL_APP_PASSWORD` from `.env`). Send PDF as attachment, plain-text body with patient name + date range.

### Backend — Short-Lived Links

Save PDF to `uploads/reports/<uuid>.pdf`. Serve via a new `GET /api/reports/:uuid` endpoint (no auth required — the unguessable UUID acts as an access token). Cleanup: delete files older than 24h lazily on access (check file age before serving, delete if expired).

### Backend — Deletions

- Delete `src/server-jobs/visitPrepJob.ts` (cron logic).
- Remove its cron registration from `server.ts`.
- Delete the old `uploads/visit-prep/` directory references.

### Frontend — New Screens

| File | Purpose |
|------|---------|
| `VisitReportsScreen.tsx` | Visits list + doctors management + generate/schedule actions. Schedule-visit form is an inline bottom sheet on this screen (not a separate navigator screen). |
| `ExportFlowSheet.tsx` | Bottom sheet: date range → delivery method |
| `DoctorPickerSheet.tsx` | Bottom sheet: select or add a doctor for email delivery |

### Frontend — Modified Screens

| File | Change |
|------|--------|
| `SideDrawer.tsx` | Add "Visit Reports" item with patient picker (2+ patients) |
| `PatientDetailScreen.tsx` | Add "Doctor Reports" card |
| `RootNavigator.tsx` | Replace `VisitsScreen` + `ScheduleVisitScreen` imports with `VisitReportsScreen` in caregiver stack. Remove old screen registrations. |

### Frontend — API Client

New functions in `src/api/`:

- `fetchDoctors(patientId)`, `addDoctor(patientId, name, email)`, `removeDoctor(patientId, doctorId)`
- `generateReport(patientId, startDate, endDate, visitId?)` — returns PDF blob
- `emailReport(patientId, startDate, endDate, doctorId, visitId?)`
- `generateReportLink(patientId, startDate, endDate, visitId?)` — returns `{ url, expiresAt }`

### Dependencies

- `nodemailer` — Gmail SMTP sending (new dependency)
- `pdfkit` — already installed

No other new dependencies.
