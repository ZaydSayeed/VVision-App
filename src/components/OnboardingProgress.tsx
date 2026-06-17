import React, { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import { useOnboarding } from "../hooks/useOnboarding";
import { useTheme } from "../context/ThemeContext";
import { radius } from "../config/theme";

const STEPS = ["profile_basics", "profile_story", "siblings", "smart_home", "caller_setup", "paywall"] as const;

export default function OnboardingProgress() {
  const { progress } = useOnboarding();
  const { colors } = useTheme();

  const styles = useMemo(() => StyleSheet.create({
    row: { flexDirection: "row", paddingHorizontal: 24, paddingTop: 8, gap: 4 },
    segment: { flex: 1, height: 6, borderRadius: radius.pill },
  }), [colors]);

  return (
    <View style={styles.row}>
      {STEPS.map((s) => (
        <View
          key={s}
          style={[styles.segment, { backgroundColor: progress[s] ? colors.violet : colors.surface }]}
        />
      ))}
    </View>
  );
}
