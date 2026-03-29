import { API_BASE_URL } from "../config/api";
import { Person, Alert } from "../types";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchPeople(): Promise<Person[]> {
  return request<Person[]>("/api/people");
}

export async function fetchAlerts(): Promise<Alert[]> {
  return request<Alert[]>("/api/alerts");
}

export async function dismissAlert(alertId: string): Promise<void> {
  await request(`/api/alerts/${alertId}`, { method: "DELETE" });
}

export async function updateNotes(
  name: string,
  notes: string
): Promise<void> {
  await request(`/api/people/${encodeURIComponent(name)}/notes`, {
    method: "POST",
    body: JSON.stringify({ notes }),
  });
}

export function createSSEConnection(onUpdate: () => void): () => void {
  const url = `${API_BASE_URL}/stream/events`;
  let eventSource: EventSource | null = null;
  let retryTimeout: ReturnType<typeof setTimeout> | null = null;

  function connect() {
    eventSource = new EventSource(url);
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "update") {
          onUpdate();
        }
      } catch {}
    };
    eventSource.onerror = () => {
      eventSource?.close();
      retryTimeout = setTimeout(connect, 5000);
    };
  }

  connect();

  return () => {
    eventSource?.close();
    if (retryTimeout) clearTimeout(retryTimeout);
  };
}
