import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

export interface SensorPrefs {
  gaitEnabled: boolean;
  typingEnabled: boolean;
  smartHomeEnabled: boolean;
}
const KEY = "vela:sensor_prefs";
// Opt-in: passive sensors are OFF until the user explicitly enables sharing
// (paired with the consent layer — no silent collection). (EMO-1)
const DEFAULT: SensorPrefs = { gaitEnabled: false, typingEnabled: false, smartHomeEnabled: false };

export function useSensorPrefs() {
  const [prefs, setPrefs] = useState<SensorPrefs>(DEFAULT);
  useEffect(() => { AsyncStorage.getItem(KEY).then(v => v && setPrefs({ ...DEFAULT, ...JSON.parse(v) })); }, []);
  const update = async (p: Partial<SensorPrefs>) => {
    const next = { ...prefs, ...p };
    setPrefs(next);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  };
  return { prefs, update };
}
