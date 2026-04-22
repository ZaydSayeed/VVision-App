import React, { useState, useMemo } from "react";
import { View, Text, TextInput, Pressable, Alert, ScrollView, StyleSheet } from "react-native";
import { authFetch } from "../../api/authFetch";
import { useCurrentProfile } from "../../hooks/useCurrentProfile";
import { useOnboarding } from "../../hooks/useOnboarding";
import { useTheme } from "../../context/ThemeContext";
import OnboardingProgress from "../../components/OnboardingProgress";

export default function ProfileBasicsStep({ navigation }: any) {
  const { patientId } = useCurrentProfile();
  const { complete } = useOnboarding();
  const { colors } = useTheme();
  const [name, setName] = useState("");
  const [stage, setStage] = useState<"mild" | "moderate" | "severe" | "">("");
  const [busy, setBusy] = useState(false);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, padding: 24 },
    title: { fontSize: 24, fontWeight: "700", color: colors.text, marginBottom: 8 },
    subtitle: { color: colors.muted, marginBottom: 24 },
    input: { borderWidth: 1, borderColor: colors.border, padding: 14, borderRadius: 10, fontSize: 16, color: colors.text, marginBottom: 16 },
    stageLabel: { fontWeight: "600", color: colors.text, marginBottom: 8 },
    stageRow: { flexDirection: "row" as const, gap: 8, marginBottom: 24 },
    stageBtn: (active: boolean) => ({ flex: 1, padding: 12, borderRadius: 10, backgroundColor: active ? colors.violet : colors.surface }),
    stageBtnText: (active: boolean) => ({ textAlign: "center" as const, color: active ? "white" : colors.text, fontWeight: "600" as const, textTransform: "capitalize" as const }),
    continueBtn: (enabled: boolean) => ({ backgroundColor: enabled ? colors.violet : colors.border, padding: 16, borderRadius: 12 }),
    continueBtnText: { color: "white", textAlign: "center" as const, fontWeight: "700" as const, fontSize: 16 },
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
    <View style={{ flex: 1 }}>
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
          <Pressable key={s} onPress={() => setStage(s)} style={styles.stageBtn(stage === s)}>
            <Text style={styles.stageBtnText(stage === s)}>{s}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable disabled={!name.trim() || busy} onPress={next} style={styles.continueBtn(!!name.trim() && !busy)}>
        <Text style={styles.continueBtnText}>{busy ? "Saving…" : "Continue"}</Text>
      </Pressable>
    </ScrollView>
    </View>
  );
}
