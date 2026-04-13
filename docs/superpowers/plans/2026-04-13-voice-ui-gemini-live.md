# Plan C — Voice UI (Gemini Live) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** Add a voice-first check-in experience for caregivers. Caregiver taps a mic button, speaks 30–60 seconds about how Mom is doing, and the transcript (plus any extracted structured facts) writes to the Living Profile's memory via Plan A's `/memory` endpoint.

**Architecture:** Gemini Live realtime audio over a WebSocket bridged by our backend (so the caregiver's phone never holds the Google API key). Backend exposes `POST /api/live/session` returning a short-lived ephemeral token + a WebSocket URL. React Native uses `expo-av` for audio capture + a minimal WebSocket client for streaming. When the caregiver ends the turn, the accumulated transcript + Gemini summary is written to `/api/profiles/:patientId/memory`.

**Tech Stack:** React Native · Expo · `expo-av` or `expo-audio` · `@google/genai` (server side) · existing backend · Gemini 2.0 Flash Live model (`gemini-live-2.5-flash-native-audio`)

**Depends on:** Plan A (memory endpoints). Does NOT depend on Plan B.

**Worktree:** Create `.worktrees/voice-ui-gemini-live` on a new branch `feature/voice-ui-gemini-live` from main.

**Key design choices to retain during execution:**
- Never ship a Google API key in the React Native bundle. Always mint ephemeral tokens server-side.
- Push-to-talk v1 (no always-on mic) — reduces cost and legal exposure.
- If Gemini Live fails, fall back to a text input so the check-in still gets captured.

---

### Task 1: Install Gemini SDK on backend + env

**Files:**
- Modify: `package.json`, `src/server-core/config.ts`, `.env.example`

- [ ] **Step 1:** `npm install @google/genai`

- [ ] **Step 2:** Append to `src/server-core/config.ts` inside `config`:
```ts
geminiApiKey: process.env.GEMINI_API_KEY || "",
geminiLiveModel: process.env.GEMINI_LIVE_MODEL || "gemini-live-2.5-flash-native-audio",
```

- [ ] **Step 3:** Append to `.env.example`:
```
# Gemini Live (voice AI)
GEMINI_API_KEY=
GEMINI_LIVE_MODEL=gemini-live-2.5-flash-native-audio
```

- [ ] **Step 4:** Commit:
```bash
git add package.json package-lock.json src/server-core/config.ts .env.example
git commit -m "chore: install @google/genai + Gemini Live env config"
```

---

### Task 2: Backend — ephemeral token endpoint

**Files:**
- Create: `src/server-routes/live.ts`
- Create: `src/server-routes/live.test.ts`
- Modify: `src/server.ts`

- [ ] **Step 1: Failing test.** `src/server-routes/live.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { liveSessionSchema } from "./live";

describe("liveSessionSchema", () => {
  it("accepts a patientId", () => {
    expect(liveSessionSchema.safeParse({ patientId: "p1" }).success).toBe(true);
  });
  it("rejects missing patientId", () => {
    expect(liveSessionSchema.safeParse({}).success).toBe(false);
  });
});
```
Run → FAIL (module not found).

- [ ] **Step 2:** Create `src/server-routes/live.ts`:
```ts
import { Router } from "express";
import { z } from "zod";
import { GoogleGenAI } from "@google/genai";
import { authMiddleware } from "../server-core/security";
import { requireSeat } from "../server-core/seatResolver";
import { config } from "../server-core/config";

export const liveSessionSchema = z.object({ patientId: z.string().min(1) });

let genai: GoogleGenAI | null = null;
function getGenai(): GoogleGenAI {
  if (!config.geminiApiKey) throw new Error("GEMINI_API_KEY not set");
  if (!genai) genai = new GoogleGenAI({ apiKey: config.geminiApiKey });
  return genai;
}

const router = Router();

// POST /api/live/session — returns ephemeral token + system instruction for the client
router.post("/session/:patientId", authMiddleware, requireSeat, async (req, res) => {
  try {
    // Build system instruction grounded in this patient's profile
    // (Full profile grounding will be layered in Plan F — here we pass a minimal stub.)
    const systemInstruction = `You are Vela, a caring voice companion helping a caregiver check in about their loved one with dementia. Keep responses warm, brief, and focused. The caregiver is speaking now.`;
    // @google/genai does not yet expose ephemeral-token API directly as of v0.x — some
    // deployments use auth-token exchange via Gemini's `ephemeral_tokens` REST endpoint.
    // For v1 we return the config the client needs and route audio through a backend WS bridge (Task 4).
    res.json({
      wsUrl: `${req.protocol}://${req.get("host")}/api/live/ws?patientId=${encodeURIComponent(req.params.patientId)}`,
      model: config.geminiLiveModel,
      systemInstruction,
    });
  } catch (err: any) {
    console.error("live session error:", err);
    res.status(500).json({ detail: err.message || "Internal server error" });
  }
});

export default router;
```

Run test → PASS.

- [ ] **Step 3:** Mount in `src/server.ts`: `app.use("/api/live", liveRoutes);`

- [ ] **Step 4:** Commit:
```bash
git add src/server-routes/live.ts src/server-routes/live.test.ts src/server.ts
git commit -m "feat: add POST /api/live/session/:patientId endpoint"
```

---

### Task 3: Backend — WebSocket bridge to Gemini Live

**Files:**
- Create: `src/server-core/liveBridge.ts`
- Modify: `src/server.ts` (attach WS upgrade handler)

- [ ] **Step 1:** `npm install ws @types/ws`

- [ ] **Step 2:** `src/server-core/liveBridge.ts`:
```ts
import { WebSocketServer, WebSocket } from "ws";
import { Server as HTTPServer, IncomingMessage } from "http";
import { GoogleGenAI, Modality } from "@google/genai";
import { config } from "./config";

export function attachLiveBridge(server: HTTPServer) {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    if (!req.url?.startsWith("/api/live/ws")) return;
    // TODO: validate auth (Supabase JWT in Sec-WebSocket-Protocol header or query)
    wss.handleUpgrade(req, socket, head, (ws) => bridgeClient(ws, req));
  });
}

async function bridgeClient(client: WebSocket, req: IncomingMessage) {
  if (!config.geminiApiKey) { client.close(1011, "Gemini not configured"); return; }
  const genai = new GoogleGenAI({ apiKey: config.geminiApiKey });
  const session = await genai.live.connect({
    model: config.geminiLiveModel,
    config: { responseModalities: [Modality.AUDIO, Modality.TEXT] },
    callbacks: {
      onmessage: (msg) => client.send(JSON.stringify(msg)),
      onerror: (e) => { client.close(1011, "upstream error"); },
      onclose: () => client.close(1000, "upstream closed"),
    },
  });

  client.on("message", (data) => {
    // Client sends base64-encoded PCM16 audio chunks as text frames { audio_b64, mime } or end-of-turn markers
    try {
      const parsed = JSON.parse(data.toString());
      if (parsed.end_of_turn) session.sendClientContent({ turns: [], turnComplete: true });
      else if (parsed.audio_b64) session.sendRealtimeInput({ media: { data: parsed.audio_b64, mimeType: parsed.mime ?? "audio/pcm;rate=16000" } });
    } catch (e) { console.error("live bridge bad msg:", e); }
  });

  client.on("close", () => session.close());
}
```

- [ ] **Step 3:** In `src/server.ts`, after `const app = express();` and once `http.createServer(app)` is invoked, call `attachLiveBridge(httpServer)`. (If the existing server.ts uses `app.listen(port)`, migrate it to `const server = http.createServer(app); attachLiveBridge(server); server.listen(port);`.)

- [ ] **Step 4:** Commit:
```bash
git add src/server-core/liveBridge.ts src/server.ts package.json package-lock.json
git commit -m "feat: add WebSocket bridge from client → Gemini Live"
```

---

### Task 4: React Native — audio capture + WebSocket client

**Files:**
- Create: `src/hooks/useVoiceSession.ts`

- [ ] **Step 1:** `npx expo install expo-av` (or `expo-audio` if on SDK 54's new audio module — check `package.json` first).

- [ ] **Step 2:** `src/hooks/useVoiceSession.ts`:
```ts
import { useCallback, useRef, useState } from "react";
import { Audio } from "expo-av";
import { authFetch } from "../api/authFetch";

export type VoiceState = "idle" | "connecting" | "listening" | "speaking" | "ended" | "error";

export function useVoiceSession(patientId: string | undefined) {
  const [state, setState] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState("");
  const wsRef = useRef<WebSocket | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);

  const start = useCallback(async () => {
    if (!patientId) return;
    setState("connecting"); setTranscript("");
    await Audio.requestPermissionsAsync();
    await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });

    const session = await authFetch(`/api/live/session/${patientId}`, { method: "POST" }).then(r => r.json());
    const ws = new WebSocket(session.wsUrl);
    wsRef.current = ws;
    ws.onopen = async () => {
      setState("listening");
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync({
        ios: { extension: ".wav", audioQuality: Audio.IOSAudioQuality.HIGH, sampleRate: 16000, numberOfChannels: 1, bitRate: 128000, linearPCMBitDepth: 16, linearPCMIsBigEndian: false, linearPCMIsFloat: false },
        android: { extension: ".wav", outputFormat: Audio.AndroidOutputFormat.DEFAULT, audioEncoder: Audio.AndroidAudioEncoder.DEFAULT, sampleRate: 16000, numberOfChannels: 1, bitRate: 128000 },
        web: {},
        isMeteringEnabled: false,
      });
      // NOTE: RN Audio.Recording doesn't stream PCM frames directly; for v1 we record in chunks and send at end-of-turn.
      // A production implementation uses a native PCM stream module (e.g. react-native-live-audio-stream).
      await rec.startAsync();
      recordingRef.current = rec;
    };
    ws.onmessage = (evt) => {
      const msg = JSON.parse(evt.data);
      if (msg.serverContent?.outputTranscription?.text) {
        setTranscript((t) => t + msg.serverContent.outputTranscription.text);
      }
      if (msg.serverContent?.modelTurn?.parts?.some((p: any) => p.inlineData?.mimeType?.startsWith("audio/"))) {
        setState("speaking");
      }
    };
    ws.onclose = () => setState("ended");
    ws.onerror = () => setState("error");
  }, [patientId]);

  const stop = useCallback(async () => {
    const rec = recordingRef.current;
    if (rec) {
      await rec.stopAndUnloadAsync();
      const uri = rec.getURI();
      if (uri && wsRef.current?.readyState === WebSocket.OPEN) {
        // Read the file, base64-encode, send as a single chunk + end_of_turn
        const fetchBlob = await fetch(uri);
        const buf = await fetchBlob.arrayBuffer();
        const b64 = Buffer.from(buf).toString("base64");
        wsRef.current.send(JSON.stringify({ audio_b64: b64, mime: "audio/wav" }));
        wsRef.current.send(JSON.stringify({ end_of_turn: true }));
      }
      recordingRef.current = null;
    }
    // keep ws open to receive final model turn
    setTimeout(() => wsRef.current?.close(), 4000);
  }, []);

  return { state, transcript, start, stop };
}
```

- [ ] **Step 3:** Commit:
```bash
git add src/hooks/useVoiceSession.ts package.json
git commit -m "feat: add useVoiceSession hook (record + stream to Gemini Live)"
```

---

### Task 5: Check-in screen

**Files:**
- Create: `src/screens/caregiver/CheckInScreen.tsx`

- [ ] **Step 1:** `src/screens/caregiver/CheckInScreen.tsx`:
```tsx
import React, { useState } from "react";
import { View, Text, Pressable, ScrollView, Alert } from "react-native";
import { useVoiceSession } from "../../hooks/useVoiceSession";
import { useCurrentProfile } from "../../hooks/useCurrentProfile";
import { authFetch } from "../../api/authFetch";

export default function CheckInScreen({ navigation }: any) {
  const { patientId } = useCurrentProfile();
  const { state, transcript, start, stop } = useVoiceSession(patientId);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!transcript.trim() || !patientId) return;
    setSaving(true);
    try {
      await authFetch(`/api/profiles/${patientId}/memory`, {
        method: "POST",
        body: JSON.stringify({
          content: transcript,
          metadata: { source: "voice_check_in", capturedAt: new Date().toISOString() },
        }),
      });
      navigation.goBack();
    } catch (e: any) {
      Alert.alert("Save failed", e.message);
    } finally { setSaving(false); }
  };

  return (
    <View style={{ flex: 1, padding: 24 }}>
      <Text style={{ fontSize: 22, fontWeight: "700" }}>How is Mom today?</Text>
      <Text style={{ color: "#64748b", marginTop: 4 }}>Speak naturally for 30–60 seconds.</Text>

      <ScrollView style={{ flex: 1, backgroundColor: "#f8fafc", borderRadius: 12, padding: 16, marginVertical: 16 }}>
        <Text style={{ color: transcript ? "#0f172a" : "#94a3b8" }}>
          {transcript || (state === "listening" ? "Listening…" : "Tap the mic to start.")}
        </Text>
      </ScrollView>

      <View style={{ flexDirection: "row", gap: 12 }}>
        {state === "listening" ? (
          <Pressable onPress={stop} style={{ flex: 1, backgroundColor: "#dc2626", padding: 18, borderRadius: 14 }}>
            <Text style={{ color: "white", textAlign: "center", fontWeight: "700", fontSize: 16 }}>Stop</Text>
          </Pressable>
        ) : (
          <Pressable onPress={start} style={{ flex: 1, backgroundColor: "#6366f1", padding: 18, borderRadius: 14 }}>
            <Text style={{ color: "white", textAlign: "center", fontWeight: "700", fontSize: 16 }}>
              {state === "connecting" ? "Connecting…" : "🎙️  Start"}
            </Text>
          </Pressable>
        )}
        <Pressable
          disabled={!transcript || saving}
          onPress={save}
          style={{ flex: 1, backgroundColor: transcript ? "#059669" : "#cbd5e1", padding: 18, borderRadius: 14 }}
        >
          <Text style={{ color: "white", textAlign: "center", fontWeight: "700", fontSize: 16 }}>
            {saving ? "Saving…" : "Save"}
          </Text>
        </Pressable>
      </View>

      <Pressable onPress={() => navigation.navigate("CheckInText", { prefill: transcript })} style={{ marginTop: 16 }}>
        <Text style={{ color: "#6366f1", textAlign: "center" }}>Voice not working? Type instead</Text>
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 2:** Commit:
```bash
git add src/screens/caregiver/CheckInScreen.tsx
git commit -m "feat: add voice check-in screen"
```

---

### Task 6: Text-fallback check-in screen

**Files:**
- Create: `src/screens/caregiver/CheckInTextScreen.tsx`

- [ ] **Step 1:** Same contract as voice screen, but textarea. Writes to `/memory` with `source: "text_check_in"`.
```tsx
import React, { useState } from "react";
import { View, Text, TextInput, Pressable, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { authFetch } from "../../api/authFetch";
import { useCurrentProfile } from "../../hooks/useCurrentProfile";

export default function CheckInTextScreen({ route, navigation }: any) {
  const [text, setText] = useState(route.params?.prefill ?? "");
  const [saving, setSaving] = useState(false);
  const { patientId } = useCurrentProfile();

  const save = async () => {
    if (!text.trim() || !patientId) return;
    setSaving(true);
    try {
      await authFetch(`/api/profiles/${patientId}/memory`, {
        method: "POST",
        body: JSON.stringify({ content: text, metadata: { source: "text_check_in" } }),
      });
      navigation.popToTop();
    } catch (e: any) { Alert.alert("Save failed", e.message); }
    finally { setSaving(false); }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, padding: 24 }}>
      <Text style={{ fontSize: 22, fontWeight: "700" }}>How is Mom today?</Text>
      <TextInput
        multiline value={text} onChangeText={setText}
        placeholder="Type anything — this feeds Mom's Living Profile."
        style={{ flex: 1, marginVertical: 16, padding: 16, backgroundColor: "#f8fafc", borderRadius: 12, textAlignVertical: "top", fontSize: 16 }}
      />
      <Pressable onPress={save} disabled={!text.trim() || saving}
        style={{ backgroundColor: text.trim() ? "#059669" : "#cbd5e1", padding: 18, borderRadius: 14 }}>
        <Text style={{ color: "white", textAlign: "center", fontWeight: "700", fontSize: 16 }}>
          {saving ? "Saving…" : "Save"}
        </Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}
```

- [ ] **Step 2:** Commit:
```bash
git add src/screens/caregiver/CheckInTextScreen.tsx
git commit -m "feat: add text-fallback check-in screen"
```

---

### Task 7: Wire into navigation

**Files:**
- Modify: `src/navigation/RootNavigator.tsx` or the caregiver tab nav

- [ ] **Step 1:** Add both screens to the caregiver stack. Add a primary "Check in" CTA to the caregiver home dashboard that opens `CheckInScreen`.

- [ ] **Step 2:** Commit:
```bash
git add src/navigation/RootNavigator.tsx  # adjust path
git commit -m "feat: wire check-in screens into caregiver nav"
```

---

### Task 8: Smoke-test checklist

**Files:**
- Create: `docs/manual-tests/plan-c-smoke.md`

- [ ] **Step 1:** Create checklist:
```markdown
# Plan C Smoke Tests (Expo Go + physical device)

Voice features require microphone access; simulator mics are unreliable.

1. **Permission** — First launch of CheckInScreen prompts for mic. Allow → button goes from "Connecting…" to "Listening…" within 2s.
2. **Happy path** — Record "Mom had a tough morning but smiled when I put on her favorite hymn." Stop. Transcript appears. Tap Save → returns to home.
3. **Verify write** — From Postman or `curl`, `GET /api/profiles/:patientId/memory/search?q=hymn` returns at least one result.
4. **Connection drop** — Turn airplane mode on mid-record. UI transitions to `error` state within 5s; user can retry.
5. **Fallback to text** — Tap the "Voice not working?" link. Text screen opens. Type, save, confirm write.
6. **Gemini key missing** — Unset `GEMINI_API_KEY`, restart backend. `POST /api/live/session/:id` returns 500 with "GEMINI_API_KEY not set". UI shows error state.
```

- [ ] **Step 2:** Commit:
```bash
git add docs/manual-tests/plan-c-smoke.md
git commit -m "docs: manual smoke-test checklist for Plan C"
```

---

### Task 9: Docs

**Files:**
- Modify: `README.md`, `CLAUDE.md`

- [ ] **Step 1:** In README append:
```markdown
### Voice Check-In (Plan C)
| Method | Path | Purpose |
|---|---|---|
| POST | `/api/live/session/:patientId` | Get config to open a Live WebSocket |
| WS | `/api/live/ws?patientId=...` | Bridged connection to Gemini Live |

Client hook: `useVoiceSession(patientId)` in `src/hooks/useVoiceSession.ts`.
```

- [ ] **Step 2:** In CLAUDE.md append:
```markdown
### Voice UI (Plan C, 2026-04-13)
- Gemini API key MUST stay on the backend. Clients never receive it directly.
- Audio capture in v1 uses chunked WAV (Expo Audio.Recording), not true PCM streaming. When we want sub-second latency, swap in `react-native-live-audio-stream` — note the native module requirement.
- The text-fallback CheckInTextScreen is a first-class path, not a graceful degradation — it stays shipped even after voice is stable.
```

- [ ] **Step 3:** Commit:
```bash
git add README.md CLAUDE.md
git commit -m "docs: document voice check-in architecture"
```

---

## Plan summary

Backend gets `/api/live/session/:patientId` + a WebSocket bridge to Gemini Live. Client gets `useVoiceSession` hook, `CheckInScreen`, and a text fallback. Transcripts write to Plan A's `/memory` endpoint.

**Next plan:** **D — Sensors (smart home + smartphone biomarkers)**.
