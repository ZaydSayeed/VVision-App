import React, { useEffect, useState, useMemo } from "react";
import { View, Text, ActivityIndicator, Pressable, StyleSheet } from "react-native";
import { acceptInvite } from "../api/seats";
import { useTheme } from "../context/ThemeContext";
import { fonts, spacing, radius } from "../config/theme";
import { useAuth } from "../context/AuthContext";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function AcceptInviteScreen({ route, navigation }: any) {
  const { token } = route.params ?? {};
  const [status, setStatus] = useState<"loading" | "error" | "done">("loading");
  const [message, setMessage] = useState("");
  const { colors } = useTheme();
  const { user } = useAuth();

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, padding: spacing.xxl, justifyContent: "center", backgroundColor: colors.bg },
    title: { fontSize: 24, lineHeight: 30, ...fonts.medium, textAlign: "center", color: colors.text },
    message: { fontSize: 15, lineHeight: 22, ...fonts.regular, textAlign: "center", marginTop: spacing.md, color: colors.muted },
    btn: { backgroundColor: colors.violet, padding: spacing.lg, borderRadius: radius.pill, minHeight: 56, justifyContent: "center", marginTop: spacing.xxl },
    btnText: { color: "#FFFFFF", textAlign: "center", ...fonts.medium, fontSize: 16 },
  }), [colors]);

  useEffect(() => {
    // Clear any pending invite token from AsyncStorage — navigation already happened
    AsyncStorage.removeItem("@vela/pending_invite");

    if (!token) {
      setMessage("Invalid invite link.");
      setStatus("error");
      return;
    }
    if (!user) {
      setMessage("Please log in before accepting this invite.");
      setStatus("error");
      return;
    }
    (async () => {
      try {
        const r = await acceptInvite(token);
        setMessage(`You're now part of this care team as ${r.role.replace(/_/g, " ")}.`);
        setStatus("done");
      } catch (e: any) {
        setMessage(e.message ?? "This invite link is not valid.");
        setStatus("error");
      }
    })();
  }, [token, user]);

  if (status === "loading") return <ActivityIndicator style={{ flex: 1 }} color={colors.violet} />;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {status === "done" ? "Welcome to the family" : "Invite not valid"}
      </Text>
      <Text style={styles.message}>{message}</Text>
      <Pressable
        onPress={() => navigation.replace(user?.role === "patient" ? "PatientTabs" : "CaregiverHome")}
        style={styles.btn}
      >
        <Text style={styles.btnText}>Continue</Text>
      </Pressable>
    </View>
  );
}
