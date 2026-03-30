import { useState, useEffect, useCallback } from "react";
import * as Haptics from "expo-haptics";
import { HelpAlert } from "../types";
import {
  fetchHelpAlerts,
  createHelpAlert,
  dismissHelpAlert,
} from "../api/client";

export function useHelpAlert() {
  const [alerts, setAlerts] = useState<HelpAlert[]>([]);

  const load = useCallback(async () => {
    try {
      const data = await fetchHelpAlerts();
      setAlerts(data);
    } catch {
      // Keep current state on error
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const sendHelp = useCallback(async () => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    const alert = await createHelpAlert();
    setAlerts((prev) => [alert, ...prev]);
  }, []);

  const dismissAlert = useCallback(async (id: string) => {
    const updated = await dismissHelpAlert(id);
    setAlerts((prev) => prev.map((a) => (a.id === id ? updated : a)));
  }, []);

  const pendingCount = alerts.filter((a) => !a.dismissed).length;

  return { alerts, pendingCount, sendHelp, dismissAlert };
}
