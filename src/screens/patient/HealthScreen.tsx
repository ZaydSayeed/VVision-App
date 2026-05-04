import React, { useEffect, useMemo, useState } from "react";
import { View, ScrollView, Text, StyleSheet, RefreshControl } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../config/theme";
import { useAuth } from "../../context/AuthContext";
import { useHealthSummary } from "../../hooks/useHealthSummary";
import { useHealthTrends } from "../../hooks/useHealthTrends";
import { MetricCard } from "../../components/health/MetricCard";
import { RangeToggle, Range } from "../../components/health/RangeToggle";
import { isHealthOnboarded } from "./HealthOnboardingScreen";
import { syncNow } from "../../services/healthSync";

const EMPTY_HINT = "No data yet — connect a wearable in the iPhone Health app.";

export function HealthScreen() {
  const { colors } = useTheme();
  const nav = useNavigation<any>();
  const { user } = useAuth();
  const patientId = user?.patient_id ?? null;
  const [range, setRange] = useState<Range>("7d");
  const summary = useHealthSummary(patientId);
  const trends = useHealthTrends(patientId, range);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    isHealthOnboarded().then((ok) => { if (!ok) nav.navigate("HealthOnboarding"); });
  }, [nav]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (patientId) await syncNow(patientId).catch(() => {});
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
      <Text style={styles.header}>Health</Text>
      <Text style={styles.sub}>Your trends over time</Text>
      <RangeToggle value={range} onChange={setRange} />
      <MetricCard
        title="Steps"
        value={summary.data?.steps?.value ?? "—"}
        unit={summary.data?.steps ? "today" : undefined}
        trend={trends.trends.steps?.points ?? []}
        emptyHint="No data yet — keep your iPhone with you to count steps."
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
