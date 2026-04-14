import AsyncStorage from "@react-native-async-storage/async-storage";
import { authFetch } from "../api/authFetch";

type Kind = "motion" | "door" | "presence" | "sleep" | "gait" | "typing_cadence" | "voice_sample";
interface QueuedEvent { kind: Kind; capturedAt: string; data: Record<string, unknown>; patientId: string }

const KEY = "vela:event_queue";
let flushing = false;

export async function queueEvent(e: QueuedEvent) {
  const raw = await AsyncStorage.getItem(KEY);
  const queue: QueuedEvent[] = raw ? JSON.parse(raw) : [];
  queue.push(e);
  await AsyncStorage.setItem(KEY, JSON.stringify(queue));
  if (queue.length >= 20) flush().catch(() => {});
}

export async function flush() {
  if (flushing) return;
  flushing = true;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const queue: QueuedEvent[] = raw ? JSON.parse(raw) : [];
    if (queue.length === 0) return;
    // Group by patientId; batch up to 100 per POST
    const byPatient: Record<string, QueuedEvent[]> = {};
    queue.forEach((e) => { (byPatient[e.patientId] ||= []).push(e); });
    const remaining: QueuedEvent[] = [];
    for (const [patientId, evs] of Object.entries(byPatient)) {
      for (let i = 0; i < evs.length; i += 100) {
        const chunk = evs.slice(i, i + 100);
        try {
          await authFetch(`/api/profiles/${patientId}/events`, {
            method: "POST",
            body: JSON.stringify({ events: chunk.map(({ patientId: _, ...rest }) => rest) }),
          });
        } catch {
          remaining.push(...chunk); // keep failed ones for retry
        }
      }
    }
    await AsyncStorage.setItem(KEY, JSON.stringify(remaining));
  } finally {
    flushing = false;
  }
}
