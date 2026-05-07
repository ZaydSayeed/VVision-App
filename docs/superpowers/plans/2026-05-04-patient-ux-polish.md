# Patient UX Polish & Bug Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 6 issues surfaced during first real-device testing: health screen UI (Apple Health-style expandable cards with per-card range + 1d support), historical HealthKit sync, task detail bottom sheet, login keyboard avoidance, centered Help FAB, and caregiver onboarding skip-if-patient-linked.

**Architecture:** All changes are isolated — no shared state or ordering dependencies between tasks 1–9. Tasks 1–2 are backend; tasks 3–9 are frontend. The health screen rewrite (tasks 5–7) depends on task 4 (useMetricTrend hook) and the range type update (task 1).

**Tech Stack:** React Native + Expo, TypeScript, Express/MongoDB backend on Render, react-native-gifted-charts (LineChart), react-native-svg, AsyncStorage, React Native Modal + Animated.

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `src/server-routes/health.ts` | Modify | Add `"1d"` to range enum; handle days=1 |
| `src/api/health.ts` | Modify | Add `"1d"` to Range type in getTrend |
| `src/components/health/RangeToggle.tsx` | Modify | Add `"1d"` option, update Range type |
| `src/server-routes/routines.ts` | Modify | Add `notes` to create/update schemas and routineOut |
| `src/types/index.ts` | Modify | Add `notes?: string` to RoutineTask |
| `src/services/healthSync.ts` | Modify | 30-day initial lookback |
| `src/hooks/useMetricTrend.ts` | Create | Single-metric trend hook with `enabled` flag |
| `src/components/health/ExpandableMetricCard.tsx` | Create | Accordion card: value + expand → chart + range toggle |
| `src/screens/patient/HealthScreen.tsx` | Rewrite | Uses 4x ExpandableMetricCard, one expanded at a time |
| `src/components/patient/TaskDetailSheet.tsx` | Create | Bottom sheet: full task detail, notes, edit, delete |
| `src/screens/patient/TodayScreen.tsx` | Modify | Task rows become tappable; wire TaskDetailSheet |
| `src/screens/LoginScreen.tsx` | Modify | Wrap ScrollView in KeyboardAvoidingView |
| `src/navigation/PatientTabNavigator.tsx` | Modify | 5-slot tab bar with centered Help FAB |
| `src/navigation/RootNavigator.tsx` | Modify | Skip OnboardingNavigator if user.patient_id exists |

---

## Task 1: Add `1d` range to backend + API types

**Files:**
- Modify: `src/server-routes/health.ts:79-97`
- Modify: `src/api/health.ts:36-48`
- Modify: `src/components/health/RangeToggle.tsx:6-16`

- [ ] **Step 1: Update backend range enum and day calculation**

In `src/server-routes/health.ts`, replace lines 79–97:

```typescript
export const trendsQuerySchema = z.object({
  metric: z.enum(METRICS),
  range: z.enum(["1d", "7d", "30d", "90d"]).default("7d"),
});

router.get("/:patientId/health/trends", authMiddleware, requirePatientAccess, async (req: Request, res: Response) => {
  const parsed = trendsQuerySchema.safeParse({
    metric: req.query.metric,
    range: req.query.range,
  });
  if (!parsed.success) {
    res.status(400).json({ detail: parsed.error.issues[0].message });
    return;
  }
  try {
    const db = getDb();
    const col = db.collection("patient_health_readings");
    const patientId = String(req.params.patientId);
    const daysMap: Record<string, number> = { "1d": 1, "7d": 7, "30d": 30, "90d": 90 };
    const days = daysMap[parsed.data.range];
    const since = new Date();
    since.setDate(since.getDate() - days + 1);
    const sinceIso = since.toISOString().slice(0, 10);
    const rows = await col
      .find({ patientId, metric: parsed.data.metric, date: { $gte: sinceIso } })
      .sort({ date: 1 })
      .toArray();
    res.json({
      metric: parsed.data.metric,
      range: parsed.data.range,
      points: rows.map((r) => ({ date: r.date, value: r.value })),
    });
  } catch (err) {
    console.error("[health/trends]", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});
```

- [ ] **Step 2: Update Range type in api/health.ts**

Replace line 42 in `src/api/health.ts`:

```typescript
export async function getTrend(
  patientId: string,
  metric: Reading["metric"],
  range: "1d" | "7d" | "30d" | "90d"
): Promise<Trend> {
  const r = await authFetch(
    `/api/profiles/${patientId}/health/trends?metric=${metric}&range=${range}`
  );
  if (!r.ok) throw new Error("trend load failed");
  return r.json();
}
```

- [ ] **Step 3: Update RangeToggle to include 1d and export updated Range type**

Replace full content of `src/components/health/RangeToggle.tsx`:

```typescript
import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../config/theme";

export type Range = "1d" | "7d" | "30d" | "90d";

interface Props {
  value: Range;
  onChange: (r: Range) => void;
}

export function RangeToggle({ value, onChange }: Props) {
  const { colors } = useTheme();
  const ranges: Range[] = ["1d", "7d", "30d", "90d"];

  const styles = useMemo(() => StyleSheet.create({
    row: { flexDirection: "row", backgroundColor: colors.surface, borderRadius: 10, padding: 3, alignSelf: "flex-start", marginBottom: 12 },
    pill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
    pillActive: { backgroundColor: colors.violet },
    label: { ...fonts.medium, fontSize: 12, color: colors.muted },
    labelActive: { color: "#FFFFFF" },
  }), [colors]);

  return (
    <View style={styles.row}>
      {ranges.map((r) => (
        <TouchableOpacity
          key={r}
          style={[styles.pill, r === value && styles.pillActive]}
          onPress={() => onChange(r)}
          activeOpacity={0.7}
        >
          <Text style={[styles.label, r === value && styles.labelActive]}>{r}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/server-routes/health.ts src/api/health.ts src/components/health/RangeToggle.tsx
git commit -m "feat: add 1d range option to health trends"
```

---

## Task 2: Add `notes` to task schema

**Files:**
- Modify: `src/server-routes/routines.ts:10-29`
- Modify: `src/types/index.ts:85-91`

- [ ] **Step 1: Update createSchema, updateSchema, and routineOut in routines.ts**

Replace the schema definitions and `routineOut` function (lines 10–29):

```typescript
const createSchema = z.object({
  label: z.string().min(1, "Label required").max(300).trim(),
  time: z.string().min(1, "Time required").max(50).trim(),
  notes: z.string().max(1000).trim().optional(),
});

const updateSchema = z.object({
  label: z.string().min(1).max(300).trim().optional(),
  time: z.string().min(1).max(50).trim().optional(),
  completed_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  notes: z.string().max(1000).trim().nullable().optional(),
});

function routineOut(doc: any) {
  return {
    id: String(doc._id),
    label: doc.label,
    time: doc.time,
    completed_date: doc.completed_date ?? null,
    notes: doc.notes ?? null,
    patient_id: String(doc.patient_id),
  };
}
```

- [ ] **Step 2: Update PATCH handler to apply notes field**

In the PATCH handler (around line 85), replace the updates block:

```typescript
    const { label, time, completed_date, notes } = parsed.data;
    if (label !== undefined) updates.label = label;
    if (time !== undefined) updates.time = time;
    if (completed_date !== undefined) updates.completed_date = completed_date;
    if (notes !== undefined) updates.notes = notes;
```

- [ ] **Step 3: Update RoutineTask type**

In `src/types/index.ts`, replace the `RoutineTask` interface:

```typescript
export interface RoutineTask {
  id: string;
  label: string;
  time: string;
  completed_date: string | null;
  notes: string | null;
  patient_id?: string;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/server-routes/routines.ts src/types/index.ts
git commit -m "feat: add notes field to routine tasks"
```

---

## Task 3: Historical HealthKit sync (30-day initial)

**Files:**
- Modify: `src/services/healthSync.ts:6-15`

- [ ] **Step 1: Update getLastSync to return 30-day lookback on first sync**

Replace `getLastSync` function in `src/services/healthSync.ts`:

```typescript
const DEFAULT_LOOKBACK_DAYS = 1;
const INITIAL_LOOKBACK_DAYS = 30;

async function getLastSync(): Promise<Date> {
  const raw = await AsyncStorage.getItem(LAST_SYNC_KEY);
  if (raw) return new Date(raw);
  // First sync — go back 30 days to capture existing Health app data
  const d = new Date();
  d.setDate(d.getDate() - INITIAL_LOOKBACK_DAYS);
  return d;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/healthSync.ts
git commit -m "feat: 30-day initial HealthKit sync on first connect"
```

---

## Task 4: Create `useMetricTrend` hook

**Files:**
- Create: `src/hooks/useMetricTrend.ts`

- [ ] **Step 1: Create the hook**

Create `src/hooks/useMetricTrend.ts`:

```typescript
import { useEffect, useState, useCallback } from "react";
import { getTrend, TrendPoint } from "../api/health";
import type { Range } from "../components/health/RangeToggle";

type Metric = "steps" | "heart_rate" | "active_minutes" | "sleep";

export function useMetricTrend(
  patientId: string | null,
  metric: Metric,
  range: Range,
  enabled: boolean
) {
  const [points, setPoints] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!patientId || !enabled) return;
    setLoading(true);
    try {
      const result = await getTrend(patientId, metric, range);
      setPoints(result.points);
    } catch {
      setPoints([]);
    } finally {
      setLoading(false);
    }
  }, [patientId, metric, range, enabled]);

  useEffect(() => { fetch(); }, [fetch]);

  return { points, loading };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useMetricTrend.ts
git commit -m "feat: useMetricTrend hook for per-card trend fetching"
```

---

## Task 5: Create `ExpandableMetricCard` component

**Files:**
- Create: `src/components/health/ExpandableMetricCard.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/health/ExpandableMetricCard.tsx`:

```typescript
import React, { useState, useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { LineChart } from "react-native-gifted-charts";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../config/theme";
import { RangeToggle, Range } from "./RangeToggle";
import { useMetricTrend } from "../../hooks/useMetricTrend";

type Metric = "steps" | "heart_rate" | "active_minutes" | "sleep";

interface Props {
  title: string;
  iconName: keyof typeof import("@expo/vector-icons").Ionicons.glyphMap;
  accentColor: string;
  value: string | number;
  unit?: string;
  metric: Metric;
  patientId: string | null;
  isExpanded: boolean;
  onToggle: () => void;
}

export function ExpandableMetricCard({
  title, iconName, accentColor, value, unit, metric, patientId, isExpanded, onToggle,
}: Props) {
  const { colors } = useTheme();
  const [range, setRange] = useState<Range>("1d");
  const { points, loading } = useMetricTrend(patientId, metric, range, isExpanded);

  const chartData = useMemo(
    () => points.map((p) => ({ value: p.value, label: p.date.slice(5) })),
    [points]
  );

  const styles = useMemo(() => StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 18,
      marginBottom: 14,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
    },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    left: { flexDirection: "row", alignItems: "center", gap: 10 },
    iconCircle: {
      width: 36, height: 36, borderRadius: 10,
      alignItems: "center", justifyContent: "center",
    },
    title: { ...fonts.medium, fontSize: 13, color: colors.muted, textTransform: "uppercase", letterSpacing: 0.8 },
    valueRow: { flexDirection: "row", alignItems: "baseline", marginTop: 10, gap: 4 },
    value: { ...fonts.medium, fontSize: 36, color: colors.text },
    unit: { ...fonts.regular, fontSize: 14, color: colors.muted },
    chartWrap: { marginTop: 14 },
    noData: { ...fonts.regular, fontSize: 13, color: colors.muted, marginTop: 14, textAlign: "center", paddingVertical: 20 },
  }), [colors]);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onToggle}
      activeOpacity={0.85}
    >
      <View style={styles.header}>
        <View style={styles.left}>
          <View style={[styles.iconCircle, { backgroundColor: accentColor + "22" }]}>
            <Ionicons name={iconName} size={18} color={accentColor} />
          </View>
          <Text style={styles.title}>{title}</Text>
        </View>
        <Ionicons
          name={isExpanded ? "chevron-up" : "chevron-down"}
          size={18}
          color={colors.muted}
        />
      </View>

      <View style={styles.valueRow}>
        <Text style={styles.value}>{value === "—" || value === null ? "—" : String(value)}</Text>
        {unit ? <Text style={styles.unit}>{unit}</Text> : null}
      </View>

      {isExpanded && (
        <View style={styles.chartWrap}>
          <RangeToggle value={range} onChange={setRange} />
          {loading ? (
            <ActivityIndicator color={accentColor} style={{ marginVertical: 20 }} />
          ) : chartData.length === 0 ? (
            <Text style={styles.noData}>No data for this period</Text>
          ) : (
            <LineChart
              data={chartData}
              areaChart
              startFillColor={accentColor}
              endFillColor={colors.surface}
              startOpacity={0.3}
              endOpacity={0.02}
              color={accentColor}
              thickness={2.5}
              hideDataPoints={chartData.length > 7}
              dataPointsColor={accentColor}
              dataPointsRadius={3}
              hideRules
              hideYAxisText
              xAxisLabelTextStyle={{ color: colors.muted, fontSize: 9 }}
              initialSpacing={0}
              endSpacing={0}
              spacing={Math.max(24, Math.floor(300 / Math.max(chartData.length, 1)))}
              height={130}
              curved
            />
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/health/ExpandableMetricCard.tsx
git commit -m "feat: ExpandableMetricCard with accordion chart + per-card range toggle"
```

---

## Task 6: Rewrite HealthScreen

**Files:**
- Modify: `src/screens/patient/HealthScreen.tsx`

- [ ] **Step 1: Rewrite HealthScreen.tsx**

Replace the full content of `src/screens/patient/HealthScreen.tsx`:

```typescript
import React, { useEffect, useMemo, useState } from "react";
import { View, ScrollView, Text, StyleSheet, RefreshControl } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../config/theme";
import { useAuth } from "../../context/AuthContext";
import { useHealthSummary } from "../../hooks/useHealthSummary";
import { ExpandableMetricCard } from "../../components/health/ExpandableMetricCard";
import { isHealthOnboarded } from "./HealthOnboardingScreen";
import { syncNow } from "../../services/healthSync";

type Metric = "steps" | "heart_rate" | "active_minutes" | "sleep";

const METRIC_CONFIG: {
  metric: Metric;
  title: string;
  iconName: any;
  accentColor: string;
  summaryKey: keyof ReturnType<typeof summaryValues>;
}[] = [
  { metric: "steps", title: "Steps", iconName: "footsteps-outline", accentColor: "#F97316", summaryKey: "steps" },
  { metric: "heart_rate", title: "Heart Rate", iconName: "heart-outline", accentColor: "#EF4444", summaryKey: "heartRate" },
  { metric: "active_minutes", title: "Active Minutes", iconName: "flash-outline", accentColor: "#22C55E", summaryKey: "activeMinutes" },
  { metric: "sleep", title: "Sleep", iconName: "moon-outline", accentColor: "#6366F1", summaryKey: "sleep" },
];

function summaryValues(data: any) {
  return {
    steps: { value: data?.steps?.value ?? "—", unit: data?.steps ? "steps today" : undefined },
    heartRate: { value: data?.heartRate?.value ?? "—", unit: data?.heartRate?.unit },
    activeMinutes: { value: data?.activeMinutes?.value ?? "—", unit: data?.activeMinutes ? "min today" : undefined },
    sleep: { value: data?.sleep?.value ?? "—", unit: data?.sleep?.unit },
  };
}

export function HealthScreen() {
  const { colors } = useTheme();
  const nav = useNavigation<any>();
  const { user } = useAuth();
  const patientId = user?.patient_id ?? null;
  const summary = useHealthSummary(patientId);
  const [expandedMetric, setExpandedMetric] = useState<Metric | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    isHealthOnboarded().then((ok) => { if (!ok) nav.navigate("HealthOnboarding"); });
  }, [nav]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (patientId) await syncNow(patientId).catch(() => {});
    await summary.refresh();
    setRefreshing(false);
  };

  const vals = summaryValues(summary.data);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    content: { padding: 16, paddingBottom: 40 },
    header: { ...fonts.medium, fontSize: 28, color: colors.text, marginBottom: 4 },
    sub: { ...fonts.regular, fontSize: 14, color: colors.muted, marginBottom: 18 },
  }), [colors]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.violet} />}
    >
      <Text style={styles.header}>Health</Text>
      <Text style={styles.sub}>Tap a card to see your trends</Text>

      {METRIC_CONFIG.map(({ metric, title, iconName, accentColor, summaryKey }) => {
        const { value, unit } = vals[summaryKey];
        return (
          <ExpandableMetricCard
            key={metric}
            title={title}
            iconName={iconName}
            accentColor={accentColor}
            value={value}
            unit={unit}
            metric={metric}
            patientId={patientId}
            isExpanded={expandedMetric === metric}
            onToggle={() => setExpandedMetric(expandedMetric === metric ? null : metric)}
          />
        );
      })}
    </ScrollView>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/patient/HealthScreen.tsx
git commit -m "feat: Apple Health-style expandable metric cards with per-card range toggle"
```

---

## Task 7: Create `TaskDetailSheet` component

**Files:**
- Create: `src/components/patient/TaskDetailSheet.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/patient/TaskDetailSheet.tsx`:

```typescript
import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  Animated, StyleSheet, Alert, ScrollView, KeyboardAvoidingView, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { fonts, spacing, radius } from "../../config/theme";
import { RoutineTask } from "../../types";

interface Props {
  task: RoutineTask | null;
  onClose: () => void;
  onComplete: (taskId: string, date: string | null) => void;
  onDelete: (taskId: string) => void;
  onSaveNotes: (taskId: string, notes: string) => Promise<void>;
  onEdit: (task: RoutineTask) => void;
  isCompletedToday: (task: RoutineTask) => boolean;
}

export function TaskDetailSheet({ task, onClose, onComplete, onDelete, onSaveNotes, onEdit, isCompletedToday }: Props) {
  const { colors } = useTheme();
  const slideAnim = useRef(new Animated.Value(400)).current;
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (task) {
      setNotes(task.notes ?? "");
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, bounciness: 0, speed: 20 }).start();
    } else {
      Animated.timing(slideAnim, { toValue: 400, duration: 200, useNativeDriver: true }).start();
    }
  }, [task]);

  const handleSaveNotes = async () => {
    if (!task) return;
    setSaving(true);
    try {
      await onSaveNotes(task.id, notes);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!task) return;
    Alert.alert("Delete Task", "Are you sure you want to delete this task?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => { onDelete(task.id); onClose(); } },
    ]);
  };

  const styles = useMemo(() => StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
    sheet: {
      backgroundColor: colors.bg,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingBottom: 40,
      maxHeight: "85%",
    },
    handle: {
      width: 40, height: 4, borderRadius: 2,
      backgroundColor: colors.border, alignSelf: "center", marginTop: 12, marginBottom: 4,
    },
    header: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    headerTitle: { ...fonts.medium, fontSize: 16, color: colors.text },
    closeBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
    content: { padding: spacing.xl, gap: spacing.lg },
    label: { ...fonts.medium, fontSize: 22, color: colors.text, lineHeight: 30 },
    metaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    metaText: { ...fonts.regular, fontSize: 14, color: colors.muted },
    sectionLabel: {
      ...fonts.medium, fontSize: 11, color: colors.muted,
      textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6,
    },
    notesInput: {
      backgroundColor: colors.surface,
      borderRadius: radius.md, padding: spacing.md,
      ...fonts.regular, fontSize: 15, color: colors.text,
      minHeight: 80, textAlignVertical: "top",
      borderWidth: 1, borderColor: colors.border,
    },
    saveBtn: {
      backgroundColor: colors.violet, borderRadius: radius.pill,
      paddingVertical: 10, paddingHorizontal: spacing.xl,
      alignSelf: "flex-end",
    },
    saveBtnText: { ...fonts.medium, fontSize: 13, color: "#FFFFFF" },
    doneToggle: {
      flexDirection: "row", alignItems: "center", gap: 10,
      backgroundColor: colors.surface, borderRadius: radius.md,
      padding: spacing.md,
    },
    doneToggleText: { ...fonts.medium, fontSize: 15, color: colors.text },
    actionRow: { flexDirection: "row", gap: spacing.md },
    editBtn: {
      flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
      backgroundColor: colors.surface, borderRadius: radius.md, paddingVertical: 12,
      borderWidth: 1, borderColor: colors.border,
    },
    editBtnText: { ...fonts.medium, fontSize: 14, color: colors.text },
    deleteBtn: {
      flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
      backgroundColor: colors.coralSoft ?? "#FEE2E2", borderRadius: radius.md, paddingVertical: 12,
    },
    deleteBtnText: { ...fonts.medium, fontSize: 14, color: colors.coral },
  }), [colors]);

  const completed = task ? isCompletedToday(task) : false;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <Modal visible={!!task} transparent animationType="none" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
            <TouchableOpacity activeOpacity={1}>
              <View style={styles.handle} />
              <View style={styles.header}>
                <Text style={styles.headerTitle}>Task Detail</Text>
                <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                  <Ionicons name="close" size={20} color={colors.muted} />
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                <Text style={styles.label}>{task?.label}</Text>

                {task?.time ? (
                  <View style={styles.metaRow}>
                    <Ionicons name="time-outline" size={16} color={colors.muted} />
                    <Text style={styles.metaText}>{task.time}</Text>
                  </View>
                ) : null}

                <TouchableOpacity
                  style={styles.doneToggle}
                  onPress={() => task && onComplete(task.id, completed ? null : today)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={completed ? "checkmark-circle" : "ellipse-outline"}
                    size={24}
                    color={completed ? colors.sage ?? "#22C55E" : colors.muted}
                  />
                  <Text style={styles.doneToggleText}>{completed ? "Completed today" : "Mark as complete"}</Text>
                </TouchableOpacity>

                <View>
                  <Text style={styles.sectionLabel}>Notes</Text>
                  <TextInput
                    style={styles.notesInput}
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="Add a note..."
                    placeholderTextColor={colors.muted}
                    multiline
                    numberOfLines={3}
                  />
                  <TouchableOpacity
                    style={[styles.saveBtn, { marginTop: 8 }]}
                    onPress={handleSaveNotes}
                    disabled={saving}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.saveBtnText}>{saving ? "Saving…" : "Save Notes"}</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.actionRow}>
                  <TouchableOpacity style={styles.editBtn} onPress={() => task && onEdit(task)} activeOpacity={0.8}>
                    <Ionicons name="pencil-outline" size={16} color={colors.text} />
                    <Text style={styles.editBtnText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} activeOpacity={0.8}>
                    <Ionicons name="trash-outline" size={16} color={colors.coral} />
                    <Text style={styles.deleteBtnText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </TouchableOpacity>
          </Animated.View>
        </KeyboardAvoidingView>
      </TouchableOpacity>
    </Modal>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/patient/TaskDetailSheet.tsx
git commit -m "feat: TaskDetailSheet bottom sheet with notes, complete toggle, edit, delete"
```

---

## Task 8: Wire task taps in TodayScreen

**Files:**
- Modify: `src/screens/patient/TodayScreen.tsx`

- [ ] **Step 1: Read TodayScreen to find task row rendering and hook exports**

Look for the task card/row render section (around line 810–830 per earlier analysis) and the `useRoutine` hook usage. Identify: the `toggleComplete` function signature, the `deleteTask` function, and where task rows are rendered.

- [ ] **Step 2: Add TaskDetailSheet state and import**

At the top of `TodayScreen.tsx`, add the import:

```typescript
import { TaskDetailSheet } from "../../components/patient/TaskDetailSheet";
```

Inside the component, add state near existing state declarations:

```typescript
const [detailTask, setDetailTask] = useState<RoutineTask | null>(null);
```

- [ ] **Step 3: Add `updateTaskNotes` function**

Inside the component (after the hook calls), add:

```typescript
const updateTaskNotes = async (taskId: string, notes: string) => {
  await fetch(`${API_BASE_URL}/api/routines/${taskId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ notes }),
  });
  reloadRoutine();
};
```

Import `API_BASE_URL` from `"../../config/api"` and `authHeaders` from `"../../api/client"` if not already imported.

- [ ] **Step 4: Wrap task rows in TouchableOpacity**

Find the task label rendering in the split-column layout (around line 817 — where tasks are rendered with `numberOfLines={2}`). Wrap each task row in a `TouchableOpacity` that calls `setDetailTask(task)`:

```typescript
<TouchableOpacity
  key={task.id}
  onPress={() => setDetailTask(task)}
  activeOpacity={0.75}
>
  {/* existing task row content */}
</TouchableOpacity>
```

Remove `numberOfLines={2}` limit — use `numberOfLines={2}` still for the collapsed row (the sheet shows full text), just make it tappable.

- [ ] **Step 5: Add TaskDetailSheet to JSX**

At the bottom of the returned JSX (before the closing tag), add:

```typescript
<TaskDetailSheet
  task={detailTask}
  onClose={() => setDetailTask(null)}
  onComplete={(taskId, date) => {
    toggleComplete(taskId, date);
    setDetailTask(null);
  }}
  onDelete={(taskId) => {
    deleteTask(taskId);
    setDetailTask(null);
  }}
  onSaveNotes={updateTaskNotes}
  onEdit={(task) => {
    setDetailTask(null);
    setEditingTask(task);
  }}
  isCompletedToday={isCompletedToday}
/>
```

- [ ] **Step 6: Commit**

```bash
git add src/screens/patient/TodayScreen.tsx
git commit -m "feat: task rows tappable, opens TaskDetailSheet with full detail"
```

---

## Task 9: Login KeyboardAvoidingView

**Files:**
- Modify: `src/screens/LoginScreen.tsx:213-219`

- [ ] **Step 1: Add KeyboardAvoidingView wrapper**

In `src/screens/LoginScreen.tsx`, add `KeyboardAvoidingView` to imports from `react-native`.

Replace the `SafeAreaView` + `ScrollView` opening tags (around line 213–219):

```typescript
return (
  <SafeAreaView style={styles.safe}>
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
```

And add the closing `</KeyboardAvoidingView>` before `</SafeAreaView>`.

Make sure `Platform` is imported from `"react-native"` (it likely already is).

- [ ] **Step 2: Commit**

```bash
git add src/screens/LoginScreen.tsx
git commit -m "fix: login form stays visible when keyboard opens"
```

---

## Task 10: Center Help FAB in tab bar

**Files:**
- Modify: `src/navigation/PatientTabNavigator.tsx:95-123`

- [ ] **Step 1: Reorder tabs to 5-slot layout**

Replace the `Tab.Navigator` children in `PatientTabNavigator.tsx` (lines 95–124):

```typescript
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: colors.violet,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabel: ({ color }) => (
          route.name === "_blank" ? null : (
            <Text style={[styles.tabLabel, { color }]}>
              {route.name}
            </Text>
          )
        ),
        tabBarIcon: ({ color }) => (
          route.name === "_blank" ? null : (
            <Ionicons name={iconNames[route.name]} size={28} color={color} />
          )
        ),
      })}
    >
      <Tab.Screen name="Home" component={TodayScreen} />
      <Tab.Screen name="Faces" component={FacesScreen} />
      <Tab.Screen
        name="Help"
        options={{
          tabBarButton: (props) => (
            <View style={styles.fabWrapper}>
              <TouchableOpacity onPress={props.onPress} style={styles.fabButton}>
                <LinearGradient
                  colors={["#D95F5F", "#E87878"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.fabGradient}
                >
                  <Ionicons name="hand-left" size={28} color="#FFFFFF" />
                </LinearGradient>
              </TouchableOpacity>
              <Text style={[styles.fabLabel, { color: props.accessibilityState?.selected ? colors.coral : colors.muted }]}>
                Help
              </Text>
            </View>
          ),
        }}
      >
        {() => <HelpScreen patientName={patientName} />}
      </Tab.Screen>
      <Tab.Screen name="Health" component={HealthScreen} />
      <Tab.Screen
        name="_blank"
        component={TodayScreen}
        options={{
          tabBarButton: () => null,
        }}
      />
    </Tab.Navigator>
```

Also update `iconNames` to include `"_blank"` guard (or just handle it in the screenOptions as shown above with the `route.name === "_blank"` check).

- [ ] **Step 2: Commit**

```bash
git add src/navigation/PatientTabNavigator.tsx
git commit -m "fix: center Help FAB with 5-slot tab bar layout"
```

---

## Task 11: Skip caregiver onboarding if patient already linked

**Files:**
- Modify: `src/navigation/RootNavigator.tsx:456-458`

- [ ] **Step 1: Update the onboarding gate in CaregiverView**

In `src/navigation/RootNavigator.tsx`, find this block (line ~456):

```typescript
  if (onboardingReady && !onboardingCompleted) {
    return <OnboardingNavigator />;
  }
```

Replace it with:

```typescript
  if (onboardingReady && !onboardingCompleted && !user.patient_id) {
    return <OnboardingNavigator />;
  }
```

This skips the wizard for caregivers who already have a patient linked, regardless of whether `completedAt` was ever set in the database.

- [ ] **Step 2: Commit**

```bash
git add src/navigation/RootNavigator.tsx
git commit -m "fix: skip caregiver onboarding wizard if patient already linked"
```

---

## Self-Review

**Spec coverage:**
- ✅ Health Screen Apple Health-style: Tasks 5–6
- ✅ 1d range default: Task 1 (backend), Task 4 (hook default `"1d"`), Task 5 (card default `"1d"`)
- ✅ Historical HealthKit sync 30d: Task 3
- ✅ Task detail bottom sheet: Tasks 7–8
- ✅ Login keyboard: Task 9
- ✅ Help FAB centering: Task 10
- ✅ Caregiver onboarding gate: Task 11
- ✅ Notes field: Task 2 (backend schema + type)

**No placeholders found.**

**Type consistency:**
- `Range` type updated in `RangeToggle.tsx` → used in `useMetricTrend.ts` (import from `RangeToggle`) ✅
- `RoutineTask.notes` added in `types/index.ts` → used in `TaskDetailSheet.tsx` ✅
- `useMetricTrend` returns `{ points, loading }` → consumed in `ExpandableMetricCard` ✅
- `ExpandableMetricCard` props match `HealthScreen` usage ✅
