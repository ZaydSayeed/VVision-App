// Base URL for the D-Vision FastAPI backend.
// Update this to your deployed backend URL.
// For local dev, use your machine's LAN IP (not localhost) so the phone can reach it.
export const API_BASE_URL = "http://192.168.1.100:8000";

// MongoDB Atlas connection (for direct Atlas Data API usage — optional)
export const MONGODB_DB_NAME = "dvision";
export const MONGODB_COLLECTION_PEOPLE = "people";
export const MONGODB_COLLECTION_ALERTS = "alerts";
