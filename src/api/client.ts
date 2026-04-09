import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImageManipulator from "expo-image-manipulator";
import { API_BASE_URL } from "../config/api";
import {
  Person,
  Alert,
  RoutineTask,
  Medication,
  HelpAlert,
  UserRole,
  PatientSummary,
  Reminder,
  ConversationTurn,
} from "../types";

// ── Token management ──────────────────────────────────────
let authToken: string | null = null;
let onAuthExpired: (() => void) | null = null;
let onNetworkChange: ((offline: boolean) => void) | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export function setOnAuthExpired(cb: () => void) {
  onAuthExpired = cb;
}

export function setOnNetworkChange(cb: (offline: boolean) => void) {
  onNetworkChange = cb;
}

function authHeaders(): Record<string, string> {
  return authToken ? { Authorization: `Bearer ${authToken}` } : {};
}

// ── Offline cache helpers ─────────────────────────────────
const CACHE_PREFIX = "@vela/api_cache:";

async function getCached<T>(path: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_PREFIX + path);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function setCache<T>(path: string, data: T): Promise<void> {
  try {
    await AsyncStorage.multiSet([
      [CACHE_PREFIX + path, JSON.stringify(data)],
      [`${CACHE_PREFIX}ts:${path}`, String(Date.now())],
    ]);
  } catch {
    // Cache write failure is non-critical
  }
}

function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError && error.message === "Network request failed") return true;
  if (error instanceof DOMException && error.name === "AbortError") return true;
  return false;
}

// ── Base request helper ───────────────────────────────────
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  const isGet = !options?.method || options.method === "GET";

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(options?.headers as Record<string, string>),
    };

    const res = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });

    if (res.status === 401 && onAuthExpired) {
      onAuthExpired();
      throw new Error("Session expired");
    }
    if (!res.ok) {
      const body = await res.text();
      throw new Error(body || `API error ${res.status}`);
    }

    // Successful response — we're online
    onNetworkChange?.(false);

    if (res.status === 204) return undefined as T;
    const data: T = await res.json();

    // Cache successful GET responses
    if (isGet) {
      setCache(path, data);
    }

    return data;
  } catch (error) {
    if (isGet && isNetworkError(error)) {
      // Try to serve cached data when offline
      const cached = await getCached<T>(path);
      if (cached !== null) {
        onNetworkChange?.(true);
        return cached;
      }
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

// ── Profile sync (called after Supabase login/signup) ─────
export async function syncProfile(
  name: string,
  role: UserRole
): Promise<{ patient_id: string | null }> {
  return request("/api/auth/sync", {
    method: "POST",
    body: JSON.stringify({ name, role }),
  });
}

// ── Patient linking ───────────────────────────────────────
export async function linkPatient(
  linkCode: string
): Promise<{ id: string; name: string; link_code: string }> {
  return request("/api/patients/link", {
    method: "POST",
    body: JSON.stringify({ link_code: linkCode }),
  });
}

export async function getMyLinkCode(): Promise<{ link_code: string }> {
  return request("/api/patients/mine/link-code");
}

export async function fetchLinkedPatients(): Promise<PatientSummary[]> {
  return request<PatientSummary[]>("/api/patients/linked");
}

// ── People (face recognition database) ───────────────────
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
  personId: string,
  notes: string
): Promise<void> {
  await request(`/api/people/${personId}/notes`, {
    method: "POST",
    body: JSON.stringify({ notes }),
  });
}

export async function enrollFace(
  name: string,
  relation: string,
  photoUri: string
): Promise<void> {
  // Compress to ≤500KB before upload — keeps server storage manageable
  const compressed = await ImageManipulator.manipulateAsync(
    photoUri,
    [{ resize: { width: 800 } }],
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
  );

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000); // longer for upload

  const formData = new FormData();
  formData.append("name", name);
  formData.append("relation", relation);
  formData.append("photo", {
    uri: compressed.uri,
    name: "face.jpg",
    type: "image/jpeg",
  } as any);

  try {
    const res = await fetch(`${API_BASE_URL}/api/people/enroll`, {
      method: "POST",
      body: formData,
      headers: authHeaders(),
      signal: controller.signal,
    });
    if (res.status === 401 && onAuthExpired) {
      onAuthExpired();
      throw new Error("Session expired");
    }
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `API error ${res.status}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

export async function deletePerson(personId: string): Promise<void> {
  await request(`/api/people/${personId}`, { method: "DELETE" });
}

// ── Routines ──────────────────────────────────────────────
export async function fetchRoutines(): Promise<RoutineTask[]> {
  return request<RoutineTask[]>("/api/routines");
}

export async function createRoutine(
  label: string,
  time: string
): Promise<RoutineTask> {
  return request<RoutineTask>("/api/routines", {
    method: "POST",
    body: JSON.stringify({ label, time }),
  });
}

export async function updateRoutine(
  id: string,
  updates: { label?: string; time?: string; completed_date?: string | null }
): Promise<RoutineTask> {
  return request<RoutineTask>(`/api/routines/${id}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export async function deleteRoutine(id: string): Promise<void> {
  await request(`/api/routines/${id}`, { method: "DELETE" });
}

// ── Medications ───────────────────────────────────────────
export async function fetchMedications(): Promise<Medication[]> {
  return request<Medication[]>("/api/medications");
}

export async function createMedication(
  name: string,
  dosage: string,
  time: string
): Promise<Medication> {
  return request<Medication>("/api/medications", {
    method: "POST",
    body: JSON.stringify({ name, dosage, time }),
  });
}

export async function updateMedication(
  id: string,
  updates: {
    name?: string;
    dosage?: string;
    time?: string;
    taken_date?: string | null;
  }
): Promise<Medication> {
  return request<Medication>(`/api/medications/${id}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export async function deleteMedication(id: string): Promise<void> {
  await request(`/api/medications/${id}`, { method: "DELETE" });
}

// ── Help Alerts ───────────────────────────────────────────
export async function fetchHelpAlerts(): Promise<HelpAlert[]> {
  return request<HelpAlert[]>("/api/help-alerts");
}

export async function createHelpAlert(): Promise<HelpAlert> {
  return request<HelpAlert>("/api/help-alerts", { method: "POST" });
}

export async function dismissHelpAlert(id: string): Promise<HelpAlert> {
  return request<HelpAlert>(`/api/help-alerts/${id}/dismiss`, {
    method: "PATCH",
  });
}

// ── Caregiver profiles ───────────────────────────────────
export async function fetchCaregiverProfiles(): Promise<
  { id: string; name: string; email: string }[]
> {
  return request("/api/caregiver-profiles");
}

// ── SSE ───────────────────────────────────────────────────
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

// ── Reminders ─────────────────────────────────────────────
export async function fetchReminders(): Promise<Reminder[]> {
  return request<Reminder[]>("/api/reminders");
}

export async function addReminder(data: {
  text: string;
  time?: string;
  recurrence?: string;
  source?: "glasses" | "app";
}): Promise<Reminder> {
  return request<Reminder>("/api/reminders", {
    method: "POST",
    body: JSON.stringify({ source: "app", ...data }),
  });
}

export async function deleteReminder(id: string): Promise<void> {
  await request(`/api/reminders/${id}`, { method: "DELETE" });
}

// ── Vision Assistant ───────────────────────────────────────
export async function sendVisionMessage(message: string): Promise<{ reply: string; reminderCreated?: boolean }> {
  return request<{ reply: string; reminderCreated?: boolean }>("/api/assistant/chat", {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}

// ── Conversations ──────────────────────────────────────────
export async function saveConversationTurn(role: "user" | "assistant", content: string): Promise<ConversationTurn> {
  return request<ConversationTurn>("/api/conversations", {
    method: "POST",
    body: JSON.stringify({ role, content }),
  });
}

export async function fetchConversations(): Promise<ConversationTurn[]> {
  return request<ConversationTurn[]>("/api/conversations");
}
