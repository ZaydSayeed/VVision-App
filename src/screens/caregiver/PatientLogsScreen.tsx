import React, { useMemo, useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../context/ThemeContext";
import { fonts, spacing, radius } from "../../config/theme";
import { fetchLogs, CheckInLog } from "../../api/logs";

interface Props {
  patientId: string;
  patientName: string;
  onBack: () => void;
  onSelectLog: (log: CheckInLog) => void;
}

function groupByDay(logs: CheckInLog[]): { date: string; entries: CheckInLog[] }[] {
  const map = new Map<string, CheckInLog[]>();
  for (const log of logs) {
    const day = new Date(log.capturedAt).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    if (!map.has(day)) map.set(day, []);
    map.get(day)!.push(log);
  }
  return Array.from(map.entries()).map(([date, entries]) => ({ date, entries }));
}

export function PatientLogsScreen({ patientId, patientName, onBack, onSelectLog }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [logs, setLogs] = useState<CheckInLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const data = await fetchLogs(patientId);
      setLogs(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, [patientId]);

  const groups = useMemo(() => groupByDay(logs), [logs]);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    backBar: {
      flexDirection: "row", alignItems: "center",
      paddingHorizontal: spacing.xl, paddingBottom: spacing.md, gap: spacing.sm,
    },
    backBtn: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: colors.surface, alignItems: "center", justifyContent: "center",
    },
    title: { fontSize: 20, color: colors.text, ...fonts.medium, flex: 1 },
    content: { padding: spacing.xl, paddingBottom: 100 },
    dayLabel: {
      fontSize: 11, color: colors.violet, ...fonts.medium,
      letterSpacing: 1.2, textTransform: "uppercase",
      marginBottom: spacing.sm, marginTop: spacing.lg,
    },
    logCard: {
      backgroundColor: colors.bg, borderRadius: radius.lg,
      padding: spacing.lg, marginBottom: spacing.sm,
      borderLeftWidth: 4, borderLeftColor: colors.violet,
      shadowColor: colors.violet, shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.07, shadowRadius: 10, elevation: 2,
      flexDirection: "row", alignItems: "center", gap: spacing.md,
    },
    logBody: { flex: 1 },
    logTime: { fontSize: 12, color: colors.violet, ...fonts.medium, marginBottom: 3 },
    logPreview: { fontSize: 14, color: colors.text, ...fonts.regular, lineHeight: 20 },
    logSource: { fontSize: 11, color: colors.muted, ...fonts.regular, marginTop: 3 },
    emptyWrap: { alignItems: "center", paddingTop: 80, gap: spacing.md },
    emptyText: { fontSize: 15, color: colors.muted, ...fonts.regular, textAlign: "center" },
    emptySubtext: { fontSize: 13, color: colors.muted, ...fonts.regular, textAlign: "center", lineHeight: 20 },
  }), [colors]);

  return (
    <View style={styles.container}>
      <View style={[styles.backBar, { paddingTop: Math.max(insets.top, spacing.lg) }]}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{patientName} — Logs</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.violet} style={{ marginTop: 60 }} />
      ) : error ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="alert-circle-outline" size={40} color={colors.muted} />
          <Text style={styles.emptyText}>Couldn't load logs</Text>
          <Text style={styles.emptySubtext}>{error}</Text>
        </View>
      ) : groups.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="journal-outline" size={48} color={colors.border} />
          <Text style={styles.emptyText}>No check-ins yet</Text>
          <Text style={styles.emptySubtext}>
            Use the Check In button on the{"\n"}Timeline screen to add notes.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={colors.violet} />}
        >
          {groups.map((group) => (
            <View key={group.date}>
              <Text style={styles.dayLabel}>{group.date}</Text>
              {group.entries.map((log) => {
                const time = new Date(log.capturedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                const preview = log.content.length > 100 ? log.content.slice(0, 100) + "…" : log.content;
                return (
                  <TouchableOpacity key={log.id} style={styles.logCard} onPress={() => onSelectLog(log)} activeOpacity={0.75}>
                    <View style={styles.logBody}>
                      <Text style={styles.logTime}>{time}</Text>
                      <Text style={styles.logPreview}>{preview}</Text>
                      <Text style={styles.logSource}>{log.source === "voice_check_in" ? "🎙 Voice" : "⌨️ Text"}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
