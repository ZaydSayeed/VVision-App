import { useState, useEffect, useCallback, useRef } from "react";
import { HelpAlert } from "../types";
import {
  fetchHelpAlerts,
  createHelpAlert,
  dismissHelpAlert,
  resolveHelpAlert,
} from "../api/client";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1500;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function useHelpAlert() {
  const [alerts, setAlerts] = useState<HelpAlert[]>([]);
  const [sending, setSending] = useState(false);
  const [sentAt, setSentAt] = useState<Date | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchHelpAlerts();
      setAlerts(data);
    } catch {
      // Keep current state — cached data may have been returned by client
    }
  }, []);

  // Adaptive polling: 4s when active, 15s when idle
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    load();
  }, [load]);

  const isActive = sending || !!sentAt || !!sendError || alerts.some((a) => !a.dismissed && !a.resolved && !a.cancelled);
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    const ms = isActive ? 4000 : 15000;
    intervalRef.current = setInterval(load, ms);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isActive, load]);

  const sendHelp = useCallback(async () => {
    setSending(true);
    setSendError(null);
    setSentAt(null);

    let lastError: any;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const alert = await createHelpAlert();
        setAlerts((prev) => [alert, ...prev]);
        setSentAt(new Date());
        setSending(false);
        return;
      } catch (e: any) {
        lastError = e;
        if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS * attempt);
      }
    }

    setSending(false);
    setSendError(lastError?.message ?? "Unable to send help request. Please check your connection.");
  }, []);

  const dismissAlert = useCallback(async (id: string) => {
    try {
      const updated = await dismissHelpAlert(id);
      setAlerts((prev) => prev.map((a) => (a.id === id ? updated : a)));
    } catch (e: any) {
      throw e; // Let the caller handle display
    }
  }, []);

  const resolveAlert = useCallback(async (id: string, cause: string, note?: string) => {
    try {
      const updated = await resolveHelpAlert(id, cause, note);
      setAlerts((prev) => prev.map((a) => (a.id === id ? updated : a)));
    } catch (e: any) {
      throw e;
    }
  }, []);

  const clearSentState = useCallback(() => {
    setSentAt(null);
    setSendError(null);
  }, []);

  const pendingCount = alerts.filter((a) => !a.dismissed).length;

  return { alerts, pendingCount, sending, sentAt, sendError, sendHelp, dismissAlert, resolveAlert, clearSentState, reload: load };
}
