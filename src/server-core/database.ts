import { MongoClient, Db } from "mongodb";
import { config } from "./config";

let client: MongoClient;
let db: Db;

export async function connectDb(): Promise<void> {
  client = new MongoClient(config.mongodbUri, { tls: true });
  await client.connect();
  db = client.db(config.mongodbDbName);

  // Verify connection
  await client.db("admin").command({ ping: 1 });
  const collections = await db.listCollections().toArray();
  console.log(`Database: ${config.mongodbDbName}`);
  console.log(`Collections: ${collections.map((c) => c.name).join(", ")}`);

  // Ensure indexes
  await db.collection("users").createIndex({ supabase_uid: 1 }, { unique: true });
  await db.collection("patients").createIndex({ link_code: 1 }, { unique: true });
  await db.collection("people").createIndex({ patient_id: 1 });
  await db.collection("alerts").createIndex({ patient_id: 1 });
  await db.collection("help_alerts").createIndex({ patient_id: 1 });
  await db.collection("routines").createIndex({ patient_id: 1 });
  await db.collection("medications").createIndex({ patient_id: 1 });
  await db.collection("reminders").createIndex({ patient_id: 1 });
  await db.collection("conversations").createIndex({ patient_id: 1, created_at: 1 });
  await db.collection("seats").createIndex({ userId: 1, patientId: 1 }, { unique: true });
  await db.collection("seats").createIndex({ patientId: 1 });
  await db.collection("seat_invites").createIndex({ email: 1, patientId: 1 }, { unique: true });
  await db.collection("seat_invites").createIndex({ token: 1 }, { unique: true });
  await db.collection("patterns").createIndex({ patientId: 1, confidence: -1, lastObserved: -1 });
  await db.collection("patterns").createIndex({ patientId: 1, title: 1 }, { unique: true });
  await db.collection("visits").createIndex({ patientId: 1, scheduledFor: 1 });
  await db.collection("profile_events").createIndex({ patientId: 1, capturedAt: -1 });
  await db.collection("profile_events").createIndex({ patientId: 1, kind: 1, capturedAt: -1 });
  await db.collection("patient_health_readings").createIndex(
    { patientId: 1, metric: 1, date: 1 },
    { unique: true, name: "patient_metric_date_unique" }
  );
  await db.collection("patient_health_readings").createIndex(
    { patientId: 1, metric: 1, date: -1 },
    { name: "patient_metric_date_desc" }
  );
  await db.collection("subscriptions").createIndex({ patientId: 1 }, { unique: true });
  console.log("Indexes ensured");
}

export async function closeDb(): Promise<void> {
  if (client) await client.close();
}

export function getDb(): Db {
  return db;
}
