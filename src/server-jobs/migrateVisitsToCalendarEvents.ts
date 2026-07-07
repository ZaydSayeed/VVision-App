import { Db } from "mongodb";

// Idempotency: each migrated document stores `migratedFrom`, the original
// visit's _id as a string. Re-running this job (e.g. the migrate-visits cron
// route gets hit twice) skips any visit whose id already appears in
// calendar_events.migratedFrom, so it's a safe no-op for previously-migrated
// visits and only inserts genuinely new ones.
//
// Rollback (manual, run against the DB directly if the migration needs to be
// undone): db.collection("calendar_events").deleteMany({ migratedFrom: { $exists: true } })
export async function migrateVisitsToCalendarEvents(db: Db): Promise<number> {
  const visits = await db.collection("visits").find({}).toArray();
  if (visits.length === 0) return 0;

  const alreadyMigrated = await db
    .collection("calendar_events")
    .find({ migratedFrom: { $exists: true } })
    .toArray();
  const migratedIds = new Set(alreadyMigrated.map((d: any) => d.migratedFrom));

  const newVisits = visits.filter((v: any) => !migratedIds.has(String(v._id)));
  if (newVisits.length === 0) return 0;

  const docs = newVisits.map((v: any) => {
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
      migratedFrom: String(v._id),
      completedDates: [],
      createdAt: new Date().toISOString(),
    };
  });

  await db.collection("calendar_events").insertMany(docs);
  return docs.length;
}
