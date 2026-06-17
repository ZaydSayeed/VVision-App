import { createClient } from "@supabase/supabase-js";
import Constants from "expo-constants";
import { secureStorage } from "./secureStorage";

const SUPABASE_URL = Constants.expoConfig?.extra?.supabaseUrl ?? "";
const SUPABASE_ANON_KEY = Constants.expoConfig?.extra?.supabaseAnonKey ?? "";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // Keychain/Keystore-backed (with AsyncStorage fallback) — see secureStorage (SEC-04).
    storage: secureStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
