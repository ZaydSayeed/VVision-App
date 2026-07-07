import { authFetch } from "../api/authFetch";
import { CalendarCategory } from "../config/calendarCategories";
import { fetchRoutines, fetchMedications } from "../api/client";
import { buildWidgetSnapshot } from "./widgetSnapshot";
import {
  writeWidgetSnapshot,
  writeWidgetActivePatient,
  reloadWidgetTimelines,
} from "../../modules/widget-bridge";

export interface CalendarEventOccurrence {
  id: string;
  title: string;
  category: CalendarCategory;
  /**
   * The recurring series' true, unexpanded start time (the document's own
   * `startAt` field) — NOT the tapped occurrence's own datetime. For a
   * non-recurring event this equals `occurrenceAt`. Always prefer this over
   * `occurrenceAt` when prefilling an edit form or saving edits back, so
   * editing a later occurrence of a recurring series doesn't rewrite the
   * series' anchor date and silently drop earlier occurrences.
   */
  startAt: string;
  occurrenceAt: string;
  endAt: string;
  notes: string | null;
  recurrenceRule: string | null;
  createdBy: string;
  completed: boolean;
}

export interface CalendarEvent {
  id: string;
  title: string;
  category: CalendarCategory;
  startAt: string;
  endAt: string;
  notes: string | null;
  recurrenceRule: string | null;
  createdBy: string;
  completedDates: string[];
}

export interface CalendarEventInput {
  title: string;
  category: CalendarCategory;
  startAt: string;
  endAt: string;
  notes?: string;
  recurrenceRule?: string | null;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfToday(): Date {
  const d = startOfToday();
  d.setDate(d.getDate() + 1);
  return d;
}

/**
 * Rebuilds today's widget snapshot for `patientId` and pushes it (plus the
 * active-patient pointer) into the App Group, then asks WidgetKit to reload —
 * so the home-screen widget reflects a change within seconds instead of
 * waiting for its own ~20-minute refresh schedule.
 *
 * Fire-and-forget: every caller wraps this in a bare `.catch(() => {})` (or
 * awaits it inside its own try/catch) — a widget refresh must never block or
 * fail the user's actual save/complete action, matching the non-fatal pattern
 * used for push-token registration (src/hooks/usePushRegistration.ts).
 *
 * `patientName` is best-effort: callers that don't have it handy (this file's
 * CRUD functions only receive `patientId`) can omit it — the widget falls
 * back to a generic "Today" header until a caller that does know the name
 * (e.g. CalendarScreen, which has the `patientName` prop/route param)
 * refreshes it next.
 */
export async function refreshWidgetForPatient(
  patientId: string,
  patientName?: string
): Promise<void> {
  const [events, tasks, medications] = await Promise.all([
    listCalendarEvents(patientId, startOfToday().toISOString(), endOfToday().toISOString()),
    fetchRoutines().catch(() => []),
    fetchMedications().catch(() => []),
  ]);

  // The widget's checklist is fed by whatever this device's "today" tasks +
  // medications are (RoutineTask.label / Medication, the actually-completable
  // items in the app), mapped into buildWidgetSnapshot's generic
  // {id, text, completed_date} checklist-item shape.
  const reminders = tasks.map((t) => ({
    id: t.id,
    text: t.label,
    completed_date: t.completed_date,
  }));

  const snapshot = buildWidgetSnapshot(
    patientId,
    patientName ?? "",
    events,
    reminders,
    medications
  );

  await writeWidgetSnapshot(snapshot);
  await writeWidgetActivePatient(patientId, patientName);
  await reloadWidgetTimelines();
}

export async function listCalendarEvents(
  patientId: string,
  from: string,
  to: string
): Promise<CalendarEventOccurrence[]> {
  const res = await authFetch(
    `/api/profiles/${patientId}/calendar-events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
  );
  if (!res.ok) throw new Error(`Failed to load calendar events: ${res.status}`);
  const data = await res.json();
  return data.events ?? [];
}

export async function getCalendarEvent(patientId: string, id: string): Promise<CalendarEvent> {
  const res = await authFetch(`/api/profiles/${patientId}/calendar-events/${id}`);
  if (!res.ok) throw new Error(`Failed to load calendar event: ${res.status}`);
  return res.json();
}

export async function createCalendarEvent(
  patientId: string,
  input: CalendarEventInput,
  patientName?: string
): Promise<{ id: string }> {
  const res = await authFetch(`/api/profiles/${patientId}/calendar-events`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Failed to create calendar event (${res.status}). ${detail}`);
  }
  const data = await res.json();
  refreshWidgetForPatient(patientId, patientName).catch((err) =>
    console.warn("[widget] snapshot refresh failed (non-fatal):", err)
  );
  return data;
}

export async function updateCalendarEvent(
  patientId: string,
  id: string,
  input: Partial<CalendarEventInput>,
  patientName?: string
): Promise<void> {
  const res = await authFetch(`/api/profiles/${patientId}/calendar-events/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Failed to update calendar event: ${res.status}`);
  refreshWidgetForPatient(patientId, patientName).catch((err) =>
    console.warn("[widget] snapshot refresh failed (non-fatal):", err)
  );
}

export async function deleteCalendarEvent(
  patientId: string,
  id: string,
  patientName?: string
): Promise<void> {
  const res = await authFetch(`/api/profiles/${patientId}/calendar-events/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`Failed to delete calendar event: ${res.status}`);
  refreshWidgetForPatient(patientId, patientName).catch((err) =>
    console.warn("[widget] snapshot refresh failed (non-fatal):", err)
  );
}

export async function completeCalendarEventOccurrence(
  patientId: string,
  id: string,
  date: string,
  patientName?: string
): Promise<void> {
  const res = await authFetch(`/api/profiles/${patientId}/calendar-events/${id}/complete`, {
    method: "POST",
    body: JSON.stringify({ date }),
  });
  if (!res.ok) throw new Error(`Failed to complete calendar event occurrence: ${res.status}`);
  refreshWidgetForPatient(patientId, patientName).catch((err) =>
    console.warn("[widget] snapshot refresh failed (non-fatal):", err)
  );
}
