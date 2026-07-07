import React, { useState, useMemo } from "react";
import { View, Text, TextInput, Pressable, Alert, StyleSheet } from "react-native";
import { inviteSeat } from "../../api/seats";
import { useCurrentProfile } from "../../hooks/useCurrentProfile";
import { useOnboarding } from "../../hooks/useOnboarding";
import { useTheme } from "../../context/ThemeContext";
import { fonts, spacing, radius } from "../../config/theme";
import OnboardingProgress from "../../components/OnboardingProgress";

export default function InviteSiblingsStep({ navigation }: any) {
  const { patientId } = useCurrentProfile();
  const { complete } = useOnboarding();
  const { colors } = useTheme();
  const [emails, setEmails] = useState(["", "", ""]);
  const [busy, setBusy] = useState(false);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, padding: spacing.xxl },
    title: { fontSize: 24, lineHeight: 30, ...fonts.medium, color: colors.text, marginBottom: spacing.sm },
    subtitle: { fontSize: 15, lineHeight: 22, ...fonts.regular, color: colors.muted, marginBottom: spacing.xxl },
    input: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: spacing.lg, borderRadius: radius.md, fontSize: 16, ...fonts.regular, color: colors.text, marginBottom: spacing.sm, minHeight: 52 },
    sendBtn: { backgroundColor: colors.violet, padding: spacing.lg, borderRadius: radius.pill, minHeight: 56, justifyContent: "center" as const, marginTop: spacing.sm, marginBottom: spacing.md },
    sendBtnText: { color: "#FFFFFF", textAlign: "center" as const, ...fonts.medium, fontSize: 16 },
    skipText: { fontSize: 15, ...fonts.regular, color: colors.muted, textAlign: "center" as const, paddingVertical: spacing.md },
  }), [colors]);

  const send = async () => {
    if (!patientId) return;
    setBusy(true);
    try {
      for (const e of emails.filter(x => x.includes("@"))) {
        try {
          await inviteSeat(patientId, e, "sibling");
        } catch (err: any) {
          if (err.message?.includes("Starter plan") || err.message?.includes("subscription")) break;
        }
      }
      await complete("siblings");
      navigation.navigate("SmartHomeStep");
    } catch (e: any) {
      Alert.alert("Couldn't send", e.message);
    } finally {
      setBusy(false);
    }
  };

  const skip = async () => {
    await complete("siblings");
    navigation.navigate("SmartHomeStep");
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
    <OnboardingProgress />
    <View style={styles.container}>
      <Text style={styles.title}>Invite family</Text>
      <Text style={styles.subtitle}>Your siblings see the same profile. The more everyone shares, the better Vela works.</Text>
      {emails.map((e, i) => (
        <TextInput
          key={i}
          placeholder={`Sibling ${i + 1} email`}
          placeholderTextColor={colors.muted}
          value={e}
          keyboardType="email-address"
          autoCapitalize="none"
          onChangeText={(v) => setEmails(emails.map((x, j) => j === i ? v : x))}
          style={styles.input}
        />
      ))}
      <Pressable onPress={send} disabled={busy} style={[styles.sendBtn, { opacity: busy ? 0.5 : 1 }]}>
        <Text style={styles.sendBtnText}>Send invites</Text>
      </Pressable>
      <Pressable onPress={skip}>
        <Text style={styles.skipText}>Skip — do this later</Text>
      </Pressable>
    </View>
    </View>
  );
}
