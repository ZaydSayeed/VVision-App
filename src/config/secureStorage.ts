import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Supabase session storage backed by the device Keychain/Keystore (SEC-04).
 *
 * `expo-secure-store` may not be installed yet — it is resolved dynamically (via
 * a variable specifier so `tsc` doesn't require it), so the app keeps working on
 * AsyncStorage today and transparently upgrades the moment you run:
 *
 *     npx expo install expo-secure-store
 *
 * On first secure read we migrate any existing plaintext AsyncStorage session
 * across, so users are NOT logged out by the switch. SecureStore failures (e.g.
 * Android's ~2KB value limit) fall back to AsyncStorage rather than breaking auth.
 */
const SECURE_MODULE = "expo-secure-store";
let securePromise: Promise<any | null> | undefined;

function getSecure(): Promise<any | null> {
  if (!securePromise) {
    securePromise = import(SECURE_MODULE as string).catch(() => null);
  }
  return securePromise;
}

export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    const SS = await getSecure();
    if (!SS?.getItemAsync) return AsyncStorage.getItem(key);
    try {
      const v = await SS.getItemAsync(key);
      if (v != null) return v;
      // One-time migration from the old plaintext AsyncStorage.
      const legacy = await AsyncStorage.getItem(key);
      if (legacy != null) {
        try {
          await SS.setItemAsync(key, legacy);
          await AsyncStorage.removeItem(key);
        } catch {
          /* keep legacy if migration write fails */
        }
      }
      return legacy;
    } catch {
      return AsyncStorage.getItem(key);
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    const SS = await getSecure();
    if (SS?.setItemAsync) {
      try {
        await SS.setItemAsync(key, value);
        return;
      } catch {
        /* fall through to AsyncStorage */
      }
    }
    await AsyncStorage.setItem(key, value);
  },

  async removeItem(key: string): Promise<void> {
    const SS = await getSecure();
    if (SS?.deleteItemAsync) {
      try {
        await SS.deleteItemAsync(key);
      } catch {
        /* ignore */
      }
    }
    await AsyncStorage.removeItem(key).catch(() => {});
  },
};
