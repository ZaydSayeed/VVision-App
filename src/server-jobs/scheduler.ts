import cron from "node-cron";
import { getDb } from "../server-core/database";
import { runInferenceAll } from "./inferPatterns";
import { fireRemindersForAll } from "./fireReminders";
import { runDailySummaries } from "./dailySummary";
import { escalateHelpAlerts } from "./escalateHelpAlerts";

export function startCron() {
  // Nightly 03:00 UTC — pattern inference
  cron.schedule("0 3 * * *", async () => {
    try { await runInferenceAll(getDb()); } catch (e) { console.error("nightly inference:", e); }
  });

  // Every 5 minutes — fire due reminders
  cron.schedule("*/5 * * * *", async () => {
    try { await fireRemindersForAll(getDb()); } catch (e) { console.error("fireReminders:", e); }
  });

  // Every minute — re-escalate unanswered help/SOS alerts to the care team
  cron.schedule("* * * * *", async () => {
    try { await escalateHelpAlerts(getDb()); } catch (e) { console.error("escalateHelpAlerts:", e); }
  });

  // Daily 08:00 UTC — caregiver morning summary push
  cron.schedule("0 8 * * *", async () => {
    try { await runDailySummaries(getDb()); } catch (e) { console.error("dailySummary:", e); }
  });

  console.log("cron scheduled");
}
