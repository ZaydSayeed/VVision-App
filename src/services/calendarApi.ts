import { authFetch } from "../api/authFetch";
import { CalendarCategory } from "../config/calendarCategories";

export interface CalendarEventOccurrence {
  id: string;
  title: string;
  category: CalendarCategory;
  occurrenceAt: string;
  endAt: string;
  notes: string | null;
  recurrenceRule: string | null;
  createdBy: string;
  completed: boolean;
}

export interface CalendarEventInput {
  title: string;
  category: CalendarCategory;
  startAt: string;
  endAt: string;
  notes?: string;
  recurrenceRule?: string | null;
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

export async function createCalendarEvent(
  patientId: string,
  input: CalendarEventInput
): Promise<{ id: string }> {
  const res = await authFetch(`/api/profiles/${patientId}/calendar-events`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Failed to create calendar event (${res.status}). ${detail}`);
  }
  return res.json();
}

export async function updateCalendarEvent(
  patientId: string,
  id: string,
  input: Partial<CalendarEventInput>
): Promise<void> {
  const res = await authFetch(`/api/profiles/${patientId}/calendar-events/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Failed to update calendar event: ${res.status}`);
}

export async function deleteCalendarEvent(patientId: string, id: string): Promise<void> {
  const res = await authFetch(`/api/profiles/${patientId}/calendar-events/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`Failed to delete calendar event: ${res.status}`);
}

export async function completeCalendarEventOccurrence(
  patientId: string,
  id: string,
  date: string
): Promise<void> {
  const res = await authFetch(`/api/profiles/${patientId}/calendar-events/${id}/complete`, {
    method: "POST",
    body: JSON.stringify({ date }),
  });
  if (!res.ok) throw new Error(`Failed to complete calendar event occurrence: ${res.status}`);
}
