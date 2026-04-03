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
import { SectionHeader } from "../../components/shared/SectionHeader";
import { EmptyState } from "../../components/shared/EmptyState";
import { fonts, spacing, radius } from "../../config/theme";
import { formatRelativeTime } from "../../hooks/useDashboardData";

interface Props {
  patientId: string;
  patientName: string;
  onBack: () => void;
}

export function PatientDetailScreen({ patientId, patientName, onBack }: Props) {
  const { colors } = useTheme();
  const { tasks, isCompletedToday } = useRoutine(patientId);
  const { meds, isTakenToday } = useMeds(patientId);
  const { alerts, dismissAlert } = useHelpAlert();

  const routineDone = tasks.filter(isCompletedToday).length;
  const medsDone = meds.filter(isTakenToday).length;
  const pendingHelp = alerts.filter((a) => !a.dismissed);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    // Back bar (white)
    backBar: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.lg,
      paddingBottom: spacing.md,
      gap: spacing.sm,
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    backText: {
      fontSize: 13,
      color: colors.muted,
      ...fonts.regular,
    },
    patientTitle: {
      fontSize: 20,
      color: colors.text,
      ...fonts.medium,
      flex: 1,
    },
    content: { padding: spacing.xl, paddingBottom: 100 },
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
      width: 36,
      height: 36,
      borderRadius: 18,
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
      backgroundColor: colors.violet50,
      borderRadius: radius.pill,
      paddingHorizontal: 14,
      paddingVertical: 7,
    },
    dismissText: {
      fontSize: 12,
      color: colors.violet,
      ...fonts.medium,
    },
    section: { marginTop: spacing.xl },
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
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    dotCircleDone: { backgroundColor: colors.violet },
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

  return (
    <View style={styles.container}>
      {/* White back bar */}
      <View style={styles.backBar}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.patientTitle}>{patientName}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={styles.statIconCircle}>
              <Ionicons name="calendar-clear-outline" size={16} color={colors.violet} />
            </View>
            <Text style={styles.statValue}>{routineDone}/{tasks.length}</Text>
            <Text style={styles.statLabel}>Routine Done</Text>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statIconCircle}>
              <Ionicons name="medkit-outline" size={16} color={colors.violet} />
            </View>
            <Text style={styles.statValue}>{medsDone}/{meds.length}</Text>
            <Text style={styles.statLabel}>Meds Taken</Text>
          </View>
        </View>

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
              <TouchableOpacity style={styles.dismissBtn} onPress={() => dismissAlert(alert.id)}>
                <Text style={styles.dismissText}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          ))
        )}

        <View style={styles.section}>
          <SectionHeader label="Daily Routine" />
          {tasks.length === 0 ? (
            <Text style={styles.noItems}>No tasks added yet</Text>
          ) : (
            tasks.map((task) => (
              <View key={task.id} style={styles.readRow}>
                <View style={[styles.dotCircle, isCompletedToday(task) && styles.dotCircleDone]}>
                  {isCompletedToday(task) && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
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

        <View style={styles.section}>
          <SectionHeader label="Medications" />
          {meds.length === 0 ? (
            <Text style={styles.noItems}>No medications added yet</Text>
          ) : (
            meds.map((med) => (
              <View key={med.id} style={styles.readRow}>
                <View style={[styles.dotCircle, isTakenToday(med) && styles.dotCircleDone]}>
                  {isTakenToday(med) && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
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
