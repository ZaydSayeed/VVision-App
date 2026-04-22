import React, { useMemo } from "react";
import { Pressable, Text, StyleSheet } from "react-native";
import { useOnboarding } from "../hooks/useOnboarding";
import { useTheme } from "../context/ThemeContext";

export default function OnboardingReminderBanner({ navigation }: { navigation: any }) {
  const { progress, completed } = useOnboarding();
  const { colors } = useTheme();

  const styles = useMemo(() => StyleSheet.create({
    banner: { backgroundColor: colors.amberSoft, padding: 16, margin: 16, borderRadius: 10 },
    title: { fontWeight: "600", color: colors.amber },
    body: { color: colors.amber, marginTop: 4 },
  }), [colors]);

  if (completed || progress.paywall) return null;

  return (
    <Pressable style={styles.banner} onPress={() => navigation.navigate("Paywall")}>
      <Text style={styles.title}>Start your 7-day trial</Text>
      <Text style={styles.body}>Invite family and unlock the full Living Profile.</Text>
    </Pressable>
  );
}
