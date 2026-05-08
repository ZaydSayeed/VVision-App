# Emotional Mood Check-In Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let patients log how they're feeling once a day (4 options: happy, tired, confused, sad). Caregivers see the last 7 days of mood as a row of emoji on PatientDetailScreen.

**Architecture:** New `mood_checkins` MongoDB collection. Two backend routes: POST to submit today's mood, GET to fetch recent entries. Patient sees a mood card at the top of TodayScreen (hidden after submitting for the day, tracked via AsyncStorage). Caregiver sees a 7-day mood strip on PatientDetailScreen.

**Tech Stack:** React Native, Express/TypeScript, MongoDB, AsyncStorage (already installed)

---

## File Structure

- Create: `src/server-routes/mood.ts` — `POST/GET /api/mood`
- Create: `src/server-routes/mood.test.ts` — backend tests
- Modify: `src/server-core/database.ts` — add `mood_checkins` index
- Modify: `src/server.ts` — mount mood router
- Modify: `src/screens/patient/TodayScreen.tsx` — add mood card
- Modify: `src/screens/caregiver/PatientDetailScreen.tsx` — add 7-day mood strip

---

### Task 1: Backend mood routes

**Files:**
- Create: `src/server-routes/mood.ts`
- Create: `src/server-routes/mood.test.ts`
- Modify: `src/server-core/database.ts`
- Modify: `src/server.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/server-routes/mood.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

vi.mock("../server-core/security", () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.auth = { userId: "user-abc" };
    next();
  },
}));
vi.mock("../server-core/patientResolver", () => ({
  resolvePatientId: (req: any, _res: any, next: any) => {
    req.patientId = "patient-123";
    next();
  },
}));

const mockDoc = { _id: "id1", patient_id: "patient-123", mood: "happy", date: "2026-05-08", created_at: "2026-05-08T10:00:00.000Z" };
const mockCol = {
  findOne: vi.fn().mockResolvedValue(null),
  insertOne: vi.fn().mockResolvedValue({ insertedId: "id1" }),
  find: vi.fn().mockReturnValue({ sort: vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([mockDoc]) }) }) }),
};
vi.mock("../server-core/database", () => ({
  getDb: () => ({ collection: () => mockCol }),
}));

import moodRouter from "./mood";

const app = express();
app.use(express.json());
app.use("/api/mood", moodRouter);

describe("POST /api/mood", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a mood entry and returns 201", async () => {
    const res = await request(app)
      .post("/api/mood")
      .send({ mood: "happy" });
    expect(res.status).toBe(201);
    expect(res.body.mood).toBe("happy");
  });

  it("returns 409 when already submitted today", async () => {
    mockCol.findOne.mockResolvedValueOnce(mockDoc);
    const res = await request(app)
      .post("/api/mood")
      .send({ mood: "tired" });
    expect(res.status).toBe(409);
  });

  it("returns 400 for invalid mood value", async () => {
    const res = await request(app)
      .post("/api/mood")
      .send({ mood: "angry" });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/mood", () => {
  it("returns array of recent moods", async () => {
    const res = await request(app).get("/api/mood");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].mood).toBe("happy");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
cd /Users/haadisiddiqui/projects/VVision-App && npx vitest run src/server-routes/mood.test.ts
```
Expected: FAIL (module not found)

- [ ] **Step 3: Create the mood route**

```typescript
// src/server-routes/mood.ts
import { Router } from "express";
import { z } from "zod";
import { getDb } from "../server-core/database";
import { authMiddleware } from "../server-core/security";
import { resolvePatientId } from "../server-core/patientResolver";

const router = Router();

const VALID_MOODS = ["happy", "tired", "confused", "sad"] as const;
type Mood = typeof VALID_MOODS[number];

const createSchema = z.object({
  mood: z.enum(VALID_MOODS),
});

function moodOut(doc: any) {
  return {
    id: String(doc._id),
    patient_id: String(doc.patient_id),
    mood: doc.mood as Mood,
    date: doc.date,
    created_at: doc.created_at,
  };
}

// POST /api/mood — submit today's mood (once per day)
router.post("/", authMiddleware, resolvePatientId, async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ detail: parsed.error.issues[0].message });
    return;
  }
  try {
    const db = getDb();
    const today = new Date().toISOString().slice(0, 10);
    const existing = await db.collection("mood_checkins").findOne({
      patient_id: req.patientId!,
      date: today,
    });
    if (existing) {
      res.status(409).json({ detail: "Mood already submitted today" });
      return;
    }
    const doc = {
      patient_id: req.patientId!,
      mood: parsed.data.mood,
      date: today,
      created_at: new Date().toISOString(),
    };
    const result = await db.collection("mood_checkins").insertOne(doc);
    res.status(201).json(moodOut({ ...doc, _id: result.insertedId }));
  } catch (err) {
    console.error("create mood error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

// GET /api/mood — get last 7 days of mood entries
router.get("/", authMiddleware, resolvePatientId, async (req, res) => {
  try {
    const db = getDb();
    const docs = await db
      .collection("mood_checkins")
      .find({ patient_id: req.patientId! })
      .sort({ date: -1 })
      .limit(7)
      .toArray();
    res.json(docs.map(moodOut));
  } catch (err) {
    console.error("get mood error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

export default router;
```

- [ ] **Step 4: Add index in database.ts**

In `src/server-core/database.ts`, after the existing indexes, add:

```typescript
  await db.collection("mood_checkins").createIndex({ patient_id: 1, date: -1 });
  await db.collection("mood_checkins").createIndex({ patient_id: 1, date: 1 }, { unique: true });
```

- [ ] **Step 5: Mount route in server.ts**

```typescript
import moodRouter from "./server-routes/mood";
// ...
app.use("/api/mood", moodRouter);
```

- [ ] **Step 6: Run test to verify it passes**

```
cd /Users/haadisiddiqui/projects/VVision-App && npx vitest run src/server-routes/mood.test.ts
```
Expected: PASS (4 tests)

- [ ] **Step 7: Commit**

```bash
git add src/server-routes/mood.ts src/server-routes/mood.test.ts src/server-core/database.ts src/server.ts
git commit -m "feat: add mood check-in backend routes (POST/GET /api/mood)"
```

---

### Task 2: Patient mood card in TodayScreen

**Files:**
- Modify: `src/screens/patient/TodayScreen.tsx`

The mood card appears at the top of TodayScreen when the patient hasn't submitted a mood today. After tapping an emoji, it submits and hides for the rest of the day. Whether the user has submitted today is stored in AsyncStorage under `@vela/mood_submitted:<userId>:<date>`.

- [ ] **Step 1: Add mood state and submit logic to TodayScreen**

In `src/screens/patient/TodayScreen.tsx`, at the top of the component function (alongside existing state declarations), add:

```typescript
const [moodSubmitted, setMoodSubmitted] = useState(false);
const [moodSubmitting, setMoodSubmitting] = useState(false);

// Check if mood already submitted today
useEffect(() => {
  if (!user) return;
  const today = new Date().toISOString().slice(0, 10);
  AsyncStorage.getItem(`@vela/mood_submitted:${user.id}:${today}`).then((val) => {
    if (val) setMoodSubmitted(true);
  });
}, [user]);

const handleMoodSelect = useCallback(async (mood: string) => {
  if (moodSubmitting || moodSubmitted) return;
  setMoodSubmitting(true);
  try {
    const res = await fetch(`${API_BASE_URL}/api/mood`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ mood }),
    });
    if (res.ok || res.status === 409) {
      const today = new Date().toISOString().slice(0, 10);
      await AsyncStorage.setItem(`@vela/mood_submitted:${user!.id}:${today}`, "1");
      setMoodSubmitted(true);
    }
  } catch (err) {
    console.error("mood submit error:", err);
  } finally {
    setMoodSubmitting(false);
  }
}, [moodSubmitting, moodSubmitted, user]);
```

Make sure `AsyncStorage` is imported at the top:
```typescript
import AsyncStorage from "@react-native-async-storage/async-storage";
```
And `authHeaders` from `../../api/client`, and `API_BASE_URL` from `../../config/api` (both already imported in TodayScreen).

- [ ] **Step 2: Add the mood card JSX**

Inside the ScrollView in TodayScreen, before the existing greeting/task content, add the mood card. It renders only when `!moodSubmitted`:

```typescript
{!moodSubmitted && (
  <View style={styles.moodCard}>
    <Text style={styles.moodQuestion}>How are you feeling today?</Text>
    <View style={styles.moodRow}>
      {([ 
        { mood: "happy", emoji: "😊", label: "Happy" },
        { mood: "tired", emoji: "😴", label: "Tired" },
        { mood: "confused", emoji: "😕", label: "Confused" },
        { mood: "sad", emoji: "😢", label: "Sad" },
      ] as const).map(({ mood, emoji, label }) => (
        <TouchableOpacity
          key={mood}
          style={styles.moodBtn}
          onPress={() => handleMoodSelect(mood)}
          disabled={moodSubmitting}
          accessibilityLabel={label}
        >
          <Text style={styles.moodEmoji}>{emoji}</Text>
          <Text style={styles.moodLabel}>{label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  </View>
)}
```

- [ ] **Step 3: Add mood card styles**

Inside the `useMemo(() => StyleSheet.create({...}), [colors])` block in TodayScreen, add:

```typescript
    moodCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      padding: spacing.lg,
      marginHorizontal: spacing.lg,
      marginBottom: spacing.md,
      gap: spacing.sm,
    },
    moodQuestion: {
      fontSize: 15,
      ...fonts.medium,
      color: colors.text,
    },
    moodRow: {
      flexDirection: "row",
      justifyContent: "space-between",
    },
    moodBtn: {
      alignItems: "center",
      gap: 4,
      flex: 1,
    },
    moodEmoji: {
      fontSize: 28,
    },
    moodLabel: {
      fontSize: 11,
      ...fonts.regular,
      color: colors.muted,
    },
```

- [ ] **Step 4: Verify TypeScript compiles**

```
cd /Users/haadisiddiqui/projects/VVision-App && npx tsc --noEmit 2>&1 | grep -i "todayscreen\|mood" | head -20
```
Expected: No errors related to TodayScreen or mood.

- [ ] **Step 5: Commit**

```bash
git add src/screens/patient/TodayScreen.tsx
git commit -m "feat: add daily mood check-in card to patient TodayScreen"
```

---

### Task 3: Caregiver 7-day mood strip on PatientDetailScreen

**Files:**
- Modify: `src/screens/caregiver/PatientDetailScreen.tsx`

The caregiver sees a small horizontal strip of 7 mood emoji — one per day going left-to-right oldest to newest. Days with no entry show a gray dot. Fetched from `GET /api/mood` (same endpoint, authenticated as the caregiver with the patient's ID in context via `requireSeat`).

**Note:** The existing `GET /api/mood` route uses `resolvePatientId` which resolves based on the logged-in user. For caregivers, this resolves to their linked patient. No route change needed.

- [ ] **Step 1: Add mood fetch to PatientDetailScreen**

At the top of the `PatientDetailScreen` component, alongside other state, add:

```typescript
const [moodHistory, setMoodHistory] = useState<Array<{ date: string; mood: string }>>([]);

useEffect(() => {
  fetch(`${API_BASE_URL}/api/mood`, {
    headers: { ...authHeaders() },
  })
    .then((r) => r.json())
    .then((data) => {
      if (Array.isArray(data)) setMoodHistory(data);
    })
    .catch(() => {});
}, [patientId]);
```

- [ ] **Step 2: Build a 7-day mood grid helper**

Add this helper function at the top of the file (outside the component):

```typescript
const MOOD_EMOJI: Record<string, string> = {
  happy: "😊",
  tired: "😴",
  confused: "😕",
  sad: "😢",
};

function buildLast7Days(history: Array<{ date: string; mood: string }>) {
  const days: Array<{ date: string; emoji: string | null }> = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const date = d.toISOString().slice(0, 10);
    const entry = history.find((h) => h.date === date);
    days.push({ date, emoji: entry ? (MOOD_EMOJI[entry.mood] ?? null) : null });
  }
  return days;
}
```

- [ ] **Step 3: Add mood strip JSX**

Inside PatientDetailScreen's render, add the mood strip after the progress bars section. Find the existing `<AnimatedBar .../>` usage and place this after:

```typescript
{moodHistory.length > 0 && (
  <View style={styles.moodStrip}>
    <Text style={styles.moodStripLabel}>MOOD — LAST 7 DAYS</Text>
    <View style={styles.moodDots}>
      {buildLast7Days(moodHistory).map(({ date, emoji }) => (
        <View key={date} style={styles.moodDot}>
          {emoji ? (
            <Text style={styles.moodDotEmoji}>{emoji}</Text>
          ) : (
            <View style={styles.moodDotEmpty} />
          )}
        </View>
      ))}
    </View>
  </View>
)}
```

- [ ] **Step 4: Add mood strip styles**

Inside the `useMemo(() => StyleSheet.create({...}), [colors])` block in PatientDetailScreen, add:

```typescript
    moodStrip: {
      marginTop: spacing.md,
      gap: spacing.xs,
    },
    moodStripLabel: {
      fontSize: 11,
      letterSpacing: 1.2,
      ...fonts.medium,
      color: colors.muted,
      textTransform: "uppercase",
    },
    moodDots: {
      flexDirection: "row",
      gap: spacing.xs,
    },
    moodDot: {
      flex: 1,
      alignItems: "center",
    },
    moodDotEmoji: {
      fontSize: 20,
    },
    moodDotEmpty: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.border,
      marginVertical: 6,
    },
```

- [ ] **Step 5: Verify TypeScript compiles**

```
cd /Users/haadisiddiqui/projects/VVision-App && npx tsc --noEmit 2>&1 | grep -i "patientdetail\|mood" | head -20
```
Expected: No errors.

- [ ] **Step 6: Run all tests**

```
cd /Users/haadisiddiqui/projects/VVision-App && npx vitest run
```
Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/screens/caregiver/PatientDetailScreen.tsx
git commit -m "feat: add 7-day mood strip to caregiver PatientDetailScreen"
```
