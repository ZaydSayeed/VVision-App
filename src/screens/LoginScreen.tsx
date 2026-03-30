import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { UserRole } from "../types";
import { colors, fonts, spacing, radius } from "../config/theme";

interface LoginScreenProps {
  onLogin: (name: string, role: UserRole) => void;
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [name, setName] = useState("");
  const [role, setRole] = useState<UserRole | null>(null);
  const [error, setError] = useState("");

  function handleContinue() {
    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }
    if (!role) {
      setError("Please select your role.");
      return;
    }
    setError("");
    onLogin(name.trim(), role);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo */}
        <View style={styles.logoRow}>
          <Image
            source={require("../../assets/icon.png")}
            style={styles.logoIcon}
            resizeMode="contain"
          />
          <Text style={styles.logoText}>Vela Vision</Text>
        </View>

        {/* Headline */}
        <Text style={styles.headline}>Welcome.</Text>
        <Text style={styles.tagline}>Faces remembered. Connections preserved.</Text>

        {/* Name Input */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>YOUR NAME</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Sarah Johnson"
            placeholderTextColor={colors.muted}
            autoCapitalize="words"
            returnKeyType="done"
          />
        </View>

        {/* Role Selection */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>I AM A</Text>
          <View style={styles.roleRow}>
            <TouchableOpacity
              style={[styles.roleCard, role === "patient" && styles.roleCardActive]}
              onPress={() => setRole("patient")}
              activeOpacity={0.8}
            >
              <Text style={styles.roleEmoji}>🧓</Text>
              <Text style={[styles.roleTitle, role === "patient" && styles.roleTitleActive]}>
                Patient
              </Text>
              <Text style={styles.roleSubtitle}>Daily routines{"\n"}& reminders</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.roleCard, role === "caregiver" && styles.roleCardActive]}
              onPress={() => setRole("caregiver")}
              activeOpacity={0.8}
            >
              <Text style={styles.roleEmoji}>🩺</Text>
              <Text style={[styles.roleTitle, role === "caregiver" && styles.roleTitleActive]}>
                Caregiver
              </Text>
              <Text style={styles.roleSubtitle}>Monitor &{"\n"}manage care</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Error */}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {/* Continue Button */}
        <TouchableOpacity style={styles.btn} onPress={handleContinue} activeOpacity={0.85}>
          <Text style={styles.btnText}>Continue</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xxxxl,
    paddingBottom: spacing.xxxxl,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: spacing.xxxxl,
  },
  logoIcon: {
    width: 36,
    height: 36,
  },
  logoText: {
    fontSize: 22,
    color: colors.text,
    ...fonts.display,
  },
  headline: {
    fontSize: 52,
    color: colors.text,
    ...fonts.displayLight,
    marginBottom: spacing.sm,
  },
  tagline: {
    fontSize: 16,
    color: colors.muted,
    ...fonts.regular,
    marginBottom: spacing.xxxxl,
  },
  fieldGroup: {
    marginBottom: spacing.xxl,
  },
  fieldLabel: {
    fontSize: 10,
    color: colors.lavender,
    ...fonts.medium,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: spacing.sm,
  },
  input: {
    height: 56,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.lg,
    fontSize: 18,
    color: colors.text,
    ...fonts.regular,
  },
  roleRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  roleCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: "center",
    gap: spacing.sm,
  },
  roleCardActive: {
    borderColor: colors.violet,
    backgroundColor: colors.violet50,
  },
  roleEmoji: {
    fontSize: 32,
  },
  roleTitle: {
    fontSize: 17,
    color: colors.text,
    ...fonts.medium,
  },
  roleTitleActive: {
    color: colors.violet,
  },
  roleSubtitle: {
    fontSize: 12,
    color: colors.muted,
    ...fonts.regular,
    textAlign: "center",
  },
  error: {
    fontSize: 14,
    color: colors.violet,
    ...fonts.regular,
    marginBottom: spacing.md,
    textAlign: "center",
  },
  btn: {
    height: 56,
    backgroundColor: colors.violet,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.sm,
  },
  btnText: {
    fontSize: 17,
    color: "#F5F0E8",
    ...fonts.medium,
  },
});
