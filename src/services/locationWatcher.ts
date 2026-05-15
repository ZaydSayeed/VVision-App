import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { authHeaders } from "../api/client";
import { API_BASE_URL } from "../config/api";

// Region monitoring (geofencing) — iOS wakes the app on enter/exit events.
// Does NOT require "location" in UIBackgroundModes, unlike startLocationUpdatesAsync.
const GEOFENCE_TASK = "vela-geofence";

TaskManager.defineTask(GEOFENCE_TASK, async ({ data, error }: any) => {
  if (error) { console.error("[locationWatcher] geofence task error:", error); return; }
  const { eventType } = data ?? {};
  if (eventType !== Location.GeofencingEventType.Exit) return;

  try {
    await fetch(`${API_BASE_URL}/api/notifications/zone-exit`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
    });
  } catch (err) {
    console.error("[locationWatcher] zone-exit notify failed:", err);
  }
});

export async function startLocationWatcher(): Promise<void> {
  const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
  if (fgStatus !== "granted") return;
  const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
  if (bgStatus !== "granted") return;

  const geofenceRes = await fetch(`${API_BASE_URL}/api/profiles/mine/geofence-check`, {
    headers: { ...authHeaders() },
  });
  if (!geofenceRes.ok) return;
  const geofence = await geofenceRes.json();
  if (typeof geofence?.lat !== "number" || typeof geofence?.lng !== "number") return;

  const isRegistered = await TaskManager.isTaskRegisteredAsync(GEOFENCE_TASK);
  if (isRegistered) {
    await Location.stopGeofencingAsync(GEOFENCE_TASK);
  }

  await Location.startGeofencingAsync(GEOFENCE_TASK, [
    {
      identifier: "home",
      latitude: geofence.lat,
      longitude: geofence.lng,
      radius: geofence.radiusMeters ?? 500,
      notifyOnEnter: false,
      notifyOnExit: true,
    },
  ]);
}

export async function stopLocationWatcher(): Promise<void> {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(GEOFENCE_TASK);
  if (isRegistered) {
    await Location.stopGeofencingAsync(GEOFENCE_TASK);
  }
}
