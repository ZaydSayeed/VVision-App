import React, { useMemo, useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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

function AnimatedBar({ ratio, color }: { ratio: number; color: string }) {
  const widthAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(widthAnim, { toValue: ratio, duration: 600, useNativeDriver: false, delay: 150 }).start();
  }, [ratio]);
  return (
    <View style={{ height: 6, backgroundColor: "rgba(0,0,0,0.06)", borderRadius: 999, overflow: "hidden" }}>
      <Animated.View style={{ height: 6, borderRadius: 999, backgroundColor: color, width: widthAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) }} />
    </View>
  );
}

export function PatientDetailScreen({ patientId, patientName, onBack }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { tasks, isCompletedToday } = useRoutine(patientId);
  const { meds, isTakenToday } = useMeds(patientId);
  const { alerts, dismissAlert } = useHelpAlert();

  const routineDone = tasks.filter(isCompletedToday).length;
  const medsDone = meds.filter(isTakenToday).length;
  const pendingHelp = alerts.filter((a) => !a.dismissed);

  const taskRatio = tasks.length > 0 ? routineDone / tasks.length : 0;
  const medRatio = meds.length > 0 ? medsDone / meds.length : 0;

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
    statsCard: {
      backgroundColor: colors.bg,
      borderRadius: radius.xl,
      padding: spacing.xl,
      marginBottom: spacing.xxl,
      shadowColor: colors.violet,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.07,
      shadowRadius: 14,
      elevation: 3,
      gap: spacing.lg,
    },
    progressRow: { gap: 5 },
    progressLabelRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 4,
    },
    progressLabel: {
      fontSize: 11,
      color: colors.muted,
      ...fonts.medium,
      letterSpacing: 0.8,
      textTransform: "uppercase",
    },
    progressFraction: {
      fontSize: 11,
      color: colors.muted,
      ...fonts.regular,
    },
    progressTrack: {
      height: 6,
      backgroundColor: colors.surface,
      borderRadius: radius.pill,
      overflow: "hidden",
    },
    progressFill: {
      height: 6,
      borderRadius: radius.pill,
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
      {/* Back bar */}
      <View style={[styles.backBar, { paddingTop: Math.max(insets.top, spacing.lg) }]}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.patientTitle}>{patientName}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.statsCard}>
          <View style={styles.progressRow}>
            <View style={styles.progressLabelRow}>
              <Text style={styles.progressLabel}>Routine</Text>
              <Text style={styles.progressFraction}>{routineDone}/{tasks.length}</Text>
            </View>
            <AnimatedBar ratio={taskRatio} color={colors.sage} />
          </View>
          <View style={styles.progressRow}>
            <View style={styles.progressLabelRow}>
              <Text style={styles.progressLabel}>Medications</Text>
              <Text style={styles.progressFraction}>{medsDone}/{meds.length}</Text>
            </View>
            <AnimatedBar ratio={medRatio} color={colors.amber} />
          </View>
        </View>

        <SectionHeader label="Help Requests" />
        {pendingHelp.length === 0 ? (
          <EmptyState icon="checkmark-circle" title="All clear" subtitle="No help requests from patient" />
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
