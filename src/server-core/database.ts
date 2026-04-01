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
  console.log("Indexes ensured");
}

export async function closeDb(): Promise<void> {
  if (client) await client.close();
}

export function getDb(): Db {
  return db;
}
