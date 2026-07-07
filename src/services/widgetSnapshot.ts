import type { CalendarEventOccurrence } from "./calendarApi";

// Matches the app's existing `Reminder` type (src/types/index.ts).
export interface ReminderItem {
  id: string;
  text: string;
  completed_date: string | null;
}

// Matches the relevant fields of the app's existing `Medication` type
// (src/types/index.ts). Merged into the same widget checklist as reminders.
export interface MedicationItem {
  id: string;
  name: string;
  dosage: string;
  taken_date: string | null;
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
  todayReminders: ReminderItem[],
  todayMedications: MedicationItem[]
): WidgetSnapshot {
  return {
    patientId,
    patientName,
    generatedAt: new Date().toISOString(),
    checklist: [
      ...todayReminders.map((r) => ({
        id: r.id,
        label: r.text,
        completed: r.completed_date !== null,
      })),
      ...todayMedications.map((m) => ({
        id: m.id,
        label: `Take ${m.name} (${m.dosage})`,
        completed: m.taken_date !== null,
      })),
    ],
    appointments: todayEvents.map((e) => ({
      id: e.id,
      title: e.title,
      time: formatTime(e.occurrenceAt),
    })),
  };
}
