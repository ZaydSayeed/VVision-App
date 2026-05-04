import { NativeEventEmitter, NativeModules } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getReadingsSince, enableBackgroundDelivery, isAvailable, Reading } from "./healthkit";
import { syncReadings } from "../api/health";

const LAST_SYNC_KEY = "@vela/health/lastSyncedAt";
const INITIAL_LOOKBACK_DAYS = 30;

async function getLastSync(): Promise<Date> {
  const raw = await AsyncStorage.getItem(LAST_SYNC_KEY);
  if (raw) return new Date(raw);
  const d = new Date();
  d.setDate(d.getDate() - INITIAL_LOOKBACK_DAYS);
  return d;
}

async function setLastSync(d: Date): Promise<void> {
  await AsyncStorage.setItem(LAST_SYNC_KEY, d.toISOString());
}

export async function syncNow(patientId: string): Promise<number> {
  if (!isAvailable()) return 0;
  const since = await getLastSync();
  const readings: Reading[] = await getReadingsSince(since);
  if (readings.length === 0) return 0;
  const result = await syncReadings(patientId, readings);
  await setLastSync(new Date());
  return result.written;
}

const OBSERVED_EVENTS = [
  "healthKit:StepCount:new",
  "healthKit:HeartRate:new",
  "healthKit:Walking:new",
  "healthKit:SleepAnalysis:new",
];

let observerSubscriptions: { remove: () => void }[] = [];

export function startBackgroundObservers(patientId: string): void {
  if (!isAvailable()) return;
  enableBackgroundDelivery();
  const emitter = new NativeEventEmitter(NativeModules.AppleHealthKit);
  const handler = () => {
    syncNow(patientId).catch((e) => console.warn("[healthSync] background sync failed", e));
  };
  observerSubscriptions = OBSERVED_EVENTS.map((event) => emitter.addListener(event, handler));
}

export function stopBackgroundObservers(): void {
  observerSubscriptions.forEach((s) => s.remove());
  observerSubscriptions = [];
}
