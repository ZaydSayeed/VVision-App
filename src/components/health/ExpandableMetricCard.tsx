import React, { useState, useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { LineChart } from "react-native-gifted-charts";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { fonts, spacing, radius } from "../../config/theme";
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

const CUMULATIVE_METRICS: Metric[] = ["steps", "active_minutes", "sleep"];

function formatXLabel(date: string, range: Range): string {
  if (range === "1d") {
    const hour = parseInt(date.slice(0, 2), 10);
    if (hour === 0) return "12AM";
    if (hour === 6) return "6AM";
    if (hour === 12) return "12PM";
    if (hour === 18) return "6PM";
    return "";
  }
  if (range === "7d") {
    const d = new Date(date + "T12:00:00Z");
    return d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
  }
  if (range === "30d") return date.slice(8);
  if (range === "90d") return date.slice(5);
  return date.slice(5);
}

function shouldShowLabel(index: number, total: number, range: Range): boolean {
  if (range === "7d") return true;
  if (range === "30d") return index % 5 === 0 || index === total - 1;
  if (range === "90d") return index % 14 === 0 || index === total - 1;
  return true;
}

export function ExpandableMetricCard({
  title, iconName, accentColor, value, unit, metric, patientId, isExpanded, onToggle,
}: Props) {
  const { colors } = useTheme();
  const [range, setRange] = useState<Range>("7d");
  const { points, loading } = useMetricTrend(patientId, metric, range, isExpanded);

  const chartData = useMemo(() => {
    return points.map((p, i) => ({
      value: p.value,
      label: shouldShowLabel(i, points.length, range) ? formatXLabel(p.date, range) : "",
      dataPointText: "",
    }));
  }, [points, range]);

  const maxVal = chartData.length > 0 ? Math.max(...chartData.map((d) => d.value)) : 0;
  const minVal = chartData.length > 0 ? Math.min(...chartData.map((d) => d.value)) : 0;

  const is1dCumulative = range === "1d" && CUMULATIVE_METRICS.includes(metric);

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
    todayTotal: {
      alignItems: "center",
      paddingVertical: 24,
    },
    todayLabel: { ...fonts.regular, fontSize: 12, color: colors.muted, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.8 },
    todayValue: { ...fonts.medium, fontSize: 48, color: colors.text },
    todayUnit: { ...fonts.regular, fontSize: 16, color: colors.muted, marginTop: 2 },
    tooltipBox: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
    },
    tooltipValue: { ...fonts.medium, fontSize: 14, color: colors.text },
    tooltipLabel: { ...fonts.regular, fontSize: 11, color: colors.muted },
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
          ) : is1dCumulative ? (
            chartData.length === 0 ? (
              <Text style={styles.noData}>No data yet today</Text>
            ) : (
              <View style={styles.todayTotal}>
                <Text style={styles.todayLabel}>Today's total</Text>
                <Text style={styles.todayValue}>{chartData[0].value.toLocaleString()}</Text>
                {unit ? <Text style={styles.todayUnit}>{unit}</Text> : null}
              </View>
            )
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
              yAxisTextStyle={{ color: colors.muted, fontSize: 10 }}
              yAxisLabelWidth={36}
              xAxisLabelTextStyle={{ color: colors.muted, fontSize: 9 }}
              initialSpacing={0}
              endSpacing={0}
              spacing={Math.max(24, Math.floor(300 / Math.max(chartData.length, 1)))}
              height={130}
              curved
              maxValue={maxVal > 0 ? maxVal * 1.1 : 10}
              mostNegativeValue={minVal}
              noOfSections={2}
              pointerConfig={{
                pointerStripHeight: 130,
                pointerStripColor: colors.muted + "44",
                pointerStripWidth: 1.5,
                pointerColor: accentColor,
                radius: 5,
                pointerLabelWidth: 90,
                pointerLabelHeight: 44,
                activatePointersOnLongPress: false,
                autoAdjustPointerLabelPosition: true,
                pointerLabelComponent: (items: Array<{ value: number; label: string }>) => (
                  <View style={styles.tooltipBox}>
                    <Text style={styles.tooltipValue}>{items[0]?.value?.toLocaleString()}</Text>
                    <Text style={styles.tooltipLabel}>{items[0]?.label}</Text>
                  </View>
                ),
              }}
            />
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}
