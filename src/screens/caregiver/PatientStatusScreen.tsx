import React, { useMemo, useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Pressable,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRoutine } from "../../hooks/useRoutine";
import { useMeds } from "../../hooks/useMeds";
import { useHelpAlert } from "../../hooks/useHelpAlert";
import { useNotes } from "../../hooks/useNotes";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";
import { SectionHeader } from "../../components/shared/SectionHeader";
import { NotesHistoryModal } from "../../components/NotesHistoryModal";
import { AddNoteSheet } from "../../components/AddNoteSheet";
import { createNote } from "../../api/client";
import { fonts, spacing, radius, gradients } from "../../config/theme";
import { formatRelativeTime } from "../../hooks/useDashboardData";

const SCREEN_W = Dimensions.get("window").width;
const PANEL_WIDTH = Math.min(SCREEN_W * 0.82, 340);

export function PatientStatusScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const patientId = user?.patient_id ?? undefined;
  const { tasks, isCompletedToday } = useRoutine(patientId);
  const { meds, isTakenToday } = useMeds(patientId);
  const { alerts } = useHelpAlert();
  const { pinnedNote, notes: caregiverNotes, reload: reloadNotes } = useNotes(patientId);
  const [notesModalVisible, setNotesModalVisible] = useState(false);
  const [addNoteVisible, setAddNoteVisible] = useState(false);

  async function handleSaveNote(text: string, pinned: boolean) {
    if (!patientId) return;
    await createNote(patientId, text, pinned);
    await reloadNotes();
  }

  const [clock, setClock] = useState(new Date());
  const [notifOpen, setNotifOpen] = useState(false);
  const slideAnim = useRef(new Animated.Value(PANEL_WIDTH)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const interval = setInterval(() => setClock(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const dayStr = clock.toLocaleDateString([], { weekday: "long" });
  const dateStr = clock.toLocaleDateString([], { month: "long", day: "numeric" });

  const routineDone = tasks.filter(isCompletedToday).length;
  const medsDone = meds.filter(isTakenToday).length;
  const pendingHelp = alerts.filter((a) => !a.dismissed);
  const firstName = user?.name?.split(" ")[0] ?? "there";

  const pendingTasks = tasks.filter((t) => !isCompletedToday(t));
  const pendingMeds = meds.filter((m) => !isTakenToday(m));
  const totalNotifs = pendingTasks.length + pendingMeds.length;

  const openNotifs = () => {
    setNotifOpen(true);
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        friction: 8,
        tension: 58,
      }),
      Animated.timing(backdropAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeNotifs = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: PANEL_WIDTH,
        duration: 240,
        useNativeDriver: true,
      }),
      Animated.timing(backdropAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => setNotifOpen(false));
  };

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    content: { padding: spacing.xl, paddingBottom: 110 },

    // ── Greeting header ──────────────────────────────────────────
    greetingSection: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.lg,
      paddingBottom: spacing.xl,
      backgroundColor: colors.bg,
    },
    greetingRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
    },
    greetingText: {
      fontSize: 32,
      color: colors.text,
      ...fonts.medium,
      lineHeight: 40,
    },
    greetingName: {
      color: colors.violet,
    },
    dateRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: spacing.md,
      gap: spacing.sm,
    },
    datePill: {
      backgroundColor: colors.violet50,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: 5,
    },
    datePillText: {
      fontSize: 13,
      color: colors.violet,
      ...fonts.medium,
    },

    // ── Bell button ──────────────────────────────────────────────
    notifBtn: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: colors.violet50,
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
      borderColor: colors.bg,
    },
    notifBadgeText: {
      fontSize: 9,
      color: "#FFFFFF",
      ...fonts.medium,
    },

    // ── Notification panel ───────────────────────────────────────
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(11, 7, 30, 0.38)",
    },
    panelWrapper: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      width: PANEL_WIDTH,
      shadowColor: "#000",
      shadowOffset: { width: -6, height: 0 },
      shadowOpacity: 0.14,
      shadowRadius: 20,
      elevation: 16,
    },
    panel: {
      flex: 1,
      backgroundColor: colors.bg,
      overflow: "hidden",
    },
    // Soft lavender gradient wash at the top of the panel
    panelTopGradient: {
      paddingTop: 56,
      paddingHorizontal: 24,
      paddingBottom: 20,
    },
    panelHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    panelTitle: {
      fontSize: 24,
      color: colors.text,
      ...fonts.medium,
      letterSpacing: -0.3,
    },
    panelSubtitle: {
      fontSize: 13,
      color: colors.muted,
      ...fonts.regular,
      marginTop: 4,
    },
    panelClose: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: "rgba(123,92,231,0.1)",
      alignItems: "center",
      justifyContent: "center",
    },
    panelBody: {
      flex: 1,
      paddingHorizontal: 24,
    },
    // Section label with violet left border accent
    panelSectionLabel: {
      fontSize: 10,
      color: colors.violet,
      ...fonts.medium,
      textTransform: "uppercase",
      letterSpacing: 1.6,
      marginBottom: 10,
      marginTop: 20,
      paddingLeft: 10,
      borderLeftWidth: 2,
      borderLeftColor: colors.violet,
    },
    // Notification row — tall, breathable for easy reading
    notifRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.bg,
      borderRadius: 16,
      paddingVertical: 14,
      paddingHorizontal: 14,
      marginBottom: 8,
      gap: 14,
      borderWidth: 1,
      borderColor: "rgba(123,92,231,0.08)",
      shadowColor: "#7B5CE7",
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.07,
      shadowRadius: 10,
      elevation: 2,
    },
    notifIconCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: "#F0ECFD",
      alignItems: "center",
      justifyContent: "center",
    },
    notifRowBody: { flex: 1 },
    notifRowLabel: {
      fontSize: 15,
      color: colors.text,
      ...fonts.medium,
      lineHeight: 20,
    },
    notifRowSub: {
      fontSize: 12,
      color: colors.muted,
      ...fonts.regular,
      marginTop: 3,
    },
    // Divider between sections
    sectionDivider: {
      height: 1,
      backgroundColor: "rgba(123,92,231,0.07)",
      marginTop: 8,
    },
    // Empty state — centered, calm
    emptyNotif: {
      alignItems: "center",
      paddingTop: 48,
      paddingBottom: 32,
      gap: 12,
    },
    emptyIconRing: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: "#F0ECFD",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 4,
    },
    emptyNotifTitle: {
      fontSize: 17,
      color: colors.text,
      ...fonts.medium,
    },
    emptyNotifText: {
      fontSize: 13,
      color: colors.muted,
      ...fonts.regular,
      textAlign: "center",
      lineHeight: 18,
    },

    // ── Stats ────────────────────────────────────────────────────
    statsRow: {
      flexDirection: "row",
      gap: spacing.md,
      marginBottom: spacing.xxl,
    },
    statCard: {
      flex: 1,
      backgroundColor: colors.bg,
      borderRadius: radius.lg,
      padding: spacing.lg,
      alignItems: "center",
      shadowColor: "#7B5CE7",
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 3,
    },
    statIconCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.violet50,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.sm,
    },
    statValue: {
      fontSize: 28,
      color: colors.violet,
      ...fonts.medium,
    },
    statLabel: {
      fontSize: 11,
      color: colors.muted,
      ...fonts.medium,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      marginTop: 2,
    },

    // ── Featured gradient card ───────────────────────────────────
    featuredCard: {
      borderRadius: radius.xl,
      padding: spacing.xl,
      marginBottom: spacing.xxl,
      overflow: "hidden",
    },
    featuredLabel: {
      fontSize: 12,
      color: "rgba(255,255,255,0.8)",
      ...fonts.medium,
      letterSpacing: 1,
      textTransform: "uppercase",
      marginBottom: spacing.xs,
    },
    featuredTitle: {
      fontSize: 22,
      color: "#FFFFFF",
      ...fonts.medium,
    },
    featuredSub: {
      fontSize: 14,
      color: "rgba(255,255,255,0.8)",
      ...fonts.regular,
      marginTop: spacing.xs,
    },

    // ── Notes section ───────────────────────────────────────────
    noteSection: { marginTop: spacing.lg },
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
    notePlusBtnText: { color: "#fff", fontSize: 18, lineHeight: 22, fontWeight: "400" as const },

    // ── Read-only list items ─────────────────────────────────────
    section: { marginTop: spacing.lg },
    noItems: {
      fontSize: 14,
      color: colors.muted,
      ...fonts.regular,
      paddingVertical: spacing.md,
    },
    readRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.bg,
      borderRadius: radius.lg,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.sm,
      gap: spacing.md,
      shadowColor: "#7B5CE7",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
    dotCircle: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    dotCircleDone: {
      backgroundColor: colors.violet,
    },
    readRowBody: { flex: 1 },
    readLabel: {
      fontSize: 15,
      color: colors.text,
      ...fonts.medium,
    },
    readLabelDone: {
      color: colors.muted,
      textDecorationLine: "line-through",
    },
    readTime: {
      fontSize: 12,
      color: colors.muted,
      ...fonts.regular,
      marginTop: 2,
    },
  }), [colors]);

  const totalPending = pendingTasks.length + pendingMeds.length;

  return (
    <View style={styles.container}>

      {/* ── Notification panel modal ─────────────────────────── */}
      <Modal visible={notifOpen} transparent animationType="none" onRequestClose={closeNotifs}>
        {/* Animated backdrop */}
        <Animated.View style={[styles.backdrop, { opacity: backdropAnim }]} pointerEvents="auto">
          <Pressable style={StyleSheet.absoluteFillObject} onPress={closeNotifs} />
        </Animated.View>

        {/* Sliding panel */}
        <Animated.View style={[styles.panelWrapper, { transform: [{ translateX: slideAnim }] }]}>
          <View style={styles.panel}>

            {/* Soft lavender gradient at top */}
            <LinearGradient
              colors={["#EDE8FC", "#F7F5FF", "#FFFFFF"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.panelTopGradient}
            >
              <View style={styles.panelHeader}>
                <View>
                  <Text style={styles.panelTitle}>Reminders</Text>
                  <Text style={styles.panelSubtitle}>
                    {totalPending > 0
                      ? `${totalPending} item${totalPending === 1 ? "" : "s"} pending today`
                      : "Nothing pending"}
                  </Text>
                </View>
                <TouchableOpacity style={styles.panelClose} onPress={closeNotifs}>
                  <Ionicons name="close" size={18} color={colors.violet} />
                </TouchableOpacity>
              </View>
            </LinearGradient>

            {/* Panel content */}
            <ScrollView style={styles.panelBody} showsVerticalScrollIndicator={false}>
              {totalPending === 0 ? (
                <View style={styles.emptyNotif}>
                  <View style={styles.emptyIconRing}>
                    <Ionicons name="checkmark" size={36} color={colors.violet} />
                  </View>
                  <Text style={styles.emptyNotifTitle}>You're all caught up!</Text>
                  <Text style={styles.emptyNotifText}>
                    All tasks and medications{"\n"}for today are complete.
                  </Text>
                </View>
              ) : (
                <>
                  {pendingTasks.length > 0 && (
                    <>
                      <Text style={styles.panelSectionLabel}>Routine Tasks</Text>
                      {pendingTasks.map((task) => (
                        <View key={task.id} style={styles.notifRow}>
                          <View style={styles.notifIconCircle}>
                            <Ionicons name="calendar-clear-outline" size={20} color={colors.violet} />
                          </View>
                          <View style={styles.notifRowBody}>
                            <Text style={styles.notifRowLabel}>{task.label}</Text>
                            {task.time ? (
                              <Text style={styles.notifRowSub}>{task.time}</Text>
                            ) : null}
                          </View>
                        </View>
                      ))}
                    </>
                  )}

                  {pendingTasks.length > 0 && pendingMeds.length > 0 && (
                    <View style={styles.sectionDivider} />
                  )}

                  {pendingMeds.length > 0 && (
                    <>
                      <Text style={styles.panelSectionLabel}>Medications</Text>
                      {pendingMeds.map((med) => (
                        <View key={med.id} style={styles.notifRow}>
                          <View style={styles.notifIconCircle}>
                            <Ionicons name="medkit-outline" size={20} color={colors.violet} />
                          </View>
                          <View style={styles.notifRowBody}>
                            <Text style={styles.notifRowLabel}>{med.name}</Text>
                            <Text style={styles.notifRowSub}>
                              {[med.dosage, med.time].filter(Boolean).join(" · ")}
                            </Text>
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
      <View style={styles.greetingSection}>
        <View style={styles.greetingRow}>
          <View>
            <Text style={styles.greetingText}>
              Hello,{"\n"}
              <Text style={styles.greetingName}>{firstName}!</Text>
            </Text>
          </View>

          {/* Bell button */}
          <TouchableOpacity style={styles.notifBtn} onPress={openNotifs} activeOpacity={0.75}>
            <Ionicons name="notifications-outline" size={22} color={colors.violet} />
            {totalNotifs > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>{totalNotifs}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.dateRow}>
          <View style={styles.datePill}>
            <Text style={styles.datePillText}>{dayStr}</Text>
          </View>
          <View style={styles.datePill}>
            <Text style={styles.datePillText}>{dateStr}</Text>
          </View>
        </View>
      </View>

      {/* ── Main scroll content ──────────────────────────────── */}
      <ScrollView contentContainerStyle={styles.content}>

        {/* Featured gradient card — pending help alerts */}
        {pendingHelp.length > 0 && (
          <LinearGradient
            colors={[...gradients.primary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.featuredCard}
          >
            <Text style={styles.featuredLabel}>Help Request</Text>
            <Text style={styles.featuredTitle}>
              {pendingHelp.length === 1 ? "1 pending request" : `${pendingHelp.length} pending requests`}
            </Text>
            <Text style={styles.featuredSub}>
              {formatRelativeTime(pendingHelp[0].timestamp)}
            </Text>
          </LinearGradient>
        )}

        {/* Stat cards */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={styles.statIconCircle}>
              <Ionicons name="calendar-clear-outline" size={18} color={colors.violet} />
            </View>
            <Text style={styles.statValue}>{routineDone}/{tasks.length}</Text>
            <Text style={styles.statLabel}>Routine Done</Text>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statIconCircle}>
              <Ionicons name="medkit-outline" size={18} color={colors.violet} />
            </View>
            <Text style={styles.statValue}>{medsDone}/{meds.length}</Text>
            <Text style={styles.statLabel}>Meds Taken</Text>
          </View>
        </View>

        {/* Routine tasks (read-only) */}
        <View style={styles.section}>
          <SectionHeader label="Daily Routine" />
          {tasks.length === 0 ? (
            <Text style={styles.noItems}>No tasks added yet</Text>
          ) : (
            tasks.map((task) => (
              <View key={task.id} style={styles.readRow}>
                <View style={[styles.dotCircle, isCompletedToday(task) && styles.dotCircleDone]}>
                  {isCompletedToday(task) && (
                    <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                  )}
                </View>
                <View style={styles.readRowBody}>
                  <Text style={[styles.readLabel, isCompletedToday(task) && styles.readLabelDone]}>
                    {task.label}
                  </Text>
                  <Text style={styles.readTime}>{task.time}</Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Medications (read-only) */}
        <View style={styles.section}>
          <SectionHeader label="Medications" />
          {meds.length === 0 ? (
            <Text style={styles.noItems}>No medications added yet</Text>
          ) : (
            meds.map((med) => (
              <View key={med.id} style={styles.readRow}>
                <View style={[styles.dotCircle, isTakenToday(med) && styles.dotCircleDone]}>
                  {isTakenToday(med) && (
                    <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                  )}
                </View>
                <View style={styles.readRowBody}>
                  <Text style={[styles.readLabel, isTakenToday(med) && styles.readLabelDone]}>
                    {med.name}
                  </Text>
                  <Text style={styles.readTime}>{med.dosage} · {med.time}</Text>
                </View>
              </View>
            ))
          )}
        </View>

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
      </ScrollView>

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
    </View>
  );
}
