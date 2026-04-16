import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { LineChart } from "react-native-gifted-charts";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../config/theme";
import type { TrendPoint } from "../../api/health";

interface Props {
  title: string;
  value: string | number;
  unit?: string;
  trend: TrendPoint[];
  emptyHint?: string;
}

export function MetricCard({ title, value, unit, trend, emptyHint }: Props) {
  const { colors } = useTheme();
  const data = useMemo(() => trend.map((p) => ({ value: p.value, label: p.date.slice(5) })), [trend]);
  const isEmpty = trend.length === 0;

  const styles = useMemo(() => StyleSheet.create({
    card: {
      backgroundColor: colors.warm,
      borderRadius: 18,
      padding: 18,
      marginBottom: 14,
      shadowColor: colors.coral,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 10,
    },
    title: { ...fonts.medium, fontSize: 13, color: colors.violet, textTransform: "uppercase", letterSpacing: 1.2 },
    valueRow: { flexDirection: "row", alignItems: "baseline", marginTop: 6 },
    value: { ...fonts.regular, fontSize: 32, color: colors.text },
    unit: { ...fonts.regular, fontSize: 14, color: colors.muted, marginLeft: 6 },
    chartWrap: { marginTop: 12, marginLeft: -16 },
    empty: { ...fonts.regular, fontSize: 14, color: colors.muted, marginTop: 16, lineHeight: 20 },
  }), [colors]);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      {isEmpty ? (
        <Text style={styles.empty}>{emptyHint ?? "No data yet."}</Text>
      ) : (
        <>
          <View style={styles.valueRow}>
            <Text style={styles.value}>{value}</Text>
            {unit ? <Text style={styles.unit}>{unit}</Text> : null}
          </View>
          <View style={styles.chartWrap}>
            <LineChart
              data={data}
              areaChart
              startFillColor={colors.violet}
              endFillColor={colors.warm}
              startOpacity={0.4}
              endOpacity={0.05}
              color={colors.violet}
              thickness={2}
              hideDataPoints
              hideRules
              hideYAxisText
              xAxisLabelTextStyle={{ color: colors.muted, fontSize: 10 }}
              initialSpacing={0}
              endSpacing={0}
              spacing={26}
              height={120}
              curved
            />
          </View>
        </>
      )}
    </View>
  );
}
