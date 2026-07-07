import React, { useState, useMemo } from "react";
import { View, Text, TextInput, Pressable, Alert, ScrollView, StyleSheet } from "react-native";
import { authFetch } from "../../api/authFetch";
import { useCurrentProfile } from "../../hooks/useCurrentProfile";
import { useOnboarding } from "../../hooks/useOnboarding";
import { useTheme } from "../../context/ThemeContext";
import { fonts, spacing, radius } from "../../config/theme";
import OnboardingProgress from "../../components/OnboardingProgress";

export default function ProfileBasicsStep({ navigation }: any) {
  const { patientId } = useCurrentProfile();
  const { complete } = useOnboarding();
  const { colors } = useTheme();
  const [name, setName] = useState("");
  const [stage, setStage] = useState<"mild" | "moderate" | "severe" | "">("");
  const [busy, setBusy] = useState(false);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, padding: spacing.xxl },
    title: { fontSize: 24, lineHeight: 30, ...fonts.medium, color: colors.text, marginBottom: spacing.sm },
    subtitle: { fontSize: 15, lineHeight: 22, ...fonts.regular, color: colors.muted, marginBottom: spacing.xxl },
    input: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: spacing.lg, borderRadius: radius.md, fontSize: 16, ...fonts.regular, color: colors.text, marginBottom: spacing.lg, minHeight: 52 },
    stageLabel: { fontSize: 15, ...fonts.medium, color: colors.text, marginBottom: spacing.sm },
    stageRow: { flexDirection: "row" as const, gap: spacing.sm, marginBottom: spacing.xxl },
    stageBtn: { flex: 1, paddingVertical: spacing.md, borderRadius: radius.pill, minHeight: 44, justifyContent: "center" as const },
    stageBtnText: { textAlign: "center" as const, fontSize: 14, ...fonts.medium, textTransform: "capitalize" as const },
    continueBtn: { padding: spacing.lg, borderRadius: radius.pill, minHeight: 56, justifyContent: "center" as const },
    continueBtnText: { color: "#FFFFFF", textAlign: "center" as const, ...fonts.medium, fontSize: 16 },
  }), [colors]);

  const next = async () => {
    if (!patientId || !name.trim()) return;
    setBusy(true);
    try {
      await authFetch(`/api/patients/mine`, { method: "PATCH", body: JSON.stringify({ name }) });
      if (stage) await authFetch(`/api/profiles/mine`, { method: "PATCH", body: JSON.stringify({ stage }) });
      await complete("profile_basics");
      navigation.navigate("ProfileStory");
    } catch (e: any) {
      Alert.alert("Couldn't save", e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
    <OnboardingProgress />
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Tell us about your parent</Text>
      <Text style={styles.subtitle}>These basics let Vela address them correctly and tune its tone.</Text>
      <TextInput
        placeholder="Their name (e.g. Mom, or Sharon)"
        placeholderTextColor={colors.muted}
        value={name} onChangeText={setName}
        style={styles.input}
      />
      <Text style={styles.stageLabel}>Current stage (you can change this later)</Text>
      <View style={styles.stageRow}>
        {(["mild", "moderate", "severe"] as const).map(s => (
          <Pressable
            key={s}
            onPress={() => setStage(s)}
            style={[styles.stageBtn, { backgroundColor: stage === s ? colors.violet : colors.surface }]}
          >
            <Text style={[styles.stageBtnText, { color: stage === s ? "white" : colors.text }]}>{s}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable
        disabled={!name.trim() || busy}
        onPress={next}
        style={[styles.continueBtn, { backgroundColor: !!name.trim() && !busy ? colors.violet : colors.border }]}
      >
        <Text style={styles.continueBtnText}>{busy ? "Saving…" : "Continue"}</Text>
      </Pressable>
    </ScrollView>
    </View>
  );
}
