import React, { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useOnboarding } from "../../hooks/useOnboarding";
import { useTheme } from "../../context/ThemeContext";
import { fonts, spacing, radius } from "../../config/theme";
import OnboardingProgress from "../../components/OnboardingProgress";

export default function SmartHomeStep({ navigation }: any) {
  const { complete } = useOnboarding();
  const { colors } = useTheme();

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, padding: spacing.xxl, justifyContent: "center" as const },
    title: { fontSize: 24, lineHeight: 30, ...fonts.medium, color: colors.text, marginBottom: spacing.sm },
    subtitle: { fontSize: 15, lineHeight: 22, ...fonts.regular, color: colors.muted, marginBottom: spacing.xxxl },
    primaryBtn: { backgroundColor: colors.violet, padding: spacing.lg, borderRadius: radius.pill, minHeight: 56, justifyContent: "center" as const, marginBottom: spacing.md },
    primaryBtnText: { color: "#FFFFFF", textAlign: "center" as const, ...fonts.medium, fontSize: 16 },
    skipText: { fontSize: 15, ...fonts.regular, color: colors.muted, textAlign: "center" as const, paddingVertical: spacing.md },
  }), [colors]);

  const advance = async () => {
    await complete("smart_home");
    navigation.navigate("CallerSetupStep");
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
    <OnboardingProgress />
    <View style={styles.container}>
      <Text style={styles.title}>Use the smart home you already have?</Text>
      <Text style={styles.subtitle}>
        If your parent's home has Apple HomeKit sensors (motion, doors), Vela can quietly learn their rhythms — no new hardware needed.
      </Text>
      <Pressable onPress={advance} style={styles.primaryBtn}>
        <Text style={styles.primaryBtnText}>Yes, we have smart home</Text>
      </Pressable>
      <Pressable onPress={advance}>
        <Text style={styles.skipText}>Not right now</Text>
      </Pressable>
    </View>
    </View>
  );
}
