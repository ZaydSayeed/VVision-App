import React, { useMemo, useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRoutine } from "../../hooks/useRoutine";
import { useMeds } from "../../hooks/useMeds";
import { useHelpAlert } from "../../hooks/useHelpAlert";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";
import { SectionHeader } from "../../components/shared/SectionHeader";
import { EmptyState } from "../../components/shared/EmptyState";
import { fonts, spacing, radius, gradients } from "../../config/theme";
import { formatRelativeTime } from "../../hooks/useDashboardData";

export function PatientStatusScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const patientId = user?.patient_id ?? undefined;
  const { tasks, isCompletedToday } = useRoutine(patientId);
  const { meds, isTakenToday } = useMeds(patientId);
  const { alerts } = useHelpAlert();

  const [clock, setClock] = useState(new Date());

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

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    content: { padding: spacing.xl, paddingBottom: 110 },

    // Greeting header
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
    avatarCircle: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: colors.violet50,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: colors.violet100,
    },
    avatarText: {
      fontSize: 20,
      color: colors.violet,
      ...fonts.medium,
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

    // Stats
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

    // Help alerts
    helpCard: {
      backgroundColor: colors.bg,
      borderRadius: radius.lg,
      padding: spacing.lg,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: spacing.sm,
      shadowColor: "#7B5CE7",
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 3,
    },
    helpLeft: { flexDirection: "row", alignItems: "center", gap: spacing.md, flex: 1 },
    helpIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.violet50,
      alignItems: "center",
      justifyContent: "center",
    },
    helpTitle: {
      fontSize: 15,
      color: colors.text,
      ...fonts.medium,
    },
    helpTime: {
      fontSize: 12,
      color: colors.muted,
      ...fonts.regular,
      marginTop: 2,
    },
    dismissBtn: {
      borderWidth: 1.5,
      borderColor: colors.violet,
      borderRadius: radius.pill,
      paddingHorizontal: 14,
      paddingVertical: 6,
    },
    dismissText: {
      fontSize: 12,
      color: colors.violet,
      ...fonts.medium,
    },

    // Sections
    section: { marginTop: spacing.lg },
    noItems: {
      fontSize: 14,
      color: colors.muted,
      ...fonts.regular,
      paddingVertical: spacing.md,
    },

    // Read-only list items
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

    // Featured gradient card
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
  }), [colors]);

  const initials = user?.name?.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase() ?? "?";

  return (
    <View style={styles.container}>
      {/* Greeting Header */}
      <View style={styles.greetingSection}>
        <View style={styles.greetingRow}>
          <View>
            <Text style={styles.greetingText}>Hello,{"\n"}
              <Text style={styles.greetingName}>{firstName}!</Text>
            </Text>
          </View>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
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

      <ScrollView contentContainerStyle={styles.content}>
        {/* Featured gradient card — pending help or summary */}
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

        {/* Stat Cards */}
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

        {/* Routine Tasks (read-only) */}
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
      </ScrollView>
    </View>
  );
}
