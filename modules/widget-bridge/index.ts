import { requireOptionalNativeModule } from "expo-modules-core";

import type { WidgetSnapshot } from "../../src/services/widgetSnapshot";

interface WidgetBridgeNativeModule {
  writeSnapshot(filename: string, jsonString: string): Promise<void>;
  reloadTimelines(): Promise<void>;
}

// Only registered on iOS (see expo-module.config.json's `platforms: ["apple"]`).
// On Android, web, and unmodified Expo Go this resolves to `null` instead of
// throwing, so every export below must no-op gracefully when it's absent.
const NativeWidgetBridge =
  requireOptionalNativeModule<WidgetBridgeNativeModule>("WidgetBridge");

export async function writeWidgetSnapshot(snapshot: WidgetSnapshot): Promise<void> {
  if (!NativeWidgetBridge) {
    return;
  }
  const filename = `widget-snapshot-${snapshot.patientId}.json`;
  await NativeWidgetBridge.writeSnapshot(filename, JSON.stringify(snapshot));
}

// Mirrors the widget's `ActivePatientPointer` (targets/EvaluVisionWidget/EvaluVisionWidget.swift) —
// the fallback patient the widget shows when no per-widget configuration picker
// selection has been made. Without this file the widget shows its empty state
// even when a snapshot exists.
export async function writeWidgetActivePatient(
  patientId: string,
  patientName?: string
): Promise<void> {
  if (!NativeWidgetBridge) {
    return;
  }
  await NativeWidgetBridge.writeSnapshot(
    "widget-active-patient.json",
    JSON.stringify({ patientId, patientName })
  );
}

// Mirrors the widget's `PatientOption` (targets/EvaluVisionWidget/AppIntent.swift) —
// populates the widget's configuration picker for caregivers managing multiple
// patients. Optional: absence degrades gracefully (widget falls back to the
// active-patient pointer).
export async function writeWidgetPatientsList(
  patients: { id: string; name: string }[]
): Promise<void> {
  if (!NativeWidgetBridge) {
    return;
  }
  await NativeWidgetBridge.writeSnapshot("widget-patients.json", JSON.stringify(patients));
}

// Asks WidgetKit to re-fetch every placed widget's timeline immediately, so a
// freshly written snapshot shows up within seconds instead of waiting for the
// widget's own ~20-minute refresh schedule.
export async function reloadWidgetTimelines(): Promise<void> {
  if (!NativeWidgetBridge) {
    return;
  }
  await NativeWidgetBridge.reloadTimelines();
}
