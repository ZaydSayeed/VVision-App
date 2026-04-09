# Vision AI Assistant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a patient-facing "Vision" AI assistant to VVision-App — a sparkle icon in the header that opens a bottom sheet chat panel powered by Groq, synced with the smart glasses via shared MongoDB reminders and conversation history.

**Architecture:** Shared MongoDB Atlas is the sync layer between the app (Groq API) and the glasses (Ollama). New `reminders` and `conversations` collections carry context between both systems. The frontend is a Modal bottom sheet — it does not replace any existing screens.

**Tech Stack:** React Native + Expo, Express/TypeScript backend (Render), MongoDB Atlas, Groq SDK (`groq-sdk`), Zod, Ionicons, expo-linear-gradient, TypeScript

---

## File Map

### Files to Create
- `src/server-routes/reminders.ts` — GET/POST/DELETE /api/reminders
- `src/server-routes/conversations.ts` — GET/POST /api/conversations (max-20 pruning)
- `src/server-routes/assistant.ts` — POST /api/assistant/chat (Groq call, context building, rate limit)
- `src/hooks/useReminders.ts` — mirrors useRoutine pattern
- `src/components/VisionSheet.tsx` — bottom sheet chat modal

### Files to Modify
- `src/types/index.ts` — add `Reminder` and `ConversationTurn` interfaces
- `src/server-core/database.ts` — add reminders + conversations indexes
- `src/server-core/config.ts` — add `groqApiKey`
- `.env` — add `GROQ_API_KEY=`
- `src/server.ts` — register 3 new routes
- `src/api/client.ts` — add reminder + assistant + conversation API methods
- `src/screens/patient/TodayScreen.tsx` — add RemindersSection + useReminders
- `src/navigation/RootNavigator.tsx` — add VisionButton (patient-only) + VisionSheet

---

## Task 1: Add TypeScript types

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add Reminder and ConversationTurn interfaces**

Open `src/types/index.ts` and append at the end:

```typescript
// ── Reminders ────────────────────────────────────────────
export interface Reminder {
  id: string;
  patient_id?: string;
  text: string;
  time?: string;
  recurrence?: string;
  source: "glasses" | "app";
  created_at: string;
  completed_date: string | null;
}

// ── Conversations ─────────────────────────────────────────
export interface ConversationTurn {
  id: string;
  patient_id?: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/haadisiddiqui/projects/VVision-App && npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors (existing errors are fine to ignore)

- [ ] **Step 3: Commit**

```bash
cd /Users/haadisiddiqui/projects/VVision-App
git add src/types/index.ts
git commit -m "feat: add Reminder and ConversationTurn types"
```

---

## Task 2: Update database indexes and config

**Files:**
- Modify: `src/server-core/database.ts`
- Modify: `src/server-core/config.ts`
- Modify: `.env`

- [ ] **Step 1: Add reminders and conversations indexes to database.ts**

In `src/server-core/database.ts`, add two lines after the `medications` index line (after line 25):

```typescript
  await db.collection("reminders").createIndex({ patient_id: 1 });
  await db.collection("conversations").createIndex({ patient_id: 1, created_at: 1 });
```

The indexes block should then read:
```typescript
  await db.collection("users").createIndex({ supabase_uid: 1 }, { unique: true });
  await db.collection("patients").createIndex({ link_code: 1 }, { unique: true });
  await db.collection("people").createIndex({ patient_id: 1 });
  await db.collection("alerts").createIndex({ patient_id: 1 });
  await db.collection("help_alerts").createIndex({ patient_id: 1 });
  await db.collection("routines").createIndex({ patient_id: 1 });
  await db.collection("medications").createIndex({ patient_id: 1 });
  await db.collection("reminders").createIndex({ patient_id: 1 });
  await db.collection("conversations").createIndex({ patient_id: 1, created_at: 1 });
```

- [ ] **Step 2: Add groqApiKey to config.ts**

Replace the entire `export const config = { ... }` block in `src/server-core/config.ts`:

```typescript
export const config = {
  mongodbUri: process.env.MONGODB_URI || "",
  mongodbDbName: process.env.MONGODB_DB_NAME || "dvision",
  supabaseUrl: process.env.SUPABASE_URL || "",
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || "",
  port: parseInt(process.env.PORT || "8000", 10),
  groqApiKey: process.env.GROQ_API_KEY || "",
};
```

- [ ] **Step 3: Add GROQ_API_KEY placeholder to .env**

Open `.env` and add this line at the bottom:
```
GROQ_API_KEY=your_groq_api_key_here
```

(Replace the placeholder with a real key from console.groq.com — free tier is sufficient)

- [ ] **Step 4: Commit**

```bash
cd /Users/haadisiddiqui/projects/VVision-App
git add src/server-core/database.ts src/server-core/config.ts
git commit -m "feat: add reminders/conversations indexes and groq config"
```

---

## Task 3: Install Groq SDK

**Files:** None (package installation only)

- [ ] **Step 1: Install groq-sdk**

```bash
cd /Users/haadisiddiqui/projects/VVision-App && npm install groq-sdk
```

Expected: installs successfully, `groq-sdk` appears in package.json dependencies

- [ ] **Step 2: Commit package.json changes**

```bash
cd /Users/haadisiddiqui/projects/VVision-App
git add package.json package-lock.json
git commit -m "feat: install groq-sdk"
```

---

## Task 4: Create reminders route

**Files:**
- Create: `src/server-routes/reminders.ts`

- [ ] **Step 1: Create the reminders route file**

Create `src/server-routes/reminders.ts`:

```typescript
import { Router } from "express";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb } from "../server-core/database";
import { authMiddleware } from "../server-core/security";
import { resolvePatientId } from "../server-core/patientResolver";

const router = Router();

const createSchema = z.object({
  text: z.string().min(1, "Text required").max(500).trim(),
  time: z.string().max(50).trim().optional(),
  recurrence: z.string().max(100).trim().optional(),
  source: z.enum(["glasses", "app"]).default("app"),
});

function reminderOut(doc: any) {
  return {
    id: String(doc._id),
    patient_id: String(doc.patient_id),
    text: doc.text,
    time: doc.time ?? null,
    recurrence: doc.recurrence ?? null,
    source: doc.source,
    created_at: doc.created_at,
    completed_date: doc.completed_date ?? null,
  };
}

// GET /api/reminders
router.get("/", authMiddleware, resolvePatientId, async (req, res) => {
  try {
    const db = getDb();
    const docs = await db
      .collection("reminders")
      .find({ patient_id: req.patientId! })
      .sort({ created_at: -1 })
      .limit(100)
      .toArray();
    res.json(docs.map(reminderOut));
  } catch (err) {
    console.error("list reminders error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

// POST /api/reminders
router.post("/", authMiddleware, resolvePatientId, async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ detail: parsed.error.issues[0].message });
    return;
  }
  try {
    const db = getDb();
    const doc = {
      patient_id: req.patientId!,
      text: parsed.data.text,
      time: parsed.data.time ?? null,
      recurrence: parsed.data.recurrence ?? null,
      source: parsed.data.source,
      created_at: new Date().toISOString(),
      completed_date: null,
    };
    const result = await db.collection("reminders").insertOne(doc);
    res.status(201).json(reminderOut({ ...doc, _id: result.insertedId }));
  } catch (err) {
    console.error("create reminder error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

// DELETE /api/reminders/:id
router.delete("/:id", authMiddleware, resolvePatientId, async (req, res) => {
  if (!ObjectId.isValid(String(req.params.id))) {
    res.status(400).json({ detail: "Invalid ID" });
    return;
  }
  try {
    const db = getDb();
    const result = await db.collection("reminders").deleteOne({
      _id: new ObjectId(String(req.params.id)),
      patient_id: req.patientId!,
    });
    if (result.deletedCount === 0) {
      res.status(404).json({ detail: "Reminder not found" });
      return;
    }
    res.status(204).send();
  } catch (err) {
    console.error("delete reminder error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

export default router;
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/haadisiddiqui/projects/VVision-App && npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors

- [ ] **Step 3: Commit**

```bash
cd /Users/haadisiddiqui/projects/VVision-App
git add src/server-routes/reminders.ts
git commit -m "feat: add reminders route (GET/POST/DELETE)"
```

---

## Task 5: Create conversations route

**Files:**
- Create: `src/server-routes/conversations.ts`

- [ ] **Step 1: Create the conversations route file**

Create `src/server-routes/conversations.ts`:

```typescript
import { Router } from "express";
import { z } from "zod";
import { getDb } from "../server-core/database";
import { authMiddleware } from "../server-core/security";
import { resolvePatientId } from "../server-core/patientResolver";

const router = Router();

const createSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000).trim(),
});

function convOut(doc: any) {
  return {
    id: String(doc._id),
    patient_id: String(doc.patient_id),
    role: doc.role,
    content: doc.content,
    created_at: doc.created_at,
  };
}

// GET /api/conversations — last 20 for the patient
router.get("/", authMiddleware, resolvePatientId, async (req, res) => {
  try {
    const db = getDb();
    const docs = await db
      .collection("conversations")
      .find({ patient_id: req.patientId! })
      .sort({ created_at: 1 })
      .limit(20)
      .toArray();
    res.json(docs.map(convOut));
  } catch (err) {
    console.error("list conversations error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

// POST /api/conversations — save a turn, prune to max 20
router.post("/", authMiddleware, resolvePatientId, async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ detail: parsed.error.issues[0].message });
    return;
  }
  try {
    const db = getDb();
    const doc = {
      patient_id: req.patientId!,
      role: parsed.data.role,
      content: parsed.data.content,
      created_at: new Date().toISOString(),
    };
    const result = await db.collection("conversations").insertOne(doc);

    // Prune oldest if count exceeds 20
    const count = await db
      .collection("conversations")
      .countDocuments({ patient_id: req.patientId! });
    if (count > 20) {
      const oldest = await db
        .collection("conversations")
        .find({ patient_id: req.patientId! })
        .sort({ created_at: 1 })
        .limit(count - 20)
        .toArray();
      const ids = oldest.map((d) => d._id);
      await db.collection("conversations").deleteMany({ _id: { $in: ids } });
    }

    res.status(201).json(convOut({ ...doc, _id: result.insertedId }));
  } catch (err) {
    console.error("create conversation error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

export default router;
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/haadisiddiqui/projects/VVision-App && npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors

- [ ] **Step 3: Commit**

```bash
cd /Users/haadisiddiqui/projects/VVision-App
git add src/server-routes/conversations.ts
git commit -m "feat: add conversations route with max-20 pruning"
```

---

## Task 6: Create assistant route

**Files:**
- Create: `src/server-routes/assistant.ts`

- [ ] **Step 1: Create the assistant route file**

Create `src/server-routes/assistant.ts`:

```typescript
import { Router } from "express";
import { z } from "zod";
import Groq from "groq-sdk";
import { getDb } from "../server-core/database";
import { authMiddleware } from "../server-core/security";
import { resolvePatientId } from "../server-core/patientResolver";
import { config } from "../server-core/config";
import rateLimit from "express-rate-limit";

const router = Router();

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { detail: "Too many requests. Please wait a moment." },
});

const chatSchema = z.object({
  message: z.string().min(1).max(2000).trim(),
});

// POST /api/assistant/chat
router.post("/chat", chatLimiter, authMiddleware, resolvePatientId, async (req, res) => {
  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ detail: parsed.error.issues[0].message });
    return;
  }

  try {
    const db = getDb();
    const patientId = req.patientId!;

    // Fetch context in parallel
    const [convDocs, routineDocs, medDocs, reminderDocs, patientDoc] = await Promise.all([
      db.collection("conversations").find({ patient_id: patientId }).sort({ created_at: 1 }).limit(20).toArray(),
      db.collection("routines").find({ patient_id: patientId }).limit(50).toArray(),
      db.collection("medications").find({ patient_id: patientId }).limit(50).toArray(),
      db.collection("reminders").find({ patient_id: patientId }).sort({ created_at: -1 }).limit(20).toArray(),
      db.collection("patients").findOne({ _id: patientId as any }),
    ]);

    // Find patient first name from users collection
    const userDoc = await db.collection("users").findOne({ patient_id: patientId });
    const firstName = userDoc?.name?.split(" ")[0] ?? "there";

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const dateStr = now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });

    const routinesText = routineDocs.length
      ? routineDocs.map((r) => `- ${r.label}${r.time ? ` at ${r.time}` : ""}`).join("\n")
      : "No routine tasks.";

    const medsText = medDocs.length
      ? medDocs.map((m) => `- ${m.name}${m.dosage ? ` (${m.dosage})` : ""}${m.time ? ` at ${m.time}` : ""}`).join("\n")
      : "No medications.";

    const remindersText = reminderDocs.length
      ? reminderDocs.map((r) => `- ${r.text}${r.time ? ` at ${r.time}` : ""}${r.recurrence ? ` (${r.recurrence})` : ""}`).join("\n")
      : "No reminders.";

    const conversationHistory = convDocs
      .map((c) => `${c.role === "user" ? firstName : "Vision"}: ${c.content}`)
      .join("\n");

    const systemPrompt = `You are Vision, a warm and patient AI assistant built into smart glasses and a companion app for someone who needs help remembering things.

Keep responses to 1-3 short sentences. Use a warm, reassuring tone.
Never give medical advice. Never mention that you are AI.
It is okay to repeat information — the person may ask the same thing multiple times.

PATIENT: ${firstName}
CURRENT TIME: ${timeStr}
TODAY: ${dateStr}

TODAY'S ROUTINE:
${routinesText}

TODAY'S MEDICATIONS:
${medsText}

UPCOMING REMINDERS:
${remindersText}

RECENT CONVERSATION:
${conversationHistory}`;

    const groq = new Groq({ apiKey: config.groqApiKey });

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: parsed.data.message },
      ],
      max_tokens: 200,
      temperature: 0.7,
    });

    const reply = completion.choices[0]?.message?.content?.trim() ?? "Sorry, I couldn't respond right now.";

    res.json({ reply });
  } catch (err) {
    console.error("assistant chat error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

export default router;
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/haadisiddiqui/projects/VVision-App && npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors

- [ ] **Step 3: Commit**

```bash
cd /Users/haadisiddiqui/projects/VVision-App
git add src/server-routes/assistant.ts
git commit -m "feat: add Vision assistant route with Groq + context building"
```

---

## Task 7: Register new routes in server.ts

**Files:**
- Modify: `src/server.ts`

- [ ] **Step 1: Find where existing routes are imported**

The existing route imports and registrations look like:
```typescript
import routineRoutes from "./server-routes/routines";
...
app.use("/api/routines", routineRoutes);
```

- [ ] **Step 2: Add imports for the three new routes**

Find the block of route imports in `src/server.ts` and add:
```typescript
import reminderRoutes from "./server-routes/reminders";
import conversationRoutes from "./server-routes/conversations";
import assistantRoutes from "./server-routes/assistant";
```

- [ ] **Step 3: Add route registrations**

Find the block of `app.use("/api/...")` calls and add:
```typescript
app.use("/api/reminders", reminderRoutes);
app.use("/api/conversations", conversationRoutes);
app.use("/api/assistant", assistantRoutes);
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/haadisiddiqui/projects/VVision-App && npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors

- [ ] **Step 5: Commit**

```bash
cd /Users/haadisiddiqui/projects/VVision-App
git add src/server.ts
git commit -m "feat: register reminders, conversations, and assistant routes"
```

---

## Task 8: Add API client methods

**Files:**
- Modify: `src/api/client.ts`

- [ ] **Step 1: Add the import for new types at the top of client.ts**

Find the existing type imports at the top of `src/api/client.ts` (they look like `import { RoutineTask, Medication, ... } from "../types"`) and add `Reminder, ConversationTurn` to the import list.

- [ ] **Step 2: Append new API methods at the end of client.ts**

```typescript
// ── Reminders ─────────────────────────────────────────────
export async function fetchReminders(): Promise<Reminder[]> {
  return request<Reminder[]>("/api/reminders");
}

export async function addReminder(data: {
  text: string;
  time?: string;
  recurrence?: string;
  source?: "glasses" | "app";
}): Promise<Reminder> {
  return request<Reminder>("/api/reminders", {
    method: "POST",
    body: JSON.stringify({ source: "app", ...data }),
  });
}

export async function deleteReminder(id: string): Promise<void> {
  await request(`/api/reminders/${id}`, { method: "DELETE" });
}

// ── Vision Assistant ───────────────────────────────────────
export async function sendVisionMessage(message: string): Promise<{ reply: string }> {
  return request<{ reply: string }>("/api/assistant/chat", {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}

// ── Conversations ──────────────────────────────────────────
export async function saveConversationTurn(role: "user" | "assistant", content: string): Promise<ConversationTurn> {
  return request<ConversationTurn>("/api/conversations", {
    method: "POST",
    body: JSON.stringify({ role, content }),
  });
}

export async function fetchConversations(): Promise<ConversationTurn[]> {
  return request<ConversationTurn[]>("/api/conversations");
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/haadisiddiqui/projects/VVision-App && npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors

- [ ] **Step 4: Commit**

```bash
cd /Users/haadisiddiqui/projects/VVision-App
git add src/api/client.ts
git commit -m "feat: add reminder and Vision assistant API client methods"
```

---

## Task 9: Create useReminders hook

**Files:**
- Create: `src/hooks/useReminders.ts`

- [ ] **Step 1: Create the hook file**

Create `src/hooks/useReminders.ts`:

```typescript
import { useState, useEffect, useCallback } from "react";
import { Reminder } from "../types";
import { fetchReminders, addReminder, deleteReminder } from "../api/client";

export function useReminders() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchReminders();
      setReminders(data);
      setLoadError(null);
    } catch (e: any) {
      setLoadError(e?.message ?? "Failed to load reminders");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const add = useCallback(async (text: string, time?: string, recurrence?: string) => {
    const data = await addReminder({ text, time, recurrence, source: "app" });
    setReminders((prev) => [data, ...prev]);
  }, []);

  const remove = useCallback(async (id: string) => {
    await deleteReminder(id);
    setReminders((prev) => prev.filter((r) => r.id !== id));
  }, []);

  return { reminders, addReminder: add, deleteReminder: remove, loadError, reload: load };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/haadisiddiqui/projects/VVision-App && npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors

- [ ] **Step 3: Commit**

```bash
cd /Users/haadisiddiqui/projects/VVision-App
git add src/hooks/useReminders.ts
git commit -m "feat: add useReminders hook"
```

---

## Task 10: Add RemindersSection to TodayScreen

**Files:**
- Modify: `src/screens/patient/TodayScreen.tsx`

- [ ] **Step 1: Add useReminders import**

In `src/screens/patient/TodayScreen.tsx`, find the existing hook imports:
```typescript
import { useRoutine } from "../../hooks/useRoutine";
import { useMeds } from "../../hooks/useMeds";
```

Add below them:
```typescript
import { useReminders } from "../../hooks/useReminders";
```

- [ ] **Step 2: Add useReminders call inside TodayScreen**

Find the line:
```typescript
const { alerts } = useHelpAlert();
```

Add after it:
```typescript
const { reminders, loadError: remindersError, reload: reloadReminders } = useReminders();
```

- [ ] **Step 3: Include reminders in the onRefresh callback**

Find:
```typescript
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([reloadRoutine(), reloadMeds()]);
    setRefreshing(false);
  }, [reloadRoutine, reloadMeds]);
```

Replace with:
```typescript
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([reloadRoutine(), reloadMeds(), reloadReminders()]);
    setRefreshing(false);
  }, [reloadRoutine, reloadMeds, reloadReminders]);
```

- [ ] **Step 4: Add RemindersSection component**

At the bottom of `src/screens/patient/TodayScreen.tsx`, before the final `export`, add this component:

```typescript
function RemindersSection({ reminders, colors }: {
  reminders: import("../../types").Reminder[];
  colors: import("../../config/theme").AppColors;
}) {
  if (reminders.length === 0) return null;
  return (
    <View>
      <Text style={{
        fontSize: 11,
        textTransform: "uppercase",
        letterSpacing: 1.2,
        color: colors.muted,
        marginBottom: spacing.sm,
        marginTop: spacing.lg,
        ...fonts.medium,
      }}>
        Reminders
      </Text>
      {reminders.map((r) => (
        <View
          key={r.id}
          style={{
            backgroundColor: colors.bg,
            borderRadius: radius.xl,
            padding: spacing.md,
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
            marginBottom: spacing.sm,
            borderLeftWidth: 4,
            borderLeftColor: colors.violet,
          }}
        >
          <Ionicons name="notifications-outline" size={18} color={colors.violet} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, color: colors.text, ...fonts.medium }}>{r.text}</Text>
            {(r.time || r.source) && (
              <Text style={{ fontSize: 11, color: colors.muted, marginTop: 2, ...fonts.regular }}>
                {[r.time, r.source === "glasses" ? "via glasses" : "via app"].filter(Boolean).join(" · ")}
              </Text>
            )}
          </View>
        </View>
      ))}
    </View>
  );
}
```

- [ ] **Step 5: Render RemindersSection in the ScrollView**

Find where the medications section ends in the JSX. It will look something like the last `</View>` before the closing `</ScrollView>`. Add the RemindersSection just before the closing `</ScrollView>` content area:

Find the end of the meds section (search for where medication cards are rendered, after their closing tags) and add:

```typescript
<RemindersSection reminders={reminders} colors={colors} />
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd /Users/haadisiddiqui/projects/VVision-App && npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors

- [ ] **Step 7: Commit**

```bash
cd /Users/haadisiddiqui/projects/VVision-App
git add src/screens/patient/TodayScreen.tsx src/hooks/useReminders.ts
git commit -m "feat: add RemindersSection to TodayScreen"
```

---

## Task 11: Create VisionSheet bottom sheet component

**Files:**
- Create: `src/components/VisionSheet.tsx`

- [ ] **Step 1: Create VisionSheet.tsx**

Create `src/components/VisionSheet.tsx`:

```typescript
import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../context/ThemeContext";
import { fonts, spacing, radius, gradients } from "../config/theme";
import { sendVisionMessage, saveConversationTurn, fetchConversations } from "../api/client";
import { ConversationTurn } from "../types";

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function VisionSheet({ visible, onClose }: Props) {
  const { colors } = useTheme();
  const [messages, setMessages] = useState<ConversationTurn[]>([]);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (visible) {
      fetchConversations()
        .then(setMessages)
        .catch(() => {});
    }
  }, [visible]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || sending) return;
    setInputText("");
    setSending(true);

    const userMsg: ConversationTurn = {
      id: String(Date.now()),
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const { reply } = await sendVisionMessage(text);
      const assistantMsg: ConversationTurn = {
        id: String(Date.now() + 1),
        role: "assistant",
        content: reply,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);

      await Promise.all([
        saveConversationTurn("user", text),
        saveConversationTurn("assistant", reply),
      ]);
    } catch {
      const errMsg: ConversationTurn = {
        id: String(Date.now() + 1),
        role: "assistant",
        content: "Sorry, I couldn't connect right now. Please try again.",
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setSending(false);
    }
  };

  const styles = useMemo(() => StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: "rgba(0,0,0,0.4)",
    },
    sheet: {
      backgroundColor: colors.bg,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingBottom: 24,
      maxHeight: "75%",
    },
    handle: {
      width: 40,
      height: 4,
      backgroundColor: colors.border,
      borderRadius: 2,
      alignSelf: "center",
      marginTop: 12,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.md,
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: radius.pill,
      backgroundColor: colors.violet50,
      borderWidth: 1.5,
      borderColor: colors.violet300,
      alignItems: "center",
      justifyContent: "center",
    },
    titleText: {
      fontSize: 15,
      color: colors.text,
      ...fonts.medium,
    },
    subtitleText: {
      fontSize: 11,
      color: colors.muted,
      ...fonts.regular,
    },
    closeBtn: {
      width: 32,
      height: 32,
      alignItems: "center",
      justifyContent: "center",
    },
    scrollContent: {
      padding: spacing.lg,
      gap: 12,
    },
    visionBubbleRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
    },
    bubbleAvatar: {
      width: 26,
      height: 26,
      borderRadius: radius.pill,
      backgroundColor: colors.violet50,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 2,
      flexShrink: 0,
    },
    visionBubble: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderTopLeftRadius: 2,
      padding: spacing.md,
      maxWidth: "80%",
    },
    userBubble: {
      backgroundColor: colors.violet,
      borderRadius: 12,
      borderBottomRightRadius: 2,
      padding: spacing.md,
      maxWidth: "78%",
      alignSelf: "flex-end",
    },
    visionText: {
      fontSize: 13,
      color: colors.text,
      lineHeight: 20,
      ...fonts.regular,
    },
    userText: {
      fontSize: 13,
      color: "#FFFFFF",
      lineHeight: 20,
      ...fonts.regular,
    },
    inputBar: {
      flexDirection: "row",
      alignItems: "center",
      marginHorizontal: spacing.lg,
      marginTop: spacing.sm,
      backgroundColor: colors.surface,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.lg,
      paddingVertical: 10,
      borderWidth: 1.5,
      borderColor: colors.border,
      gap: 10,
    },
    input: {
      flex: 1,
      fontSize: 13,
      color: colors.text,
      ...fonts.regular,
    },
    micBtn: {
      width: 34,
      height: 34,
      borderRadius: radius.pill,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
  }), [colors]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.sheet}>
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.avatar}>
                <Ionicons name="sparkles" size={16} color={colors.violet} />
              </View>
              <View>
                <Text style={styles.titleText}>Vision</Text>
                <Text style={styles.subtitleText}>AI Assistant</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={20} color={colors.muted} />
            </TouchableOpacity>
          </View>

          {/* Messages */}
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {messages.length === 0 && !sending && (
              <View style={styles.visionBubbleRow}>
                <View style={styles.bubbleAvatar}>
                  <Ionicons name="sparkles" size={12} color={colors.violet} />
                </View>
                <View style={styles.visionBubble}>
                  <Text style={styles.visionText}>Hello! I can help you with your routine, medications, and reminders. What would you like to know?</Text>
                </View>
              </View>
            )}
            {messages.map((msg) =>
              msg.role === "assistant" ? (
                <View key={msg.id} style={styles.visionBubbleRow}>
                  <View style={styles.bubbleAvatar}>
                    <Ionicons name="sparkles" size={12} color={colors.violet} />
                  </View>
                  <View style={styles.visionBubble}>
                    <Text style={styles.visionText}>{msg.content}</Text>
                  </View>
                </View>
              ) : (
                <View key={msg.id} style={styles.userBubble}>
                  <Text style={styles.userText}>{msg.content}</Text>
                </View>
              )
            )}
            {sending && (
              <View style={styles.visionBubbleRow}>
                <View style={styles.bubbleAvatar}>
                  <Ionicons name="sparkles" size={12} color={colors.violet} />
                </View>
                <View style={styles.visionBubble}>
                  <ActivityIndicator size="small" color={colors.violet} />
                </View>
              </View>
            )}
          </ScrollView>

          {/* Input bar */}
          <View style={styles.inputBar}>
            <TextInput
              style={styles.input}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Ask Vision anything..."
              placeholderTextColor={colors.muted}
              onSubmitEditing={handleSend}
              returnKeyType="send"
              editable={!sending}
            />
            <TouchableOpacity onPress={handleSend} activeOpacity={0.8} style={styles.micBtn} disabled={sending}>
              <LinearGradient
                colors={[...gradients.primary]}
                style={{ width: 34, height: 34, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" }}
              >
                <Ionicons name="send" size={14} color="#FFFFFF" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/haadisiddiqui/projects/VVision-App && npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors

- [ ] **Step 3: Commit**

```bash
cd /Users/haadisiddiqui/projects/VVision-App
git add src/components/VisionSheet.tsx
git commit -m "feat: add VisionSheet bottom sheet chat component"
```

---

## Task 12: Add Vision icon button to RootNavigator

**Files:**
- Modify: `src/navigation/RootNavigator.tsx`

This is the most involved frontend change. The `Header` component (lines 99–195) currently has just a logo on the left and a hamburger button on the right. We need to:
1. Make `Header` accept `user` prop so it can show the Vision button for patients only
2. Add a `VisionButton` with sparkle icon between the logo and hamburger
3. Show/hide `VisionSheet` from the header

- [ ] **Step 1: Add VisionSheet import**

Find the existing component imports at the top of `src/navigation/RootNavigator.tsx` and add:
```typescript
import { VisionSheet } from "../components/VisionSheet";
```

- [ ] **Step 2: Update the RootNavigator to manage VisionSheet state**

Find the state declarations near the top of `RootNavigator()`:
```typescript
  const [drawerOpen, setDrawerOpen] = useState(false);
```

Add:
```typescript
  const [visionOpen, setVisionOpen] = useState(false);
```

- [ ] **Step 3: Pass user and visionOpen props to Header**

Find the two places `<Header onOpenDrawer=...` is rendered (one for caregiver, one for patient) and update:

For the caregiver render:
```typescript
<Header onOpenDrawer={() => setDrawerOpen(true)} user={user} onOpenVision={() => setVisionOpen(true)} />
```

For the patient render:
```typescript
<Header onOpenDrawer={() => setDrawerOpen(true)} user={user} onOpenVision={() => setVisionOpen(true)} />
```

- [ ] **Step 4: Add VisionSheet render for patient**

In the patient return block, after `<SideDrawer .../>`, add:
```typescript
<VisionSheet visible={visionOpen} onClose={() => setVisionOpen(false)} />
```

- [ ] **Step 5: Update the Header function signature**

Find:
```typescript
function Header({ onOpenDrawer }: { onOpenDrawer: () => void }) {
```

Replace with:
```typescript
function Header({ onOpenDrawer, user, onOpenVision }: {
  onOpenDrawer: () => void;
  user: import("../types").AppUser | null;
  onOpenVision: () => void;
}) {
```

- [ ] **Step 6: Add the Vision button to the header bar JSX**

Find the header bar's right side — currently just the hamburger:
```typescript
        <TouchableOpacity onPress={onOpenDrawer} activeOpacity={0.7} style={headerStyles.menuBtn}>
          <Ionicons name="menu-outline" size={26} color={colors.text} />
        </TouchableOpacity>
```

Replace with:
```typescript
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          {user?.role === "patient" && (
            <TouchableOpacity
              onPress={onOpenVision}
              activeOpacity={0.8}
              style={headerStyles.visionBtn}
            >
              <Ionicons name="sparkles" size={13} color={colors.violet} />
              <View style={[headerStyles.onlineDot, { backgroundColor: colors.sage, borderColor: colors.bg }]} />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={onOpenDrawer} activeOpacity={0.7} style={headerStyles.menuBtn}>
            <Ionicons name="menu-outline" size={26} color={colors.text} />
          </TouchableOpacity>
        </View>
```

- [ ] **Step 7: Add visionBtn and onlineDot styles to headerStyles**

Find `const headerStyles = StyleSheet.create({` and add inside the object:
```typescript
  visionBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  onlineDot: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 7,
    height: 7,
    borderRadius: 999,
    borderWidth: 1.5,
  },
```

Wait — `headerStyles` is defined with `StyleSheet.create` as a static constant (not inside `useMemo`). We can't use `colors` directly in it. Instead, apply `borderColor` and `backgroundColor` inline as shown in Step 6 above (which already passes `colors.sage` and `colors.bg` inline). The static `headerStyles` just needs the layout:

```typescript
  visionBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  onlineDot: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 7,
    height: 7,
    borderRadius: 999,
    borderWidth: 1.5,
  },
```

But the Vision button also needs a circle border. We need colors for that. The cleanest solution: wrap the sparkle icon in a `View` with inline styles:

Replace the visionBtn TouchableOpacity inner content with:
```typescript
            <TouchableOpacity
              onPress={onOpenVision}
              activeOpacity={0.8}
              style={headerStyles.visionBtn}
            >
              <View style={{
                width: 26,
                height: 26,
                borderRadius: 999,
                borderWidth: 1.5,
                borderColor: colors.violet,
                backgroundColor: colors.violet50,
                alignItems: "center",
                justifyContent: "center",
              }}>
                <Ionicons name="sparkles" size={13} color={colors.violet} />
              </View>
              <View style={[headerStyles.onlineDot, { backgroundColor: colors.sage, borderColor: colors.bg }]} />
            </TouchableOpacity>
```

Note: `colors` is available in `Header` because it calls `const { colors, isDark } = useTheme();` at line 100.

- [ ] **Step 8: Verify TypeScript compiles**

```bash
cd /Users/haadisiddiqui/projects/VVision-App && npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors

- [ ] **Step 9: Commit**

```bash
cd /Users/haadisiddiqui/projects/VVision-App
git add src/navigation/RootNavigator.tsx
git commit -m "feat: add Vision AI icon button to header (patient-only)"
```

---

## Task 13: Push to Render and test end-to-end

**Files:** None (deployment)

- [ ] **Step 1: Push to GitHub (triggers Render auto-deploy)**

```bash
cd /Users/haadisiddiqui/projects/VVision-App && git push
```

Expected: pushes cleanly, Render picks up the changes

- [ ] **Step 2: Add GROQ_API_KEY to Render environment variables**

In the Render dashboard for `vvision-app`:
- Go to Environment → Environment Variables
- Add `GROQ_API_KEY` with your key from console.groq.com

- [ ] **Step 3: Test with Expo Go**

```bash
cd /Users/haadisiddiqui/projects/VVision-App && npx expo start
```

- Scan QR code with Expo Go
- Open the app as a patient user
- Verify the sparkle icon appears in the header (not for caregiver accounts)
- Tap the icon — VisionSheet should slide up from the bottom
- Send a message — should get a response from Groq
- Pull-to-refresh on Today screen — should reload reminders section

---

## Task 14: VelaVision glasses — shared MongoDB integration

**Files:**
- Modify: `/Users/haadisiddiqui/projects/VelaVision/src/dvision/config.py`
- Modify: `/Users/haadisiddiqui/projects/VelaVision/src/dvision/assistant.py`

Note: These changes make the glasses write conversation history to shared MongoDB so the app can read it as context. The glasses' `reminders.py` is out of scope here (requires knowing the existing voice-to-reminder flow).

- [ ] **Step 1: Add shared MongoDB config to VelaVision**

Open `/Users/haadisiddiqui/projects/VelaVision/src/dvision/config.py` and add at the bottom:

```python
# Shared MongoDB (same as VVision-App)
SHARED_MONGODB_URI = os.environ.get("MONGODB_URI", "")
SHARED_MONGODB_DB = os.environ.get("MONGODB_DB_NAME", "dvision")
```

Make sure `import os` is at the top of the file (it likely already is).

- [ ] **Step 2: Add MongoDB conversation writing to assistant.py**

Open `/Users/haadisiddiqui/projects/VelaVision/src/dvision/assistant.py`.

Find the imports at the top and add:
```python
from pymongo import MongoClient
from .config import SHARED_MONGODB_URI, SHARED_MONGODB_DB
```

Add a helper function near the top of the file (after imports):
```python
def _get_shared_db():
    """Return the shared MongoDB database, or None if not configured."""
    if not SHARED_MONGODB_URI:
        return None
    try:
        client = MongoClient(SHARED_MONGODB_URI, tls=True, serverSelectionTimeoutMS=3000)
        return client[SHARED_MONGODB_DB]
    except Exception:
        return None
```

- [ ] **Step 3: Save conversation turns after each glasses exchange**

Find the place in `assistant.py` where the assistant receives a user query and generates a reply. After the reply is generated, add:

```python
# Save to shared MongoDB for app sync
try:
    db = _get_shared_db()
    if db is not None and patient_id:
        from datetime import datetime, timezone
        turns = [
            {"patient_id": patient_id, "role": "user", "content": user_message, "created_at": datetime.now(timezone.utc).isoformat()},
            {"patient_id": patient_id, "role": "assistant", "content": reply, "created_at": datetime.now(timezone.utc).isoformat()},
        ]
        db["conversations"].insert_many(turns)
        # Prune to max 20
        count = db["conversations"].count_documents({"patient_id": patient_id})
        if count > 20:
            oldest = list(db["conversations"].find({"patient_id": patient_id}).sort("created_at", 1).limit(count - 20))
            ids = [d["_id"] for d in oldest]
            db["conversations"].delete_many({"_id": {"$in": ids}})
except Exception as e:
    print(f"[shared-db] conversation save failed: {e}")
```

Note: `patient_id` in the glasses context is likely the patient's identifier stored in the glasses config or session. Check the existing assistant.py to find what variable holds the current patient's identifier — it may be `PATIENT_ID` from config or similar. Adapt accordingly.

- [ ] **Step 4: Add pymongo to VelaVision requirements**

```bash
cd /Users/haadisiddiqui/projects/VelaVision && .venv312/bin/pip install pymongo
```

Expected: installs successfully

- [ ] **Step 5: Test VelaVision still launches without errors**

```bash
cd /Users/haadisiddiqui/projects/VelaVision && bash run.sh
```

Expected: launches normally, no import errors for pymongo

- [ ] **Step 6: Commit VelaVision changes**

```bash
cd /Users/haadisiddiqui/projects/VelaVision
git add src/dvision/config.py src/dvision/assistant.py
git commit -m "feat: write conversation turns to shared MongoDB for app sync"
```

---

## Verification

Full success criteria:
- Patient opens app, sees sparkle icon in header between logo and hamburger
- Caregiver does NOT see the sparkle icon
- Tapping icon opens bottom sheet chat panel
- Sending a message returns a response from Groq within a few seconds
- After chatting, conversation history persists when closing and reopening the sheet
- Today screen shows a "REMINDERS" section below medications (empty if none set)
- Reminders set on glasses appear in the app's Today screen (via shared MongoDB)
- Pull-to-refresh reloads reminders
- VelaVision glasses write conversation turns to shared MongoDB after each exchange
