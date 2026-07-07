import type { CalendarEventOccurrence } from "./calendarApi";

// Matches the app's existing `Reminder` type (src/types/index.ts). Medications
// are a wholly separate collection/feature with different field names
// (`name`/`dosage`/`taken_date`) and are not merged into this checklist —
// see the investigation note in this task's report before adding them here.
export interface ReminderItem {
  id: string;
  text: string;
  completed_date: string | null;
}

export interface WidgetChecklistItem {
  id: string;
  label: string;
  completed: boolean;
}

export interface WidgetAppointment {
  id: string;
  title: string;
  time: string; // e.g. "3:00 PM", pre-formatted for direct display
}

export interface WidgetSnapshot {
  patientId: string;
  patientName: string;
  generatedAt: string;
  checklist: WidgetChecklistItem[];
  appointments: WidgetAppointment[];
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function buildWidgetSnapshot(
  patientId: string,
  patientName: string,
  todayEvents: CalendarEventOccurrence[],
  todayReminders: ReminderItem[]
): WidgetSnapshot {
  return {
    patientId,
    patientName,
    generatedAt: new Date().toISOString(),
    checklist: todayReminders.map((r) => ({
      id: r.id,
      label: r.text,
      completed: r.completed_date !== null,
    })),
    appointments: todayEvents.map((e) => ({
      id: e.id,
      title: e.title,
      time: formatTime(e.occurrenceAt),
    })),
  };
}
