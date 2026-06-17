import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Animated,
  Pressable,
  Dimensions,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { updateRoutine, authHeaders } from "../../api/client";
import { RoutineTask } from "../../types";
import { API_BASE_URL } from "../../config/api";
import { TaskDetailSheet } from "../../components/patient/TaskDetailSheet";
import { useRoutine } from "../../hooks/useRoutine";
import { useMeds } from "../../hooks/useMeds";
import { useReminders } from "../../hooks/useReminders";
import { useHelpAlert } from "../../hooks/useHelpAlert";
import { useNotes } from "../../hooks/useNotes";
import { NotesHistoryModal } from "../../components/NotesHistoryModal";
import { formatRelativeTime } from "../../hooks/useDashboardData";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { fonts, spacing, radius, shadow } from "../../config/theme";
import { registerReminderReload, registerTaskReload, registerMedReload } from "../../utils/reminderEvents";
import { HeroStatCard } from "../../components/HeroStatCard";
import { getGreeting } from "../../utils/greeting";
import { useClock } from "../../hooks/useClock";
import { MoodCheckIn } from "../../components/patient/MoodCheckIn";
import { NotificationPanel } from "../../components/patient/NotificationPanel";
import { AddTaskModal, EditTaskModal, AddMedModal } from "../../components/patient/TaskMedFormModals";
import { MedicationsCard, TasksCard } from "../../components/patient/TodayListCards";

const SCREEN_W = Dimensions.get("window").width;
const PANEL_WIDTH = Math.min(SCREEN_W * 0.82, 340);

export function TodayScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const patientId = user?.patient_id ?? undefined;
  const { tasks, addTask, toggleComplete, deleteTask, isCompletedToday, loadError: routineError, reload: reloadRoutine } = useRoutine(patientId);
  const { meds, addMed, toggleTaken, isTakenToday, loadError: medsError, reload: reloadMeds } = useMeds(patientId);
  const { alerts } = useHelpAlert();
  const { reminders, deleteReminder, reload: reloadReminders } = useReminders();
  useEffect(() => { registerReminderReload(reloadReminders); }, [reloadReminders]);
  useEffect(() => { registerTaskReload(reloadRoutine); }, [reloadRoutine]);
  useEffect(() => { registerMedReload(reloadMeds); }, [reloadMeds]);
  const { pinnedNote, notes: caregiverNotes, reload: reloadNotes } = useNotes(patientId);
  const [notesModalVisible, setNotesModalVisible] = useState(false);
  const dataError = routineError || medsError;
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([reloadRoutine(), reloadMeds(), reloadReminders(), reloadNotes()]);
    setRefreshing(false);
  }, [reloadRoutine, reloadMeds, reloadReminders, reloadNotes]);

  const clock = useClock();

  const hour = clock.getHours();
  const greeting = getGreeting(hour);
  const firstName = user?.name?.split(" ")[0] ?? "there";

  const routineDone = tasks.filter(isCompletedToday).length;
  const medsDone = meds.filter(isTakenToday).length;
  const pendingTasks = tasks.filter((t) => !isCompletedToday(t));
  const pendingMeds = meds.filter((m) => !isTakenToday(m));
  const totalNotifs = pendingTasks.length + pendingMeds.length;
  const [remindersOn, setRemindersOn] = useState(true);

  // ── Notification panel ──────────────────────────────────────
  const [notifOpen, setNotifOpen] = useState(false);
  const slideAnim = useRef(new Animated.Value(PANEL_WIDTH)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  const openNotifs = () => {
    setNotifOpen(true);
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, friction: 7, tension: 65 }),
      Animated.timing(backdropAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  };
  const closeNotifs = () => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: PANEL_WIDTH, duration: 240, useNativeDriver: true }),
      Animated.timing(backdropAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setNotifOpen(false));
  };

  // ── Add chooser modal ────────────────────────────────────────
  const [showChooser, setShowChooser] = useState(false);

  // ── Add Task modal ───────────────────────────────────────────
  const [showTaskModal, setShowTaskModal] = useState(false);

  const [detailTask, setDetailTask] = useState<RoutineTask | null>(null);

  const updateTaskNotes = async (taskId: string, notes: string) => {
    await fetch(`${API_BASE_URL}/api/routines/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ notes }),
    });
    reloadRoutine();
  };

  // ── Edit Task modal ──────────────────────────────────────
  const [editingTask, setEditingTask] = useState<RoutineTask | null>(null);

  // ── Add Med modal ────────────────────────────────────────────
  const [showMedModal, setShowMedModal] = useState(false);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.warm },

    // ── Greeting header ────────────────────────────────────────
    header: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.lg,
      paddingBottom: spacing.xl,
      backgroundColor: colors.warm,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
    },
    greetingGroup: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      flex: 1,
    },
    buddyEmoji: {
      width: 56,
      height: 56,
      alignItems: "center",
      justifyContent: "center",
    },
    greetingIcon: {
      fontSize: 36,
      marginBottom: 2,
    },
    greetingLineRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: 2,
    },
    greetingLine: {
      fontSize: 17,
      color: colors.muted,
      ...fonts.regular,
    },
    greetingName: {
      fontSize: 36,
      color: colors.text,
      ...fonts.medium,
      lineHeight: 42,
    },
    greetingAccent: {
      color: colors.violet,
    },
    notifBtn: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.warmSurface,
      alignItems: "center",
      justifyContent: "center",
    },
    notifBadge: {
      position: "absolute",
      top: 9,
      right: 9,
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: colors.violet,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 3,
      borderWidth: 1.5,
      borderColor: colors.warm,
    },
    notifBadgeText: { fontSize: 9, color: "#FFFFFF", ...fonts.medium },

    // ── Progress summary ───────────────────────────────────────
    progressBar: {
      marginHorizontal: spacing.xl,
      marginBottom: spacing.xl,
      backgroundColor: colors.warmSurface,
      borderRadius: radius.lg,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
    },
    progressText: {
      fontSize: 15,
      color: colors.subtext,
      ...fonts.regular,
      flex: 1,
    },
    progressBold: {
      color: colors.violet,
      ...fonts.medium,
    },

    // ── Scroll content ─────────────────────────────────────────
    content: { paddingHorizontal: spacing.xl, paddingBottom: 120 },

    // ── Note card ──────────────────────────────────────────────
    noteCard: {
      marginHorizontal: spacing.xl,
      marginBottom: spacing.md,
      backgroundColor: colors.bg,
      borderRadius: radius.xl,
      padding: spacing.lg,
      borderLeftWidth: 4,
      borderLeftColor: colors.violet,
      ...shadow.sm,
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

    // Full-width stacked cards → ./components/patient/TodayListCards

    // ── Chooser sheet ──────────────────────────────────────────
    chooserOverlay: { flex: 1, backgroundColor: "rgba(30,27,58,0.45)", justifyContent: "flex-end" },
    chooserSheet: {
      backgroundColor: colors.bg, borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl,
      padding: spacing.xxl, gap: spacing.md,
    },
    chooserHandle: {
      width: 40, height: 4, borderRadius: radius.pill,
      backgroundColor: colors.border, alignSelf: "center", marginBottom: spacing.lg,
    },
    chooserTitle: { fontSize: 20, color: colors.text, ...fonts.medium, marginBottom: spacing.sm },
    chooserBtn: {
      flexDirection: "row", alignItems: "center", gap: spacing.lg,
      backgroundColor: colors.surface, borderRadius: radius.lg,
      paddingVertical: spacing.lg, paddingHorizontal: spacing.lg,
    },
    chooserBtnIcon: {
      width: 48, height: 48, borderRadius: 24,
      alignItems: "center", justifyContent: "center",
    },
    chooserBtnLabel: { fontSize: 18, color: colors.text, ...fonts.medium },
    chooserBtnSub: { fontSize: 14, color: colors.muted, ...fonts.regular },

    // ── Add modals ─────────────────────────────────────────────
    // Add/Edit task + Add med form modals → ./components/patient/TaskMedFormModals

  }), [colors]);

  return (
    <View style={styles.container}>

      {/* ── Notification panel ──────────────────────────────── */}
      <NotificationPanel
        visible={notifOpen}
        slideAnim={slideAnim}
        backdropAnim={backdropAnim}
        onClose={closeNotifs}
        totalNotifs={totalNotifs}
        pendingTasks={pendingTasks}
        pendingMeds={pendingMeds}
      />

      {/* ── Greeting header ──────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.greetingGroup}>
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={styles.buddyEmoji}
            >
              <Ionicons name="flower-outline" size={44} color={colors.violet} />
            </View>
            <View>
              <View style={styles.greetingLineRow}>
                <Ionicons name={greeting.icon} size={16} color={colors.amber} />
                <Text style={styles.greetingLine}>{greeting.text},</Text>
              </View>
              <Text style={styles.greetingName}>
                <Text style={styles.greetingAccent}>{firstName}</Text>
              </Text>
            </View>
          </View>
          <TouchableOpacity style={styles.notifBtn} onPress={openNotifs} activeOpacity={0.75}>
            <Ionicons name="notifications" size={22} color={colors.violet} />
            {totalNotifs > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>{totalNotifs}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Data error banner ────────────────────────────────── */}
      {dataError ? (
        <View style={{ marginHorizontal: spacing.xl, marginBottom: spacing.sm, backgroundColor: colors.coralSoft, borderRadius: radius.lg, padding: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <Ionicons name="wifi-outline" size={16} color={colors.coral} />
          <Text style={{ fontSize: 13, color: colors.coral, ...fonts.regular, flex: 1 }}>Couldn't load your data. Showing last saved version.</Text>
        </View>
      ) : null}

      {/* ── Main content ─────────────────────────────────────── */}
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.violet} />
        }
      >
        {/* ── Hero progress card ──────────────────────────── */}
        <HeroStatCard
          stats={[
            { label: "Routine", value: `${routineDone} of ${tasks.length}`, iconName: "leaf", iconColor: colors.sage },
            { label: "Meds", value: `${medsDone} of ${meds.length}`, iconName: "medkit", iconColor: colors.amber },
          ]}
          toggle={{
            label: "Reminders on",
            value: remindersOn,
            onChange: setRemindersOn,
            iconName: "notifications-outline",
          }}
          cta={{
            label: "See today's schedule",
            onPress: openNotifs,
          }}
        />

        {/* ── Mood check-in card ────────────────────────────── */}
        <MoodCheckIn user={user} />

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

        {/* ── Medications card ──────────────────────────────── */}
        <MedicationsCard
          meds={meds}
          medsDone={medsDone}
          isTakenToday={isTakenToday}
          onToggleTaken={toggleTaken}
          onAddMed={() => setShowMedModal(true)}
        />

        {/* ── Tasks card ────────────────────────────────────── */}
        <TasksCard
          tasks={tasks}
          reminders={reminders}
          isCompletedToday={isCompletedToday}
          onToggleComplete={toggleComplete}
          onOpenTaskDetail={setDetailTask}
          onDeleteReminder={deleteReminder}
          onAddTask={() => setShowTaskModal(true)}
        />
      </ScrollView>

      {/* ── Chooser sheet ─────────────────────────────────────── */}
      <Modal visible={showChooser} transparent animationType="slide">
        <Pressable style={styles.chooserOverlay} onPress={() => setShowChooser(false)}>
          <Pressable style={styles.chooserSheet} onPress={() => {}}>
            <View style={styles.chooserHandle} />
            <Text style={styles.chooserTitle}>What would you like to add?</Text>
            <TouchableOpacity
              style={styles.chooserBtn}
              onPress={() => { setShowChooser(false); setShowTaskModal(true); }}
              activeOpacity={0.85}
            >
              <View style={[styles.chooserBtnIcon, { backgroundColor: colors.sageSoft }]}>
                <Ionicons name="calendar-clear" size={22} color={colors.sage} />
              </View>
              <View>
                <Text style={styles.chooserBtnLabel}>A routine task</Text>
                <Text style={styles.chooserBtnSub}>Something you do every day</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.chooserBtn}
              onPress={() => { setShowChooser(false); setShowMedModal(true); }}
              activeOpacity={0.85}
            >
              <View style={[styles.chooserBtnIcon, { backgroundColor: colors.amberSoft }]}>
                <Ionicons name="medkit" size={22} color={colors.amber} />
              </View>
              <View>
                <Text style={styles.chooserBtnLabel}>A medication</Text>
                <Text style={styles.chooserBtnSub}>Track your daily medicines</Text>
              </View>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <AddTaskModal
        visible={showTaskModal}
        onClose={() => setShowTaskModal(false)}
        onAdd={addTask}
      />

      <EditTaskModal
        task={editingTask}
        onClose={() => setEditingTask(null)}
        onSave={async (id, patch) => { await updateRoutine(id, patch); reloadRoutine(); }}
      />

      <NotesHistoryModal
        visible={notesModalVisible}
        notes={caregiverNotes}
        onClose={() => setNotesModalVisible(false)}
      />

      <TaskDetailSheet
        task={detailTask}
        onClose={() => setDetailTask(null)}
        onComplete={(taskId) => {
          toggleComplete(taskId);
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

      <AddMedModal
        visible={showMedModal}
        onClose={() => setShowMedModal(false)}
        onAdd={addMed}
      />
    </View>
  );
}
