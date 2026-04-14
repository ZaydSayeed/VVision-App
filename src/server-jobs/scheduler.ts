import cron from "node-cron";
import { getDb } from "../server-core/database";
import { runInferenceAll } from "./inferPatterns";
import { processDueVisits } from "./visitPrepJob";

export function startCron() {
  // Nightly 03:00 UTC — pattern inference
  cron.schedule("0 3 * * *", async () => {
    try { await runInferenceAll(getDb()); } catch (e) { console.error("nightly inference:", e); }
  });
  // Every 6h — visit prep check
  cron.schedule("0 */6 * * *", async () => {
    try { await processDueVisits(getDb()); } catch (e) { console.error("visit prep:", e); }
  });
  console.log("cron scheduled");
}
