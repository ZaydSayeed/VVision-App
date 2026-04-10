import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
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
  Pressable,
  Dimensions,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Swipeable, PanGestureHandler, State } from "react-native-gesture-handler";
import { updateRoutine } from "../../api/client";
import { RoutineTask } from "../../types";
import { useRoutine } from "../../hooks/useRoutine";
import { useMeds } from "../../hooks/useMeds";
import { useReminders } from "../../hooks/useReminders";
import { useHelpAlert } from "../../hooks/useHelpAlert";
import { useNotes } from "../../hooks/useNotes";
import { NotesHistoryModal } from "../../components/NotesHistoryModal";
import { formatRelativeTime } from "../../hooks/useDashboardData";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CheckRow } from "../../components/shared/CheckRow";
import { SectionHeader } from "../../components/shared/SectionHeader";
import { TimeSlider } from "../../components/shared/TimeSlider";
import { fonts, spacing, radius, gradients } from "../../config/theme";
import { registerReminderReload } from "../../utils/reminderEvents";

const SCREEN_W = Dimensions.get("window").width;
const SCREEN_H = Dimensions.get("window").height;
const PANEL_WIDTH = Math.min(SCREEN_W * 0.82, 340);

function getGreeting(hour: number): { text: string; icon: keyof typeof Ionicons.glyphMap } {
  if (hour >= 5 && hour < 12) return { text: "Good morning", icon: "sunny" };
  if (hour >= 12 && hour < 17) return { text: "Good afternoon", icon: "partly-sunny" };
  if (hour >= 17 && hour < 21) return { text: "Good evening", icon: "moon" };
  return { text: "Good night", icon: "moon" };
}

export function TodayScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const patientId = user?.patient_id ?? undefined;
  const { tasks, addTask, toggleComplete, deleteTask, isCompletedToday, loadError: routineError, reload: reloadRoutine } = useRoutine(patientId);
  const { meds, addMed, editMed, toggleTaken, deleteMed, isTakenToday, loadError: medsError, reload: reloadMeds } = useMeds(patientId);
  const { alerts } = useHelpAlert();
  const { reminders, deleteReminder, reload: reloadReminders } = useReminders();
  useEffect(() => { registerReminderReload(reloadReminders); }, [reloadReminders]);
  const { pinnedNote, notes: caregiverNotes, reload: reloadNotes } = useNotes(patientId);
  const [notesModalVisible, setNotesModalVisible] = useState(false);
  const dataError = routineError || medsError;
  const [refreshing, setRefreshing] = useState(false);

  // Modal swipe-to-close animations
  const taskModalY = useRef(new Animated.Value(0)).current;
  const editModalY = useRef(new Animated.Value(0)).current;
  const medModalY = useRef(new Animated.Value(0)).current;
  const editMedModalY = useRef(new Animated.Value(0)).current;
  const taskModalBaseY = useRef(0);
  const editModalBaseY = useRef(0);
  const medModalBaseY = useRef(0);
  const editMedModalBaseY = useRef(0);

  function slideModalIn(anim: Animated.Value, baseRef: { current: number }) {
    baseRef.current = 0;
    anim.setValue(600);
    Animated.spring(anim, { toValue: 0, useNativeDriver: true, bounciness: 0, speed: 20 }).start();
  }
  function slideModalOut(anim: Animated.Value, baseRef: { current: number }, onDone: () => void) {
    Animated.timing(anim, { toValue: 600, duration: 220, useNativeDriver: true }).start(onDone);
  }
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([reloadRoutine(), reloadMeds(), reloadReminders(), reloadNotes()]);
    setRefreshing(false);
  }, [reloadRoutine, reloadMeds, reloadReminders, reloadNotes]);

  const [clock, setClock] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const hour = clock.getHours();
  const greeting = getGreeting(hour);
  const firstName = user?.name?.split(" ")[0] ?? "there";
  const dayStr = clock.toLocaleDateString([], { weekday: "long" });
  const dateStr = clock.toLocaleDateString([], { month: "long", day: "numeric" });

  const routineDone = tasks.filter(isCompletedToday).length;
  const medsDone = meds.filter(isTakenToday).length;
  const pendingTasks = tasks.filter((t) => !isCompletedToday(t));
  const pendingMeds = meds.filter((m) => !isTakenToday(m));
  const totalNotifs = pendingTasks.length + pendingMeds.length;

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

  // ── Edit Task modal ──────────────────────────────────────
  const [editingTask, setEditingTask] = useState<RoutineTask | null>(null);
  useEffect(() => { if (editingTask) slideModalIn(editModalY, editModalBaseY); }, [editingTask]);
  const [editLabel, setEditLabel] = useState("");
  const [editTime, setEditTime] = useState("");
  const [editError, setEditError] = useState("");
  const swipeableRefs = useRef<Map<string, Swipeable>>(new Map());

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

  // ── Add Med modal ────────────────────────────────────────────
  const [showMedModal, setShowMedModal] = useState(false);
  useEffect(() => { if (showMedModal) slideModalIn(medModalY, medModalBaseY); }, [showMedModal]);

  // ── Edit Med modal ───────────────────────────────────────────
  const [editingMed, setEditingMed] = useState<import("../../types").Medication | null>(null);
  useEffect(() => { if (editingMed) slideModalIn(editMedModalY, editMedModalBaseY); }, [editingMed]);
  const [editMedName, setEditMedName] = useState("");
  const [editMedDosage, setEditMedDosage] = useState("");
  const [editMedTime, setEditMedTime] = useState("");
  const [editMedError, setEditMedError] = useState("");
  const medSwipeableRefs = useRef<Map<string, import("react-native-gesture-handler").Swipeable>>(new Map());

  async function handleEditMed() {
    if (!editMedName.trim() || !editMedDosage.trim() || !editMedTime.trim()) { setEditMedError("Please fill in all fields."); return; }
    setEditMedError("");
    try {
      await editMed(editingMed!.id, editMedName.trim(), editMedDosage.trim(), editMedTime.trim());
      setEditingMed(null);
    } catch {
      setEditMedError("Could not save. Check your connection.");
    }
  }
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
    dateRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: spacing.md,
      gap: spacing.sm,
    },
    datePill: {
      backgroundColor: colors.warmSurface,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
    },
    datePillText: {
      fontSize: 14,
      color: colors.subtext,
      ...fonts.medium,
    },

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

    section: { marginBottom: spacing.lg },

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
      marginTop: "auto" as const,
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
    splitPlusBtnText: { color: "#fff", fontSize: 18, lineHeight: 22, fontWeight: "400" as const },

    allDoneBanner: {
      borderRadius: radius.xl,
      padding: spacing.lg,
      marginBottom: spacing.md,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      overflow: "hidden",
    },
    bannerText: {
      fontSize: 17,
      color: "#FFFFFF",
      ...fonts.medium,
    },
    bannerSub: {
      fontSize: 14,
      color: "rgba(255,255,255,0.85)",
      ...fonts.regular,
    },

    emptyCTA: {
      alignItems: "center",
      paddingVertical: spacing.xxl,
      gap: spacing.sm,
    },
    emptyBtn: {
      width: 72,
      height: 72,
      borderRadius: 36,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.xs,
    },
    emptyTitle: {
      fontSize: 18,
      color: colors.text,
      ...fonts.medium,
    },
    emptySub: {
      fontSize: 15,
      color: colors.muted,
      ...fonts.regular,
      textAlign: "center",
      lineHeight: 22,
    },

    // ── FAB ────────────────────────────────────────────────────
    fab: {
      position: "absolute",
      bottom: 32,
      right: 24,
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: colors.violet,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: colors.violet,
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.4,
      shadowRadius: 12,
      elevation: 8,
    },

    // ── Notification panel ─────────────────────────────────────
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(11,7,30,0.38)" },
    panelWrapper: {
      position: "absolute", top: 0, right: 0, bottom: 0, width: PANEL_WIDTH,
      shadowColor: "#000", shadowOffset: { width: -6, height: 0 },
      shadowOpacity: 0.14, shadowRadius: 20, elevation: 16,
    },
    panel: { flex: 1, backgroundColor: colors.bg, overflow: "hidden" },
    panelTopGradient: { paddingTop: 48, paddingHorizontal: 24, paddingBottom: 20 },
    panelHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    panelTitle: { fontSize: 24, color: colors.text, ...fonts.medium, letterSpacing: -0.3 },
    panelSubtitle: { fontSize: 13, color: colors.muted, ...fonts.regular, marginTop: 4 },
    panelClose: {
      width: 38, height: 38, borderRadius: 19,
      backgroundColor: colors.violet50, alignItems: "center", justifyContent: "center",
    },
    panelBody: { flex: 1, paddingHorizontal: 24 },
    panelSectionLabel: {
      fontSize: 10, color: colors.violet, ...fonts.medium,
      textTransform: "uppercase", letterSpacing: 1.6,
      marginBottom: 10, marginTop: 20, paddingLeft: 10,
      borderLeftWidth: 2, borderLeftColor: colors.violet,
    },
    notifRow: {
      flexDirection: "row", alignItems: "center", backgroundColor: colors.bg,
      borderRadius: 16, paddingVertical: 14, paddingHorizontal: 14,
      marginBottom: 8, gap: 14,
      borderWidth: 1, borderColor: "rgba(123,92,231,0.08)",
      shadowColor: "#7B5CE7", shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.07, shadowRadius: 10, elevation: 2,
    },
    notifIconCircle: {
      width: 44, height: 44, borderRadius: 22,
      backgroundColor: colors.violet50, alignItems: "center", justifyContent: "center",
    },
    notifRowBody: { flex: 1 },
    notifRowLabel: { fontSize: 15, color: colors.text, ...fonts.medium, lineHeight: 20 },
    notifRowSub: { fontSize: 12, color: colors.muted, ...fonts.regular, marginTop: 3 },
    sectionDivider: { height: 1, backgroundColor: "rgba(123,92,231,0.07)", marginTop: 8 },
    emptyNotif: { alignItems: "center", paddingTop: 48, paddingBottom: 32, gap: 12 },
    emptyIconRing: {
      width: 80, height: 80, borderRadius: 40,
      backgroundColor: colors.violet50, alignItems: "center", justifyContent: "center", marginBottom: 4,
    },
    emptyNotifTitle: { fontSize: 17, color: colors.text, ...fonts.medium },
    emptyNotifText: { fontSize: 13, color: colors.muted, ...fonts.regular, textAlign: "center", lineHeight: 18 },

    // ── Chooser sheet ──────────────────────────────────────────
    chooserOverlay: { flex: 1, backgroundColor: "rgba(30,27,58,0.45)", justifyContent: "flex-end" },
    chooserSheet: {
      backgroundColor: colors.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28,
      padding: spacing.xxl, gap: spacing.md,
    },
    chooserHandle: {
      width: 40, height: 4, borderRadius: 2,
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
    modalOverlay: { flex: 1, backgroundColor: "rgba(30,27,58,0.45)", justifyContent: "flex-end" },
    modalSheet: {
      backgroundColor: colors.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28,
      padding: spacing.xxl, gap: spacing.sm,
      maxHeight: SCREEN_H * 0.80,
    },
    modalHandle: {
      width: 40, height: 4, borderRadius: 2,
      backgroundColor: colors.border, alignSelf: "center", marginBottom: spacing.lg,
    },
    modalTitle: { fontSize: 22, color: colors.text, ...fonts.medium, marginBottom: spacing.sm },
    fieldLabel: {
      fontSize: 11, color: colors.muted, ...fonts.medium,
      letterSpacing: 1.2, textTransform: "uppercase",
      marginTop: spacing.md, marginBottom: spacing.xs,
    },
    input: {
      height: 54, backgroundColor: colors.surface,
      borderRadius: radius.lg, paddingHorizontal: spacing.lg,
      fontSize: 16, color: colors.text, ...fonts.regular,
    },
    error: { fontSize: 13, color: "#E05050", ...fonts.regular },
    modalBtns: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg },
    btnOutline: {
      flex: 1, height: 54, borderWidth: 1.5, borderColor: colors.border,
      borderRadius: radius.pill, alignItems: "center", justifyContent: "center",
    },
    btnOutlineText: { fontSize: 16, color: colors.text, ...fonts.medium },
    btnPrimary: {
      flex: 1, height: 54, backgroundColor: colors.violet,
      borderRadius: radius.pill, alignItems: "center", justifyContent: "center",
    },
    btnPrimaryText: { fontSize: 16, color: "#FFFFFF", ...fonts.medium },
  }), [colors]);

  const allTasksDone = tasks.length > 0 && tasks.every(isCompletedToday);
  const allMedsDone = meds.length > 0 && meds.every(isTakenToday);

  // Animated banner entrance — slides down + fades in when all tasks done
  const taskBannerAnim = useRef(new Animated.Value(0)).current;
  const medBannerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(taskBannerAnim, {
      toValue: allTasksDone ? 1 : 0,
      useNativeDriver: true,
      friction: 7,
      tension: 80,
    }).start();
  }, [allTasksDone]);

  useEffect(() => {
    Animated.spring(medBannerAnim, {
      toValue: allMedsDone ? 1 : 0,
      useNativeDriver: true,
      friction: 7,
      tension: 80,
    }).start();
  }, [allMedsDone]);

  return (
    <View style={styles.container}>

      {/* ── Notification panel ──────────────────────────────── */}
      <Modal visible={notifOpen} transparent animationType="none" onRequestClose={closeNotifs}>
        <Animated.View style={[styles.backdrop, { opacity: backdropAnim }]} pointerEvents="auto">
          <Pressable style={StyleSheet.absoluteFillObject} onPress={closeNotifs} />
        </Animated.View>
        <Animated.View style={[styles.panelWrapper, { transform: [{ translateX: slideAnim }] }]}>
          <View style={styles.panel}>
            <LinearGradient
              colors={[colors.violet50, colors.surface, colors.bg]}
              start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
              style={styles.panelTopGradient}
            >
              <View style={styles.panelHeader}>
                <View>
                  <Text style={styles.panelTitle}>Reminders</Text>
                  <Text style={styles.panelSubtitle}>
                    {totalNotifs > 0
                      ? `${totalNotifs} item${totalNotifs === 1 ? "" : "s"} pending today`
                      : "Nothing pending"}
                  </Text>
                </View>
                <TouchableOpacity style={styles.panelClose} onPress={closeNotifs}>
                  <Ionicons name="close" size={18} color={colors.violet} />
                </TouchableOpacity>
              </View>
            </LinearGradient>
            <ScrollView style={styles.panelBody} showsVerticalScrollIndicator={false}>
              {totalNotifs === 0 ? (
                <View style={styles.emptyNotif}>
                  <View style={styles.emptyIconRing}>
                    <Ionicons name="checkmark" size={36} color={colors.violet} />
                  </View>
                  <Text style={styles.emptyNotifTitle}>You're all caught up!</Text>
                  <Text style={styles.emptyNotifText}>All tasks and medications{"\n"}for today are complete.</Text>
                </View>
              ) : (
                <>
                  {pendingTasks.length > 0 && (
                    <>
                      <Text style={styles.panelSectionLabel}>Routine Tasks</Text>
                      {pendingTasks.map((task) => (
                        <View key={task.id} style={styles.notifRow}>
                          <View style={styles.notifIconCircle}>
                            <Ionicons name="calendar-clear" size={20} color={colors.violet} />
                          </View>
                          <View style={styles.notifRowBody}>
                            <Text style={styles.notifRowLabel}>{task.label}</Text>
                            {task.time ? <Text style={styles.notifRowSub}>{task.time}</Text> : null}
                          </View>
                        </View>
                      ))}
                    </>
                  )}
                  {pendingTasks.length > 0 && pendingMeds.length > 0 && <View style={styles.sectionDivider} />}
                  {pendingMeds.length > 0 && (
                    <>
                      <Text style={styles.panelSectionLabel}>Medications</Text>
                      {pendingMeds.map((med) => (
                        <View key={med.id} style={styles.notifRow}>
                          <View style={styles.notifIconCircle}>
                            <Ionicons name="medkit" size={20} color={colors.amber} />
                          </View>
                          <View style={styles.notifRowBody}>
                            <Text style={styles.notifRowLabel}>{med.name}</Text>
                            <Text style={styles.notifRowSub}>{[med.dosage, med.time].filter(Boolean).join(" · ")}</Text>
                          </View>
                        </View>
                      ))}
                    </>
                  )}
                </>
              )}
            </ScrollView>
          </View>
        </Animated.View>
      </Modal>

      {/* ── Greeting header ──────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <View style={styles.greetingLineRow}>
              <Ionicons name={greeting.icon} size={16} color={colors.amber} />
              <Text style={styles.greetingLine}>{greeting.text},</Text>
            </View>
            <Text style={styles.greetingName}>
              <Text style={styles.greetingAccent}>{firstName}</Text>
            </Text>
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
                    width: meds.length > 0 ? `${Math.round((medsDone / meds.length) * 100)}%` as any : "0%",
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
                    onPress={() => item.type === "task" ? toggleComplete(item.id) : undefined}
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
              {(() => {
                const allItems = tasks.length + reminders.length;
                const doneItems = tasks.filter(isCompletedToday).length + reminders.filter((r) => !!r.completed_date).length;
                return (
                  <View style={styles.splitProgress}>
                    <View style={styles.splitProgressTrack}>
                      <View style={[styles.splitProgressFill, {
                        backgroundColor: colors.sage,
                        width: allItems > 0 ? `${Math.round((doneItems / allItems) * 100)}%` as any : "0%",
                      }]} />
                    </View>
                    <Text style={styles.splitProgressText}>{doneItems} of {allItems} done</Text>
                  </View>
                );
              })()}
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

      {/* ── Edit Med modal ─────────────────────────────────────── */}
      <Modal visible={editingMed !== null} transparent animationType="none">
        <KeyboardAvoidingView style={[styles.modalOverlay, { paddingTop: insets.top }]} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <PanGestureHandler
            onGestureEvent={({ nativeEvent }) => {
              editMedModalY.setValue(Math.max(0, editMedModalBaseY.current + nativeEvent.translationY));
            }}
            onHandlerStateChange={({ nativeEvent }) => {
              if (nativeEvent.state !== State.END) return;
              nativeEvent.translationY > 80
                ? slideModalOut(editMedModalY, editMedModalBaseY, () => { setEditingMed(null); setEditMedError(""); })
                : Animated.spring(editMedModalY, { toValue: 0, useNativeDriver: true, bounciness: 0, speed: 20 }).start();
            }}
          >
            <Animated.View style={[styles.modalSheet, { transform: [{ translateY: editMedModalY }] }]}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>Edit Medication</Text>
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>NAME</Text>
                  <TextInput style={styles.input} value={editMedName} onChangeText={setEditMedName} placeholder="e.g. Donepezil" placeholderTextColor={colors.muted} autoFocus />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>DOSAGE</Text>
                  <TextInput style={styles.input} value={editMedDosage} onChangeText={setEditMedDosage} placeholder="e.g. 1 tablet" placeholderTextColor={colors.muted} />
                </View>
              </View>
              <Text style={styles.fieldLabel}>TIME</Text>
              <TimeSlider value={editMedTime} onChange={setEditMedTime} />
              {editMedError ? <Text style={styles.error}>{editMedError}</Text> : null}
              <View style={styles.modalBtns}>
                <TouchableOpacity style={styles.btnOutline} onPress={() => { setEditingMed(null); setEditMedError(""); }}>
                  <Text style={styles.btnOutlineText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnPrimary} onPress={handleEditMed}>
                  <Text style={styles.btnPrimaryText}>Save</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </PanGestureHandler>
        </KeyboardAvoidingView>
      </Modal>

      <NotesHistoryModal
        visible={notesModalVisible}
        notes={caregiverNotes}
        onClose={() => setNotesModalVisible(false)}
      />

      {/* ── Add Med modal ──────────────────────────────────────── */}
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
              <Text style={styles.modalTitle}>Add Medication</Text>
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

function RemindersSection({ reminders, colors, onDelete }: {
  reminders: import("../../types").Reminder[];
  colors: import("../../config/theme").AppColors;
  onDelete: (id: string) => void;
}) {
  if (reminders.length === 0) return null;
  return (
    <View>
      {reminders.map((r) => (
        <View
          key={r.id}
          style={{
            backgroundColor: colors.bg,
            borderRadius: radius.xl,
            padding: spacing.md,
            paddingVertical: 18,
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
            marginBottom: spacing.md,
            borderLeftWidth: 4,
            borderLeftColor: colors.violet,
            shadowColor: "#7B5CE7",
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.07,
            shadowRadius: 12,
            elevation: 3,
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
          <TouchableOpacity
            onPress={() => Alert.alert("Remove reminder?", `"${r.text}" will be removed.`, [
              { text: "Keep it", style: "cancel" },
              { text: "Remove", style: "destructive", onPress: () => onDelete(r.id) },
            ])}
            style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}
          >
            <Ionicons name="close" size={18} color={colors.muted} />
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}
