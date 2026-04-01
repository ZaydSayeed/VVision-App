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
};
