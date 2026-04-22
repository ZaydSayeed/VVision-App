import React, { useState, useMemo } from "react";
import { View, Text, TextInput, Pressable, Alert, ScrollView, StyleSheet } from "react-native";
import { useCurrentProfile } from "../../hooks/useCurrentProfile";
import { useOnboarding } from "../../hooks/useOnboarding";
import { useTheme } from "../../context/ThemeContext";
import { authFetch } from "../../api/authFetch";
import OnboardingProgress from "../../components/OnboardingProgress";

export default function ProfileStoryStep({ navigation }: any) {
  const { patientId } = useCurrentProfile();
  const { complete } = useOnboarding();
  const { colors } = useTheme();
  const [story, setStory] = useState("");
  const [busy, setBusy] = useState(false);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, padding: 24 },
    title: { fontSize: 24, fontWeight: "700", color: colors.text, marginBottom: 8 },
    subtitle: { color: colors.muted, marginBottom: 24 },
    textArea: { borderWidth: 1, borderColor: colors.border, padding: 14, borderRadius: 10, fontSize: 16, color: colors.text, minHeight: 160, textAlignVertical: "top" as const, marginBottom: 16 },
    saveBtn: (enabled: boolean) => ({ backgroundColor: enabled ? colors.violet : colors.border, padding: 16, borderRadius: 12, marginBottom: 12 }),
    saveBtnText: { color: "white", textAlign: "center" as const, fontWeight: "700" as const, fontSize: 16 },
    skipText: { color: colors.muted, textAlign: "center" as const },
  }), [colors]);

  const save = async () => {
    if (!patientId || !story.trim()) return;
    setBusy(true);
    try {
      await authFetch(`/api/profiles/mine`, { method: "PATCH", body: JSON.stringify({ history: story.slice(0, 5000) }) });
      await complete("profile_story");
      navigation.navigate("InviteSiblingsStep");
    } catch (e: any) {
      Alert.alert("Couldn't save", e.message);
    } finally {
      setBusy(false);
    }
  };

  const skip = async () => {
    await complete("profile_story");
    navigation.navigate("InviteSiblingsStep");
  };

  return (
    <View style={{ flex: 1 }}>
    <OnboardingProgress />
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Tell Vela their story</Text>
      <Text style={styles.subtitle}>
        Where they grew up, who they love, what makes them calm. This shapes every future interaction.
        {"\n\n"}You can also add this later using the voice check-in feature.
      </Text>
      <TextInput
        placeholder="Write their story here…"
        placeholderTextColor={colors.muted}
        multiline
        value={story} onChangeText={setStory}
        style={styles.textArea}
      />
      <Pressable disabled={!story.trim() || busy} onPress={save} style={styles.saveBtn(!!story.trim() && !busy)}>
        <Text style={styles.saveBtnText}>{busy ? "Saving…" : "Save"}</Text>
      </Pressable>
      <Pressable onPress={skip}>
        <Text style={styles.skipText}>Skip for now</Text>
      </Pressable>
    </ScrollView>
    </View>
  );
}
