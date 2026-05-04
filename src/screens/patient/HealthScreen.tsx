import React, { useEffect, useMemo, useState } from "react";
import { View, ScrollView, Text, StyleSheet, RefreshControl } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../config/theme";
import { useAuth } from "../../context/AuthContext";
import { useHealthSummary } from "../../hooks/useHealthSummary";
import { ExpandableMetricCard } from "../../components/health/ExpandableMetricCard";
import { isHealthOnboarded } from "./HealthOnboardingScreen";
import { syncNow } from "../../services/healthSync";

type Metric = "steps" | "heart_rate" | "active_minutes" | "sleep";

const METRIC_CONFIG: Array<{
  metric: Metric;
  title: string;
  iconName: any;
  accentColor: string;
  summaryKey: "steps" | "heartRate" | "activeMinutes" | "sleep";
}> = [
  { metric: "steps", title: "Steps", iconName: "footsteps-outline", accentColor: "#F97316", summaryKey: "steps" },
  { metric: "heart_rate", title: "Heart Rate", iconName: "heart-outline", accentColor: "#EF4444", summaryKey: "heartRate" },
  { metric: "active_minutes", title: "Active Minutes", iconName: "flash-outline", accentColor: "#22C55E", summaryKey: "activeMinutes" },
  { metric: "sleep", title: "Sleep", iconName: "moon-outline", accentColor: "#6366F1", summaryKey: "sleep" },
];

function getSummaryValues(data: any) {
  return {
    steps: { value: data?.steps?.value ?? "—", unit: data?.steps ? "steps today" : undefined },
    heartRate: { value: data?.heartRate?.value ?? "—", unit: data?.heartRate?.unit },
    activeMinutes: { value: data?.activeMinutes?.value ?? "—", unit: data?.activeMinutes ? "min today" : undefined },
    sleep: { value: data?.sleep?.value ?? "—", unit: data?.sleep?.unit },
  };
}

export function HealthScreen() {
  const { colors } = useTheme();
  const nav = useNavigation<any>();
  const { user } = useAuth();
  const patientId = user?.patient_id ?? null;
  const summary = useHealthSummary(patientId);
  const [expandedMetric, setExpandedMetric] = useState<Metric | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    isHealthOnboarded().then((ok) => { if (!ok) nav.navigate("HealthOnboarding"); });
  }, [nav]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (patientId) await syncNow(patientId).catch(() => {});
    await summary.refresh();
    setRefreshing(false);
  };

  const vals = getSummaryValues(summary.data);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    content: { padding: 16, paddingBottom: 40 },
    header: { ...fonts.medium, fontSize: 28, color: colors.text, marginBottom: 4 },
    sub: { ...fonts.regular, fontSize: 14, color: colors.muted, marginBottom: 18 },
  }), [colors]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.violet} />}
    >
      <Text style={styles.header}>Health</Text>
      <Text style={styles.sub}>Tap a card to see your trends</Text>

      {METRIC_CONFIG.map(({ metric, title, iconName, accentColor, summaryKey }) => {
        const { value, unit } = vals[summaryKey];
        return (
          <ExpandableMetricCard
            key={metric}
            title={title}
            iconName={iconName}
            accentColor={accentColor}
            value={value}
            unit={unit}
            metric={metric}
            patientId={patientId}
            isExpanded={expandedMetric === metric}
            onToggle={() => setExpandedMetric(expandedMetric === metric ? null : metric)}
          />
        );
      })}
    </ScrollView>
  );
}
