import { requireNativeModule } from "expo-modules-core";

import type { WidgetSnapshot } from "../../src/services/widgetSnapshot";

interface WidgetBridgeNativeModule {
  writeSnapshot(filename: string, jsonString: string): Promise<void>;
}

const NativeWidgetBridge = requireNativeModule<WidgetBridgeNativeModule>("WidgetBridge");

export async function writeWidgetSnapshot(snapshot: WidgetSnapshot): Promise<void> {
  const filename = `widget-snapshot-${snapshot.patientId}.json`;
  await NativeWidgetBridge.writeSnapshot(filename, JSON.stringify(snapshot));
}
