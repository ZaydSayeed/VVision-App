import React, { useMemo, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useRoutine } from "../../hooks/useRoutine";
import { useMeds } from "../../hooks/useMeds";
import { useHelpAlert } from "../../hooks/useHelpAlert";
import { useTheme } from "../../context/ThemeContext";
import { SectionHeader } from "../../components/shared/SectionHeader";
import { EmptyState } from "../../components/shared/EmptyState";
import { ExportFlowSheet } from "../../components/ExportFlowSheet";
import { fonts, spacing, radius } from "../../config/theme";
import { formatRelativeTime } from "../../hooks/useDashboardData";
import { API_BASE_URL } from "../../config/api";
import { authHeaders } from "../../api/client";

interface Props {
  patientId: string;
  patientName: string;
  onBack: () => void;
  onViewLogs: () => void;
  onStartLiveView: (roomUrl: string, token: string) => void;
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

export function PatientDetailScreen({ patientId, patientName, onBack, onViewLogs, onStartLiveView }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [exportOpen, setExportOpen] = useState(false);
  const { tasks, isCompletedToday } = useRoutine(patientId);
  const { meds, isTakenToday } = useMeds(patientId);
  const { alerts, dismissAlert } = useHelpAlert();
  const [liveLoading, setLiveLoading] = useState(false);
  const pollRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const routineDone = tasks.filter(isCompletedToday).length;
  const medsDone = meds.filter(isTakenToday).length;
  const pendingHelp = alerts.filter((a) => !a.dismissed);

  const taskRatio = tasks.length > 0 ? routineDone / tasks.length : 0;
  const medRatio = meds.length > 0 ? medsDone / meds.length : 0;

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

  useEffect(() => {
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
    patientTitle: {
      fontSize: 20,
      color: colors.text,
      ...fonts.medium,
      flex: 1,
    },
    content: { padding: spacing.xl, paddingBottom: 100 },
    liveCard: {
      backgroundColor: colors.bg,
      borderRadius: radius.lg,
      padding: spacing.lg,
      marginBottom: spacing.xxl,
      shadowColor: colors.violet,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 10,
      elevation: 3,
      borderLeftWidth: 4,
      borderLeftColor: colors.violet,
    },
    liveCardTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    liveCardLeft: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    liveCardTitle: { fontSize: 15, color: colors.text, ...fonts.medium },
    liveCardSub: { fontSize: 12, color: colors.muted, ...fonts.regular, marginTop: 2 },
    liveCardBtn: {
      backgroundColor: colors.violet,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
    },
    liveCardBtnText: { fontSize: 13, color: "#fff", ...fonts.medium },
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
    helpTitle: { fontSize: 15, color: colors.text, ...fonts.medium },
    helpTime: { fontSize: 12, color: colors.muted, ...fonts.regular, marginTop: 2 },
    dismissBtn: {
      backgroundColor: colors.violet50,
      borderRadius: radius.pill,
      paddingHorizontal: 14,
      paddingVertical: 7,
    },
    dismissText: { fontSize: 12, color: colors.violet, ...fonts.medium },
    logsBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      backgroundColor: colors.bg, borderRadius: radius.lg,
      padding: spacing.lg, marginBottom: spacing.xxl,
      shadowColor: colors.violet, shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.07, shadowRadius: 10, elevation: 2,
      borderLeftWidth: 4, borderLeftColor: colors.violet,
    },
    logsBtnLeft: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    logsBtnText: { fontSize: 15, color: colors.text, ...fonts.medium },
    logsBtnSub: { fontSize: 12, color: colors.muted, ...fonts.regular, marginTop: 2 },
    section: { marginTop: spacing.xl },
    noItems: { fontSize: 14, color: colors.muted, ...fonts.regular, paddingVertical: spacing.md },
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
      width: 30, height: 30, borderRadius: 15,
      backgroundColor: colors.surface,
      alignItems: "center", justifyContent: "center",
    },
    dotCircleDone: { backgroundColor: colors.violet },
    readRowBody: { flex: 1 },
    readLabel: { fontSize: 15, color: colors.text, ...fonts.medium },
    readLabelDone: { color: colors.muted, textDecorationLine: "line-through" },
    readTime: { fontSize: 12, color: colors.muted, ...fonts.regular, marginTop: 2 },
    reportsCard: {
      backgroundColor: colors.bg, borderRadius: radius.lg,
      padding: spacing.lg, marginTop: spacing.lg,
      shadowColor: colors.violet, shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.07, shadowRadius: 10, elevation: 2,
    },
    reportsLabel: {
      fontSize: 11, color: colors.muted, ...fonts.medium,
      letterSpacing: 1.2, textTransform: "uppercase",
      marginBottom: spacing.md,
    },
    reportBtn: {
      flex: 1, backgroundColor: colors.violet, borderRadius: radius.pill,
      paddingVertical: spacing.md, flexDirection: "row", alignItems: "center",
      justifyContent: "center", gap: spacing.xs,
    },
    reportBtnText: { fontSize: 13, color: "#FFFFFF", ...fonts.medium },
    reportBtnAlt: {
      flex: 1, borderWidth: 1.5, borderColor: colors.violet, borderRadius: radius.pill,
      paddingVertical: spacing.md, flexDirection: "row", alignItems: "center",
      justifyContent: "center", gap: spacing.xs,
    },
    reportBtnAltText: { fontSize: 13, color: colors.violet, ...fonts.medium },
  }), [colors]);

  return (
    <View style={styles.container}>
      <View style={[styles.backBar, { paddingTop: Math.max(insets.top, spacing.lg) }]}>
        <TouchableOpacity style={styles.backBtn} onPress={handleBack} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.patientTitle}>{patientName}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Live View card */}
        <View style={styles.liveCard}>
          <View style={styles.liveCardTop}>
            <View style={styles.liveCardLeft}>
              <Ionicons name="videocam-outline" size={22} color={colors.violet} />
              <View>
                <Text style={styles.liveCardTitle}>Live View</Text>
                <Text style={styles.liveCardSub}>
                  {liveLoading ? "Waiting for patient to approve…" : "Patient must approve before stream begins"}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.liveCardBtn, liveLoading && { opacity: 0.6 }]}
              onPress={handleRequestLiveView}
              activeOpacity={0.8}
              disabled={liveLoading}
            >
              <Text style={styles.liveCardBtnText}>
                {liveLoading ? "Waiting…" : "Request"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

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

        {/* Check-In Logs */}
        <TouchableOpacity style={styles.logsBtn} onPress={onViewLogs} activeOpacity={0.75}>
          <View style={styles.logsBtnLeft}>
            <Ionicons name="journal-outline" size={22} color={colors.violet} />
            <View>
              <Text style={styles.logsBtnText}>Check-In Logs</Text>
              <Text style={styles.logsBtnSub}>View daily notes & AI summaries</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </TouchableOpacity>

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

        {/* Doctor Reports */}
        <View style={styles.reportsCard}>
          <Text style={styles.reportsLabel}>DOCTOR REPORTS</Text>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <TouchableOpacity
              style={styles.reportBtn}
              onPress={() => setExportOpen(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="document-text-outline" size={16} color="#FFFFFF" />
              <Text style={styles.reportBtnText}>Generate Report</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.reportBtnAlt}
              onPress={() => navigation.navigate("VisitReports", { patientId, patientName })}
              activeOpacity={0.8}
            >
              <Ionicons name="calendar-outline" size={16} color={colors.violet} />
              <Text style={styles.reportBtnAltText}>Schedule Visit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.reportBtnAlt}
              onPress={() => navigation.navigate("CaregiverHealth", { patientId, patientName })}
              activeOpacity={0.8}
            >
              <Ionicons name="pulse" size={16} color={colors.violet} />
              <Text style={styles.reportBtnAltText}>Health</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ExportFlowSheet visible={exportOpen} patientId={patientId} onClose={() => setExportOpen(false)} />
      </ScrollView>
    </View>
  );
}
