import { Platform } from "react-native";
import { queueEvent } from "../eventBatcher";

export async function startHomeKitListeners(patientId: string): Promise<() => void> {
  if (Platform.OS !== "ios") return () => {};
  try {
    // react-native-homekit is a native module — only available in bare Expo workflow builds.
    // It's not available in Expo Go; the try/catch ensures graceful fallback.
    const HK = require("react-native-homekit");
    await HK.requestAuthorization();
    const homes = await HK.getHomes();
    const disposers: Array<() => void> = [];
    for (const home of homes) {
      for (const accessory of home.accessories) {
        for (const service of accessory.services) {
          // Motion sensors (characteristic UUID 22)
          const mot = service.characteristics.find((c: any) => c.type === "00000022-0000-1000-8000-0026BB765291");
          if (mot) {
            const sub = HK.subscribe(accessory.uuid, service.uuid, mot.uuid, (value: boolean) => {
              if (value) queueEvent({
                kind: "motion",
                capturedAt: new Date().toISOString(),
                data: { room: service.name, accessory: accessory.name },
                patientId,
              });
            });
            disposers.push(sub);
          }
          // Contact (door) sensors (characteristic UUID 6A)
          const door = service.characteristics.find((c: any) => c.type === "0000006A-0000-1000-8000-0026BB765291");
          if (door) {
            const sub = HK.subscribe(accessory.uuid, service.uuid, door.uuid, (state: number) => {
              queueEvent({
                kind: "door",
                capturedAt: new Date().toISOString(),
                data: { door: accessory.name, state: state === 1 ? "open" : "closed" },
                patientId,
              });
            });
            disposers.push(sub);
          }
        }
      }
    }
    return () => disposers.forEach((d) => d());
  } catch (e) {
    console.warn("HomeKit unavailable:", e);
    return () => {};
  }
}
