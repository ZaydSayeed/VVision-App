import { describe, it, expect } from "vitest";
import { createHelpQueue, KVStorage } from "./helpQueue";

function memStorage(): KVStorage {
  const m = new Map<string, string>();
  return {
    getItem: async (k) => (m.has(k) ? m.get(k)! : null),
    setItem: async (k, v) => { m.set(k, v); },
    removeItem: async (k) => { m.delete(k); },
  };
}

describe("help offline queue", () => {
  it("persists an enqueued help intent across reads", async () => {
    const storage = memStorage();
    const q = createHelpQueue(storage, async () => {});
    await q.enqueue("id1", "2026-01-01T00:00:00Z");
    expect(await q.size()).toBe(1);
    // A fresh queue over the same storage still sees it (durable)
    const q2 = createHelpQueue(storage, async () => {});
    expect(await q2.size()).toBe(1);
  });

  it("flush delivers queued intents and clears them on success", async () => {
    let sent = 0;
    const q = createHelpQueue(memStorage(), async () => { sent++; });
    await q.enqueue("id1", "t");
    await q.enqueue("id2", "t");
    const r = await q.flush();
    expect(sent).toBe(2);
    expect(r.sent).toBe(2);
    expect(await q.size()).toBe(0);
  });

  it("keeps intents queued when send fails — no SOS is ever lost", async () => {
    const q = createHelpQueue(memStorage(), async () => { throw new Error("offline"); });
    await q.enqueue("id1", "t");
    const r = await q.flush();
    expect(r.sent).toBe(0);
    expect(await q.size()).toBe(1);
  });

  it("stops at the first failure and retains the rest (FIFO, no hammering)", async () => {
    let calls = 0;
    const q = createHelpQueue(memStorage(), async () => {
      calls++;
      if (calls === 2) throw new Error("offline");
    });
    await q.enqueue("a", "t");
    await q.enqueue("b", "t");
    await q.enqueue("c", "t");
    const r = await q.flush();
    expect(r.sent).toBe(1);          // 'a' delivered
    expect(await q.size()).toBe(2);  // 'b' (failed) + 'c' retained
  });

  it("treats corrupt storage as an empty queue (never crashes)", async () => {
    const storage = memStorage();
    await storage.setItem("@vela/help_queue", "not json");
    const q = createHelpQueue(storage, async () => {});
    expect(await q.size()).toBe(0);
  });
});
