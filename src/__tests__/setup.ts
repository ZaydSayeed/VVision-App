import { beforeAll, afterAll, inject } from "vitest";
import { MongoClient, Db } from "mongodb";

// Connects to the single shared Mongo started in globalSetup.ts (one instance
// for the whole suite). Each file gets a clean slate via the collection wipe
// below; fileParallelism is disabled so sequential files don't collide.
let client: MongoClient;

beforeAll(async () => {
  const uri = inject("testMongoUri");
  client = new MongoClient(uri);
  await client.connect();

  const db: Db = client.db("vvision_test");
  const collections = await db.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
  (globalThis as any).__TEST_DB__ = db;
});

afterAll(async () => {
  await client?.close();
});
