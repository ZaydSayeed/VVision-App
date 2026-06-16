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

  it("serializes concurrent enqueues and flushes without losing or duplicating intents", async () => {
    const sent: string[] = [];
    const q = createHelpQueue(memStorage(), async (item) => { sent.push(item.id); });
    await Promise.all([
      q.enqueue("a", "t"),
      q.enqueue("b", "t"),
      q.flush(),
      q.enqueue("c", "t"),
      q.flush(),
    ]);
    await q.flush(); // drain any straggler
    expect([...sent].sort()).toEqual(["a", "b", "c"]); // each delivered exactly once
    expect(await q.size()).toBe(0);
  });

  it("coalesces concurrent flushes so one intent is delivered exactly once (no double-page)", async () => {
    let calls = 0;
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    const q = createHelpQueue(memStorage(), async () => {
      calls++;
      await gate; // hold the first send in-flight while a second flush races it
    });
    await q.enqueue("id1", "t");

    const f1 = q.flush();
    const f2 = q.flush(); // fires while f1's send is still awaiting
    release();
    await Promise.all([f1, f2]);

    expect(calls).toBe(1);          // not 2 — the SOS is sent once, not duplicated
    expect(await q.size()).toBe(0);
  });
});
