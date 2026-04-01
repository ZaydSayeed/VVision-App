import { useState, useEffect, useCallback } from "react";
import { Alert as RNAlert } from "react-native";
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
      // Keep current state on error (cached data may have been returned)
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const sendHelp = useCallback(async () => {
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const alert = await createHelpAlert();
      setAlerts((prev) => [alert, ...prev]);
    } catch {
      RNAlert.alert("Offline", "Unable to send help request. Please check your connection and try again.");
    }
  }, []);

  const dismissAlert = useCallback(async (id: string) => {
    try {
      const updated = await dismissHelpAlert(id);
      setAlerts((prev) => prev.map((a) => (a.id === id ? updated : a)));
    } catch {
      RNAlert.alert("Offline", "Unable to dismiss alert. Please check your connection.");
    }
  }, []);

  const pendingCount = alerts.filter((a) => !a.dismissed).length;

  return { alerts, pendingCount, sendHelp, dismissAlert };
}
