import React, { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useOnboarding } from "../../hooks/useOnboarding";
import { useTheme } from "../../context/ThemeContext";

export default function SmartHomeStep({ navigation }: any) {
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
    await complete("smart_home");
    navigation.navigate("CallerSetupStep");
  };

  return (
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
  );
}
