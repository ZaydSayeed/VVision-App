import React, { useMemo, useState } from "react";
import { View, ScrollView, Text, StyleSheet, RefreshControl } from "react-native";
import { useRoute } from "@react-navigation/native";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../config/theme";
import { useHealthSummary } from "../../hooks/useHealthSummary";
import { useHealthTrends } from "../../hooks/useHealthTrends";
import { MetricCard } from "../../components/health/MetricCard";
import { RangeToggle, Range } from "../../components/health/RangeToggle";

const EMPTY_HINT = "No data yet — patient hasn't connected a wearable.";

export function CaregiverHealthScreen() {
  const { colors } = useTheme();
  const route = useRoute<any>();
  const patientId: string = route.params?.patientId;
  const patientName: string = route.params?.patientName ?? "Patient";
  const [range, setRange] = useState<Range>("30d");
  const summary = useHealthSummary(patientId);
  const trends = useHealthTrends(patientId, range);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([summary.refresh(), trends.refresh()]);
    setRefreshing(false);
  };

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    content: { padding: 16, paddingBottom: 40 },
    header: { ...fonts.regular, fontSize: 28, color: colors.text, marginBottom: 4 },
    sub: { ...fonts.regular, fontSize: 14, color: colors.muted, marginBottom: 18 },
  }), [colors]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.violet} />}
    >
      <Text style={styles.header}>{patientName}'s Health</Text>
      <Text style={styles.sub}>Trends from connected devices</Text>
      <RangeToggle value={range} onChange={setRange} />
      <MetricCard
        title="Steps"
        value={summary.data?.steps?.value?.toLocaleString() ?? "—"}
        unit={summary.data?.steps ? "today" : undefined}
        trend={trends.trends.steps?.points ?? []}
        emptyHint={EMPTY_HINT}
      />
      <MetricCard
        title="Heart Rate"
        value={summary.data?.heartRate?.value ?? "—"}
        unit={summary.data?.heartRate?.unit}
        trend={trends.trends.heart_rate?.points ?? []}
        emptyHint={EMPTY_HINT}
      />
      <MetricCard
        title="Active Minutes"
        value={summary.data?.activeMinutes?.value ?? "—"}
        unit={summary.data?.activeMinutes ? "today" : undefined}
        trend={trends.trends.active_minutes?.points ?? []}
        emptyHint={EMPTY_HINT}
      />
      <MetricCard
        title="Sleep"
        value={summary.data?.sleep?.value ?? "—"}
        unit={summary.data?.sleep?.unit}
        trend={trends.trends.sleep?.points ?? []}
        emptyHint={EMPTY_HINT}
      />
    </ScrollView>
  );
}
