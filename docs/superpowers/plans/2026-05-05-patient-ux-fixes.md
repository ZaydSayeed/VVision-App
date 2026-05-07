# Patient UX Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix task/checkbox interaction on the home screen, add a Routine tab, and redesign the home screen cards to be two full-width stacked cards instead of side-by-side small boxes.

**Architecture:** Three isolated changes to patient-facing screens. Task 1 fixes the broken touch targets in TodayScreen. Task 2 wires the new Routine tab in PatientTabNavigator and creates the screen file. Tasks 3 and 4 replace the split-column home layout with two full-width stacked cards.

**Tech Stack:** React Native, Expo, `@react-navigation/bottom-tabs` v7, `@expo/vector-icons` (Ionicons), existing hooks (`useRoutine`, `useMeds`), existing components (`TaskDetailSheet`, `TimeSlider`).

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/screens/patient/TodayScreen.tsx` | Modify | Fix task/med row touch targets (Task 1) + replace splitRow layout (Task 4) |
| `src/navigation/PatientTabNavigator.tsx` | Modify | Replace `_blank` with real Routine tab (Task 2) |
| `src/screens/patient/RoutineScreen.tsx` | Create | New standalone tasks + meds screen (Task 3) |

---

### Task 1: Fix task row and med row touch targets in TodayScreen

**Files:**
- Modify: `src/screens/patient/TodayScreen.tsx:786-847`

The med row (lines 786–799) is one `TouchableOpacity` that calls `toggleTaken` when tapped anywhere — checkbox works but label tapping toggles instead of doing nothing (meds have no detail sheet, so this is acceptable but inconsistent with spec).

The task/reminder row (lines 834–846) is one `TouchableOpacity` that opens `setDetailTask` — tapping the checkbox View also opens the detail sheet instead of toggling completion. This is the bug.

Fix: split both rows into `View` + two inner `TouchableOpacity` elements.

- [ ] **Step 1: Fix the med row**

Replace lines 786–799 in `src/screens/patient/TodayScreen.tsx`. Find this block:

```tsx
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
```

Replace with:

```tsx
<View key={med.id} style={styles.splitItem}>
  <TouchableOpacity onPress={() => toggleTaken(med.id)} activeOpacity={0.75} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
    <View style={[styles.splitCheckbox, { backgroundColor: taken ? colors.amber : "transparent", borderWidth: taken ? 0 : 1.5, borderColor: colors.amber }]}>
      {taken && <Ionicons name="checkmark" size={12} color="#fff" />}
    </View>
  </TouchableOpacity>
  <Text style={[styles.splitItemText, taken && styles.splitItemDone]} numberOfLines={2}>
    {med.name}
  </Text>
</View>
```

- [ ] **Step 2: Fix the task/reminder row**

Find the task map block (lines 833–847):

```tsx
.map((item) => (
  <TouchableOpacity
    key={item.id}
    style={styles.splitItem}
    onPress={() => item.type === "task" && item.task ? setDetailTask(item.task) : undefined}
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
```

Replace with:

```tsx
.map((item) => (
  <View key={item.id} style={styles.splitItem}>
    <TouchableOpacity
      onPress={() => {
        if (item.type === "task") toggleComplete(item.id);
      }}
      activeOpacity={0.75}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
    >
      <View style={[styles.splitCheckbox, { backgroundColor: item.done ? colors.sage : "transparent", borderWidth: item.done ? 0 : 1.5, borderColor: colors.sage }]}>
        {item.done && <Ionicons name="checkmark" size={12} color="#fff" />}
      </View>
    </TouchableOpacity>
    <TouchableOpacity
      style={{ flex: 1 }}
      onPress={() => item.type === "task" && item.task ? setDetailTask(item.task) : undefined}
      activeOpacity={item.type === "task" ? 0.6 : 1}
    >
      <Text style={[styles.splitItemText, item.done && styles.splitItemDone]} numberOfLines={2}>
        {item.label}
      </Text>
    </TouchableOpacity>
  </View>
))
```

- [ ] **Step 3: Verify the app renders without error**

Run: `npx expo start` and open on device. Tap a task checkbox — it should toggle without opening the detail sheet. Tap the task label — it should open TaskDetailSheet. Tap a med checkbox — it should toggle. Confirm no crash.

- [ ] **Step 4: Commit**

```bash
git add src/screens/patient/TodayScreen.tsx
git commit -m "fix: split task/med rows into separate checkbox + label touch targets"
```

---

### Task 2: Add Routine tab to PatientTabNavigator

**Files:**
- Modify: `src/navigation/PatientTabNavigator.tsx`

Current state: 5 tabs — Home, Faces, Help (FAB), Health, `_blank` (hidden via `tabBarButton: () => null`).
New state: Home, Faces, Help (FAB), Routine, Health. The `_blank` tab is removed. The `Routine: "list-outline"` entry is added to `iconNames`. The import for `RoutineScreen` is added (file created in Task 3 — add the import now and the file will exist when Task 3 runs).

- [ ] **Step 1: Update PatientTabNavigator.tsx**

Replace the entire file content:

```tsx
import React, { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { TodayScreen } from "../screens/patient/TodayScreen";
import { FacesScreen } from "../screens/patient/FacesScreen";
import { HelpScreen } from "../screens/patient/HelpScreen";
import { HealthScreen } from "../screens/patient/HealthScreen";
import { RoutineScreen } from "../screens/patient/RoutineScreen";
import { fonts } from "../config/theme";
import { useTheme } from "../context/ThemeContext";

interface PatientTabNavigatorProps {
  patientName: string;
}

const Tab = createBottomTabNavigator();

const iconNames: Record<string, keyof typeof Ionicons.glyphMap> = {
  Home: "home",
  Faces: "people",
  Help: "hand-left",
  Routine: "list-outline",
  Health: "pulse",
};

export function PatientTabNavigator({ patientName }: PatientTabNavigatorProps) {
  const { colors } = useTheme();

  const styles = useMemo(() => StyleSheet.create({
    tabBar: {
      backgroundColor: colors.warm,
      borderTopWidth: 0,
      height: 88,
      paddingTop: 8,
      paddingBottom: 22,
      shadowColor: colors.coral,
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 8,
    },
    tabLabel: {
      fontSize: 13,
      ...fonts.medium,
    },
    fabWrapper: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    fabButton: {
      top: -20,
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: colors.coral,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.45,
      shadowRadius: 14,
      elevation: 10,
      overflow: "hidden",
    },
    fabGradient: {
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems: "center",
      justifyContent: "center",
    },
    fabLabel: {
      fontSize: 13,
      ...fonts.medium,
      marginTop: 2,
    },
  }), [colors]);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: colors.violet,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabel: ({ color }) => (
          <Text style={[styles.tabLabel, { color }]}>{route.name}</Text>
        ),
        tabBarIcon: ({ color }) => (
          <Ionicons name={iconNames[route.name]} size={28} color={color} />
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
      <Tab.Screen name="Routine" component={RoutineScreen} />
      <Tab.Screen name="Health" component={HealthScreen} />
    </Tab.Navigator>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/navigation/PatientTabNavigator.tsx
git commit -m "feat: replace blank tab with Routine tab in patient nav"
```

---

### Task 3: Create RoutineScreen

**Files:**
- Create: `src/screens/patient/RoutineScreen.tsx`

This screen shows tasks and meds in a single scrollable list. It reuses `useRoutine`, `useMeds`, `TaskDetailSheet`, and the same add-task / add-med modal pattern from TodayScreen. Reminders are not shown here.

- [ ] **Step 1: Create `src/screens/patient/RoutineScreen.tsx`**

```tsx
import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  Modal,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PanGestureHandler, State } from "react-native-gesture-handler";
import { RoutineTask } from "../../types";
import { updateRoutine, authHeaders } from "../../api/client";
import { API_BASE_URL } from "../../config/api";
import { useRoutine } from "../../hooks/useRoutine";
import { useMeds } from "../../hooks/useMeds";
import { TaskDetailSheet } from "../../components/patient/TaskDetailSheet";
import { TimeSlider } from "../../components/shared/TimeSlider";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fonts, spacing, radius } from "../../config/theme";

export function RoutineScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const patientId = user?.patient_id ?? undefined;

  const { tasks, addTask, toggleComplete, deleteTask, isCompletedToday, loadError: routineError, reload: reloadRoutine } = useRoutine(patientId);
  const { meds, addMed, editMed, toggleTaken, deleteMed, isTakenToday, loadError: medsError, reload: reloadMeds } = useMeds(patientId);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([reloadRoutine(), reloadMeds()]);
    setRefreshing(false);
  }, [reloadRoutine, reloadMeds]);

  // ── Modal slide animations ──────────────────────────────────
  const taskModalY = useRef(new Animated.Value(0)).current;
  const taskModalBaseY = useRef(0);
  const medModalY = useRef(new Animated.Value(0)).current;
  const medModalBaseY = useRef(0);

  function slideModalIn(anim: Animated.Value, baseRef: { current: number }) {
    baseRef.current = 0;
    anim.setValue(600);
    Animated.spring(anim, { toValue: 0, useNativeDriver: true, bounciness: 0, speed: 20 }).start();
  }
  function slideModalOut(anim: Animated.Value, baseRef: { current: number }, onDone: () => void) {
    Animated.timing(anim, { toValue: 600, duration: 220, useNativeDriver: true }).start(onDone);
  }

  // ── Add Task modal ──────────────────────────────────────────
  const [showTaskModal, setShowTaskModal] = useState(false);
  useEffect(() => { if (showTaskModal) slideModalIn(taskModalY, taskModalBaseY); }, [showTaskModal]);
  const [taskLabel, setTaskLabel] = useState("");
  const [taskTime, setTaskTime] = useState("");
  const [taskError, setTaskError] = useState("");

  async function handleAddTask() {
    if (!taskLabel.trim() || !taskTime.trim()) { setTaskError("Please fill in both fields."); return; }
    setTaskError("");
    try {
      await addTask(taskLabel.trim(), taskTime.trim());
      setTaskLabel(""); setTaskTime(""); setShowTaskModal(false);
    } catch {
      setTaskError("Could not save. Check your connection.");
    }
  }

  // ── Task detail sheet ───────────────────────────────────────
  const [detailTask, setDetailTask] = useState<RoutineTask | null>(null);

  const updateTaskNotes = async (taskId: string, notes: string) => {
    await fetch(`${API_BASE_URL}/api/routines/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ notes }),
    });
    reloadRoutine();
  };

  const [editingTask, setEditingTask] = useState<RoutineTask | null>(null);
  const editModalY = useRef(new Animated.Value(0)).current;
  const editModalBaseY = useRef(0);
  const [editLabel, setEditLabel] = useState("");
  const [editTime, setEditTime] = useState("");
  const [editError, setEditError] = useState("");

  useEffect(() => {
    if (editingTask) {
      setEditLabel(editingTask.label);
      setEditTime(editingTask.time ?? "");
      slideModalIn(editModalY, editModalBaseY);
    }
  }, [editingTask]);

  async function handleEditTask() {
    if (!editLabel.trim() || !editTime.trim()) { setEditError("Please fill in both fields."); return; }
    setEditError("");
    try {
      await updateRoutine(editingTask!.id, { label: editLabel.trim(), time: editTime.trim() });
      setEditingTask(null);
      reloadRoutine();
    } catch {
      setEditError("Could not save. Check your connection.");
    }
  }

  // ── Add Med modal ───────────────────────────────────────────
  const [showMedModal, setShowMedModal] = useState(false);
  useEffect(() => { if (showMedModal) slideModalIn(medModalY, medModalBaseY); }, [showMedModal]);
  const [medName, setMedName] = useState("");
  const [medDosage, setMedDosage] = useState("");
  const [medTime, setMedTime] = useState("");
  const [medError, setMedError] = useState("");

  async function handleAddMed() {
    if (!medName.trim() || !medDosage.trim() || !medTime.trim()) { setMedError("Please fill in all fields."); return; }
    setMedError("");
    try {
      await addMed(medName.trim(), medDosage.trim(), medTime.trim());
      setMedName(""); setMedDosage(""); setMedTime(""); setShowMedModal(false);
    } catch {
      setMedError("Could not save. Check your connection.");
    }
  }

  const tasksDone = tasks.filter(isCompletedToday).length;
  const medsDone = meds.filter(isTakenToday).length;

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.warm },
    header: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.lg + insets.top,
      paddingBottom: spacing.lg,
    },
    title: { fontSize: 28, color: colors.text, ...fonts.medium },

    card: {
      marginHorizontal: spacing.xl,
      marginBottom: spacing.lg,
      backgroundColor: colors.bg,
      borderRadius: radius.xl,
      padding: spacing.lg,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
    cardAccentLeft: {
      position: "absolute",
      left: 0,
      top: 0,
      bottom: 0,
      width: 4,
      borderTopLeftRadius: radius.xl,
      borderBottomLeftRadius: radius.xl,
    },
    cardHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: spacing.sm,
    },
    cardTitle: {
      fontSize: 10,
      ...fonts.medium,
      letterSpacing: 1.2,
      textTransform: "uppercase",
    },
    pill: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: radius.pill,
    },
    pillText: { fontSize: 11, ...fonts.medium },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingVertical: 6,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 5,
      alignItems: "center",
      justifyContent: "center",
    },
    itemLabel: { fontSize: 14, color: colors.text, ...fonts.regular, flex: 1 },
    itemLabelDone: { color: colors.muted, textDecorationLine: "line-through" },
    progressTrack: {
      height: 5,
      borderRadius: 3,
      backgroundColor: colors.surface,
      marginTop: spacing.sm,
    },
    progressFill: { height: 5, borderRadius: 3 },
    progressText: { fontSize: 10, color: colors.muted, ...fonts.regular, marginTop: 3 },
    addBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      marginTop: spacing.sm,
      alignSelf: "flex-start",
    },
    addBtnText: { fontSize: 13, ...fonts.medium },
    emptyText: { fontSize: 13, color: colors.muted, ...fonts.regular },
    errorText: { fontSize: 13, color: colors.coral, ...fonts.regular, textAlign: "center", marginTop: spacing.lg },

    // modal
    modalOverlay: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: "rgba(0,0,0,0.35)",
    },
    modalSheet: {
      backgroundColor: colors.bg,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      padding: spacing.xl,
      paddingBottom: spacing.xl + insets.bottom,
    },
    modalHandle: {
      width: 40, height: 4, borderRadius: 2,
      backgroundColor: colors.border,
      alignSelf: "center",
      marginBottom: spacing.lg,
    },
    modalTitle: { fontSize: 20, color: colors.text, ...fonts.medium, marginBottom: spacing.lg },
    fieldLabel: {
      fontSize: 10, ...fonts.medium,
      color: colors.muted,
      letterSpacing: 1.2,
      textTransform: "uppercase",
      marginBottom: spacing.xs,
      marginTop: spacing.sm,
    },
    input: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      padding: spacing.md,
      fontSize: 15,
      color: colors.text,
      ...fonts.regular,
    },
    modalBtns: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
    btnOutline: {
      flex: 1, padding: spacing.md, borderRadius: radius.md,
      borderWidth: 1.5, borderColor: colors.border,
      alignItems: "center",
    },
    btnOutlineText: { fontSize: 15, color: colors.muted, ...fonts.medium },
    btnPrimary: {
      flex: 1, padding: spacing.md, borderRadius: radius.md,
      backgroundColor: colors.violet, alignItems: "center",
    },
    btnPrimaryText: { fontSize: 15, color: "#fff", ...fonts.medium },
    error: { fontSize: 13, color: colors.coral, ...fonts.regular, marginTop: spacing.xs },
  }), [colors, insets]);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.violet} />}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Routine</Text>
        </View>

        {/* Tasks card */}
        <View style={styles.card}>
          <View style={[styles.cardAccentLeft, { backgroundColor: colors.sage }]} />
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.sage }]}>Tasks</Text>
            <View style={[styles.pill, { backgroundColor: colors.sageSoft }]}>
              <Text style={[styles.pillText, { color: colors.sage }]}>{tasksDone} of {tasks.length} done</Text>
            </View>
          </View>

          {routineError ? (
            <Text style={styles.errorText}>Could not load tasks.</Text>
          ) : tasks.length === 0 ? (
            <Text style={styles.emptyText}>No tasks yet.</Text>
          ) : (
            tasks
              .slice()
              .sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""))
              .map((task) => {
                const done = isCompletedToday(task);
                return (
                  <View key={task.id} style={styles.row}>
                    <TouchableOpacity
                      onPress={() => toggleComplete(task.id)}
                      activeOpacity={0.75}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <View style={[styles.checkbox, { backgroundColor: done ? colors.sage : "transparent", borderWidth: done ? 0 : 1.5, borderColor: colors.sage }]}>
                        {done && <Ionicons name="checkmark" size={13} color="#fff" />}
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity style={{ flex: 1 }} onPress={() => setDetailTask(task)} activeOpacity={0.6}>
                      <Text style={[styles.itemLabel, done && styles.itemLabelDone]}>{task.label}</Text>
                    </TouchableOpacity>
                  </View>
                );
              })
          )}

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, {
              backgroundColor: colors.sage,
              width: tasks.length > 0 ? `${Math.round((tasksDone / tasks.length) * 100)}%` as any : "0%",
            }]} />
          </View>
          <Text style={styles.progressText}>{tasksDone} of {tasks.length} done</Text>

          <TouchableOpacity style={styles.addBtn} onPress={() => setShowTaskModal(true)} activeOpacity={0.7}>
            <Ionicons name="add-circle-outline" size={18} color={colors.sage} />
            <Text style={[styles.addBtnText, { color: colors.sage }]}>Add Task</Text>
          </TouchableOpacity>
        </View>

        {/* Medications card */}
        <View style={styles.card}>
          <View style={[styles.cardAccentLeft, { backgroundColor: colors.amber }]} />
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.amber }]}>Medications</Text>
            <View style={[styles.pill, { backgroundColor: colors.amberSoft }]}>
              <Text style={[styles.pillText, { color: colors.amber }]}>{medsDone} of {meds.length} taken</Text>
            </View>
          </View>

          {medsError ? (
            <Text style={styles.errorText}>Could not load medications.</Text>
          ) : meds.length === 0 ? (
            <Text style={styles.emptyText}>No medications yet.</Text>
          ) : (
            meds
              .slice()
              .sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""))
              .map((med) => {
                const taken = isTakenToday(med);
                return (
                  <View key={med.id} style={styles.row}>
                    <TouchableOpacity
                      onPress={() => toggleTaken(med.id)}
                      activeOpacity={0.75}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <View style={[styles.checkbox, { backgroundColor: taken ? colors.amber : "transparent", borderWidth: taken ? 0 : 1.5, borderColor: colors.amber }]}>
                        {taken && <Ionicons name="checkmark" size={13} color="#fff" />}
                      </View>
                    </TouchableOpacity>
                    <Text style={[styles.itemLabel, taken && styles.itemLabelDone]}>{med.name}</Text>
                  </View>
                );
              })
          )}

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, {
              backgroundColor: colors.amber,
              width: meds.length > 0 ? `${Math.round((medsDone / meds.length) * 100)}%` as any : "0%",
            }]} />
          </View>
          <Text style={styles.progressText}>{medsDone} of {meds.length} taken</Text>

          <TouchableOpacity style={styles.addBtn} onPress={() => setShowMedModal(true)} activeOpacity={0.7}>
            <Ionicons name="add-circle-outline" size={18} color={colors.amber} />
            <Text style={[styles.addBtnText, { color: colors.amber }]}>Add Medication</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ── Task detail sheet ─────────────────────────────────── */}
      <TaskDetailSheet
        task={detailTask}
        onClose={() => setDetailTask(null)}
        onComplete={(taskId) => { toggleComplete(taskId); setDetailTask(null); }}
        onDelete={(taskId) => { deleteTask(taskId); setDetailTask(null); }}
        onSaveNotes={updateTaskNotes}
        onEdit={(task) => { setDetailTask(null); setEditingTask(task); }}
      />

      {/* ── Add Task modal ─────────────────────────────────────── */}
      <Modal visible={showTaskModal} transparent animationType="none">
        <KeyboardAvoidingView style={[styles.modalOverlay, { paddingTop: insets.top }]} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <PanGestureHandler
            onGestureEvent={({ nativeEvent }) => {
              taskModalY.setValue(Math.max(0, taskModalBaseY.current + nativeEvent.translationY));
            }}
            onHandlerStateChange={({ nativeEvent }) => {
              if (nativeEvent.state !== State.END) return;
              nativeEvent.translationY > 80
                ? slideModalOut(taskModalY, taskModalBaseY, () => { setShowTaskModal(false); setTaskError(""); })
                : Animated.spring(taskModalY, { toValue: 0, useNativeDriver: true, bounciness: 0, speed: 20 }).start();
            }}
          >
            <Animated.View style={[styles.modalSheet, { transform: [{ translateY: taskModalY }] }]}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>Add a Task</Text>
              <Text style={styles.fieldLabel}>WHAT DO I NEED TO DO?</Text>
              <TextInput style={styles.input} value={taskLabel} onChangeText={setTaskLabel} placeholder="e.g. Morning walk" placeholderTextColor={colors.muted} autoFocus />
              <Text style={styles.fieldLabel}>TIME</Text>
              <TimeSlider value={taskTime} onChange={setTaskTime} />
              {taskError ? <Text style={styles.error}>{taskError}</Text> : null}
              <View style={styles.modalBtns}>
                <TouchableOpacity style={styles.btnOutline} onPress={() => { setShowTaskModal(false); setTaskError(""); }}>
                  <Text style={styles.btnOutlineText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnPrimary} onPress={handleAddTask}>
                  <Text style={styles.btnPrimaryText}>Add</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </PanGestureHandler>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Edit Task modal ───────────────────────────────────── */}
      <Modal visible={editingTask !== null} transparent animationType="none">
        <KeyboardAvoidingView style={[styles.modalOverlay, { paddingTop: insets.top }]} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <PanGestureHandler
            onGestureEvent={({ nativeEvent }) => {
              editModalY.setValue(Math.max(0, editModalBaseY.current + nativeEvent.translationY));
            }}
            onHandlerStateChange={({ nativeEvent }) => {
              if (nativeEvent.state !== State.END) return;
              nativeEvent.translationY > 80
                ? slideModalOut(editModalY, editModalBaseY, () => { setEditingTask(null); setEditError(""); })
                : Animated.spring(editModalY, { toValue: 0, useNativeDriver: true, bounciness: 0, speed: 20 }).start();
            }}
          >
            <Animated.View style={[styles.modalSheet, { transform: [{ translateY: editModalY }] }]}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>Edit Task</Text>
              <Text style={styles.fieldLabel}>WHAT DO I NEED TO DO?</Text>
              <TextInput style={styles.input} value={editLabel} onChangeText={setEditLabel} placeholder="e.g. Morning walk" placeholderTextColor={colors.muted} autoFocus />
              <Text style={styles.fieldLabel}>TIME</Text>
              <TimeSlider value={editTime} onChange={setEditTime} />
              {editError ? <Text style={styles.error}>{editError}</Text> : null}
              <View style={styles.modalBtns}>
                <TouchableOpacity style={styles.btnOutline} onPress={() => { setEditingTask(null); setEditError(""); }}>
                  <Text style={styles.btnOutlineText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnPrimary} onPress={handleEditTask}>
                  <Text style={styles.btnPrimaryText}>Save</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </PanGestureHandler>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Add Med modal ─────────────────────────────────────── */}
      <Modal visible={showMedModal} transparent animationType="none">
        <KeyboardAvoidingView style={[styles.modalOverlay, { paddingTop: insets.top }]} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <PanGestureHandler
            onGestureEvent={({ nativeEvent }) => {
              medModalY.setValue(Math.max(0, medModalBaseY.current + nativeEvent.translationY));
            }}
            onHandlerStateChange={({ nativeEvent }) => {
              if (nativeEvent.state !== State.END) return;
              nativeEvent.translationY > 80
                ? slideModalOut(medModalY, medModalBaseY, () => { setShowMedModal(false); setMedError(""); })
                : Animated.spring(medModalY, { toValue: 0, useNativeDriver: true, bounciness: 0, speed: 20 }).start();
            }}
          >
            <Animated.View style={[styles.modalSheet, { transform: [{ translateY: medModalY }] }]}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>Add a Medication</Text>
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>NAME</Text>
                  <TextInput style={styles.input} value={medName} onChangeText={setMedName} placeholder="e.g. Donepezil" placeholderTextColor={colors.muted} autoFocus />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>DOSAGE</Text>
                  <TextInput style={styles.input} value={medDosage} onChangeText={setMedDosage} placeholder="e.g. 1 tablet" placeholderTextColor={colors.muted} />
                </View>
              </View>
              <Text style={styles.fieldLabel}>TIME</Text>
              <TimeSlider value={medTime} onChange={setMedTime} />
              {medError ? <Text style={styles.error}>{medError}</Text> : null}
              <View style={styles.modalBtns}>
                <TouchableOpacity style={styles.btnOutline} onPress={() => { setShowMedModal(false); setMedError(""); }}>
                  <Text style={styles.btnOutlineText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnPrimary} onPress={handleAddMed}>
                  <Text style={styles.btnPrimaryText}>Add</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </PanGestureHandler>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors for RoutineScreen.tsx or PatientTabNavigator.tsx.

- [ ] **Step 3: Open app and verify Routine tab appears**

Tap Routine tab — should see Tasks section and Medications section. Add a task, check it off. Add a med, check it off. Tapping a task label opens TaskDetailSheet.

- [ ] **Step 4: Commit**

```bash
git add src/screens/patient/RoutineScreen.tsx
git commit -m "feat: add RoutineScreen with tasks and meds sections"
```

---

### Task 4: Redesign home cards in TodayScreen — two full-width stacked cards

**Files:**
- Modify: `src/screens/patient/TodayScreen.tsx`

Replace the `splitRow` / `splitCard` side-by-side layout with two full-width stacked cards. The meds card goes first (above), the tasks card goes below — matching the left→right order (meds left, tasks right) becoming top→bottom. Both cards grow with content, no fixed height.

Also remove the now-unused split styles and add new card styles.

- [ ] **Step 1: Replace the split section JSX (lines 773–876)**

Find this entire block (from the comment through the closing View):

```tsx
        {/* ── Split Columns ─────────────────────────────────── */}
        <View style={styles.splitRow}>

          {/* Medications */}
          <View style={styles.splitCard}>
```

...through...

```tsx
        </View>

      </ScrollView>
```

Replace the split section (lines 773–876, everything from `{/* ── Split Columns */}` through the closing `</View>` before `</ScrollView>`) with:

```tsx
        {/* ── Medications card ──────────────────────────────── */}
        <View style={styles.fullCard}>
          <View style={[styles.fullCardAccent, { backgroundColor: colors.amber }]} />
          <View style={styles.fullCardHeader}>
            <Text style={[styles.fullCardTitle, { color: colors.amber }]}>Medications</Text>
            <View style={[styles.fullCardPill, { backgroundColor: colors.amberSoft }]}>
              <Text style={[styles.fullCardPillText, { color: colors.amber }]}>{medsDone} of {meds.length} taken</Text>
            </View>
            <TouchableOpacity
              style={[styles.fullCardPlusBtn, { backgroundColor: colors.amber }]}
              onPress={() => setShowMedModal(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.fullCardPlusBtnText}>+</Text>
            </TouchableOpacity>
          </View>

          {meds.length === 0 ? (
            <Text style={styles.fullCardEmpty}>No meds added yet.</Text>
          ) : (
            meds
              .slice()
              .sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""))
              .map((med) => {
                const taken = isTakenToday(med);
                return (
                  <View key={med.id} style={styles.fullCardItem}>
                    <TouchableOpacity
                      onPress={() => toggleTaken(med.id)}
                      activeOpacity={0.75}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <View style={[styles.fullCardCheckbox, { backgroundColor: taken ? colors.amber : "transparent", borderWidth: taken ? 0 : 1.5, borderColor: colors.amber }]}>
                        {taken && <Ionicons name="checkmark" size={13} color="#fff" />}
                      </View>
                    </TouchableOpacity>
                    <Text style={[styles.fullCardItemText, taken && styles.fullCardItemDone]} numberOfLines={2}>
                      {med.name}
                    </Text>
                  </View>
                );
              })
          )}

          <View style={styles.fullCardProgressTrack}>
            <View style={[styles.fullCardProgressFill, {
              backgroundColor: colors.amber,
              width: meds.length > 0 ? `${Math.round((medsDone / meds.length) * 100)}%` as any : "0%",
            }]} />
          </View>
          <Text style={styles.fullCardProgressText}>{medsDone} of {meds.length} taken</Text>
        </View>

        {/* ── Tasks card ────────────────────────────────────── */}
        <View style={styles.fullCard}>
          <View style={[styles.fullCardAccent, { backgroundColor: colors.sage }]} />
          <View style={styles.fullCardHeader}>
            <Text style={[styles.fullCardTitle, { color: colors.sage }]}>Tasks</Text>
            {(() => {
              const allItems = tasks.length + reminders.length;
              const doneItems = tasks.filter(isCompletedToday).length + reminders.filter((r) => !!r.completed_date).length;
              return (
                <View style={[styles.fullCardPill, { backgroundColor: colors.sageSoft }]}>
                  <Text style={[styles.fullCardPillText, { color: colors.sage }]}>{doneItems} of {allItems} done</Text>
                </View>
              );
            })()}
            <TouchableOpacity
              style={[styles.fullCardPlusBtn, { backgroundColor: colors.sage }]}
              onPress={() => setShowTaskModal(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.fullCardPlusBtnText}>+</Text>
            </TouchableOpacity>
          </View>

          {tasks.length === 0 && reminders.length === 0 ? (
            <Text style={styles.fullCardEmpty}>No tasks yet.</Text>
          ) : (
            [...tasks.map((t) => ({ id: t.id, label: t.label, time: t.time, done: isCompletedToday(t), type: "task" as const, task: t })),
             ...reminders.map((r) => ({ id: r.id, label: r.text, time: r.time ?? "", done: !!r.completed_date, type: "reminder" as const, task: null as RoutineTask | null }))]
              .sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""))
              .map((item) => (
                <View key={item.id} style={styles.fullCardItem}>
                  <TouchableOpacity
                    onPress={() => { if (item.type === "task") toggleComplete(item.id); }}
                    activeOpacity={0.75}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <View style={[styles.fullCardCheckbox, { backgroundColor: item.done ? colors.sage : "transparent", borderWidth: item.done ? 0 : 1.5, borderColor: colors.sage }]}>
                      {item.done && <Ionicons name="checkmark" size={13} color="#fff" />}
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ flex: 1 }}
                    onPress={() => item.type === "task" && item.task ? setDetailTask(item.task) : undefined}
                    activeOpacity={item.type === "task" ? 0.6 : 1}
                  >
                    <Text style={[styles.fullCardItemText, item.done && styles.fullCardItemDone]} numberOfLines={2}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))
          )}

          {(() => {
            const allItems = tasks.length + reminders.length;
            const doneItems = tasks.filter(isCompletedToday).length + reminders.filter((r) => !!r.completed_date).length;
            return (
              <>
                <View style={styles.fullCardProgressTrack}>
                  <View style={[styles.fullCardProgressFill, {
                    backgroundColor: colors.sage,
                    width: allItems > 0 ? `${Math.round((doneItems / allItems) * 100)}%` as any : "0%",
                  }]} />
                </View>
                <Text style={styles.fullCardProgressText}>{doneItems} of {allItems} done</Text>
              </>
            );
          })()}
        </View>
```

- [ ] **Step 2: Replace the split styles with fullCard styles**

In the `styles` useMemo (around lines 375–433), find the section:

```ts
    // ── Split columns ──────────────────────────────────────────
    splitRow: {
      flexDirection: "row",
      marginHorizontal: spacing.xl,
      gap: spacing.md,
      marginBottom: spacing.xl,
    },
    splitCard: {
```

...through...

```ts
    splitPlusBtnText: { color: "#fff", fontSize: 18, lineHeight: 22, fontWeight: "400" as const },
```

Replace the entire split styles block with:

```ts
    // ── Full-width stacked cards ───────────────────────────────
    fullCard: {
      marginHorizontal: spacing.xl,
      marginBottom: spacing.lg,
      backgroundColor: colors.bg,
      borderRadius: radius.xl,
      padding: spacing.lg,
      paddingLeft: spacing.lg + 4,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
    fullCardAccent: {
      position: "absolute",
      left: 0,
      top: 0,
      bottom: 0,
      width: 4,
      borderTopLeftRadius: radius.xl,
      borderBottomLeftRadius: radius.xl,
    },
    fullCardHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    fullCardTitle: {
      fontSize: 10,
      ...fonts.medium,
      letterSpacing: 1.2,
      textTransform: "uppercase",
      marginRight: "auto" as const,
    },
    fullCardPill: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: radius.pill,
    },
    fullCardPillText: { fontSize: 11, ...fonts.medium },
    fullCardPlusBtn: {
      width: 28, height: 28, borderRadius: 14,
      alignItems: "center", justifyContent: "center",
    },
    fullCardPlusBtnText: { color: "#fff", fontSize: 18, lineHeight: 22, fontWeight: "400" as const },
    fullCardItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingVertical: 6,
    },
    fullCardCheckbox: {
      width: 22, height: 22, borderRadius: 5,
      alignItems: "center", justifyContent: "center",
    },
    fullCardItemText: { fontSize: 14, color: colors.text, ...fonts.regular, flex: 1 },
    fullCardItemDone: { color: colors.muted, textDecorationLine: "line-through" },
    fullCardProgressTrack: {
      height: 5, borderRadius: 3,
      backgroundColor: colors.surface,
      marginTop: spacing.sm,
    },
    fullCardProgressFill: { height: 5, borderRadius: 3 },
    fullCardProgressText: { fontSize: 10, color: colors.muted, ...fonts.regular, marginTop: 3 },
    fullCardEmpty: { fontSize: 13, color: colors.muted, ...fonts.regular },
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Open app and verify home screen**

Home screen should show two full-width cards stacked vertically. Medications on top, Tasks below. Each card has a colored left border (amber for meds, sage for tasks). Items show with working checkboxes. Tapping a task label opens the detail sheet. Progress bar shows at bottom of each card. "+" button adds items.

- [ ] **Step 5: Commit**

```bash
git add src/screens/patient/TodayScreen.tsx
git commit -m "feat: replace split-column home layout with two full-width stacked cards"
```
