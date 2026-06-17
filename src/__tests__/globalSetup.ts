// Start ONE Mongo for the whole suite (not one per test file). Spinning up 34
// separate mongodb-memory-server processes was slow and flaky under load; this
// shares a single instance and hands its URI to every test worker.
declare module "vitest" {
  export interface ProvidedContext {
    testMongoUri: string;
  }
}

interface GlobalSetupApi {
  provide: <T = unknown>(key: string, value: T) => void;
}

let memoryServer: { stop: () => Promise<unknown> } | undefined;

export async function setup({ provide }: GlobalSetupApi) {
  let uri = process.env.TEST_MONGODB_URI;

  if (!uri) {
    // Prefer a reachable local mongod; otherwise one shared in-memory server.
    try {
      const { MongoClient } = await import("mongodb");
      const probe = new MongoClient("mongodb://localhost:27017", { serverSelectionTimeoutMS: 1500 });
      await probe.connect();
      await probe.close();
      uri = "mongodb://localhost:27017";
    } catch {
      const { MongoMemoryServer } = await import("mongodb-memory-server");
      const server = await MongoMemoryServer.create();
      memoryServer = server;
      uri = server.getUri();
    }
  }

  provide("testMongoUri", uri);
}

export async function teardown() {
  await memoryServer?.stop();
}
