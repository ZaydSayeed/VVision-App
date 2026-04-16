import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../config/theme";

export type Range = "7d" | "30d" | "90d";

interface Props {
  value: Range;
  onChange: (r: Range) => void;
}

export function RangeToggle({ value, onChange }: Props) {
  const { colors } = useTheme();
  const ranges: Range[] = ["7d", "30d", "90d"];

  const styles = useMemo(() => StyleSheet.create({
    row: { flexDirection: "row", backgroundColor: colors.warm, borderRadius: 12, padding: 4, alignSelf: "center", marginBottom: 14 },
    pill: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 8 },
    pillActive: { backgroundColor: colors.violet },
    label: { ...fonts.medium, fontSize: 13, color: colors.muted },
    labelActive: { color: "#FFFFFF" },
  }), [colors]);

  return (
    <View style={styles.row}>
      {ranges.map((r) => (
        <TouchableOpacity
          key={r}
          style={[styles.pill, r === value && styles.pillActive]}
          onPress={() => onChange(r)}
          activeOpacity={0.7}
        >
          <Text style={[styles.label, r === value && styles.labelActive]}>{r}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
