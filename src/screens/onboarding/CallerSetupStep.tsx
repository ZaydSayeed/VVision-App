import React, { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useOnboarding } from "../../hooks/useOnboarding";
import { useTheme } from "../../context/ThemeContext";
import { fonts, spacing, radius } from "../../config/theme";
import OnboardingProgress from "../../components/OnboardingProgress";

export default function CallerSetupStep({ navigation }: any) {
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
    await complete("caller_setup");
    navigation.navigate("PaywallStep");
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
    <OnboardingProgress />
    <View style={styles.container}>
      <Text style={styles.title}>Set up a companion caller?</Text>
      <Text style={styles.subtitle}>
        Vela can proactively check in with your parent by call or SMS — a gentle nudge to ensure they're okay. You can configure this later from the app.
      </Text>
      <Pressable onPress={advance} style={styles.primaryBtn}>
        <Text style={styles.primaryBtnText}>Sounds good</Text>
      </Pressable>
      <Pressable onPress={advance}>
        <Text style={styles.skipText}>Skip for now</Text>
      </Pressable>
    </View>
    </View>
  );
}
