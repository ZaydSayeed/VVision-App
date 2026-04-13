# Plan E — Patient Companion (Twilio Phone) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** Let the patient dial a dedicated Vela phone number from ANY phone (landline, flip phone, smartphone) and reach a warm, patient-aware voice companion that knows who they are, handles repetitive questions, and writes each call's summary back to the Living Profile.

**Architecture:** Twilio phone number receives inbound calls → webhook to our backend → backend bridges the call audio to Gemini Live (Plan C's bridge, reused) with a system prompt grounded in the patient's Living Profile (identity, history, triggers, recent memories). On call end, Gemini generates a 2–4 sentence summary that writes to `/api/profiles/:patientId/memory` with source `companion_call`.

**Tech Stack:** Twilio Voice · `twilio` npm package · `@google/genai` (reused from Plan C) · existing Express · MongoDB.

**Depends on:** Plan A. Also benefits from (but does not require) Plan C's Live bridge — reuses that code path.

**Worktree:** `.worktrees/patient-companion-twilio`, branch `feature/patient-companion-twilio` from main.

**Manual prerequisites (human, before Task 1):**
1. Sign up at twilio.com. Buy one Voice-capable phone number (~$1/mo).
2. Note Account SID, Auth Token, and the phone number E.164 (`+1XXX...`).
3. In Twilio Console → Phone Numbers → select the number → set Voice Configuration → "A call comes in" → Webhook → `https://vvision-app.onrender.com/api/companion/voice` (POST). Leave "Primary handler fails" blank for v1.

---

### Task 1: Install Twilio SDK + env config

**Files:** `package.json`, `src/server-core/config.ts`, `.env.example`

- [ ] **Step 1:** `npm install twilio`

- [ ] **Step 2:** Append to `config.ts`:
```ts
twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || "",
twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || "",
twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER || "",
```

- [ ] **Step 3:** Append to `.env.example`:
```
# Twilio (patient companion phone)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
```

- [ ] **Step 4:** Commit:
```bash
git add package.json package-lock.json src/server-core/config.ts .env.example
git commit -m "chore: install twilio SDK + env config"
```

---

### Task 2: Map caller number → patient

**Files:**
- Create: `src/server-core/callerLookup.ts`
- Create: `src/server-core/callerLookup.test.ts`
- Modify: `src/server-core/database.ts`

- [ ] **Step 1: Failing test.** `callerLookup.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { resolveCallerToPatient } from "./callerLookup";

describe("resolveCallerToPatient", () => {
  beforeEach(async () => {
    await globalThis.__TEST_DB__.collection("patient_callers").deleteMany({});
  });
  it("returns null when no mapping exists", async () => {
    const r = await resolveCallerToPatient(globalThis.__TEST_DB__, "+14155550123");
    expect(r).toBeNull();
  });
  it("returns patientId when mapping exists (E.164 normalized)", async () => {
    const db = globalThis.__TEST_DB__;
    await db.collection("patient_callers").insertOne({ e164: "+14155550123", patientId: "p42", label: "Mom's cell" });
    const r = await resolveCallerToPatient(db, "+14155550123");
    expect(r?.patientId).toBe("p42");
  });
});
```
Run → FAIL.

- [ ] **Step 2: Implement.** `callerLookup.ts`:
```ts
import { Db } from "mongodb";

export async function resolveCallerToPatient(db: Db, e164: string): Promise<{ patientId: string; label?: string } | null> {
  const row = await db.collection("patient_callers").findOne({ e164 });
  if (!row) return null;
  return { patientId: row.patientId, label: row.label };
}
```

- [ ] **Step 3:** Add DB indexes in `database.ts`:
```ts
await db.collection("patient_callers").createIndex({ e164: 1 }, { unique: true });
await db.collection("patient_callers").createIndex({ patientId: 1 });
```

Run test → PASS.

- [ ] **Step 4:** Commit:
```bash
git add src/server-core/callerLookup.ts src/server-core/callerLookup.test.ts src/server-core/database.ts
git commit -m "feat: map caller E.164 → patient for companion calls"
```

---

### Task 3: CRUD for patient_callers (caregiver registers Mom's phone)

**Files:**
- Create: `src/server-routes/callers.ts`
- Create: `src/server-routes/callers.test.ts`
- Modify: `src/server.ts`

- [ ] **Step 1: Failing test** for Zod schema + E.164 normalization:
```ts
import { describe, it, expect } from "vitest";
import { callerAddSchema, normalizeE164 } from "./callers";

describe("callerAddSchema", () => {
  it("accepts valid US number with label", () => {
    expect(callerAddSchema.safeParse({ phone: "(415) 555-0123", label: "Mom's cell" }).success).toBe(true);
  });
  it("rejects <10-digit phone", () => {
    expect(callerAddSchema.safeParse({ phone: "555" }).success).toBe(false);
  });
});
describe("normalizeE164", () => {
  it("prefixes +1 for 10-digit US", () => { expect(normalizeE164("(415) 555-0123")).toBe("+14155550123"); });
  it("preserves existing +", () => { expect(normalizeE164("+14155550123")).toBe("+14155550123"); });
});
```
Run → FAIL.

- [ ] **Step 2: Implement.** `callers.ts`:
```ts
import { Router } from "express";
import { z } from "zod";
import { getDb } from "../server-core/database";
import { authMiddleware } from "../server-core/security";
import { requireSeat } from "../server-core/seatResolver";

export function normalizeE164(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (raw.trim().startsWith("+")) return "+" + digits;
  if (digits.length === 10) return "+1" + digits; // US default
  if (digits.length === 11 && digits.startsWith("1")) return "+" + digits;
  return "+" + digits;
}

export const callerAddSchema = z.object({
  phone: z.string().min(7).max(30),
  label: z.string().max(80).optional(),
});

const router = Router();

router.post("/:patientId/callers", authMiddleware, requireSeat, async (req, res) => {
  if (req.seat?.role !== "primary_caregiver") { res.status(403).json({ detail: "Primary caregiver only" }); return; }
  const parsed = callerAddSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ detail: parsed.error.issues[0].message }); return; }
  try {
    const db = getDb();
    const e164 = normalizeE164(parsed.data.phone);
    await db.collection("patient_callers").updateOne(
      { e164 },
      { $set: { e164, patientId: req.params.patientId, label: parsed.data.label ?? null, createdAt: new Date().toISOString() } },
      { upsert: true }
    );
    res.status(201).json({ e164 });
  } catch (err: any) {
    if (err.code === 11000) { res.status(409).json({ detail: "Number already mapped to another profile" }); return; }
    console.error("caller add error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

router.get("/:patientId/callers", authMiddleware, requireSeat, async (req, res) => {
  try {
    const db = getDb();
    const callers = await db.collection("patient_callers").find({ patientId: req.params.patientId }).toArray();
    res.json({ callers });
  } catch (err) { res.status(500).json({ detail: "Internal server error" }); }
});

router.delete("/:patientId/callers/:e164", authMiddleware, requireSeat, async (req, res) => {
  if (req.seat?.role !== "primary_caregiver") { res.status(403).json({ detail: "Primary caregiver only" }); return; }
  try {
    const db = getDb();
    await db.collection("patient_callers").deleteOne({ e164: req.params.e164, patientId: req.params.patientId });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ detail: "Internal server error" }); }
});

export default router;
```

Run tests → PASS.

- [ ] **Step 3:** Mount in server.ts: `app.use("/api/profiles", callerRoutes);`

- [ ] **Step 4:** Commit:
```bash
git add src/server-routes/callers.ts src/server-routes/callers.test.ts src/server.ts
git commit -m "feat: caller mapping endpoints (register Mom's phone)"
```

---

### Task 4: Companion call webhook (Twilio entrypoint)

**Files:**
- Create: `src/server-routes/companion.ts`
- Modify: `src/server.ts`

- [ ] **Step 1:** `companion.ts`:
```ts
import { Router } from "express";
import twilio from "twilio";
import { config } from "../server-core/config";
import { getDb } from "../server-core/database";
import { resolveCallerToPatient } from "../server-core/callerLookup";

const router = Router();

// POST /api/companion/voice — Twilio webhook, returns TwiML
router.post("/voice", async (req, res) => {
  const from = req.body.From as string;
  const callSid = req.body.CallSid as string;
  const vr = new twilio.twiml.VoiceResponse();

  try {
    const db = getDb();
    const match = await resolveCallerToPatient(db, from);
    if (!match) {
      vr.say({ voice: "alice" }, "This number is not yet registered. Please ask your caregiver to add your phone to Vela.");
      vr.hangup();
      res.type("text/xml").send(vr.toString());
      return;
    }
    // Log the call so we can close it out in the status callback
    await db.collection("companion_calls").insertOne({
      callSid, from, patientId: match.patientId, startedAt: new Date().toISOString(), status: "active",
    });
    // Connect to our Live WebSocket stream. Twilio <Stream> bridges audio to us.
    const start = vr.connect();
    const streamUrl = `wss://${req.get("host")}/api/companion/stream?callSid=${callSid}&patientId=${encodeURIComponent(match.patientId)}`;
    start.stream({ url: streamUrl });
    res.type("text/xml").send(vr.toString());
  } catch (err) {
    console.error("voice webhook error:", err);
    vr.say("Sorry, we're having trouble. Please try again later.");
    vr.hangup();
    res.type("text/xml").send(vr.toString());
  }
});

// POST /api/companion/status — Twilio status callback (optional — set in console)
router.post("/status", async (req, res) => {
  try {
    const db = getDb();
    await db.collection("companion_calls").updateOne(
      { callSid: req.body.CallSid },
      { $set: { status: req.body.CallStatus, endedAt: new Date().toISOString() } }
    );
    res.sendStatus(200);
  } catch (err) { res.sendStatus(500); }
});

export default router;
```

- [ ] **Step 2:** Mount in server.ts: `app.use("/api/companion", companionRoutes);`

- [ ] **Step 3:** Commit:
```bash
git add src/server-routes/companion.ts src/server.ts
git commit -m "feat: Twilio inbound call webhook with caller→patient mapping"
```

---

### Task 5: Twilio Media Stream → Gemini Live bridge

**Files:**
- Create: `src/server-core/companionBridge.ts`
- Modify: `src/server.ts` (attach WebSocket upgrade)

- [ ] **Step 1:** Twilio Media Streams send μ-law 8kHz audio in base64 frames. Gemini Live expects PCM16 16kHz. We'll upsample + convert. The bridge:
```ts
import { WebSocketServer, WebSocket } from "ws";
import { Server as HTTPServer, IncomingMessage } from "http";
import { GoogleGenAI, Modality } from "@google/genai";
import { config } from "./config";
import { getDb } from "./database";
import { addMemory } from "./memory";

// 8 kHz μ-law → 16 kHz PCM16
function mulawToPcm16(mulaw: Buffer): Int16Array {
  const out = new Int16Array(mulaw.length);
  for (let i = 0; i < mulaw.length; i++) {
    let u = ~mulaw[i] & 0xff;
    const sign = u & 0x80; const exp = (u >> 4) & 0x07; const man = u & 0x0f;
    let s = ((man << 3) + 0x84) << exp;
    s -= 0x84;
    out[i] = sign ? -s : s;
  }
  return out;
}
function upsample16to8(pcm: Int16Array): Int16Array {
  const out = new Int16Array(pcm.length * 2);
  for (let i = 0; i < pcm.length; i++) { out[i * 2] = pcm[i]; out[i * 2 + 1] = pcm[i]; }
  return out;
}

export function attachCompanionBridge(server: HTTPServer) {
  const wss = new WebSocketServer({ noServer: true });
  server.on("upgrade", (req, socket, head) => {
    if (!req.url?.startsWith("/api/companion/stream")) return;
    wss.handleUpgrade(req, socket, head, (ws) => handleStream(ws, req));
  });
}

async function handleStream(ws: WebSocket, req: IncomingMessage) {
  const url = new URL(req.url!, `http://${req.headers.host}`);
  const callSid = url.searchParams.get("callSid")!;
  const patientId = url.searchParams.get("patientId")!;

  const db = getDb();
  const profile = await db.collection("patients").findOne({ _id: { $eq: patientId } as any });
  const memories = await db.collection("patient_callers").findOne({ patientId }); // v1 stub — Plan F refines
  const systemInstruction = [
    "You are Vela, a warm, patient-aware phone companion for someone living with dementia.",
    profile?.name ? `You are speaking with ${profile.name}.` : "",
    profile?.history ? `Background: ${profile.history}` : "",
    profile?.triggers?.length ? `Avoid distressing topics and focus on what's calming.` : "",
    "Speak slowly. Use short sentences. If they repeat a question, answer gently as if it were the first time. Never pretend to be a real person — you are Vela.",
  ].filter(Boolean).join(" ");

  if (!config.geminiApiKey) { ws.close(1011, "no gemini"); return; }
  const genai = new GoogleGenAI({ apiKey: config.geminiApiKey });
  const transcript: string[] = [];
  const live = await genai.live.connect({
    model: config.geminiLiveModel,
    config: { responseModalities: [Modality.AUDIO, Modality.TEXT], systemInstruction },
    callbacks: {
      onmessage: (m: any) => {
        if (m.serverContent?.outputTranscription?.text) transcript.push(m.serverContent.outputTranscription.text);
        if (m.serverContent?.modelTurn?.parts) {
          for (const p of m.serverContent.modelTurn.parts) {
            if (p.inlineData?.mimeType?.startsWith("audio/")) {
              // Send back to Twilio as μ-law 8kHz base64
              ws.send(JSON.stringify({ event: "media", streamSid: "", media: { payload: p.inlineData.data } }));
            }
          }
        }
      },
      onerror: () => ws.close(),
      onclose: () => ws.close(),
    },
  });

  ws.on("message", async (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.event === "media" && msg.media?.payload) {
        const mulaw = Buffer.from(msg.media.payload, "base64");
        const pcm8 = mulawToPcm16(mulaw);
        const pcm16 = upsample16to8(pcm8);
        live.sendRealtimeInput({ media: { data: Buffer.from(pcm16.buffer).toString("base64"), mimeType: "audio/pcm;rate=16000" } });
      }
      if (msg.event === "stop") {
        live.close();
      }
    } catch (e) { console.error("companion msg err:", e); }
  });

  ws.on("close", async () => {
    live.close();
    const fullTranscript = transcript.join(" ").trim();
    if (fullTranscript.length > 0) {
      try {
        await addMemory({
          patientId,
          content: `Companion call summary: ${fullTranscript.slice(0, 2000)}`,
          metadata: { source: "companion_call", callSid },
        });
      } catch (e) { console.error("memory write on call end:", e); }
    }
    await db.collection("companion_calls").updateOne(
      { callSid },
      { $set: { endedAt: new Date().toISOString(), status: "completed", transcript: fullTranscript } }
    );
  });
}
```

- [ ] **Step 2:** In `src/server.ts`, call `attachCompanionBridge(httpServer)` next to `attachLiveBridge` (if Plan C is in, reuse the same HTTP server).

- [ ] **Step 3:** Commit:
```bash
git add src/server-core/companionBridge.ts src/server.ts
git commit -m "feat: bridge Twilio media stream ↔ Gemini Live for patient companion"
```

---

### Task 6: Caregiver UI — register Mom's phone

**Files:**
- Create: `src/screens/caregiver/CallerSetupScreen.tsx`
- Create: `src/api/callers.ts`

- [ ] **Step 1:** `src/api/callers.ts`:
```ts
import { authFetch } from "./authFetch";

export async function addCaller(patientId: string, phone: string, label?: string) {
  const r = await authFetch(`/api/profiles/${patientId}/callers`, { method: "POST", body: JSON.stringify({ phone, label }) });
  if (!r.ok) throw new Error((await r.json()).detail);
  return r.json();
}
export async function listCallers(patientId: string) {
  const r = await authFetch(`/api/profiles/${patientId}/callers`);
  if (!r.ok) throw new Error("Failed to load");
  return r.json() as Promise<{ callers: Array<{ e164: string; label: string | null }> }>;
}
```

- [ ] **Step 2:** `CallerSetupScreen.tsx`:
```tsx
import React, { useEffect, useState, useCallback } from "react";
import { View, Text, TextInput, Pressable, FlatList, Alert } from "react-native";
import { addCaller, listCallers } from "../../api/callers";
import { useCurrentProfile } from "../../hooks/useCurrentProfile";

export default function CallerSetupScreen() {
  const { patientId } = useCurrentProfile();
  const [phone, setPhone] = useState("");
  const [label, setLabel] = useState("");
  const [callers, setCallers] = useState<any[]>([]);

  const load = useCallback(async () => {
    if (!patientId) return;
    try { const r = await listCallers(patientId); setCallers(r.callers); } catch {}
  }, [patientId]);
  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    if (!patientId) return;
    try { await addCaller(patientId, phone, label); setPhone(""); setLabel(""); await load(); }
    catch (e: any) { Alert.alert("Couldn't add", e.message); }
  };

  return (
    <View style={{ padding: 24, gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: "700" }}>Mom's phones</Text>
      <Text style={{ color: "#64748b" }}>When Mom calls Vela's number from any of these, the companion knows it's her.</Text>
      <TextInput placeholder="Phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad"
        style={{ borderWidth: 1, borderColor: "#e2e8f0", padding: 12, borderRadius: 10 }} />
      <TextInput placeholder="Label (Mom's cell, kitchen landline…)" value={label} onChangeText={setLabel}
        style={{ borderWidth: 1, borderColor: "#e2e8f0", padding: 12, borderRadius: 10 }} />
      <Pressable onPress={submit} style={{ backgroundColor: "#6366f1", padding: 14, borderRadius: 10 }}>
        <Text style={{ color: "white", textAlign: "center", fontWeight: "700" }}>Add</Text>
      </Pressable>
      <FlatList data={callers} keyExtractor={(c: any) => c.e164} renderItem={({ item }: any) => (
        <View style={{ padding: 12, backgroundColor: "#f8fafc", borderRadius: 8, marginTop: 8 }}>
          <Text style={{ fontWeight: "600" }}>{item.e164}</Text>
          {item.label && <Text style={{ color: "#64748b" }}>{item.label}</Text>}
        </View>
      )} />
    </View>
  );
}
```

- [ ] **Step 3:** Commit:
```bash
git add src/screens/caregiver/CallerSetupScreen.tsx src/api/callers.ts
git commit -m "feat: caller setup screen to register patient phones"
```

---

### Task 7: Wire Vela phone number into UI

**Files:**
- Modify: caregiver home or settings screen

- [ ] **Step 1:** In caregiver dashboard, surface the Vela phone number (from `config.twilioPhoneNumber` fetched via a small `/api/companion/info` endpoint that returns `{ phoneNumber }`). Include a "Tap to copy" and a "Test call" button that opens the phone dialer.

- [ ] **Step 2:** Add the companion info endpoint in `companion.ts`:
```ts
router.get("/info", authMiddleware, (req, res) => {
  res.json({ phoneNumber: config.twilioPhoneNumber || null });
});
```

- [ ] **Step 3:** Commit:
```bash
git add src/screens src/server-routes/companion.ts
git commit -m "feat: surface Vela phone number in caregiver UI"
```

---

### Task 8: Smoke-test checklist

**Files:**
- Create: `docs/manual-tests/plan-e-smoke.md`

- [ ] Content:
```markdown
# Plan E Smoke Tests

**Requires:** Live Twilio number + real phone to call from + GEMINI_API_KEY set.

1. **Unknown caller** — Call Vela's number from a number NOT registered. Hear the "not registered" message. Call ends cleanly.
2. **Register** — In caregiver UI, add your own mobile number as a caller. Confirm `GET /api/profiles/:id/callers` returns it.
3. **Happy path** — Call Vela from the registered number. Expect Gemini Live voice greeting within 3s. Speak for ~20s. Hang up.
4. **Memory write** — `GET /api/profiles/:id/memory/search?q=companion` returns at least one doc with source `companion_call`.
5. **Multiple caregivers** — Add a second phone. Call from it. Same companion, same memory store.
6. **Concurrent calls (stress)** — From two phones simultaneously (different numbers, same patient). Both connect; both transcripts save.
7. **Duplicate number** — Try to register the same number against a second patient. Expect 409.
```

- [ ] **Step 2:** Commit:
```bash
git add docs/manual-tests/plan-e-smoke.md
git commit -m "docs: Plan E smoke test checklist"
```

---

### Task 9: Docs

**Files:** `README.md`, `CLAUDE.md`

- [ ] **Step 1:** README append:
```markdown
### Patient Companion (Plan E)
| Method | Path | Purpose |
|---|---|---|
| POST | `/api/companion/voice` | Twilio inbound call webhook (TwiML) |
| POST | `/api/companion/status` | Twilio call-status callback |
| WS | `/api/companion/stream?callSid=&patientId=` | Twilio Media Stream ↔ Gemini Live bridge |
| GET | `/api/companion/info` | Returns the current Vela phone number |
| POST/GET/DELETE | `/api/profiles/:patientId/callers[/:e164]` | Caller registration |

Set Twilio Voice webhook to `POST /api/companion/voice` on your purchased number.
```

- [ ] **Step 2:** CLAUDE.md append:
```markdown
### Patient Companion (Plan E, 2026-04-13)
- The companion NEVER pretends to be a real person. The system prompt makes it introduce itself as Vela.
- Audio format: Twilio sends μ-law 8kHz; Gemini wants PCM16 16kHz. Conversion lives in `companionBridge.ts`. Any latency investigation starts there.
- A failed `addMemory` on call end logs but does NOT retry — Plan F's pattern job will handle any gaps.
```

- [ ] **Step 3:** Commit:
```bash
git add README.md CLAUDE.md
git commit -m "docs: document patient companion architecture"
```

---

## Plan summary

Backend gets `/api/companion/voice` TwiML handler, Twilio Media Stream ↔ Gemini Live bridge, caller mapping CRUD. Client gets `CallerSetupScreen` + phone number surface. The patient calls a phone number and Vela answers, grounded in their Living Profile.

**Next plan:** **F — Pattern Learning + Visit Prep**.
