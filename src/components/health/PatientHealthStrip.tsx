import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../config/theme";
import { useHealthSummary } from "../../hooks/useHealthSummary";

interface Props { patientId: string; }

export function PatientHealthStrip({ patientId }: Props) {
  const { colors } = useTheme();
  const { data } = useHealthSummary(patientId);

  const hasAny = data && (data.steps || data.heartRate || data.sleep);
  if (!hasAny) return null;

  const styles = useMemo(() => StyleSheet.create({
    row: { flexDirection: "row", alignItems: "center", gap: 14, marginTop: 8 },
    chip: { flexDirection: "row", alignItems: "center", gap: 4 },
    label: { ...fonts.medium, fontSize: 13, color: colors.muted },
  }), [colors]);

  return (
    <View style={styles.row}>
      {data.steps && (
        <View style={styles.chip}>
          <Ionicons name="footsteps" size={14} color={colors.violet} />
          <Text style={styles.label}>{data.steps.value.toLocaleString()}</Text>
        </View>
      )}
      {data.heartRate && (
        <View style={styles.chip}>
          <Ionicons name="heart" size={14} color={colors.coral} />
          <Text style={styles.label}>{data.heartRate.value} bpm</Text>
        </View>
      )}
      {data.sleep && (
        <View style={styles.chip}>
          <Ionicons name="moon" size={14} color={colors.violet} />
          <Text style={styles.label}>{data.sleep.value}h</Text>
        </View>
      )}
    </View>
  );
}
