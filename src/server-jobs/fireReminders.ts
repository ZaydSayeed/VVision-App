import { Db } from "mongodb";

export function parseReminderTime(time: string | null | undefined): { hours: number; minutes: number } | null {
  if (!time) return null;
  const match = time.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3].toUpperCase();
  if (period === "AM") {
    if (hours === 12) hours = 0;
  } else {
    if (hours !== 12) hours += 12;
  }
  return { hours, minutes };
}

export function isReminderDueNow(
  parsed: { hours: number; minutes: number },
  now: Date,
  windowMinutes = 5
): boolean {
  const reminderMinutes = parsed.hours * 60 + parsed.minutes;
  const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const diff = nowMinutes - reminderMinutes;
  return diff >= 0 && diff < windowMinutes;
}

async function sendExpoPush(
  token: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  const res = await fetch("https://exp.host/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to: token, title, body, data: data ?? {} }),
  });
  const json = await res.json();
  const ticket = json?.data?.[0];
  if (ticket?.status === "error") {
    console.error("[fireReminders] push delivery error:", ticket.details);
  }
}

export async function fireRemindersForAll(db: Db): Promise<void> {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  const reminders = await db
    .collection("reminders")
    .find({ time: { $exists: true, $ne: null } })
    .toArray();

  for (const reminder of reminders) {
    const parsed = parseReminderTime(reminder.time);
    if (!parsed) continue;
    if (!isReminderDueNow(parsed, now)) continue;

    // Skip if already notified today
    if (reminder.notified_date === today) continue;

    const tokenDoc = await db
      .collection("patientPushTokens")
      .findOne({ patientId: reminder.patient_id });
    if (!tokenDoc?.expoPushToken) continue;

    try {
      await sendExpoPush(
        tokenDoc.expoPushToken,
        "Reminder",
        reminder.text,
        { reminderId: String(reminder._id), type: "reminder" }
      );
      await db.collection("reminders").updateOne(
        { _id: reminder._id },
        { $set: { notified_date: today } }
      );
    } catch (err) {
      console.error("[fireReminders] failed for reminder", reminder._id, err);
    }
  }
}
