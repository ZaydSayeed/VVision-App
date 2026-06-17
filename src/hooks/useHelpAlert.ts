import { useState, useEffect, useCallback, useRef } from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { HelpAlert } from "../types";
import {
  fetchHelpAlerts,
  createHelpAlert,
  dismissHelpAlert,
  resolveHelpAlert,
  acknowledgeHelpAlert,
} from "../api/client";
import { createHelpQueue, HelpQueue, KVStorage } from "../services/helpQueue";

const storageAdapter: KVStorage = {
  getItem: (k) => AsyncStorage.getItem(k),
  setItem: (k, v) => AsyncStorage.setItem(k, v),
  removeItem: (k) => AsyncStorage.removeItem(k),
};

function genId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function useHelpAlert() {
  const [alerts, setAlerts] = useState<HelpAlert[]>([]);
  const [sending, setSending] = useState(false);
  const [sentAt, setSentAt] = useState<Date | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const sendingRef = useRef(false);

  // Durable SOS queue — an intent is persisted before delivery and only removed
  // once the server acknowledges it, so a tap is never lost offline (SAFE-9).
  const queueRef = useRef<HelpQueue | null>(null);
  if (!queueRef.current) {
    queueRef.current = createHelpQueue(storageAdapter, async (item) => {
      // Pass the queue id as an idempotency key so a retried send (after a lost
      // response) resolves to the same alert server-side instead of duplicating it.
      const alert = await createHelpAlert(item.id);
      setAlerts((prev) => [alert, ...prev]);
      setSentAt(new Date());
      setSendError(null);
    });
  }

  const load = useCallback(async () => {
    try {
      const data = await fetchHelpAlerts();
      setAlerts(data);
    } catch {
      // Keep current state — cached data may have been returned by client
    }
  }, []);

  const flushQueue = useCallback(async () => {
    try {
      const { remaining } = await queueRef.current!.flush();
      if (remaining === 0) setSendError(null);
    } catch {
      // ignore — next tick retries
    }
  }, []);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    load();
    flushQueue();
  }, [load, flushQueue]);

  // Retry delivery whenever the app returns to the foreground.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") flushQueue();
    });
    return () => sub.remove();
  }, [flushQueue]);

  // Adaptive polling: 4s when active, 15s when idle — also drains the SOS queue.
  const isActive = sending || !!sentAt || !!sendError || alerts.some((a) => !a.dismissed && !a.resolved && !a.cancelled);
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    const ms = isActive ? 4000 : 15000;
    intervalRef.current = setInterval(() => {
      load();
      flushQueue();
    }, ms);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isActive, load, flushQueue]);

  const sendHelp = useCallback(async () => {
    if (sendingRef.current) return; // prevent double-send
    sendingRef.current = true;
    setSending(true);
    setSendError(null);
    setSentAt(null);

    // Persist first (survives crash/kill), then attempt delivery.
    try {
      await queueRef.current!.enqueue(genId(), new Date().toISOString());
    } catch {
      // Even if persistence fails, still attempt the direct send below.
    }

    // Quick in-tap retries recover a flaky connection while the patient is still
    // watching; the durable queue + background flush keep trying after this too.
    // The serialized queue makes these overlap-safe.
    let remaining = (await queueRef.current!.flush()).remaining;
    for (let attempt = 1; attempt <= 2 && remaining > 0; attempt++) {
      await sleep(1500 * attempt);
      remaining = (await queueRef.current!.flush()).remaining;
    }

    setSending(false);
    sendingRef.current = false;

    if (remaining > 0) {
      // Not yet acknowledged by the server — be honest, keep retrying in the background.
      setSendError("We couldn't reach your caregiver yet — keep this screen open and we'll keep trying.");
    }
  }, []);

  const dismissAlert = useCallback(async (id: string) => {
    const updated = await dismissHelpAlert(id);
    setAlerts((prev) => prev.map((a) => (a.id === id ? updated : a)));
  }, []);

  const resolveAlert = useCallback(async (id: string, cause: string, note?: string) => {
    const updated = await resolveHelpAlert(id, cause, note);
    setAlerts((prev) => prev.map((a) => (a.id === id ? updated : a)));
  }, []);

  // Caregiver tapped "I'm responding" — record it (does not resolve the alert).
  // Throws on failure so the caller can keep the alert visible instead of
  // silently telling the caregiver it's handled while the server keeps paging.
  const acknowledgeAlert = useCallback(async (id: string) => {
    const updated = await acknowledgeHelpAlert(id);
    setAlerts((prev) => prev.map((a) => (a.id === id ? updated : a)));
  }, []);

  const clearSentState = useCallback(() => {
    setSentAt(null);
    setSendError(null);
  }, []);

  // "Pending" = needs a response. An acknowledged alert ("someone is responding")
  // is no longer pending for the badge/overlay, even though it's not yet resolved.
  const pendingCount = alerts.filter((a) => !a.dismissed && !a.acknowledged).length;

  return { alerts, pendingCount, sending, sentAt, sendError, sendHelp, dismissAlert, resolveAlert, acknowledgeAlert, clearSentState, reload: load };
}
