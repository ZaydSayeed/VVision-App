import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { authHeaders } from "../api/client";
import { API_BASE_URL } from "../config/api";

const TASK_NAME = "vela-location-check";
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

let outsideZoneSince: Date | null = null;
const ALERT_THRESHOLD_MS = 10 * 60 * 1000;

function haversineDistanceMeters(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

TaskManager.defineTask(TASK_NAME, async ({ data, error }: any) => {
  if (error) { console.error("[locationWatcher] task error:", error); return; }
  const location = data?.locations?.[0];
  if (!location) return;

  try {
    const geofenceRes = await fetch(`${API_BASE_URL}/api/profiles/mine/geofence-check`, {
      headers: { ...authHeaders() },
    });
    if (!geofenceRes.ok) return;
    const geofence = await geofenceRes.json();
    if (!geofence?.lat) return;

    const dist = haversineDistanceMeters(
      location.coords.latitude, location.coords.longitude,
      geofence.lat, geofence.lng
    );

    if (dist > geofence.radiusMeters) {
      if (!outsideZoneSince) {
        outsideZoneSince = new Date();
      } else if (Date.now() - outsideZoneSince.getTime() >= ALERT_THRESHOLD_MS) {
        await fetch(`${API_BASE_URL}/api/notifications/zone-exit`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
        });
        outsideZoneSince = null;
      }
    } else {
      outsideZoneSince = null;
    }
  } catch (err) {
    console.error("[locationWatcher] check failed:", err);
  }
});

export async function startLocationWatcher(): Promise<void> {
  const { status } = await Location.requestBackgroundPermissionsAsync();
  if (status !== "granted") return;

  const isRegistered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
  if (isRegistered) return;

  await Location.startLocationUpdatesAsync(TASK_NAME, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: CHECK_INTERVAL_MS,
    distanceInterval: 50,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: "Vela",
      notificationBody: "Watching for safe zone alerts",
    },
  });
}

export async function stopLocationWatcher(): Promise<void> {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
  if (isRegistered) {
    await Location.stopLocationUpdatesAsync(TASK_NAME);
  }
}
