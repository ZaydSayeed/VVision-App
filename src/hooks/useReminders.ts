import { useState, useEffect, useCallback } from "react";
import { Reminder } from "../types";
import { fetchReminders, addReminder, deleteReminder } from "../api/client";

export function useReminders() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchReminders();
      setReminders(data);
      setLoadError(null);
    } catch (e: any) {
      setLoadError(e?.message ?? "Failed to load reminders");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const add = useCallback(async (text: string, time?: string, recurrence?: string) => {
    const data = await addReminder({ text, time, recurrence, source: "app" });
    setReminders((prev) => [data, ...prev]);
  }, []);

  const remove = useCallback(async (id: string) => {
    await deleteReminder(id);
    setReminders((prev) => prev.filter((r) => r.id !== id));
  }, []);

  return { reminders, addReminder: add, deleteReminder: remove, loadError, reload: load };
}
