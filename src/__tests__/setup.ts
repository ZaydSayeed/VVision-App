import { beforeAll, afterAll } from "vitest";
import { MongoClient, Db } from "mongodb";

let client: MongoClient;
let db: Db;

beforeAll(async () => {
  const uri = process.env.TEST_MONGODB_URI || "mongodb://localhost:27017";
  client = new MongoClient(uri);
  await client.connect();
  db = client.db("vvision_test");
  // Clean slate each run
  const collections = await db.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
  (globalThis as any).__TEST_DB__ = db;
});

afterAll(async () => {
  await client.close();
});
