/**
 * Durable offline queue for Help/SOS intents.
 *
 * A help tap must never be lost — not to a flaky network, a backend cold start,
 * or an app crash (SAFE-9). The intent is persisted before we attempt delivery
 * and only removed once the server has acknowledged it. Storage is injected so
 * the logic is testable without React Native's AsyncStorage.
 */

export interface KVStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface QueuedHelp {
  id: string;
  createdAt: string;
}

const QUEUE_KEY = "@vela/help_queue";

export interface HelpQueue {
  enqueue(id: string, createdAt: string): Promise<void>;
  /** Attempt to deliver queued intents FIFO; stops at the first failure. */
  flush(): Promise<{ sent: number; remaining: number }>;
  size(): Promise<number>;
}

export function createHelpQueue(
  storage: KVStorage,
  send: (item: QueuedHelp) => Promise<void>
): HelpQueue {
  // Serialize ALL queue mutations (enqueue + flush) through one chain. The hook
  // fires flush() from four triggers (mount, foreground, poll tick, sendHelp);
  // running them concurrently — or letting an enqueue interleave with a flush's
  // read→modify→write — would either double-send an intent (double-paging the
  // care team, SAFE-1) or clobber a freshly-enqueued tap. Serializing prevents both.
  let chain: Promise<unknown> = Promise.resolve();

  function serialize<T>(op: () => Promise<T>): Promise<T> {
    const run = chain.then(op, op);
    chain = run.then(() => undefined, () => undefined); // keep the chain alive on throw
    return run;
  }

  async function doFlush(): Promise<{ sent: number; remaining: number }> {
    const items = await read();
    let sent = 0;
    while (items.length > 0) {
      try {
        await send(items[0]);
        items.shift(); // delivered — drop it
        sent++;
      } catch {
        break; // still offline; keep this and the rest, try again later
      }
    }
    await write(items);
    return { sent, remaining: items.length };
  }

  async function read(): Promise<QueuedHelp[]> {
    try {
      const raw = await storage.getItem(QUEUE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return []; // corrupt payload — treat as empty rather than crash
    }
  }

  async function write(items: QueuedHelp[]): Promise<void> {
    if (items.length === 0) {
      await storage.removeItem(QUEUE_KEY);
      return;
    }
    await storage.setItem(QUEUE_KEY, JSON.stringify(items));
  }

  return {
    enqueue(id, createdAt) {
      return serialize(async () => {
        const items = await read();
        items.push({ id, createdAt });
        await write(items);
      });
    },

    flush() {
      return serialize(doFlush);
    },

    async size() {
      return (await read()).length;
    },
  };
}
