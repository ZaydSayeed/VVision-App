import React, { useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useHelpAlert } from "../../hooks/useHelpAlert";
import { useTheme } from "../../context/ThemeContext";
import { fonts, spacing, radius } from "../../config/theme";
import { formatTimeShort } from "../../hooks/useDashboardData";
import { HelpAlert } from "../../types";

function groupByDate(alerts: HelpAlert[]): { date: string; items: HelpAlert[] }[] {
  const map = new Map<string, HelpAlert[]>();
  for (const a of alerts) {
    const d = a.timestamp.slice(0, 10);
    if (!map.has(d)) map.set(d, []);
    map.get(d)!.push(a);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, items]) => ({ date, items }));
}

function formatDateLabel(iso: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (iso === today) return "Today";
  if (iso === yesterday) return "Yesterday";
  return new Date(iso).toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
}

const CAUSE_COLORS: Record<string, string> = {
  Confusion: "#7B5CE7",
  Pain: "#E74C3C",
  Anxiety: "#E8934A",
  Fell: "#C0392B",
  Wandered: "#2980B9",
  Sundowning: "#8E44AD",
  Other: "#7F8C8D",
};

export function HelpHistoryScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const { alerts, reload } = useHelpAlert();
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  const allHandled = alerts.filter((a) => a.dismissed);
  const grouped = useMemo(() => groupByDate(allHandled), [allHandled]);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.lg,
      paddingBottom: spacing.md,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
    },
    backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
    headerTitle: { fontSize: 24, color: colors.text, ...fonts.medium },
    content: { paddingBottom: 80 },
    dateGroup: { marginBottom: spacing.xxl },
    dateLabel: {
      fontSize: 13,
      color: colors.muted,
      ...fonts.medium,
      letterSpacing: 0.5,
      paddingHorizontal: spacing.xl,
      marginBottom: spacing.sm,
    },
    alertCard: {
      marginHorizontal: spacing.xl,
      marginBottom: spacing.sm,
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      padding: spacing.lg,
      borderLeftWidth: 3,
    },
    alertTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: spacing.xs,
    },
    alertTime: { fontSize: 13, color: colors.muted, ...fonts.regular },
    statusBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
      borderRadius: radius.pill,
    },
    statusText: { fontSize: 11, ...fonts.medium },
    causeRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.xs },
    causeDot: { width: 8, height: 8, borderRadius: 4 },
    causeText: { fontSize: 13, color: colors.text, ...fonts.medium },
    noteText: {
      fontSize: 13,
      color: colors.muted,
      ...fonts.regular,
      marginTop: spacing.sm,
      lineHeight: 20,
    },
    emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80, gap: spacing.md },
    emptyText: { fontSize: 16, color: colors.muted, ...fonts.regular },
  }), [colors]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help History</Text>
      </View>

      {grouped.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="time-outline" size={44} color={colors.border} />
          <Text style={styles.emptyText}>No help requests yet</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.violet} />}
          showsVerticalScrollIndicator={false}
        >
          {grouped.map(({ date, items }) => (
            <View key={date} style={styles.dateGroup}>
              <Text style={styles.dateLabel}>{formatDateLabel(date)}</Text>
              {items.map((alert) => {
                const isResolved = alert.resolved && !alert.cancelled;
                const isCancelled = alert.cancelled;
                const causeColor = alert.cause ? (CAUSE_COLORS[alert.cause] ?? colors.muted) : colors.muted;
                const borderColor = isCancelled ? colors.border : isResolved ? colors.coral : colors.amber;
                return (
                  <View key={alert.id} style={[styles.alertCard, { borderLeftColor: borderColor }]}>
                    <View style={styles.alertTop}>
                      <Text style={styles.alertTime}>{formatTimeShort(alert.timestamp)}</Text>
                      <View style={[styles.statusBadge, {
                        backgroundColor: isCancelled ? colors.surface : isResolved ? colors.coralSoft : colors.amberSoft,
                      }]}>
                        <Text style={[styles.statusText, {
                          color: isCancelled ? colors.muted : isResolved ? colors.coral : colors.amber,
                        }]}>
                          {isCancelled ? "Cancelled" : "Handled"}
                        </Text>
                      </View>
                    </View>

                    {alert.cause && !isCancelled && (
                      <View style={styles.causeRow}>
                        <View style={[styles.causeDot, { backgroundColor: causeColor }]} />
                        <Text style={styles.causeText}>{alert.cause}</Text>
                      </View>
                    )}

                    {alert.note ? (
                      <Text style={styles.noteText}>"{alert.note}"</Text>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
