import React, { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useOnboarding } from "../../hooks/useOnboarding";
import { useTheme } from "../../context/ThemeContext";
import OnboardingProgress from "../../components/OnboardingProgress";

export default function CallerSetupStep({ navigation }: any) {
  const { complete } = useOnboarding();
  const { colors } = useTheme();

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, padding: 24, justifyContent: "center" as const },
    title: { fontSize: 24, fontWeight: "700", color: colors.text, marginBottom: 8 },
    subtitle: { color: colors.muted, marginBottom: 32 },
    primaryBtn: { backgroundColor: colors.violet, padding: 16, borderRadius: 12, marginBottom: 12 },
    primaryBtnText: { color: "white", textAlign: "center" as const, fontWeight: "700" as const },
    skipText: { color: colors.muted, textAlign: "center" as const },
  }), [colors]);

  const advance = async () => {
    await complete("caller_setup");
    navigation.navigate("PaywallStep");
  };

  return (
    <View style={{ flex: 1 }}>
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
