// Base URL for the Vela Vision Express backend.
// Configured via app.json > expo.extra.apiBaseUrl.
// For local dev, use your machine's LAN IP (not localhost) so the phone can reach it.
import Constants from "expo-constants";

export const API_BASE_URL: string =
  Constants.expoConfig?.extra?.apiBaseUrl ?? "http://localhost:8000";

