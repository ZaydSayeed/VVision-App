import React, { useState, useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { LineChart } from "react-native-gifted-charts";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../config/theme";
import { RangeToggle, Range } from "./RangeToggle";
import { useMetricTrend } from "../../hooks/useMetricTrend";

type Metric = "steps" | "heart_rate" | "active_minutes" | "sleep";

interface Props {
  title: string;
  iconName: keyof typeof Ionicons.glyphMap;
  accentColor: string;
  value: string | number;
  unit?: string;
  metric: Metric;
  patientId: string | null;
  isExpanded: boolean;
  onToggle: () => void;
}

export function ExpandableMetricCard({
  title, iconName, accentColor, value, unit, metric, patientId, isExpanded, onToggle,
}: Props) {
  const { colors } = useTheme();
  const [range, setRange] = useState<Range>("1d");
  const { points, loading } = useMetricTrend(patientId, metric, range, isExpanded);

  const chartData = useMemo(
    () => points.map((p) => ({ value: p.value, label: p.date.slice(5) })),
    [points]
  );

  const styles = useMemo(() => StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 18,
      marginBottom: 14,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
    },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    left: { flexDirection: "row", alignItems: "center", gap: 10 },
    iconCircle: {
      width: 36, height: 36, borderRadius: 10,
      alignItems: "center", justifyContent: "center",
    },
    title: { ...fonts.medium, fontSize: 13, color: colors.muted, textTransform: "uppercase", letterSpacing: 0.8 },
    valueRow: { flexDirection: "row", alignItems: "baseline", marginTop: 10, gap: 4 },
    value: { ...fonts.medium, fontSize: 36, color: colors.text },
    unit: { ...fonts.regular, fontSize: 14, color: colors.muted },
    chartWrap: { marginTop: 14 },
    noData: { ...fonts.regular, fontSize: 13, color: colors.muted, marginTop: 14, textAlign: "center", paddingVertical: 20 },
  }), [colors]);

  return (
    <TouchableOpacity style={styles.card} onPress={onToggle} activeOpacity={0.85}>
      <View style={styles.header}>
        <View style={styles.left}>
          <View style={[styles.iconCircle, { backgroundColor: accentColor + "22" }]}>
            <Ionicons name={iconName} size={18} color={accentColor} />
          </View>
          <Text style={styles.title}>{title}</Text>
        </View>
        <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={18} color={colors.muted} />
      </View>

      <View style={styles.valueRow}>
        <Text style={styles.value}>{value === "—" ? "—" : String(value)}</Text>
        {unit ? <Text style={styles.unit}>{unit}</Text> : null}
      </View>

      {isExpanded && (
        <View style={styles.chartWrap}>
          <RangeToggle value={range} onChange={setRange} />
          {loading ? (
            <ActivityIndicator color={accentColor} style={{ marginVertical: 20 }} />
          ) : chartData.length === 0 ? (
            <Text style={styles.noData}>No data for this period</Text>
          ) : (
            <LineChart
              data={chartData}
              areaChart
              startFillColor={accentColor}
              endFillColor={colors.surface}
              startOpacity={0.3}
              endOpacity={0.02}
              color={accentColor}
              thickness={2.5}
              hideDataPoints={chartData.length > 7}
              dataPointsColor={accentColor}
              dataPointsRadius={3}
              hideRules
              hideYAxisText
              xAxisLabelTextStyle={{ color: colors.muted, fontSize: 9 }}
              initialSpacing={0}
              endSpacing={0}
              spacing={Math.max(24, Math.floor(300 / Math.max(chartData.length, 1)))}
              height={130}
              curved
            />
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}
