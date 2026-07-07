import * as Calendar from "expo-calendar";
import { isAppleCalendarSyncEnabled } from "./appleCalendarPrefs";
import { getAppleEventId, setAppleEventId, clearAppleEventId } from "./appleCalendarIdMap";
import type { CalendarEventOccurrence } from "./calendarApi";

export async function requestAppleCalendarPermission(): Promise<boolean> {
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  return status === "granted";
}

async function getTargetCalendarId(): Promise<string | null> {
  const defaultCalendar = await Calendar.getDefaultCalendarAsync();
  return defaultCalendar?.id ?? null;
}

export async function syncEventCreated(event: CalendarEventOccurrence): Promise<void> {
  if (!(await isAppleCalendarSyncEnabled())) return;
  try {
    const calendarId = await getTargetCalendarId();
    if (!calendarId) return;
    const appleEventId = await Calendar.createEventAsync(calendarId, {
      title: event.title,
      startDate: new Date(event.occurrenceAt),
      endDate: new Date(event.endAt),
      notes: event.notes ?? undefined,
    });
    await setAppleEventId(event.id, appleEventId);
  } catch (err) {
    console.warn("[appleCalendarSync] create failed (non-fatal):", err);
  }
}

export async function syncEventUpdated(event: CalendarEventOccurrence): Promise<void> {
  if (!(await isAppleCalendarSyncEnabled())) return;
  try {
    const appleEventId = await getAppleEventId(event.id);
    if (!appleEventId) {
      await syncEventCreated(event);
      return;
    }
    await Calendar.updateEventAsync(appleEventId, {
      title: event.title,
      startDate: new Date(event.occurrenceAt),
      endDate: new Date(event.endAt),
      notes: event.notes ?? undefined,
    });
  } catch (err) {
    console.warn("[appleCalendarSync] update failed (non-fatal):", err);
  }
}

export async function syncEventDeleted(ourEventId: string): Promise<void> {
  if (!(await isAppleCalendarSyncEnabled())) return;
  try {
    const appleEventId = await getAppleEventId(ourEventId);
    if (!appleEventId) return;
    await Calendar.deleteEventAsync(appleEventId);
    await clearAppleEventId(ourEventId);
  } catch (err) {
    console.warn("[appleCalendarSync] delete failed (non-fatal):", err);
  }
}
