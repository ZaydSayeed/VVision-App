import { useState, useEffect, useCallback } from "react";
import * as Haptics from "expo-haptics";
import { HelpAlert } from "../types";
import { STORAGE_KEYS, readStorage, writeStorage } from "../config/storage";

export function useHelpAlert() {
  const [alerts, setAlerts] = useState<HelpAlert[]>([]);

  useEffect(() => {
    readStorage<HelpAlert[]>(STORAGE_KEYS.HELP_ALERTS, []).then(setAlerts);
  }, []);

  const persist = useCallback(async (updated: HelpAlert[]) => {
    setAlerts(updated);
    await writeStorage(STORAGE_KEYS.HELP_ALERTS, updated);
  }, []);

  const sendHelp = useCallback(async () => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    const alert: HelpAlert = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      dismissed: false,
    };
    const current = await readStorage<HelpAlert[]>(STORAGE_KEYS.HELP_ALERTS, []);
    await persist([alert, ...current]);
  }, [persist]);

  const dismissAlert = useCallback(async (id: string) => {
    const current = await readStorage<HelpAlert[]>(STORAGE_KEYS.HELP_ALERTS, []);
    await persist(current.map((a) => (a.id === id ? { ...a, dismissed: true } : a)));
  }, [persist]);

  const pendingCount = alerts.filter((a) => !a.dismissed).length;

  return { alerts, pendingCount, sendHelp, dismissAlert };
}
