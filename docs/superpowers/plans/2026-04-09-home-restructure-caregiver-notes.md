# Home Restructure + Caregiver Notes + Help Delay Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the 15s help alert delay, restructure the patient Today screen into a split-column layout, and add a caregiver notes feature visible on the patient home screen.

**Architecture:** Adaptive polling in `useHelpAlert` eliminates the delay with no backend changes. A new `notes` backend route + `useNotes` hook + `NotesHistoryModal` + `AddNoteSheet` implement the notes feature end-to-end. The Today screen is restructured to show a pinned note card at the top, then a side-by-side Medications / Tasks split (reminders merged into Tasks).

**Tech Stack:** React Native, Expo, TypeScript, Express, MongoDB, Zod, `@expo/vector-icons` (Ionicons), `expo-linear-gradient`, existing theme tokens.

---

## File Map

**Create:**
- `src/server-routes/notes.ts` — CRUD routes for caregiver notes
- `src/hooks/useNotes.ts` — fetch/poll notes, expose `pinnedNote` + `notes`
- `src/components/NotesHistoryModal.tsx` — expanded notes list modal (patient read-only)
- `src/components/AddNoteSheet.tsx` — add-note bottom sheet with thumbtack toggle (caregiver only)

**Modify:**
- `src/types/index.ts` — add `CaregiverNote` type
- `src/server.ts` — register notes route
- `src/api/client.ts` — add `fetchNotes`, `createNote`, `pinNote`, `deleteNote`
- `src/hooks/useHelpAlert.ts` — adaptive polling (4s active / 15s idle)
- `src/screens/patient/TodayScreen.tsx` — restructure layout: note card + split columns
- `src/screens/caregiver/PatientStatusScreen.tsx` — add Notes section with `AddNoteSheet`

---

## Task 1: Add `CaregiverNote` type + adaptive polling fix

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/hooks/useHelpAlert.ts`

- [ ] **Step 1: Add `CaregiverNote` to `src/types/index.ts`**

Append to the bottom of the file:

```typescript
// ── Caregiver Notes ──────────────────────────────────────
export interface CaregiverNote {
  id: string;
  patientId: string;
  caregiverId: string;
  caregiverName: string;
  text: string;
  pinned: boolean;
  timestamp: string;
}
```

- [ ] **Step 2: Replace the fixed interval in `src/hooks/useHelpAlert.ts` with adaptive polling**

Replace the entire `useEffect` that sets up the interval (lines 32–36):

```typescript
// Before:
useEffect(() => {
  load();
  const interval = setInterval(load, 15000);
  return () => clearInterval(interval);
}, [load]);
```

With:

```typescript
useEffect(() => {
  load();
}, [load]);

// Adaptive polling: 4s when active, 15s when idle
const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
const isActive = sending || !!sentAt || alerts.some((a) => !a.dismissed && !a.resolved && !a.cancelled);
useEffect(() => {
  if (intervalRef.current) clearInterval(intervalRef.current);
  const ms = isActive ? 4000 : 15000;
  intervalRef.current = setInterval(load, ms);
  return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
}, [isActive, load]);
```

Also add `useRef` to the import at line 1:

```typescript
import { useState, useEffect, useCallback, useRef } from "react";
```

- [ ] **Step 3: Verify the app compiles — run TypeScript check**

```bash
cd /Users/zaydsayeed/Desktop/VVision-App && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors related to `useHelpAlert.ts` or `types/index.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts src/hooks/useHelpAlert.ts
git commit -m "fix: adaptive polling in useHelpAlert — 4s active, 15s idle

Reduces help alert round-trip delay from up to 15s to ~4s
without hammering the backend when no alerts are active."
```

---

## Task 2: Backend notes route

**Files:**
- Create: `src/server-routes/notes.ts`
- Modify: `src/server.ts`

- [ ] **Step 1: Create `src/server-routes/notes.ts`**

```typescript
import { Router } from "express";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb } from "../server-core/database";
import { authMiddleware } from "../server-core/security";

const router = Router();

const createSchema = z.object({
  patientId: z.string().min(1),
  text: z.string().min(1, "Text required").max(500).trim(),
  pinned: z.boolean().default(false),
});

function noteOut(doc: any) {
  return {
    id: String(doc._id),
    patientId: String(doc.patientId),
    caregiverId: String(doc.caregiverId),
    caregiverName: doc.caregiverName ?? "",
    text: doc.text,
    pinned: doc.pinned ?? false,
    timestamp: doc.timestamp,
  };
}

// Resolve the requesting user's role + supabaseUid
async function resolveUser(req: any, res: any): Promise<{ supabaseUid: string; role: string; name: string } | null> {
  const db = getDb();
  const supabaseUid = req.auth?.userId;
  if (!supabaseUid) { res.status(401).json({ detail: "Not authenticated" }); return null; }
  const user = await db.collection("users").findOne({ supabase_uid: supabaseUid });
  if (!user) { res.status(404).json({ detail: "Profile not found" }); return null; }
  return { supabaseUid, role: user.role, name: user.name ?? "" };
}

// GET /api/notes?patientId=<id>
router.get("/", authMiddleware, async (req, res) => {
  const { patientId } = req.query;
  if (!patientId || !ObjectId.isValid(String(patientId))) {
    return res.status(400).json({ detail: "Valid patientId required" });
  }
  try {
    const db = getDb();
    const docs = await db.collection("caregiver_notes")
      .find({ patientId: String(patientId) })
      .sort({ timestamp: -1 })
      .limit(50)
      .toArray();
    res.json(docs.map(noteOut));
  } catch (err) {
    console.error("list notes error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

// POST /api/notes
router.post("/", authMiddleware, async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ detail: parsed.error.errors[0].message });
  const { patientId, text, pinned } = parsed.data;
  if (!ObjectId.isValid(patientId)) return res.status(400).json({ detail: "Invalid patientId" });

  const user = await resolveUser(req, res);
  if (!user) return;
  if (user.role !== "caregiver") return res.status(403).json({ detail: "Only caregivers can create notes" });

  try {
    const db = getDb();
    if (pinned) {
      await db.collection("caregiver_notes").updateMany(
        { patientId },
        { $set: { pinned: false } }
      );
    }
    const doc = {
      patientId,
      caregiverId: user.supabaseUid,
      caregiverName: user.name,
      text,
      pinned,
      timestamp: new Date().toISOString(),
    };
    const result = await db.collection("caregiver_notes").insertOne(doc);
    res.status(201).json(noteOut({ _id: result.insertedId, ...doc }));
  } catch (err) {
    console.error("create note error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

// PATCH /api/notes/:id/pin
router.patch("/:id/pin", authMiddleware, async (req, res) => {
  if (!ObjectId.isValid(req.params.id as string)) return res.status(400).json({ detail: "Invalid id" });

  const user = await resolveUser(req, res);
  if (!user) return;
  if (user.role !== "caregiver") return res.status(403).json({ detail: "Only caregivers can pin notes" });

  try {
    const db = getDb();
    const note = await db.collection("caregiver_notes").findOne({ _id: new ObjectId(req.params.id as string) });
    if (!note) return res.status(404).json({ detail: "Note not found" });

    const newPinned = !note.pinned;
    if (newPinned) {
      await db.collection("caregiver_notes").updateMany(
        { patientId: note.patientId },
        { $set: { pinned: false } }
      );
    }
    await db.collection("caregiver_notes").updateOne(
      { _id: new ObjectId(req.params.id as string) },
      { $set: { pinned: newPinned } }
    );
    const updated = await db.collection("caregiver_notes").findOne({ _id: new ObjectId(req.params.id as string) });
    res.json(noteOut(updated));
  } catch (err) {
    console.error("pin note error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

// DELETE /api/notes/:id
router.delete("/:id", authMiddleware, async (req, res) => {
  if (!ObjectId.isValid(req.params.id as string)) return res.status(400).json({ detail: "Invalid id" });

  const user = await resolveUser(req, res);
  if (!user) return;
  if (user.role !== "caregiver") return res.status(403).json({ detail: "Only caregivers can delete notes" });

  try {
    const db = getDb();
    await db.collection("caregiver_notes").deleteOne({ _id: new ObjectId(req.params.id as string) });
    res.status(204).end();
  } catch (err) {
    console.error("delete note error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

export default router;
```

- [ ] **Step 2: Register the route in `src/server.ts`**

After the existing import block (after line 19 `import assistantRoutes`), add:

```typescript
import noteRoutes from "./server-routes/notes";
```

After the line `app.use("/api/reminders", generalLimiter, reminderRoutes);` (find it with grep), add:

```typescript
app.use("/api/notes", generalLimiter, noteRoutes);
```

- [ ] **Step 3: TypeScript check**

```bash
cd /Users/zaydsayeed/Desktop/VVision-App && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors in `notes.ts` or `server.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/server-routes/notes.ts src/server.ts
git commit -m "feat: add /api/notes CRUD route for caregiver notes"
```

---

## Task 3: API client functions + `useNotes` hook

**Files:**
- Modify: `src/api/client.ts`
- Create: `src/hooks/useNotes.ts`

- [ ] **Step 1: Add notes API functions to `src/api/client.ts`**

Find the end of the file and append:

```typescript
// ── Caregiver Notes ───────────────────────────────────────
export async function fetchNotes(patientId: string): Promise<CaregiverNote[]> {
  return request(`/api/notes?patientId=${patientId}`);
}

export async function createNote(patientId: string, text: string, pinned: boolean): Promise<CaregiverNote> {
  return request("/api/notes", {
    method: "POST",
    body: JSON.stringify({ patientId, text, pinned }),
  });
}

export async function pinNote(id: string): Promise<CaregiverNote> {
  return request(`/api/notes/${id}/pin`, { method: "PATCH" });
}

export async function deleteNote(id: string): Promise<void> {
  return request(`/api/notes/${id}`, { method: "DELETE" });
}
```

Also add `CaregiverNote` to the import from `"../types"` at the top of `client.ts`.

- [ ] **Step 2: Create `src/hooks/useNotes.ts`**

```typescript
import { useState, useEffect, useCallback } from "react";
import { CaregiverNote } from "../types";
import { fetchNotes } from "../api/client";

export function useNotes(patientId: string | undefined) {
  const [notes, setNotes] = useState<CaregiverNote[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    try {
      const data = await fetchNotes(patientId);
      setNotes(data);
    } catch {
      // keep current state — non-critical
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  const pinnedNote = notes.find((n) => n.pinned) ?? null;

  return { notes, pinnedNote, loading, reload: load };
}
```

- [ ] **Step 3: TypeScript check**

```bash
cd /Users/zaydsayeed/Desktop/VVision-App && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/api/client.ts src/hooks/useNotes.ts
git commit -m "feat: notes API client functions and useNotes hook"
```

---

## Task 4: `NotesHistoryModal` component

**Files:**
- Create: `src/components/NotesHistoryModal.tsx`

- [ ] **Step 1: Create `src/components/NotesHistoryModal.tsx`**

```typescript
import React, { useMemo } from "react";
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { CaregiverNote } from "../types";
import { useTheme } from "../context/ThemeContext";
import { fonts, spacing, radius } from "../config/theme";
import { formatRelativeTime } from "../hooks/useDashboardData";

interface Props {
  visible: boolean;
  notes: CaregiverNote[];
  onClose: () => void;
}

export function NotesHistoryModal({ visible, notes, onClose }: Props) {
  const { colors } = useTheme();
  const pinnedNote = notes.find((n) => n.pinned) ?? null;
  const previousNotes = notes.filter((n) => !n.pinned);
  const caregiverName = notes[0]?.caregiverName ?? "your caregiver";

  const styles = useMemo(() => StyleSheet.create({
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    sheet: {
      backgroundColor: colors.bg,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingBottom: 48,
      maxHeight: "85%",
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.xl,
      paddingBottom: spacing.lg,
      gap: spacing.md,
    },
    headerTitle: { flex: 1, fontSize: 20, color: colors.text, ...fonts.medium },
    closeBtn: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: colors.surface,
      alignItems: "center", justifyContent: "center",
    },
    sectionLabel: {
      fontSize: 11, color: colors.muted, ...fonts.medium,
      letterSpacing: 1.2, textTransform: "uppercase",
      paddingHorizontal: spacing.xl, marginBottom: spacing.sm,
    },
    card: {
      marginHorizontal: spacing.xl,
      marginBottom: spacing.sm,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.lg,
    },
    pinnedCard: {
      borderLeftWidth: 4,
      borderLeftColor: colors.violet,
    },
    pinnedLabel: {
      fontSize: 10, color: colors.violet, ...fonts.medium,
      letterSpacing: 1, textTransform: "uppercase", marginBottom: spacing.xs,
    },
    noteText: { fontSize: 14, color: colors.text, ...fonts.regular, lineHeight: 21 },
    timestamp: { fontSize: 12, color: colors.muted, ...fonts.regular, marginTop: spacing.xs },
    emptyText: {
      textAlign: "center", color: colors.muted, ...fonts.regular,
      fontSize: 14, paddingVertical: spacing.xxxl,
    },
  }), [colors]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Notes from {caregiverName}</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.75}>
              <Ionicons name="close" size={18} color={colors.muted} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {notes.length === 0 && (
              <Text style={styles.emptyText}>No notes yet.</Text>
            )}

            {pinnedNote && (
              <>
                <Text style={styles.sectionLabel}>Pinned</Text>
                <View style={[styles.card, styles.pinnedCard]}>
                  <Text style={styles.pinnedLabel}>Pinned</Text>
                  <Text style={styles.noteText}>{pinnedNote.text}</Text>
                  <Text style={styles.timestamp}>{formatRelativeTime(pinnedNote.timestamp)}</Text>
                </View>
              </>
            )}

            {previousNotes.length > 0 && (
              <>
                <Text style={[styles.sectionLabel, { marginTop: spacing.lg }]}>Previous Notes</Text>
                {previousNotes.map((note) => (
                  <View key={note.id} style={styles.card}>
                    <Text style={styles.noteText}>{note.text}</Text>
                    <Text style={styles.timestamp}>{formatRelativeTime(note.timestamp)}</Text>
                  </View>
                ))}
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd /Users/zaydsayeed/Desktop/VVision-App && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
git add src/components/NotesHistoryModal.tsx
git commit -m "feat: NotesHistoryModal — patient read-only expanded notes view"
```

---

## Task 5: `AddNoteSheet` component

**Files:**
- Create: `src/components/AddNoteSheet.tsx`

- [ ] **Step 1: Create `src/components/AddNoteSheet.tsx`**

```typescript
import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { fonts, spacing, radius } from "../config/theme";

interface Props {
  visible: boolean;
  onSave: (text: string, pinned: boolean) => Promise<void>;
  onClose: () => void;
}

export function AddNoteSheet({ visible, onSave, onClose }: Props) {
  const { colors } = useTheme();
  const [text, setText] = useState("");
  const [pinned, setPinned] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (!text.trim()) { setError("Please enter a note."); return; }
    setSaving(true);
    setError("");
    try {
      await onSave(text.trim(), pinned);
      setText("");
      setPinned(false);
      onClose();
    } catch {
      setError("Could not save. Check your connection.");
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    setText("");
    setPinned(false);
    setError("");
    onClose();
  }

  const styles = useMemo(() => StyleSheet.create({
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      padding: spacing.xxl,
      gap: spacing.md,
    },
    topRow: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
    handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, flex: 1, marginHorizontal: spacing.xxl },
    pinBtn: {
      width: 36, height: 36, borderRadius: 10,
      alignItems: "center", justifyContent: "center",
    },
    title: { fontSize: 20, color: colors.text, ...fonts.medium },
    input: {
      backgroundColor: colors.bg,
      borderRadius: radius.lg,
      padding: spacing.lg,
      fontSize: 15,
      color: colors.text,
      ...fonts.regular,
      minHeight: 100,
      textAlignVertical: "top",
      borderWidth: 1,
      borderColor: colors.border,
    },
    pinHint: { fontSize: 12, color: colors.muted, ...fonts.regular },
    error: { fontSize: 13, color: colors.coral, ...fonts.regular },
    btns: { flexDirection: "row", gap: spacing.md },
    btnCancel: {
      flex: 1, height: 52, borderRadius: radius.pill,
      borderWidth: 1.5, borderColor: colors.border,
      alignItems: "center", justifyContent: "center",
    },
    btnCancelText: { fontSize: 15, color: colors.text, ...fonts.medium },
    btnSave: {
      flex: 1, height: 52, borderRadius: radius.pill,
      backgroundColor: colors.violet,
      alignItems: "center", justifyContent: "center",
    },
    btnSaveText: { fontSize: 15, color: "#fff", ...fonts.medium },
  }), [colors]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.sheet}>
          {/* Handle + thumbtack row */}
          <View style={styles.topRow}>
            <View style={styles.handle} />
            <TouchableOpacity
              style={[styles.pinBtn, { backgroundColor: pinned ? colors.violet : colors.surface }]}
              onPress={() => setPinned((p) => !p)}
              activeOpacity={0.75}
              accessibilityLabel={pinned ? "Unpin note" : "Pin note to home screen"}
            >
              <Ionicons
                name={pinned ? "pin" : "pin-outline"}
                size={18}
                color={pinned ? "#fff" : colors.violet}
              />
            </TouchableOpacity>
          </View>

          <Text style={styles.title}>New Note</Text>

          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Write a note for your patient..."
            placeholderTextColor={colors.muted}
            multiline
            maxLength={500}
            autoFocus
          />

          <Text style={styles.pinHint}>
            {pinned ? "This note will be pinned to the patient's home screen." : "Tap the thumbtack to pin to home screen."}
          </Text>

          {!!error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.btns}>
            <TouchableOpacity style={styles.btnCancel} onPress={handleClose} activeOpacity={0.75}>
              <Text style={styles.btnCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnSave} onPress={handleSave} disabled={saving} activeOpacity={0.85}>
              <Text style={styles.btnSaveText}>{saving ? "Saving..." : "Save Note"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd /Users/zaydsayeed/Desktop/VVision-App && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
git add src/components/AddNoteSheet.tsx
git commit -m "feat: AddNoteSheet — caregiver add-note bottom sheet with pin toggle"
```

---

## Task 6: Restructure `TodayScreen`

**Files:**
- Modify: `src/screens/patient/TodayScreen.tsx`

This is the largest change. The goal is to replace the existing scrollable sections with:
1. Greeting (unchanged)
2. Note card (pinned caregiver note, read-only)
3. Two equal-height columns: Medications (left) | Tasks (right, includes reminders)

- [ ] **Step 1: Add `useNotes` import and state to `TodayScreen`**

At the top of `TodayScreen.tsx`, add the import:

```typescript
import { useNotes } from "../../hooks/useNotes";
import { NotesHistoryModal } from "../../components/NotesHistoryModal";
```

Inside `TodayScreen()`, after the `useReminders` line, add:

```typescript
const { pinnedNote, notes: caregiverNotes, reload: reloadNotes } = useNotes(patientId);
const [notesModalVisible, setNotesModalVisible] = useState(false);
```

Update `onRefresh` to also reload notes:

```typescript
const onRefresh = useCallback(async () => {
  setRefreshing(true);
  await Promise.all([reloadRoutine(), reloadMeds(), reloadReminders(), reloadNotes()]);
  setRefreshing(false);
}, [reloadRoutine, reloadMeds, reloadReminders, reloadNotes]);
```

- [ ] **Step 2: Add split-column and note-card styles to the `useMemo` StyleSheet**

Inside the `styles` useMemo, **after** the existing `content` style, add:

```typescript
// ── Note card ──────────────────────────────────────────────
noteCard: {
  marginHorizontal: spacing.xl,
  marginBottom: spacing.md,
  backgroundColor: colors.bg,
  borderRadius: radius.xl,
  padding: spacing.lg,
  borderLeftWidth: 4,
  borderLeftColor: colors.violet,
  shadowColor: colors.violet,
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.08,
  shadowRadius: 10,
  elevation: 2,
},
noteCardTop: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: spacing.xs,
},
noteLabel: {
  fontSize: 10, color: colors.violet, ...fonts.medium,
  letterSpacing: 1, textTransform: "uppercase",
},
noteViewAll: {
  flexDirection: "row", alignItems: "center", gap: 2,
},
noteViewAllText: { fontSize: 12, color: colors.violet, ...fonts.medium },
noteText: { fontSize: 14, color: colors.text, ...fonts.regular, lineHeight: 21 },
notePlaceholder: { fontSize: 14, color: colors.muted, ...fonts.regular, fontStyle: "italic" },
noteTimestamp: { fontSize: 11, color: colors.muted, ...fonts.regular, marginTop: spacing.xs },
notePlusRow: {
  flexDirection: "row", alignItems: "center",
  justifyContent: "space-between", marginTop: spacing.sm,
},

// ── Split columns ──────────────────────────────────────────
splitRow: {
  flexDirection: "row",
  marginHorizontal: spacing.xl,
  gap: spacing.md,
  marginBottom: spacing.xl,
},
splitCard: {
  flex: 1,
  backgroundColor: colors.bg,
  borderRadius: radius.xl,
  padding: spacing.lg,
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.05,
  shadowRadius: 8,
  elevation: 2,
  minHeight: 200,
},
splitCardHeader: {
  fontSize: 10, ...fonts.medium,
  letterSpacing: 1.2, textTransform: "uppercase",
  marginBottom: spacing.sm,
},
splitItem: {
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.sm,
  paddingVertical: 5,
},
splitCheckbox: {
  width: 18, height: 18, borderRadius: 4,
  alignItems: "center", justifyContent: "center",
},
splitItemText: { fontSize: 13, color: colors.text, ...fonts.regular, flex: 1 },
splitItemDone: { color: colors.muted, textDecorationLine: "line-through" },
splitFooter: {
  marginTop: "auto",
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.sm,
  paddingTop: spacing.sm,
},
splitProgress: {
  flex: 1,
},
splitProgressTrack: {
  height: 5, borderRadius: 3,
  backgroundColor: colors.surface,
},
splitProgressFill: {
  height: 5, borderRadius: 3,
},
splitProgressText: { fontSize: 10, color: colors.muted, ...fonts.regular, marginTop: 3 },
splitPlusBtn: {
  width: 28, height: 28, borderRadius: 14,
  alignItems: "center", justifyContent: "center",
},
splitPlusBtnText: { color: "#fff", fontSize: 18, lineHeight: 22, fontWeight: "400" },
```

- [ ] **Step 3: Replace the JSX content inside the main `ScrollView` of `TodayScreen`**

Find the `return (` statement in TodayScreen. Keep the notification panel Modal, the backdrop, and the header section (`styles.header` with greeting + notif button) exactly as-is. 

Replace everything between the closing `</View>` of the header and the `</View>` closing the main container (i.e., the `ScrollView` body content) with the following:

```tsx
<ScrollView
  contentContainerStyle={{ paddingBottom: 120 }}
  showsVerticalScrollIndicator={false}
  refreshControl={
    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.violet} />
  }
>
  {/* ── Caregiver Note Card ────────────────────────────── */}
  <View style={styles.noteCard}>
    <View style={styles.noteCardTop}>
      <Text style={styles.noteLabel}>
        {pinnedNote ? `Note from ${pinnedNote.caregiverName}` : "Caregiver Notes"}
      </Text>
      {caregiverNotes.length > 0 && (
        <TouchableOpacity style={styles.noteViewAll} onPress={() => setNotesModalVisible(true)} activeOpacity={0.75}>
          <Text style={styles.noteViewAllText}>{caregiverNotes.length} note{caregiverNotes.length !== 1 ? "s" : ""}</Text>
          <Ionicons name="chevron-forward" size={13} color={colors.violet} />
        </TouchableOpacity>
      )}
    </View>

    {pinnedNote ? (
      <>
        <Text style={styles.noteText}>{pinnedNote.text}</Text>
        <Text style={styles.noteTimestamp}>{formatRelativeTime(pinnedNote.timestamp)}</Text>
      </>
    ) : (
      <Text style={styles.notePlaceholder}>No notes from your caregiver yet.</Text>
    )}
  </View>

  {/* ── Split Columns ─────────────────────────────────── */}
  <View style={styles.splitRow}>

    {/* Medications */}
    <View style={styles.splitCard}>
      <Text style={[styles.splitCardHeader, { color: colors.amber }]}>Medications</Text>

      {meds.length === 0 ? (
        <Text style={{ color: colors.muted, fontSize: 12, ...fonts.regular }}>No meds added yet.</Text>
      ) : (
        meds.map((med) => {
          const taken = isTakenToday(med);
          return (
            <TouchableOpacity
              key={med.id}
              style={styles.splitItem}
              onPress={() => toggleTaken(med.id)}
              activeOpacity={0.75}
            >
              <View style={[styles.splitCheckbox, { backgroundColor: taken ? colors.amber : "transparent", borderWidth: taken ? 0 : 1.5, borderColor: colors.amber }]}>
                {taken && <Ionicons name="checkmark" size={12} color="#fff" />}
              </View>
              <Text style={[styles.splitItemText, taken && styles.splitItemDone]} numberOfLines={2}>
                {med.name}
              </Text>
            </TouchableOpacity>
          );
        })
      )}

      <View style={styles.splitFooter}>
        <View style={styles.splitProgress}>
          <View style={styles.splitProgressTrack}>
            <View style={[styles.splitProgressFill, {
              backgroundColor: colors.amber,
              width: meds.length > 0 ? `${Math.round((medsDone / meds.length) * 100)}%` : "0%",
            }]} />
          </View>
          <Text style={styles.splitProgressText}>{medsDone} of {meds.length} taken</Text>
        </View>
        <TouchableOpacity
          style={[styles.splitPlusBtn, { backgroundColor: colors.amber }]}
          onPress={() => setShowMedModal(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.splitPlusBtnText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>

    {/* Tasks (includes reminders) */}
    <View style={styles.splitCard}>
      <Text style={[styles.splitCardHeader, { color: colors.sage }]}>Tasks</Text>

      {tasks.length === 0 && reminders.length === 0 ? (
        <Text style={{ color: colors.muted, fontSize: 12, ...fonts.regular }}>No tasks yet.</Text>
      ) : (
        [...tasks.map((t) => ({ id: t.id, label: t.label, time: t.time, done: isCompletedToday(t), type: "task" as const })),
         ...reminders.map((r) => ({ id: r.id, label: r.text, time: r.time ?? "", done: !!r.completed_date, type: "reminder" as const }))]
          .sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""))
          .map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.splitItem}
              onPress={() => item.type === "task" ? toggleComplete(item.id) : null}
              activeOpacity={0.75}
            >
              <View style={[styles.splitCheckbox, { backgroundColor: item.done ? colors.sage : "transparent", borderWidth: item.done ? 0 : 1.5, borderColor: colors.sage }]}>
                {item.done && <Ionicons name="checkmark" size={12} color="#fff" />}
              </View>
              <Text style={[styles.splitItemText, item.done && styles.splitItemDone]} numberOfLines={2}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))
      )}

      <View style={styles.splitFooter}>
        <View style={styles.splitProgress}>
          {(() => {
            const allItems = tasks.length + reminders.length;
            const doneItems = tasks.filter(isCompletedToday).length + reminders.filter((r) => !!r.completed_date).length;
            return (
              <>
                <View style={styles.splitProgressTrack}>
                  <View style={[styles.splitProgressFill, {
                    backgroundColor: colors.sage,
                    width: allItems > 0 ? `${Math.round((doneItems / allItems) * 100)}%` : "0%",
                  }]} />
                </View>
                <Text style={styles.splitProgressText}>{doneItems} of {allItems} done</Text>
              </>
            );
          })()}
        </View>
        <TouchableOpacity
          style={[styles.splitPlusBtn, { backgroundColor: colors.sage }]}
          onPress={() => setShowTaskModal(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.splitPlusBtnText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>

  </View>
</ScrollView>
```

- [ ] **Step 4: Add `NotesHistoryModal` and the `formatRelativeTime` import to TodayScreen**

At the bottom of the TodayScreen JSX (just before the closing `</View>` of the main container), add:

```tsx
<NotesHistoryModal
  visible={notesModalVisible}
  notes={caregiverNotes}
  onClose={() => setNotesModalVisible(false)}
/>
```

Add `formatRelativeTime` to the import from `useDashboardData`:

```typescript
import { formatRelativeTime } from "../../hooks/useDashboardData";
```

Also add `colors.amber` and `colors.sage` check: in `theme.ts` they are `colors.amber` and `colors.sage` — confirm these exist. (They do per CLAUDE.md.)

- [ ] **Step 5: TypeScript check**

```bash
cd /Users/zaydsayeed/Desktop/VVision-App && npx tsc --noEmit 2>&1 | head -40
```

Fix any type errors before committing.

- [ ] **Step 6: Commit**

```bash
git add src/screens/patient/TodayScreen.tsx
git commit -m "feat: restructure TodayScreen — pinned note card + split meds/tasks columns"
```

---

## Task 7: Add Notes section to `PatientStatusScreen`

**Files:**
- Modify: `src/screens/caregiver/PatientStatusScreen.tsx`

- [ ] **Step 1: Add imports to `PatientStatusScreen.tsx`**

```typescript
import { useNotes } from "../../hooks/useNotes";
import { NotesHistoryModal } from "../../components/NotesHistoryModal";
import { AddNoteSheet } from "../../components/AddNoteSheet";
import { createNote } from "../../api/client";
import { formatRelativeTime } from "../../hooks/useDashboardData";
```

- [ ] **Step 2: Add notes state inside `PatientStatusScreen()`**

After the `useHelpAlert` line, add:

```typescript
const { pinnedNote, notes: caregiverNotes, reload: reloadNotes } = useNotes(patientId);
const [notesModalVisible, setNotesModalVisible] = useState(false);
const [addNoteVisible, setAddNoteVisible] = useState(false);

async function handleSaveNote(text: string, pinned: boolean) {
  if (!patientId) return;
  await createNote(patientId, text, pinned);
  await reloadNotes();
}
```

- [ ] **Step 3: Add note card styles to the `useMemo` StyleSheet in `PatientStatusScreen`**

Inside the StyleSheet.create call, append:

```typescript
noteSection: { paddingHorizontal: spacing.xl, marginBottom: spacing.xl },
noteCard: {
  backgroundColor: colors.bg,
  borderRadius: radius.xl,
  padding: spacing.lg,
  borderLeftWidth: 4,
  borderLeftColor: colors.violet,
  shadowColor: colors.violet,
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.08,
  shadowRadius: 10,
  elevation: 2,
},
noteCardTop: {
  flexDirection: "row", alignItems: "center",
  justifyContent: "space-between", marginBottom: spacing.xs,
},
noteLabel: {
  fontSize: 10, color: colors.violet, ...fonts.medium,
  letterSpacing: 1, textTransform: "uppercase",
},
noteViewAll: { flexDirection: "row", alignItems: "center", gap: 2 },
noteViewAllText: { fontSize: 12, color: colors.violet, ...fonts.medium },
noteText: { fontSize: 14, color: colors.text, ...fonts.regular, lineHeight: 21 },
notePlaceholder: { fontSize: 14, color: colors.muted, ...fonts.regular, fontStyle: "italic" },
noteTimestamp: { fontSize: 11, color: colors.muted, ...fonts.regular, marginTop: spacing.xs },
noteFooter: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", marginTop: spacing.sm },
notePlusBtn: {
  width: 28, height: 28, borderRadius: 14,
  backgroundColor: colors.violet,
  alignItems: "center", justifyContent: "center",
  shadowColor: colors.violet,
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.35,
  shadowRadius: 6,
  elevation: 3,
},
notePlusBtnText: { color: "#fff", fontSize: 18, lineHeight: 22, fontWeight: "400" },
```

- [ ] **Step 4: Add the notes card JSX to the PatientStatusScreen render**

Find the end of the `ScrollView` content in `PatientStatusScreen` (before the closing `</ScrollView>`). Add a Notes section just before it:

```tsx
{/* ── Caregiver Notes ── */}
<View style={styles.noteSection}>
  <SectionHeader label="Notes" />
  <View style={styles.noteCard}>
    <View style={styles.noteCardTop}>
      <Text style={styles.noteLabel}>
        {pinnedNote ? "Pinned Note" : "Notes"}
      </Text>
      {caregiverNotes.length > 0 && (
        <TouchableOpacity style={styles.noteViewAll} onPress={() => setNotesModalVisible(true)} activeOpacity={0.75}>
          <Text style={styles.noteViewAllText}>{caregiverNotes.length} note{caregiverNotes.length !== 1 ? "s" : ""}</Text>
          <Ionicons name="chevron-forward" size={13} color={colors.violet} />
        </TouchableOpacity>
      )}
    </View>
    {pinnedNote ? (
      <>
        <Text style={styles.noteText}>{pinnedNote.text}</Text>
        <Text style={styles.noteTimestamp}>{formatRelativeTime(pinnedNote.timestamp)}</Text>
      </>
    ) : (
      <Text style={styles.notePlaceholder}>No notes yet. Add one below.</Text>
    )}
    <View style={styles.noteFooter}>
      <TouchableOpacity
        style={styles.notePlusBtn}
        onPress={() => setAddNoteVisible(true)}
        activeOpacity={0.8}
        accessibilityLabel="Add a note for this patient"
      >
        <Text style={styles.notePlusBtnText}>+</Text>
      </TouchableOpacity>
    </View>
  </View>
</View>
```

- [ ] **Step 5: Add modals to PatientStatusScreen JSX**

Just before the closing `</View>` of the screen, add:

```tsx
<NotesHistoryModal
  visible={notesModalVisible}
  notes={caregiverNotes}
  onClose={() => setNotesModalVisible(false)}
/>
<AddNoteSheet
  visible={addNoteVisible}
  onSave={handleSaveNote}
  onClose={() => setAddNoteVisible(false)}
/>
```

- [ ] **Step 6: TypeScript check**

```bash
cd /Users/zaydsayeed/Desktop/VVision-App && npx tsc --noEmit 2>&1 | head -40
```

- [ ] **Step 7: Commit**

```bash
git add src/screens/caregiver/PatientStatusScreen.tsx
git commit -m "feat: add Notes section to PatientStatusScreen with add/pin/view-all"
```

---

## Task 8: Final push

- [ ] **Step 1: Full TypeScript check**

```bash
cd /Users/zaydsayeed/Desktop/VVision-App && npx tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 2: Push**

```bash
git push
```
