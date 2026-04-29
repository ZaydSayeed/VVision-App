import React, { useMemo, useState, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
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
import { API_BASE_URL } from "../../config/api";
import { authHeaders } from "../../api/client";

interface Props {
  patientId: string;
  patientName: string;
  onBack: () => void;
  onStartLiveView: (roomUrl: string, token: string) => void;
}

export function PatientDetailScreen({ patientId, patientName, onBack, onStartLiveView }: Props) {
  const { colors } = useTheme();
  const { tasks, isCompletedToday } = useRoutine(patientId);
  const { meds, isTakenToday } = useMeds(patientId);
  const { alerts, dismissAlert } = useHelpAlert();
  const [liveLoading, setLiveLoading] = useState(false);
  const pollRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const routineDone = tasks.filter(isCompletedToday).length;
  const medsDone = meds.filter(isTakenToday).length;
  const pendingHelp = alerts.filter((a) => !a.dismissed);

  const handleBack = () => {
    if (pollRef.current) clearTimeout(pollRef.current);
    if (liveLoading) setLiveLoading(false);
    onBack?.();
  };

  const handleRequestLiveView = async () => {
    if (liveLoading) return;
    setLiveLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/stream/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ patientId }),
      });
      if (!res.ok) throw new Error("request failed");

      // Poll /status until approved (or timeout after 2 min)
      const deadline = Date.now() + 120_000;
      const poll = async () => {
        if (Date.now() > deadline) {
          if (!mountedRef.current) return;
          setLiveLoading(false);
          Alert.alert("Live View", "Could not start live view. Try again.");
          return;
        }
        try {
          const statusRes = await fetch(
            `${API_BASE_URL}/api/stream/status/${patientId}`,
            { headers: { ...authHeaders() } }
          );
          if (statusRes.ok) {
            const data = await statusRes.json();
            if (data.status === "approved" && data.dailyRoomUrl && data.caregiverToken) {
              if (!mountedRef.current) return;
              setLiveLoading(false);
              onStartLiveView(data.dailyRoomUrl, data.caregiverToken);
              return;
            }
            if (data.status === "denied") {
              if (!mountedRef.current) return;
              setLiveLoading(false);
              Alert.alert("Live View", "Could not start live view. Try again.");
              return;
            }
          }
        } catch {
          // network hiccup — keep polling
        }
        pollRef.current = setTimeout(poll, 3000);
      };
      pollRef.current = setTimeout(poll, 3000);
    } catch {
      if (!mountedRef.current) return;
      setLiveLoading(false);
      Alert.alert("Live View", "Could not start live view. Try again.");
    }
  };

  // Clean up polling on unmount
  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, []);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    backBar: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: spacing.sm,
    },
    backText: {
      fontSize: 15,
      color: colors.violet,
      ...fonts.medium,
    },
    patientTitle: {
      fontSize: 20,
      color: colors.text,
      ...fonts.display,
      marginLeft: spacing.sm,
    },
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
    liveBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      backgroundColor: colors.violet,
      borderRadius: radius.md,
      paddingVertical: spacing.md + 2,
      marginBottom: spacing.xxl,
    },
    liveBtnText: {
      fontSize: 15,
      color: "#fff",
      ...fonts.medium,
    },
  }), [colors]);

  return (
    <View style={styles.container}>
      <View style={styles.backBar}>
        <TouchableOpacity onPress={handleBack} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color={colors.violet} />
        </TouchableOpacity>
        <Text style={styles.backText}>Patients</Text>
        <Text style={styles.patientTitle}>{patientName}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity
          style={styles.liveBtn}
          onPress={handleRequestLiveView}
          activeOpacity={0.8}
          disabled={liveLoading}
        >
          <Ionicons name={liveLoading ? "hourglass-outline" : "videocam-outline"} size={18} color="#fff" />
          <Text style={styles.liveBtnText}>
            {liveLoading ? "Waiting for patient…" : "Request Live View"}
          </Text>
        </TouchableOpacity>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{routineDone}/{tasks.length}</Text>
            <Text style={styles.statLabel}>Routine Done</Text>
          </View>
          <View style={styles.statCard}>
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
                <View style={[styles.dot, isCompletedToday(task) && styles.dotDone]} />
                <View style={styles.readRowBody}>
                  <Text style={[styles.readLabel, isCompletedToday(task) && styles.readLabelDone]}>
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

        <View style={styles.section}>
          <SectionHeader label="Medications" />
          {meds.length === 0 ? (
            <Text style={styles.noItems}>No medications added yet</Text>
          ) : (
            meds.map((med) => (
              <View key={med.id} style={styles.readRow}>
                <View style={[styles.dot, isTakenToday(med) && styles.dotDone]} />
                <View style={styles.readRowBody}>
                  <Text style={[styles.readLabel, isTakenToday(med) && styles.readLabelDone]}>
                    {med.name}
                  </Text>
                  <Text style={styles.readTime}>{med.dosage} · {med.time}</Text>
                </View>
                {isTakenToday(med) && (
                  <Ionicons name="checkmark" size={16} color={colors.violet} />
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}
