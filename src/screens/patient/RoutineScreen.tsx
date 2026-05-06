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

function slideModalIn(anim: Animated.Value, baseRef: { current: number }) {
  baseRef.current = 0;
  anim.setValue(600);
  Animated.spring(anim, { toValue: 0, useNativeDriver: true, bounciness: 0, speed: 20 }).start();
}
function slideModalOut(anim: Animated.Value, baseRef: { current: number }, onDone: () => void) {
  Animated.timing(anim, { toValue: 600, duration: 220, useNativeDriver: true }).start(onDone);
}

export function RoutineScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const patientId = user?.patient_id ?? undefined;

  const { tasks, addTask, toggleComplete, deleteTask, isCompletedToday, loadError: routineError, reload: reloadRoutine } = useRoutine(patientId);
  const { meds, addMed, toggleTaken, isTakenToday, loadError: medsError, reload: reloadMeds } = useMeds(patientId);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([reloadRoutine(), reloadMeds()]);
    setRefreshing(false);
  }, [reloadRoutine, reloadMeds]);

  const taskModalY = useRef(new Animated.Value(0)).current;
  const taskModalBaseY = useRef(0);
  const medModalY = useRef(new Animated.Value(0)).current;
  const medModalBaseY = useRef(0);
  const editModalY = useRef(new Animated.Value(0)).current;
  const editModalBaseY = useRef(0);

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
      paddingLeft: spacing.lg + 4,
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
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    cardTitle: {
      fontSize: 10,
      ...fonts.medium,
      letterSpacing: 1.2,
      textTransform: "uppercase",
      marginRight: "auto" as const,
    },
    pill: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: radius.pill,
    },
    pillText: { fontSize: 11, ...fonts.medium },
    plusBtn: {
      width: 28, height: 28, borderRadius: 14,
      alignItems: "center", justifyContent: "center",
    },
    plusBtnText: { color: "#fff", fontSize: 18, lineHeight: 22, fontWeight: "400" as const },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingVertical: 4,
    },
    checkboxBtn: {
      width: 44,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
    },
    checkbox: {
      width: 22, height: 22, borderRadius: 5,
      alignItems: "center", justifyContent: "center",
    },
    itemLabel: { fontSize: 14, color: colors.text, ...fonts.regular, flex: 1 },
    itemLabelDone: { color: colors.muted, textDecorationLine: "line-through" },
    progressTrack: {
      height: 5, borderRadius: 3,
      backgroundColor: colors.surface,
      marginTop: spacing.sm,
    },
    progressFill: { height: 5, borderRadius: 3 },
    progressText: { fontSize: 10, color: colors.muted, ...fonts.regular, marginTop: 3 },
    emptyText: { fontSize: 13, color: colors.muted, ...fonts.regular },
    errorText: { fontSize: 13, color: colors.coral, ...fonts.regular },
    addBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      marginTop: spacing.sm,
      alignSelf: "flex-start",
    },
    addBtnText: { fontSize: 13, ...fonts.medium },
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
            <TouchableOpacity style={[styles.plusBtn, { backgroundColor: colors.sage }]} onPress={() => setShowTaskModal(true)} activeOpacity={0.8}>
              <Text style={styles.plusBtnText}>+</Text>
            </TouchableOpacity>
          </View>

          {routineError ? (
            <Text style={styles.errorText}>Could not load tasks.</Text>
          ) : tasks.length === 0 ? (
            <Text style={styles.emptyText}>No tasks yet.</Text>
          ) : (
            tasks.slice().sort((a, b) => (a.time ?? "").localeCompare(b.time ?? "")).map((task) => {
              const done = isCompletedToday(task);
              return (
                <View key={task.id} style={styles.row}>
                  <TouchableOpacity style={styles.checkboxBtn} onPress={() => toggleComplete(task.id)} activeOpacity={0.75}>
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
            <View style={[styles.progressFill, { backgroundColor: colors.sage, width: tasks.length > 0 ? `${Math.round((tasksDone / tasks.length) * 100)}%` as any : "0%" }]} />
          </View>
          <Text style={styles.progressText}>{tasksDone} of {tasks.length} done</Text>
        </View>

        {/* Medications card */}
        <View style={styles.card}>
          <View style={[styles.cardAccentLeft, { backgroundColor: colors.amber }]} />
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.amber }]}>Medications</Text>
            <View style={[styles.pill, { backgroundColor: colors.amberSoft }]}>
              <Text style={[styles.pillText, { color: colors.amber }]}>{medsDone} of {meds.length} taken</Text>
            </View>
            <TouchableOpacity style={[styles.plusBtn, { backgroundColor: colors.amber }]} onPress={() => setShowMedModal(true)} activeOpacity={0.8}>
              <Text style={styles.plusBtnText}>+</Text>
            </TouchableOpacity>
          </View>

          {medsError ? (
            <Text style={styles.errorText}>Could not load medications.</Text>
          ) : meds.length === 0 ? (
            <Text style={styles.emptyText}>No medications yet.</Text>
          ) : (
            meds.slice().sort((a, b) => (a.time ?? "").localeCompare(b.time ?? "")).map((med) => {
              const taken = isTakenToday(med);
              return (
                <View key={med.id} style={styles.row}>
                  <TouchableOpacity style={styles.checkboxBtn} onPress={() => toggleTaken(med.id)} activeOpacity={0.75}>
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
            <View style={[styles.progressFill, { backgroundColor: colors.amber, width: meds.length > 0 ? `${Math.round((medsDone / meds.length) * 100)}%` as any : "0%" }]} />
          </View>
          <Text style={styles.progressText}>{medsDone} of {meds.length} taken</Text>
        </View>
      </ScrollView>

      <TaskDetailSheet
        task={detailTask}
        onClose={() => setDetailTask(null)}
        onComplete={(taskId) => { toggleComplete(taskId); setDetailTask(null); }}
        onDelete={(taskId) => { deleteTask(taskId); setDetailTask(null); }}
        onSaveNotes={updateTaskNotes}
        onEdit={(task) => { setDetailTask(null); setEditingTask(task); }}
        isCompletedToday={isCompletedToday}
      />

      {/* Add Task modal */}
      <Modal visible={showTaskModal} transparent animationType="none">
        <KeyboardAvoidingView style={[styles.modalOverlay, { paddingTop: insets.top }]} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <PanGestureHandler
            onGestureEvent={({ nativeEvent }) => { taskModalY.setValue(Math.max(0, taskModalBaseY.current + nativeEvent.translationY)); }}
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

      {/* Edit Task modal */}
      <Modal visible={editingTask !== null} transparent animationType="none">
        <KeyboardAvoidingView style={[styles.modalOverlay, { paddingTop: insets.top }]} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <PanGestureHandler
            onGestureEvent={({ nativeEvent }) => { editModalY.setValue(Math.max(0, editModalBaseY.current + nativeEvent.translationY)); }}
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

      {/* Add Med modal */}
      <Modal visible={showMedModal} transparent animationType="none">
        <KeyboardAvoidingView style={[styles.modalOverlay, { paddingTop: insets.top }]} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <PanGestureHandler
            onGestureEvent={({ nativeEvent }) => { medModalY.setValue(Math.max(0, medModalBaseY.current + nativeEvent.translationY)); }}
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
