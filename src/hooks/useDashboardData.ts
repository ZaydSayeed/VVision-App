import { useState, useEffect, useCallback, useRef } from "react";
import { fetchPeople, fetchAlerts } from "../api/client";
import { Person, Alert, DashboardStats, TimelineEvent } from "../types";

const POLL_INTERVAL = 5000;

export function useDashboardData() {
  const [people, setPeople] = useState<Person[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const [p, a] = await Promise.all([fetchPeople(), fetchAlerts()]);
      setPeople(p);
      setAlerts(a);
      setError(null);
    } catch (e: any) {
      setError(e.message ?? "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    intervalRef.current = setInterval(load, POLL_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [load]);

  const stats: DashboardStats = computeStats(people, alerts);
  const timeline: TimelineEvent[] = buildTimeline(people, alerts);

  return { people, alerts, stats, timeline, loading, error, refresh: load };
}

function computeStats(people: Person[], alerts: Alert[]): DashboardStats {
  const today = new Date().toISOString().split("T")[0];
  const seenToday = people.filter(
    (p) => p.last_seen && p.last_seen.startsWith(today)
  ).length;

  const mostFrequent = people.length
    ? people.reduce((a, b) => (a.seen_count > b.seen_count ? a : b)).name
    : "-";

  const lastSeenPerson = people
    .filter((p) => p.last_seen)
    .sort((a, b) => (b.last_seen ?? "").localeCompare(a.last_seen ?? ""))[0];

  return {
    seenToday,
    alertCount: alerts.length,
    mostFrequent: mostFrequent.split(" ")[0],
    lastActivity: lastSeenPerson
      ? formatRelativeTime(lastSeenPerson.last_seen!)
      : "-",
  };
}

function buildTimeline(people: Person[], alerts: Alert[]): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  people.forEach((p) => {
    if (p.last_seen) {
      events.push({
        type: "seen",
        name: p.name,
        relation: p.relation,
        time: p.last_seen,
        count: p.seen_count,
      });
    }
    (p.interactions ?? []).forEach((i) => {
      events.push({
        type: "interaction",
        name: p.name,
        summary: i.summary,
        time: i.timestamp,
      });
    });
  });

  alerts.forEach((a) => {
    events.push({ type: "alert", time: a.timestamp });
  });

  events.sort((a, b) => (b.time ?? "").localeCompare(a.time ?? ""));
  return events.slice(0, 30);
}

export function formatRelativeTime(iso: string): string {
  if (!iso) return "Never";
  try {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  } catch {
    return iso;
  }
}

export function formatTimeShort(iso: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
