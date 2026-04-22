import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  Share,
  StyleSheet,
} from "react-native";
import { inviteSeat } from "../../api/seats";
import { useSubscription } from "../../hooks/useSubscription";
import { useCurrentProfile } from "../../hooks/useCurrentProfile";
import { useTheme } from "../../context/ThemeContext";
import { fonts, spacing, radius } from "../../config/theme";

export default function InviteSeatScreen({ navigation }: any) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"sibling" | "paid_aide">("sibling");
  const [busy, setBusy] = useState(false);
  const { tier } = useSubscription();
  const { patientId } = useCurrentProfile();
  const { colors } = useTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.bg,
          padding: spacing.xxl,
          gap: spacing.lg,
        },
        title: {
          fontSize: 22,
          fontWeight: "700",
          color: colors.text,
          ...fonts.medium,
        },
        subtitle: {
          fontSize: 14,
          color: colors.muted,
          ...fonts.regular,
          marginTop: -spacing.sm,
        },
        input: {
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          padding: spacing.lg,
          borderRadius: radius.md,
          fontSize: 16,
          color: colors.text,
          ...fonts.regular,
        },
        roleRow: {
          flexDirection: "row",
          gap: spacing.sm,
        },
        roleBtnActive: {
          flex: 1,
          padding: spacing.md,
          borderRadius: radius.md,
          backgroundColor: colors.violet,
          alignItems: "center",
        },
        roleBtnInactive: {
          flex: 1,
          padding: spacing.md,
          borderRadius: radius.md,
          backgroundColor: colors.surface,
          alignItems: "center",
          borderWidth: 1,
          borderColor: colors.border,
        },
        roleBtnTextActive: {
          color: "white",
          fontWeight: "600",
          fontSize: 14,
          ...fonts.medium,
        },
        roleBtnTextInactive: {
          color: colors.text,
          fontWeight: "600",
          fontSize: 14,
          ...fonts.medium,
        },
        submitBtnEnabled: {
          backgroundColor: colors.violet,
          padding: spacing.lg,
          borderRadius: radius.lg,
          alignItems: "center",
        },
        submitBtnDisabled: {
          backgroundColor: colors.violet,
          padding: spacing.lg,
          borderRadius: radius.lg,
          alignItems: "center",
          opacity: 0.5,
        },
        submitText: {
          color: "white",
          fontWeight: "700",
          fontSize: 16,
          ...fonts.medium,
        },
      }),
    [colors]
  );

  const submit = async () => {
    if (!patientId) return;
    if (tier === "free") {
      navigation.navigate("Paywall");
      return;
    }
    setBusy(true);
    try {
      const { token } = await inviteSeat(patientId, email, role);
      const link = `https://velavision.app/invite/${token}`;
      await Share.share({ message: `You've been invited to join Vela: ${link}` });
      Alert.alert("Invite sent", "They'll accept inside the app.");
      navigation.goBack();
    } catch (e: any) {
      if (e.message?.includes("Starter plan") || e.message?.includes("402")) {
        navigation.navigate("Paywall");
      } else {
        Alert.alert("Couldn't send invite", e.message);
      }
    } finally {
      setBusy(false);
    }
  };

  const isDisabled = busy || !email.includes("@");

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Invite someone to help</Text>
      <Text style={styles.subtitle}>
        They'll get a link to join this care team.
      </Text>
      <TextInput
        placeholder="Their email"
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        style={styles.input}
      />
      <View style={styles.roleRow}>
        {(["sibling", "paid_aide"] as const).map((r) => (
          <Pressable
            key={r}
            onPress={() => setRole(r)}
            style={role === r ? styles.roleBtnActive : styles.roleBtnInactive}
          >
            <Text
              style={
                role === r
                  ? styles.roleBtnTextActive
                  : styles.roleBtnTextInactive
              }
            >
              {r === "sibling" ? "Family member" : "Paid aide"}
            </Text>
          </Pressable>
        ))}
      </View>
      <Pressable
        disabled={isDisabled}
        onPress={submit}
        style={isDisabled ? styles.submitBtnDisabled : styles.submitBtnEnabled}
      >
        <Text style={styles.submitText}>{busy ? "Sending…" : "Send invite"}</Text>
      </Pressable>
    </View>
  );
}
