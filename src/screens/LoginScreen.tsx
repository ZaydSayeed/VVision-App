import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { UserRole } from "../types";
import { useAuth } from "../context/AuthContext";
import { colors, fonts, spacing, radius } from "../config/theme";

export function LoginScreen() {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError("");

    if (!email.trim() || !password.trim()) {
      setError("Please enter your email and password.");
      return;
    }

    if (mode === "signup") {
      if (!name.trim()) {
        setError("Please enter your name.");
        return;
      }
      if (!role) {
        setError("Please select your role.");
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === "signup") {
        await signup(email.trim(), password, name.trim(), role!);
      } else {
        await login(email.trim(), password);
      }
    } catch (e: any) {
      let msg = "Something went wrong.";
      try {
        const parsed = JSON.parse(e.message);
        msg = parsed.detail || msg;
      } catch {
        msg = e.message || msg;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
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
        <Text style={styles.headline}>
          {mode === "login" ? "Welcome back." : "Get started."}
        </Text>
        <Text style={styles.tagline}>
          Faces remembered. Connections preserved.
        </Text>

        {/* Name (signup only) */}
        {mode === "signup" && (
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>YOUR NAME</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Sarah Johnson"
              placeholderTextColor={colors.muted}
              autoCapitalize="words"
              returnKeyType="next"
            />
          </View>
        )}

        {/* Email */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>EMAIL</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            keyboardType="email-address"
            returnKeyType="next"
          />
        </View>

        {/* Password */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>PASSWORD</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={colors.muted}
            secureTextEntry
            returnKeyType={mode === "login" ? "go" : "next"}
            onSubmitEditing={mode === "login" ? handleSubmit : undefined}
          />
        </View>

        {/* Role Selection (signup only) */}
        {mode === "signup" && (
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>I AM A</Text>
            <View style={styles.roleRow}>
              <TouchableOpacity
                style={[
                  styles.roleCard,
                  role === "patient" && styles.roleCardActive,
                ]}
                onPress={() => setRole("patient")}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.roleTitle,
                    role === "patient" && styles.roleTitleActive,
                  ]}
                >
                  Patient
                </Text>
                <Text style={styles.roleSubtitle}>
                  Daily routines{"\n"}& reminders
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.roleCard,
                  role === "caregiver" && styles.roleCardActive,
                ]}
                onPress={() => setRole("caregiver")}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.roleTitle,
                    role === "caregiver" && styles.roleTitleActive,
                  ]}
                >
                  Caregiver
                </Text>
                <Text style={styles.roleSubtitle}>
                  Monitor &{"\n"}manage care
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Error */}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={handleSubmit}
          activeOpacity={0.85}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#F5F0E8" />
          ) : (
            <Text style={styles.btnText}>
              {mode === "login" ? "Sign in" : "Create account"}
            </Text>
          )}
        </TouchableOpacity>

        {/* Toggle mode */}
        <TouchableOpacity
          style={styles.toggleRow}
          onPress={() => {
            setMode(mode === "login" ? "signup" : "login");
            setError("");
          }}
        >
          <Text style={styles.toggleText}>
            {mode === "login"
              ? "Don't have an account? "
              : "Already have an account? "}
            <Text style={styles.toggleLink}>
              {mode === "login" ? "Sign up" : "Sign in"}
            </Text>
          </Text>
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
    fontSize: 48,
    color: colors.text,
    ...fonts.displayLight,
    marginBottom: spacing.sm,
  },
  tagline: {
    fontSize: 16,
    color: colors.muted,
    ...fonts.regular,
    marginBottom: spacing.xxxl,
  },
  fieldGroup: {
    marginBottom: spacing.xl,
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
  btnDisabled: {
    opacity: 0.7,
  },
  btnText: {
    fontSize: 17,
    color: "#F5F0E8",
    ...fonts.medium,
  },
  toggleRow: {
    marginTop: spacing.xl,
    alignItems: "center",
  },
  toggleText: {
    fontSize: 14,
    color: colors.muted,
    ...fonts.regular,
  },
  toggleLink: {
    color: colors.violet,
    ...fonts.medium,
  },
});
