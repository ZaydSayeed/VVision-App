import React, { useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRoutine } from "../../hooks/useRoutine";
import { useMeds } from "../../hooks/useMeds";
import { useHelpAlert } from "../../hooks/useHelpAlert";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";
import { SectionHeader } from "../../components/shared/SectionHeader";
import { EmptyState } from "../../components/shared/EmptyState";
import { fonts, spacing, radius } from "../../config/theme";
import { formatRelativeTime } from "../../hooks/useDashboardData";

export function PatientStatusScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const patientId = user?.patient_id ?? undefined;
  const { tasks, isCompletedToday } = useRoutine(patientId);
  const { meds, isTakenToday } = useMeds(patientId);
  const { alerts, dismissAlert } = useHelpAlert();

  const routineDone = tasks.filter(isCompletedToday).length;
  const medsDone = meds.filter(isTakenToday).length;
  const pendingHelp = alerts.filter((a) => !a.dismissed);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    content: { padding: spacing.xl, paddingBottom: 100 },
    statsRow: {
      flexDirection: "row",
      gap: spacing.md,
      marginBottom: spacing.xxl,
    },
    statCard: {
      flex: 1,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      padding: spacing.lg,
      alignItems: "center",
    },
    statValue: {
      fontSize: 36,
      color: colors.violet,
      ...fonts.display,
    },
    statLabel: {
      fontSize: 11,
      color: colors.muted,
      ...fonts.medium,
      textTransform: "uppercase",
      letterSpacing: 1,
      marginTop: 2,
    },
    helpCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.violet100,
      borderRadius: radius.md,
      padding: spacing.lg,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: spacing.sm,
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
      borderRadius: radius.sm,
      paddingHorizontal: 14,
      paddingVertical: 6,
    },
    dismissText: {
      fontSize: 12,
      color: colors.violet,
      ...fonts.medium,
    },
    section: { marginTop: spacing.xxl },
    noItems: {
      fontSize: 15,
      color: colors.muted,
      ...fonts.regular,
      paddingVertical: spacing.md,
    },
    readRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: spacing.sm + 2,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: spacing.md,
      minHeight: 48,
    },
    dot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.border,
    },
    dotDone: { backgroundColor: colors.violet },
    readRowBody: { flex: 1 },
    readLabel: {
      fontSize: 15,
      color: colors.text,
      ...fonts.regular,
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
    checkmark: {},
  }), [colors]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Stat Cards */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>
            {routineDone}/{tasks.length}
          </Text>
          <Text style={styles.statLabel}>Routine Done</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>
            {medsDone}/{meds.length}
          </Text>
          <Text style={styles.statLabel}>Meds Taken</Text>
        </View>
      </View>

      {/* Help Alerts */}
      <SectionHeader label="Help Requests" />
      {pendingHelp.length === 0 ? (
        <EmptyState title="All clear" subtitle="No help requests from patient" />
      ) : (
        pendingHelp.map((alert) => (
          <View key={alert.id} style={styles.helpCard}>
            <View>
              <Text style={styles.helpTitle}>Patient needs help</Text>
              <Text style={styles.helpTime}>{formatRelativeTime(alert.timestamp)}</Text>
            </View>
            <TouchableOpacity
              style={styles.dismissBtn}
              onPress={() => dismissAlert(alert.id)}
            >
              <Text style={styles.dismissText}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        ))
      )}

      {/* Routine Tasks (read-only) */}
      <View style={styles.section}>
        <SectionHeader label="Daily Routine" />
        {tasks.length === 0 ? (
          <Text style={styles.noItems}>No tasks added yet</Text>
        ) : (
          tasks.map((task) => (
            <View key={task.id} style={styles.readRow}>
              <View
                style={[
                  styles.dot,
                  isCompletedToday(task) && styles.dotDone,
                ]}
              />
              <View style={styles.readRowBody}>
                <Text
                  style={[
                    styles.readLabel,
                    isCompletedToday(task) && styles.readLabelDone,
                  ]}
                >
                  {task.label}
                </Text>
                <Text style={styles.readTime}>{task.time}</Text>
              </View>
              {isCompletedToday(task) && (
                <Ionicons name="checkmark" size={16} color={colors.violet} />
              )}
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
              <View
                style={[styles.dot, isTakenToday(med) && styles.dotDone]}
              />
              <View style={styles.readRowBody}>
                <Text
                  style={[
                    styles.readLabel,
                    isTakenToday(med) && styles.readLabelDone,
                  ]}
                >
                  {med.name}
                </Text>
                <Text style={styles.readTime}>
                  {med.dosage} · {med.time}
                </Text>
              </View>
              {isTakenToday(med) && (
                <Ionicons name="checkmark" size={16} color={colors.violet} />
              )}
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}
