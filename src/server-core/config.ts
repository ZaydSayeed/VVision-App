import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });
// When running with tsx from project root, __dirname is src/server-core
// so ../../.env points to the project root .env

export const config = {
  mongodbUri: process.env.MONGODB_URI || "",
  mongodbDbName: process.env.MONGODB_DB_NAME || "dvision",
  supabaseUrl: process.env.SUPABASE_URL || "",
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  port: parseInt(process.env.PORT || "8000", 10),
  groqApiKey: process.env.GROQ_API_KEY || "",
  mem0ApiKey: process.env.MEM0_API_KEY || "",
  mem0OrgId: process.env.MEM0_ORG_ID || "",
  mem0ProjectId: process.env.MEM0_PROJECT_ID || "",
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  geminiLiveModel: process.env.GEMINI_LIVE_MODEL || "gemini-live-2.5-flash-native-audio",
  revenueCatSecretKey: process.env.REVENUECAT_SECRET_KEY || "",
  revenueCatWebhookSecret: process.env.REVENUECAT_WEBHOOK_SECRET || "",
};

/**
 * Fail fast at startup if a required secret is missing, instead of silently
 * defaulting to "" and erroring on the first DB/auth call with an unhelpful
 * message. Call once from server start() before connecting to anything.
 */
export function validateConfig(): void {
  const required: Array<[string, string]> = [
    ["MONGODB_URI", config.mongodbUri],
    ["SUPABASE_URL", config.supabaseUrl],
    ["SUPABASE_SERVICE_ROLE_KEY", config.supabaseServiceRoleKey],
  ];
  const missing = required.filter(([, v]) => !v).map(([k]) => k);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}. ` +
        `Set them in the deployment environment (e.g. Render dashboard) before starting the server.`
    );
  }

  const optional: Array<[string, string]> = [
    ["GROQ_API_KEY", config.groqApiKey],
    ["GEMINI_API_KEY", config.geminiApiKey],
    ["MEM0_API_KEY", config.mem0ApiKey],
    ["REVENUECAT_WEBHOOK_SECRET", config.revenueCatWebhookSecret],
  ];
  const missingOptional = optional.filter(([, v]) => !v).map(([k]) => k);
  if (missingOptional.length > 0) {
    console.warn(
      `[config] Optional env vars not set — related features are disabled: ${missingOptional.join(", ")}`
    );
  }
}
