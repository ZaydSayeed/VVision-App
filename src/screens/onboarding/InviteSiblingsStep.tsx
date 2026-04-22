import React, { useState, useMemo } from "react";
import { View, Text, TextInput, Pressable, Alert, StyleSheet } from "react-native";
import { inviteSeat } from "../../api/seats";
import { useCurrentProfile } from "../../hooks/useCurrentProfile";
import { useOnboarding } from "../../hooks/useOnboarding";
import { useTheme } from "../../context/ThemeContext";

export default function InviteSiblingsStep({ navigation }: any) {
  const { patientId } = useCurrentProfile();
  const { complete } = useOnboarding();
  const { colors } = useTheme();
  const [emails, setEmails] = useState(["", "", ""]);
  const [busy, setBusy] = useState(false);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, padding: 24 },
    title: { fontSize: 24, fontWeight: "700", color: colors.text, marginBottom: 8 },
    subtitle: { color: colors.muted, marginBottom: 24 },
    input: { borderWidth: 1, borderColor: colors.border, padding: 12, borderRadius: 10, color: colors.text, marginBottom: 8 },
    sendBtn: { backgroundColor: colors.violet, padding: 16, borderRadius: 12, marginTop: 8, marginBottom: 12 },
    sendBtnText: { color: "white", textAlign: "center" as const, fontWeight: "700" as const },
    skipText: { color: colors.muted, textAlign: "center" as const },
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
  );
}
