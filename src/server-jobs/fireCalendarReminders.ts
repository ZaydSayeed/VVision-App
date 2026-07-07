import { Db } from "mongodb";
import { expandOccurrences } from "../server-core/recurrence";
import { getCaregiverPushTokens, getPatientPushToken, sendExpoPush, ExpoPushMessage } from "../server-core/push";

export async function fireCalendarReminders(db: Db, leadMinutes = 30): Promise<number> {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + leadMinutes * 60_000);
  const docs = await db.collection("calendar_events").find({}).toArray();

  let notifiedCount = 0;
  for (const doc of docs) {
    const occurrences = expandOccurrences(doc.startAt, doc.recurrenceRule ?? null, now.toISOString(), windowEnd.toISOString());
    const alreadyNotified: string[] = doc.notifiedOccurrences ?? [];

    for (const occurrenceAt of occurrences) {
      const key = `${doc._id}:${occurrenceAt}`;
      if (alreadyNotified.includes(key)) continue;

      const patientId = doc.patientId;
      const [caregiverTokens, patientToken] = await Promise.all([
        getCaregiverPushTokens(db, patientId),
        getPatientPushToken(db, patientId),
      ]);
      const tokens = [...caregiverTokens, ...(patientToken ? [patientToken] : [])];
      if (tokens.length > 0) {
        const messages: ExpoPushMessage[] = tokens.map((to) => ({
          to,
          title: "Upcoming: " + doc.title,
          body: `${doc.title} at ${new Date(occurrenceAt).toLocaleTimeString()}`,
          data: { type: "calendar_reminder", eventId: String(doc._id) },
          priority: "high",
          sound: "default",
        }));
        await sendExpoPush(messages);
      }

      await db.collection("calendar_events").updateOne(
        { _id: doc._id },
        { $addToSet: { notifiedOccurrences: key } }
      );
      notifiedCount++;
    }
  }

  return notifiedCount;
}
