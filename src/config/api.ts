// Base URL for the Vela Vision FastAPI backend.
// Configured via app.json > expo.extra.apiBaseUrl.
// For local dev, use your machine's LAN IP (not localhost) so the phone can reach it.
import Constants from "expo-constants";

export const API_BASE_URL: string =
  Constants.expoConfig?.extra?.apiBaseUrl ?? "http://localhost:8000";

// MongoDB Atlas connection (for direct Atlas Data API usage — optional)
export const MONGODB_DB_NAME = "dvision";
export const MONGODB_COLLECTION_PEOPLE = "people";
export const MONGODB_COLLECTION_ALERTS = "alerts";
