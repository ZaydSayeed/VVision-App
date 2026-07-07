import { secureStorage } from "../config/secureStorage";

const KEY = "appleCalendarIdMap";

async function readMap(): Promise<Record<string, string>> {
  const raw = await secureStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : {};
}

async function writeMap(map: Record<string, string>): Promise<void> {
  await secureStorage.setItem(KEY, JSON.stringify(map));
}

export async function getAppleEventId(ourEventId: string): Promise<string | null> {
  const map = await readMap();
  return map[ourEventId] ?? null;
}

export async function setAppleEventId(ourEventId: string, appleEventId: string): Promise<void> {
  const map = await readMap();
  map[ourEventId] = appleEventId;
  await writeMap(map);
}

export async function clearAppleEventId(ourEventId: string): Promise<void> {
  const map = await readMap();
  delete map[ourEventId];
  await writeMap(map);
}
