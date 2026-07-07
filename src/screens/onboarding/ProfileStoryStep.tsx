import React, { useState, useMemo } from "react";
import { View, Text, TextInput, Pressable, Alert, ScrollView, StyleSheet } from "react-native";
import { useCurrentProfile } from "../../hooks/useCurrentProfile";
import { useOnboarding } from "../../hooks/useOnboarding";
import { useTheme } from "../../context/ThemeContext";
import { fonts, spacing, radius } from "../../config/theme";
import { authFetch } from "../../api/authFetch";
import OnboardingProgress from "../../components/OnboardingProgress";

export default function ProfileStoryStep({ navigation }: any) {
  const { patientId } = useCurrentProfile();
  const { complete } = useOnboarding();
  const { colors } = useTheme();
  const [story, setStory] = useState("");
  const [busy, setBusy] = useState(false);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, padding: spacing.xxl },
    title: { fontSize: 24, lineHeight: 30, ...fonts.medium, color: colors.text, marginBottom: spacing.sm },
    subtitle: { fontSize: 15, lineHeight: 22, ...fonts.regular, color: colors.muted, marginBottom: spacing.xxl },
    textArea: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: spacing.lg, borderRadius: radius.md, fontSize: 16, ...fonts.regular, color: colors.text, minHeight: 160, textAlignVertical: "top" as const, marginBottom: spacing.lg },
    saveBtn: { padding: spacing.lg, borderRadius: radius.pill, minHeight: 56, justifyContent: "center" as const, marginBottom: spacing.md },
    saveBtnText: { color: "#FFFFFF", textAlign: "center" as const, ...fonts.medium, fontSize: 16 },
    skipText: { fontSize: 15, ...fonts.regular, color: colors.muted, textAlign: "center" as const, paddingVertical: spacing.md },
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
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
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
      <Pressable
        disabled={!story.trim() || busy}
        onPress={save}
        style={[styles.saveBtn, { backgroundColor: !!story.trim() && !busy ? colors.violet : colors.border }]}
      >
        <Text style={styles.saveBtnText}>{busy ? "Saving…" : "Save"}</Text>
      </Pressable>
      <Pressable onPress={skip}>
        <Text style={styles.skipText}>Skip for now</Text>
      </Pressable>
    </ScrollView>
    </View>
  );
}
