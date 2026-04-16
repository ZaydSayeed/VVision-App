import cron from "node-cron";
import { getDb } from "../server-core/database";
import { runInferenceAll } from "./inferPatterns";

export function startCron() {
  // Nightly 03:00 UTC — pattern inference
  cron.schedule("0 3 * * *", async () => {
    try { await runInferenceAll(getDb()); } catch (e) { console.error("nightly inference:", e); }
  });
  console.log("cron scheduled");
}
