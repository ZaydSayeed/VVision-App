import AppleHealthKit, { HealthInputOptions, HealthKitPermissions } from "react-native-health";
import { Platform } from "react-native";

const PERMS = AppleHealthKit.Constants.Permissions;

export const healthKitPermissions: HealthKitPermissions = {
  permissions: {
    read: [PERMS.StepCount, PERMS.HeartRate, PERMS.AppleExerciseTime, PERMS.SleepAnalysis],
    write: [],
  },
};

export type Reading = {
  metric: "steps" | "heart_rate" | "active_minutes" | "sleep";
  date: string; // YYYY-MM-DD
  value: number;
  unit: string;
};

export function isAvailable(): boolean {
  return Platform.OS === "ios";
}

export function requestPermissions(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!isAvailable()) return reject(new Error("HealthKit only available on iOS"));
    AppleHealthKit.initHealthKit(healthKitPermissions, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export async function getReadingsSince(since: Date): Promise<Reading[]> {
  if (!isAvailable()) return [];
  const out: Reading[] = [];
  const startDate = startOfDay(since).toISOString();
  const endDate = new Date().toISOString();

  // Steps — daily totals
  await new Promise<void>((resolve) => {
    AppleHealthKit.getDailyStepCountSamples({ startDate, endDate } as HealthInputOptions, (err, results) => {
      if (!err && results) {
        for (const s of results) {
          out.push({ metric: "steps", date: isoDate(new Date(s.startDate)), value: Math.round(s.value), unit: "count" });
        }
      }
      resolve();
    });
  });

  // Heart rate — average of samples per day
  await new Promise<void>((resolve) => {
    AppleHealthKit.getHeartRateSamples({ startDate, endDate, limit: 5000 } as HealthInputOptions, (err, results) => {
      if (!err && results && results.length) {
        const byDay = new Map<string, number[]>();
        for (const s of results) {
          const d = isoDate(new Date(s.startDate));
          if (!byDay.has(d)) byDay.set(d, []);
          byDay.get(d)!.push(s.value);
        }
        for (const [date, vals] of byDay.entries()) {
          const avg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
          out.push({ metric: "heart_rate", date, value: avg, unit: "bpm" });
        }
      }
      resolve();
    });
  });

  // Active minutes (Apple Exercise Time) — daily totals
  await new Promise<void>((resolve) => {
    AppleHealthKit.getAppleExerciseTime({ startDate, endDate } as HealthInputOptions, (err, results) => {
      if (!err && results) {
        for (const s of results) {
          out.push({ metric: "active_minutes", date: isoDate(new Date(s.startDate)), value: Math.round(s.value), unit: "min" });
        }
      }
      resolve();
    });
  });

  // Sleep — total hours per day
  await new Promise<void>((resolve) => {
    AppleHealthKit.getSleepSamples({ startDate, endDate, limit: 5000 } as HealthInputOptions, (err, results) => {
      if (!err && results && results.length) {
        const byDay = new Map<string, number>();
        for (const s of results) {
          const sleepVal = s.value as unknown as string;
          if (sleepVal !== "ASLEEP" && sleepVal !== "INBED") continue;
          const ms = new Date(s.endDate).getTime() - new Date(s.startDate).getTime();
          const hrs = ms / 1000 / 60 / 60;
          const date = isoDate(new Date(s.endDate));
          byDay.set(date, (byDay.get(date) ?? 0) + hrs);
        }
        for (const [date, hrs] of byDay.entries()) {
          out.push({ metric: "sleep", date, value: Math.round(hrs * 10) / 10, unit: "hr" });
        }
      }
      resolve();
    });
  });

  return out;
}

export function enableBackgroundDelivery(): void {
  if (!isAvailable()) return;
  // Observers fire when new HealthKit data is written. Register one per metric type.
  // The actual event listener is wired in healthSync.ts via NativeEventEmitter.
  const OBS = AppleHealthKit.Constants.Observers as any;
  const types = [OBS.StepCount, OBS.HeartRate, OBS.AppleExerciseTime, OBS.SleepAnalysis];
  for (const t of types) {
    AppleHealthKit.setObserver({ type: t });
  }
}
