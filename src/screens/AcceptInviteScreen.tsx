import React, { useEffect, useState, useMemo } from "react";
import { View, Text, ActivityIndicator, Pressable, StyleSheet } from "react-native";
import { acceptInvite } from "../api/seats";
import { useTheme } from "../context/ThemeContext";

export default function AcceptInviteScreen({ route, navigation }: any) {
  const { token } = route.params ?? {};
  const [status, setStatus] = useState<"loading" | "error" | "done">("loading");
  const [message, setMessage] = useState("");
  const { colors } = useTheme();

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, padding: 24, justifyContent: "center" },
    title: { fontSize: 22, fontWeight: "700", textAlign: "center", color: colors.text },
    message: { textAlign: "center", marginTop: 12, color: colors.muted },
    btn: { backgroundColor: colors.violet, padding: 16, borderRadius: 12, marginTop: 24 },
    btnText: { color: "white", textAlign: "center", fontWeight: "700" },
  }), [colors]);

  useEffect(() => {
    if (!token) {
      setMessage("Invalid invite link.");
      setStatus("error");
      return;
    }
    (async () => {
      try {
        const r = await acceptInvite(token);
        setMessage(`You're now a ${r.role} on this Living Profile.`);
        setStatus("done");
      } catch (e: any) {
        setMessage(e.message ?? "This invite link is not valid.");
        setStatus("error");
      }
    })();
  }, [token]);

  if (status === "loading") return <ActivityIndicator style={{ flex: 1 }} color={colors.violet} />;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {status === "done" ? "Welcome to the family" : "Invite not valid"}
      </Text>
      <Text style={styles.message}>{message}</Text>
      <Pressable
        onPress={() => navigation.replace("CaregiverHome")}
        style={styles.btn}
      >
        <Text style={styles.btnText}>Continue</Text>
      </Pressable>
    </View>
  );
}
