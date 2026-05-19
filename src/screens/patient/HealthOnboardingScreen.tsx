import React, { useMemo, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Platform } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../config/theme";
import { requestPermissions } from "../../services/healthkit";

const ONBOARDED_KEY = "@vela/health/onboarded";

export async function isHealthOnboarded(): Promise<boolean> {
  return (await AsyncStorage.getItem(ONBOARDED_KEY)) === "1";
}

export function HealthOnboardingScreen() {
  const { colors } = useTheme();
  const nav = useNavigation<any>();
  const [busy, setBusy] = useState(false);

  const onConnect = async () => {
    setBusy(true);
    try {
      await requestPermissions();
      await AsyncStorage.setItem(ONBOARDED_KEY, "1");
      // Navigate back to the Health tab. Use goBack since the user came from there.
      if (nav.canGoBack()) nav.goBack();
      else nav.navigate("Patient" as never);
    } catch (e: any) {
      Alert.alert("Couldn't connect", e.message ?? "Try again from iPhone Settings → Health → Apps → Vela.");
    } finally {
      setBusy(false);
    }
  };

  if (Platform.OS === "ios" && (Platform as any).isPad) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 32 }}>
        <Ionicons name="phone-portrait-outline" size={48} color={colors.muted} />
        <Text style={{ ...fonts.medium, fontSize: 18, color: colors.text, textAlign: "center", marginTop: 16 }}>
          Health data is only available on iPhone
        </Text>
        <Text style={{ ...fonts.regular, fontSize: 15, color: colors.muted, textAlign: "center", marginTop: 8, lineHeight: 22 }}>
          Open Vela on your iPhone to connect Apple Health.
        </Text>
      </View>
    );
  }

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg, padding: 24, justifyContent: "center" },
    iconWrap: { alignSelf: "center", marginBottom: 28 },
    title: { ...fonts.regular, fontSize: 28, color: colors.text, textAlign: "center", marginBottom: 14 },
    body: { ...fonts.regular, fontSize: 16, color: colors.muted, textAlign: "center", lineHeight: 24, marginBottom: 32 },
    bullet: { ...fonts.regular, fontSize: 15, color: colors.text, marginBottom: 8 },
    button: { borderRadius: 16, overflow: "hidden", marginTop: 28 },
    buttonInner: { paddingVertical: 16, alignItems: "center" },
    buttonLabel: { ...fonts.medium, fontSize: 17, color: "#FFFFFF" },
  }), [colors]);

  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Ionicons name="pulse" size={64} color={colors.violet} />
      </View>
      <Text style={styles.title}>Connect your Health data</Text>
      <Text style={styles.body}>
        Vela uses Apple Health to show your steps, heart rate, sleep, and activity over time — and to keep your care team in the loop.
      </Text>
      <Text style={styles.bullet}>• We only read — we never write to your Health data.</Text>
      <Text style={styles.bullet}>• You can change this anytime in iPhone Settings.</Text>
      <TouchableOpacity style={styles.button} onPress={onConnect} disabled={busy} activeOpacity={0.8}>
        <LinearGradient colors={[colors.violet, "#7B6BE0"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.buttonInner}>
          {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonLabel}>Continue</Text>}
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}
