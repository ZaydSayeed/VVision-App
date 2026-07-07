import { Db } from "mongodb";

export async function migrateVisitsToCalendarEvents(db: Db): Promise<number> {
  const visits = await db.collection("visits").find({}).toArray();
  if (visits.length === 0) return 0;

  const docs = visits.map((v: any) => {
    const start = new Date(v.scheduledFor);
    const end = new Date(start.getTime() + 30 * 60_000);
    const notesParts = [v.providerRole, v.notes].filter(Boolean);
    return {
      patientId: v.patientId,
      title: v.providerName,
      category: "medical" as const,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      notes: notesParts.length ? notesParts.join(" — ") : null,
      recurrenceRule: null,
      createdBy: "migrated",
      completedDates: [],
      createdAt: new Date().toISOString(),
    };
  });

  await db.collection("calendar_events").insertMany(docs);
  return docs.length;
}
