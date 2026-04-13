# Plan F — Pattern Learning + Visit Prep Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** Two related features that pay off the Living Profile's accumulated data:
1. **Pattern Learning** — a nightly job that inspects each patient's memories and events, extracts recurring patterns (e.g., "4pm agitation on Tuesdays," "Aunt Carol calls calm her"), and surfaces them as nudges in the Coach view.
2. **Auto Visit Prep** — three days before a scheduled neurologist visit, the system auto-generates a 2-page PDF summary (medications, adherence, behavioral events, sleep, mood trends, sibling notes).

**Architecture:**
- **Pattern inference:** runs as a nightly cron on Render (or `node-cron` in-process for simplicity). For each patient with recent activity, it calls Gemini (text-only) with the last 30 days of memories + event aggregates and asks for ≤5 patterns in structured JSON. Patterns land in a `patterns` collection keyed by patientId.
- **Visit prep:** caregiver schedules a visit via a new `visits` collection. A daily cron checks for visits in the next 3 days; for each, it generates a PDF via `pdfkit`, stores it on disk or S3-compatible, and sends a push notification with a download link.

**Tech Stack:** Express · MongoDB · `node-cron` · `@google/genai` (text mode) · `pdfkit` · `expo-notifications` (client).

**Depends on:** Plan A (memory + events). Benefits from Plans C and D (more source material) but works with what exists.

**Worktree:** `.worktrees/pattern-learning-visit-prep`, branch `feature/pattern-learning-visit-prep`.

---

### Task 1: Install cron + pdfkit

**Files:** `package.json`

- [ ] **Step 1:** `npm install node-cron pdfkit @types/node-cron @types/pdfkit`

- [ ] **Step 2:** Commit:
```bash
git add package.json package-lock.json
git commit -m "chore: install node-cron + pdfkit"
```

---

### Task 2: Backend — patterns schema + CRUD

**Files:**
- Create: `src/server-routes/patterns.ts`
- Create: `src/server-routes/patterns.test.ts`
- Modify: `src/server-core/database.ts`, `src/server.ts`

- [ ] **Step 1: Failing test.** `patterns.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { patternSchema } from "./patterns";

describe("patternSchema", () => {
  it("accepts a valid pattern", () => {
    expect(patternSchema.safeParse({
      title: "Tuesday afternoon agitation",
      description: "Mom has shown elevated anxiety 3 of the last 4 Tuesdays between 3-5pm",
      confidence: 0.7,
      evidenceCount: 4,
      firstObserved: "2026-03-01T00:00:00Z",
      lastObserved: "2026-04-11T00:00:00Z",
      tags: ["agitation", "weekly"],
    }).success).toBe(true);
  });
  it("rejects confidence >1", () => {
    expect(patternSchema.safeParse({ title: "X", description: "Y", confidence: 1.5, evidenceCount: 1, firstObserved: "x", lastObserved: "y", tags: [] }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Implement.** `patterns.ts`:
```ts
import { Router } from "express";
import { z } from "zod";
import { getDb } from "../server-core/database";
import { authMiddleware } from "../server-core/security";
import { requireSeat } from "../server-core/seatResolver";

export const patternSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(1000),
  confidence: z.number().min(0).max(1),
  evidenceCount: z.number().int().min(1),
  firstObserved: z.string(),
  lastObserved: z.string(),
  tags: z.array(z.string().max(60)).max(10),
});

const router = Router();

router.get("/:patientId/patterns", authMiddleware, requireSeat, async (req, res) => {
  try {
    const db = getDb();
    const rows = await db.collection("patterns").find({ patientId: req.params.patientId })
      .sort({ confidence: -1, lastObserved: -1 }).limit(20).toArray();
    res.json({ patterns: rows });
  } catch (err) { res.status(500).json({ detail: "Internal server error" }); }
});

// Caregivers can dismiss a pattern
router.post("/:patientId/patterns/:patternId/dismiss", authMiddleware, requireSeat, async (req, res) => {
  try {
    const { ObjectId } = await import("mongodb");
    const db = getDb();
    await db.collection("patterns").updateOne(
      { _id: new ObjectId(req.params.patternId), patientId: req.params.patientId },
      { $set: { dismissedAt: new Date().toISOString(), dismissedBy: req.seat!.userId } }
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ detail: "Internal server error" }); }
});

export default router;
```

- [ ] **Step 3:** Add indexes in `database.ts`:
```ts
await db.collection("patterns").createIndex({ patientId: 1, confidence: -1, lastObserved: -1 });
await db.collection("patterns").createIndex({ patientId: 1, title: 1 }, { unique: true });
```

- [ ] **Step 4:** Mount: `app.use("/api/profiles", patternRoutes);`

- [ ] **Step 5:** Commit:
```bash
git add src/server-routes/patterns.ts src/server-routes/patterns.test.ts src/server.ts src/server-core/database.ts
git commit -m "feat: patterns collection + read/dismiss endpoints"
```

---

### Task 3: Pattern inference job

**Files:**
- Create: `src/server-jobs/inferPatterns.ts`
- Create: `src/server-jobs/inferPatterns.test.ts`

- [ ] **Step 1: Failing test.** `inferPatterns.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { parseGeminiResponse } from "./inferPatterns";

describe("parseGeminiResponse", () => {
  it("extracts an array of valid patterns, drops malformed ones", () => {
    const raw = `[
      {"title":"Tue 4pm agitation","description":"Seen 3 weeks","confidence":0.7,"evidenceCount":3,"firstObserved":"2026-03-01T00:00:00Z","lastObserved":"2026-04-01T00:00:00Z","tags":["weekly"]},
      {"title":"bad entry","description":""}
    ]`;
    const out = parseGeminiResponse(raw);
    expect(out).toHaveLength(1);
    expect(out[0].title).toContain("Tue");
  });
  it("handles code-fenced JSON", () => {
    const raw = "```json\n[]\n```";
    expect(parseGeminiResponse(raw)).toEqual([]);
  });
});
```

- [ ] **Step 2: Implement.** `inferPatterns.ts`:
```ts
import { GoogleGenAI } from "@google/genai";
import { Db } from "mongodb";
import { config } from "../server-core/config";
import { patternSchema } from "../server-routes/patterns";

export function parseGeminiResponse(raw: string) {
  const cleaned = raw.replace(/^```json\n?/, "").replace(/\n?```$/, "").trim();
  let arr: unknown;
  try { arr = JSON.parse(cleaned); } catch { return []; }
  if (!Array.isArray(arr)) return [];
  const out = [];
  for (const item of arr) {
    const r = patternSchema.safeParse(item);
    if (r.success) out.push(r.data);
  }
  return out;
}

export async function inferPatternsForPatient(db: Db, patientId: string) {
  if (!config.geminiApiKey) throw new Error("GEMINI_API_KEY not set");
  const since = new Date(Date.now() - 30 * 24 * 3600_000).toISOString();
  // Gather: last 30 days of memories (from Mem0 via stored metadata in profile_events? Plan A's /memory doesn't persist to our DB — v1 compromise: we also store a shadow copy in profile_events under kind "note")
  const events = await db.collection("profile_events").find({
    patientId, capturedAt: { $gte: since }
  }).sort({ capturedAt: 1 }).toArray();
  if (events.length < 10) return []; // not enough signal

  const compact = events.map(e => ({ t: e.capturedAt, k: e.kind, d: e.data })).slice(0, 400);
  const prompt = [
    "You are analyzing caregiving data for one patient with dementia over the last 30 days.",
    "Identify up to 5 RECURRING patterns that would help the caregiver. Only include patterns supported by at least 3 separate events.",
    "Return a JSON array matching this TypeScript type:",
    `Array<{ title: string; description: string; confidence: number; evidenceCount: number; firstObserved: string; lastObserved: string; tags: string[] }>`,
    "If there are no clear patterns, return [].",
    "Data:",
    JSON.stringify(compact),
  ].join("\n\n");

  const genai = new GoogleGenAI({ apiKey: config.geminiApiKey });
  const result = await genai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
  });
  const text = result.text ?? "";
  return parseGeminiResponse(text);
}

export async function runInferenceAll(db: Db) {
  const patientIds = await db.collection("profile_events").distinct("patientId");
  for (const pid of patientIds) {
    try {
      const patterns = await inferPatternsForPatient(db, pid);
      for (const p of patterns) {
        await db.collection("patterns").updateOne(
          { patientId: pid, title: p.title },
          { $set: { ...p, patientId: pid, updatedAt: new Date().toISOString() } },
          { upsert: true }
        );
      }
    } catch (e) { console.error("inference failed for", pid, e); }
  }
}
```

Run tests → PASS.

- [ ] **Step 3:** Commit:
```bash
git add src/server-jobs/inferPatterns.ts src/server-jobs/inferPatterns.test.ts
git commit -m "feat: Gemini-backed pattern inference (nightly job)"
```

---

### Task 4: Cron scheduler

**Files:**
- Create: `src/server-jobs/scheduler.ts`
- Modify: `src/server.ts`

- [ ] **Step 1:** `scheduler.ts`:
```ts
import cron from "node-cron";
import { getDb } from "../server-core/database";
import { runInferenceAll } from "./inferPatterns";
import { processDueVisits } from "./visitPrepJob";

export function startCron() {
  // Nightly 03:00 UTC — pattern inference
  cron.schedule("0 3 * * *", async () => {
    try { await runInferenceAll(getDb()); } catch (e) { console.error("nightly inference:", e); }
  });
  // Every 6h — visit prep check
  cron.schedule("0 */6 * * *", async () => {
    try { await processDueVisits(getDb()); } catch (e) { console.error("visit prep:", e); }
  });
  console.log("cron scheduled");
}
```

- [ ] **Step 2:** In `src/server.ts`, after DB connects, call `startCron()`.

- [ ] **Step 3:** Commit:
```bash
git add src/server-jobs/scheduler.ts src/server.ts
git commit -m "feat: nightly cron for pattern inference + visit prep"
```

---

### Task 5: Visits CRUD

**Files:**
- Create: `src/server-routes/visits.ts`
- Create: `src/server-routes/visits.test.ts`
- Modify: `src/server-core/database.ts`, `src/server.ts`

- [ ] **Step 1: Failing test.**
```ts
import { describe, it, expect } from "vitest";
import { visitCreateSchema } from "./visits";

describe("visitCreateSchema", () => {
  it("accepts valid visit", () => {
    expect(visitCreateSchema.safeParse({
      providerName: "Dr. Patel",
      providerRole: "neurologist",
      scheduledFor: "2026-05-10T14:00:00Z",
      notes: "Quarterly check-in"
    }).success).toBe(true);
  });
  it("rejects empty providerName", () => {
    expect(visitCreateSchema.safeParse({ providerName: "", scheduledFor: "2026-05-10T14:00:00Z" }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Implement.** `visits.ts`:
```ts
import { Router } from "express";
import { z } from "zod";
import { ObjectId } from "mongodb";
import { getDb } from "../server-core/database";
import { authMiddleware } from "../server-core/security";
import { requireSeat } from "../server-core/seatResolver";

export const visitCreateSchema = z.object({
  providerName: z.string().min(1).max(200),
  providerRole: z.string().max(100).optional(),
  scheduledFor: z.string(),
  notes: z.string().max(1000).optional(),
});

const router = Router();

router.post("/:patientId/visits", authMiddleware, requireSeat, async (req, res) => {
  const parsed = visitCreateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ detail: parsed.error.issues[0].message }); return; }
  try {
    const db = getDb();
    const result = await db.collection("visits").insertOne({
      ...parsed.data,
      patientId: req.params.patientId,
      status: "scheduled",
      createdBy: req.seat!.userId,
      createdAt: new Date().toISOString(),
    });
    res.status(201).json({ id: result.insertedId.toString() });
  } catch (err) { res.status(500).json({ detail: "Internal server error" }); }
});

router.get("/:patientId/visits", authMiddleware, requireSeat, async (req, res) => {
  try {
    const db = getDb();
    const upcoming = await db.collection("visits").find({
      patientId: req.params.patientId, scheduledFor: { $gte: new Date().toISOString() }
    }).sort({ scheduledFor: 1 }).toArray();
    res.json({ visits: upcoming });
  } catch (err) { res.status(500).json({ detail: "Internal server error" }); }
});

router.delete("/:patientId/visits/:visitId", authMiddleware, requireSeat, async (req, res) => {
  try {
    const db = getDb();
    await db.collection("visits").deleteOne({ _id: new ObjectId(req.params.visitId), patientId: req.params.patientId });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ detail: "Internal server error" }); }
});

export default router;
```

- [ ] **Step 3:** Add index:
```ts
await db.collection("visits").createIndex({ patientId: 1, scheduledFor: 1 });
```

- [ ] **Step 4:** Mount in server.ts: `app.use("/api/profiles", visitRoutes);`

- [ ] **Step 5:** Commit:
```bash
git add src/server-routes/visits.ts src/server-routes/visits.test.ts src/server-core/database.ts src/server.ts
git commit -m "feat: visits CRUD (schedule neuro appointments)"
```

---

### Task 6: Visit prep PDF generator

**Files:**
- Create: `src/server-jobs/visitPrepJob.ts`
- Create: `src/server-jobs/visitPrepPdf.ts`
- Create: `src/server-jobs/visitPrepPdf.test.ts`

- [ ] **Step 1: Test.** `visitPrepPdf.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildVisitPrepBuffer } from "./visitPrepPdf";

describe("buildVisitPrepBuffer", () => {
  it("produces a non-empty PDF buffer for minimal input", async () => {
    const buf = await buildVisitPrepBuffer({
      patientName: "Mom",
      providerName: "Dr. Patel",
      scheduledFor: "2026-05-10T14:00:00Z",
      stage: "moderate",
      medications: [{ name: "Donepezil", dose: "10mg", schedule: "daily" }],
      eventsSummary: "12 motion events, 3 door events, 1 voice check-in",
      patterns: [{ title: "Tue 4pm agitation", description: "…" }],
      siblingNotes: "Pet therapy helped on Saturday.",
    });
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.slice(0, 4).toString()).toBe("%PDF");
  });
});
```

- [ ] **Step 2: Implement.** `visitPrepPdf.ts`:
```ts
import PDFDocument from "pdfkit";

export interface VisitPrepInput {
  patientName: string;
  providerName: string;
  scheduledFor: string;
  stage?: string | null;
  medications?: Array<{ name: string; dose: string; schedule: string }>;
  eventsSummary: string;
  patterns?: Array<{ title: string; description: string }>;
  siblingNotes?: string;
}

export function buildVisitPrepBuffer(input: VisitPrepInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "LETTER" });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(20).text(`Visit Prep — ${input.patientName}`);
    doc.moveDown(0.3);
    doc.fontSize(11).fillColor("#475569").text(`For: ${input.providerName}`);
    doc.text(`Appointment: ${new Date(input.scheduledFor).toLocaleString()}`);
    if (input.stage) doc.text(`Current stage: ${input.stage}`);
    doc.moveDown();

    doc.fillColor("#0f172a").fontSize(14).text("Medications");
    doc.moveDown(0.3).fontSize(11);
    (input.medications ?? []).forEach((m) => doc.text(`• ${m.name} — ${m.dose} — ${m.schedule}`));
    if ((input.medications ?? []).length === 0) doc.fillColor("#64748b").text("None recorded").fillColor("#0f172a");
    doc.moveDown();

    doc.fontSize(14).text("Activity in the last 30 days");
    doc.moveDown(0.3).fontSize(11).text(input.eventsSummary);
    doc.moveDown();

    doc.fontSize(14).text("Patterns detected");
    doc.moveDown(0.3).fontSize(11);
    const pats = input.patterns ?? [];
    if (pats.length === 0) doc.fillColor("#64748b").text("No strong patterns detected yet.").fillColor("#0f172a");
    else pats.forEach((p) => { doc.font("Helvetica-Bold").text(p.title); doc.font("Helvetica").text(p.description); doc.moveDown(0.3); });

    if (input.siblingNotes) {
      doc.moveDown();
      doc.fontSize(14).text("From the family");
      doc.moveDown(0.3).fontSize(11).text(input.siblingNotes);
    }

    doc.end();
  });
}
```

- [ ] **Step 3:** `visitPrepJob.ts`:
```ts
import { Db, ObjectId } from "mongodb";
import { buildVisitPrepBuffer } from "./visitPrepPdf";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function processDueVisits(db: Db) {
  const in3d = new Date(Date.now() + 3 * 24 * 3600_000).toISOString();
  const now = new Date().toISOString();
  const due = await db.collection("visits").find({
    status: "scheduled",
    prepGeneratedAt: { $exists: false },
    scheduledFor: { $gte: now, $lte: in3d },
  }).toArray();

  for (const v of due) {
    try {
      const patient = await db.collection("patients").findOne({ _id: new ObjectId(v.patientId) });
      const events = await db.collection("profile_events").find({
        patientId: v.patientId,
        capturedAt: { $gte: new Date(Date.now() - 30 * 24 * 3600_000).toISOString() },
      }).toArray();
      const eventsSummary = summarizeEvents(events);
      const patterns = await db.collection("patterns").find({ patientId: v.patientId }).sort({ confidence: -1 }).limit(5).toArray();
      const buf = await buildVisitPrepBuffer({
        patientName: patient?.name ?? "Patient",
        providerName: v.providerName,
        scheduledFor: v.scheduledFor,
        stage: patient?.stage,
        medications: patient?.medications ?? [],
        eventsSummary,
        patterns: patterns.map((p: any) => ({ title: p.title, description: p.description })),
        siblingNotes: v.notes,
      });
      const dir = path.join(process.cwd(), "uploads", "visit-prep", String(v.patientId));
      await mkdir(dir, { recursive: true });
      const filePath = path.join(dir, `${v._id}.pdf`);
      await writeFile(filePath, buf);
      await db.collection("visits").updateOne(
        { _id: v._id },
        { $set: { prepGeneratedAt: new Date().toISOString(), prepFilePath: filePath } }
      );
    } catch (e) { console.error("visit prep failed:", v._id, e); }
  }
}

function summarizeEvents(events: any[]): string {
  const counts: Record<string, number> = {};
  events.forEach(e => { counts[e.kind] = (counts[e.kind] || 0) + 1; });
  const pairs = Object.entries(counts).map(([k, v]) => `${v} ${k}`);
  return pairs.length ? pairs.join(", ") : "No activity recorded.";
}
```

- [ ] **Step 4:** Commit:
```bash
git add src/server-jobs/visitPrepPdf.ts src/server-jobs/visitPrepPdf.test.ts src/server-jobs/visitPrepJob.ts
git commit -m "feat: visit prep PDF generator + due-visit processor"
```

---

### Task 7: Download endpoint for visit prep PDF

**Files:**
- Modify: `src/server-routes/visits.ts`

- [ ] **Step 1:** Append to `visits.ts`:
```ts
import { createReadStream } from "fs";

router.get("/:patientId/visits/:visitId/prep.pdf", authMiddleware, requireSeat, async (req, res) => {
  try {
    const db = getDb();
    const v = await db.collection("visits").findOne({ _id: new ObjectId(req.params.visitId), patientId: req.params.patientId });
    if (!v?.prepFilePath) { res.status(404).json({ detail: "Visit prep not generated yet" }); return; }
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="visit-prep-${v._id}.pdf"`);
    createReadStream(v.prepFilePath).pipe(res);
  } catch (err) { res.status(500).json({ detail: "Internal server error" }); }
});
```

- [ ] **Step 2:** Commit:
```bash
git add src/server-routes/visits.ts
git commit -m "feat: download endpoint for visit prep PDF"
```

---

### Task 8: Client — Patterns card + Visits screen

**Files:**
- Create: `src/components/PatternsCard.tsx`
- Create: `src/screens/caregiver/VisitsScreen.tsx`
- Create: `src/screens/caregiver/ScheduleVisitScreen.tsx`
- Create: `src/api/patterns.ts`, `src/api/visits.ts`

- [ ] **Step 1:** API clients:
```ts
// src/api/patterns.ts
import { authFetch } from "./authFetch";
export async function listPatterns(patientId: string) {
  const r = await authFetch(`/api/profiles/${patientId}/patterns`);
  if (!r.ok) throw new Error("load failed");
  return r.json() as Promise<{ patterns: Array<any> }>;
}
export async function dismissPattern(patientId: string, patternId: string) {
  const r = await authFetch(`/api/profiles/${patientId}/patterns/${patternId}/dismiss`, { method: "POST" });
  if (!r.ok) throw new Error("dismiss failed");
  return r.json();
}

// src/api/visits.ts
import { authFetch } from "./authFetch";
export async function listVisits(patientId: string) {
  const r = await authFetch(`/api/profiles/${patientId}/visits`);
  if (!r.ok) throw new Error("load failed");
  return r.json() as Promise<{ visits: Array<any> }>;
}
export async function createVisit(patientId: string, body: { providerName: string; scheduledFor: string; providerRole?: string; notes?: string }) {
  const r = await authFetch(`/api/profiles/${patientId}/visits`, { method: "POST", body: JSON.stringify(body) });
  if (!r.ok) throw new Error((await r.json()).detail);
  return r.json() as Promise<{ id: string }>;
}
```

- [ ] **Step 2:** `PatternsCard.tsx`:
```tsx
import React, { useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { listPatterns, dismissPattern } from "../api/patterns";
import { useCurrentProfile } from "../hooks/useCurrentProfile";

export default function PatternsCard() {
  const { patientId } = useCurrentProfile();
  const [patterns, setPatterns] = useState<any[]>([]);

  const load = async () => { if (patientId) { const r = await listPatterns(patientId); setPatterns(r.patterns.filter((p: any) => !p.dismissedAt)); } };
  useEffect(() => { load(); }, [patientId]);

  if (patterns.length === 0) return null;
  return (
    <View style={{ backgroundColor: "#eff6ff", padding: 16, borderRadius: 12, marginVertical: 12 }}>
      <Text style={{ fontWeight: "700", fontSize: 14, color: "#1d4ed8", marginBottom: 8 }}>Patterns we've noticed</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {patterns.slice(0, 5).map((p: any) => (
          <View key={p._id} style={{ width: 260, marginRight: 12, backgroundColor: "white", padding: 12, borderRadius: 10 }}>
            <Text style={{ fontWeight: "600" }}>{p.title}</Text>
            <Text style={{ color: "#64748b", marginTop: 4, fontSize: 13 }}>{p.description}</Text>
            <Pressable
              onPress={async () => { if (patientId) { await dismissPattern(patientId, p._id); load(); } }}
              style={{ marginTop: 8 }}>
              <Text style={{ color: "#6366f1", fontSize: 12 }}>Dismiss</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
```

- [ ] **Step 3:** `VisitsScreen.tsx`:
```tsx
import React, { useEffect, useState, useCallback } from "react";
import { View, Text, FlatList, Pressable, Linking } from "react-native";
import { listVisits } from "../../api/visits";
import { useCurrentProfile } from "../../hooks/useCurrentProfile";
import { authFetch } from "../../api/authFetch";

export default function VisitsScreen({ navigation }: any) {
  const { patientId } = useCurrentProfile();
  const [visits, setVisits] = useState<any[]>([]);
  const load = useCallback(async () => { if (patientId) { const r = await listVisits(patientId); setVisits(r.visits); } }, [patientId]);
  useEffect(() => { load(); }, [load]);

  return (
    <View style={{ flex: 1, padding: 24 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ fontSize: 22, fontWeight: "700" }}>Upcoming visits</Text>
        <Pressable onPress={() => navigation.navigate("ScheduleVisit", { onCreated: load })}
          style={{ backgroundColor: "#6366f1", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 }}>
          <Text style={{ color: "white", fontWeight: "600" }}>+ Schedule</Text>
        </Pressable>
      </View>
      <FlatList data={visits} keyExtractor={(v: any) => v._id} style={{ marginTop: 16 }}
        ListEmptyComponent={<Text style={{ color: "#64748b", textAlign: "center", marginTop: 40 }}>No visits scheduled.</Text>}
        renderItem={({ item }: any) => (
          <View style={{ padding: 16, backgroundColor: "#f8fafc", borderRadius: 10, marginBottom: 8 }}>
            <Text style={{ fontWeight: "600" }}>{item.providerName}</Text>
            <Text style={{ color: "#64748b" }}>{new Date(item.scheduledFor).toLocaleString()}</Text>
            {item.prepGeneratedAt ? (
              <Pressable onPress={async () => {
                const res = await authFetch(`/api/profiles/${patientId}/visits/${item._id}/prep.pdf`);
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                Linking.openURL(url);
              }}>
                <Text style={{ color: "#6366f1", marginTop: 6 }}>📄 Download visit prep</Text>
              </Pressable>
            ) : (
              <Text style={{ color: "#94a3b8", marginTop: 6, fontSize: 12 }}>Visit prep generates 3 days before.</Text>
            )}
          </View>
        )} />
    </View>
  );
}
```

- [ ] **Step 4:** `ScheduleVisitScreen.tsx` — simple form with providerName + date+time picker (`@react-native-community/datetimepicker`). On submit call `createVisit`. (Implementer: use existing date picker already in dependencies — check before installing.)

- [ ] **Step 5:** Commit:
```bash
git add src/api/patterns.ts src/api/visits.ts src/components/PatternsCard.tsx src/screens/caregiver/VisitsScreen.tsx src/screens/caregiver/ScheduleVisitScreen.tsx
git commit -m "feat: PatternsCard + Visits screen + Schedule visit"
```

---

### Task 9: Wire into caregiver home

**Files:**
- Modify: caregiver home screen

- [ ] **Step 1:** Drop `<PatternsCard />` above the existing dashboard content. Add "Visits" entry to the caregiver tab nav or settings.

- [ ] **Step 2:** Commit.

---

### Task 10: Smoke tests + docs

**Files:** `docs/manual-tests/plan-f-smoke.md`, `README.md`, `CLAUDE.md`

- [ ] **Smoke checklist:**
```markdown
# Plan F Smoke Tests

1. Schedule a visit 2 days out. Run `processDueVisits(db)` manually via a one-off script or `node -e`. Confirm PDF appears in `uploads/visit-prep/<patientId>/<visitId>.pdf`.
2. Open PDF — correct patient name, provider, medications, event summary, patterns.
3. With <10 events in last 30d, `runInferenceAll` returns no patterns for that patient (correctly skips).
4. With >10 events, inference produces 0–5 patterns in the `patterns` collection.
5. Client — Patterns card shows patterns; Dismiss removes them.
6. Visits screen shows visit after scheduling; Download button appears after prep is generated.
```

- [ ] **Docs:** README + CLAUDE.md updates documenting endpoints and that PDFs write to `uploads/visit-prep/` (Render disk ephemeral — for prod, swap to S3 in a later plan).

- [ ] **Commit.**

---

## Plan summary

Nightly pattern inference + 6-hourly visit prep cron. New `patterns` and `visits` collections. Client: `PatternsCard`, `VisitsScreen`, `ScheduleVisitScreen`. Writes PDFs under `uploads/visit-prep/`.

**Next plan:** **G — Onboarding & Trial Paywall** (ties everything together into a first-run experience).
