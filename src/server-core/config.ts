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
  port: parseInt(process.env.PORT || "8000", 10),
  groqApiKey: process.env.GROQ_API_KEY || "",
  mem0ApiKey: process.env.MEM0_API_KEY || "",
  mem0OrgId: process.env.MEM0_ORG_ID || "",
  mem0ProjectId: process.env.MEM0_PROJECT_ID || "",
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  geminiLiveModel: process.env.GEMINI_LIVE_MODEL || "gemini-live-2.5-flash-native-audio",
};
