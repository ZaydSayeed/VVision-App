import { beforeAll, afterAll } from "vitest";
import { MongoClient, Db } from "mongodb";

let client: MongoClient;
let memoryServer: { stop: () => Promise<unknown> } | null = null;

async function connect(uri: string): Promise<MongoClient> {
  const c = new MongoClient(uri, { serverSelectionTimeoutMS: 3000 });
  await c.connect();
  return c;
}

beforeAll(async () => {
  const explicitUri = process.env.TEST_MONGODB_URI;
  try {
    // Preserve existing behaviour: use TEST_MONGODB_URI, else a local mongod.
    client = await connect(explicitUri || "mongodb://localhost:27017");
  } catch {
    // No reachable Mongo (no TEST_MONGODB_URI and no local mongod) — fall back
    // to an ephemeral in-memory MongoDB so the suite runs anywhere, incl. CI.
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    const mem = await MongoMemoryServer.create();
    memoryServer = mem;
    client = await connect(mem.getUri());
  }

  const db: Db = client.db("vvision_test");
  // Clean slate each run
  const collections = await db.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
  (globalThis as any).__TEST_DB__ = db;
});

afterAll(async () => {
  await client?.close();
  if (memoryServer) await memoryServer.stop();
});
