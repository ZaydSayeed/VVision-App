import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { UserRole } from "../types";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { fonts, spacing, radius } from "../config/theme";

const PRIVACY_POLICY_URL = "https://velavision.org/privacy/";
const TERMS_URL = "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/";

export function LoginScreen() {
  const { colors, isDark } = useTheme();
  const { login, signup, resetPassword } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [notice, setNotice] = useState("");

  async function handleSubmit() {
    setError("");
    if (!email.trim() || !password.trim()) {
      setError("Please enter your email and password.");
      return;
    }
    if (mode === "signup") {
      if (!name.trim()) { setError("Please enter your name."); return; }
      if (!role) { setError("Please select your role."); return; }
      if (!agreed) {
        setError("Please confirm you are 18+ and agree to the Privacy Policy and Terms of Use.");
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
      try { const parsed = JSON.parse(e.message); msg = parsed.detail || msg; } catch { msg = e.message || msg; }
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    setError("");
    setNotice("");
    if (!email.trim()) {
      setError("Enter your email above, then tap Forgot password.");
      return;
    }
    try {
      await resetPassword(email.trim());
      setNotice("If an account exists for that email, a password reset link is on its way. Check your inbox.");
    } catch (e: any) {
      setError(e?.message ?? "Couldn't send a reset email. Please try again.");
    }
  }

  const styles = useMemo(() => StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    container: {
      flexGrow: 1,
      paddingHorizontal: spacing.xxl,
      paddingTop: spacing.xxxxl,
      paddingBottom: spacing.xxxxl,
      backgroundColor: colors.bg,
    },

    // ── Brand ────────────────────────────────────────────────
    brandSection: {
      alignItems: "center",
      marginBottom: spacing.xxxl,
    },
    brandLogo: { width: 180, height: 220 },

    // ── Mode toggle ──────────────────────────────────────────
    modeToggle: {
      flexDirection: "row",
      backgroundColor: colors.surface,
      borderRadius: radius.pill,
      padding: 4,
      marginBottom: spacing.xxl,
    },
    modeBtn: {
      flex: 1,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radius.pill,
    },
    modeBtnActive: {
      backgroundColor: colors.violet,
      shadowColor: colors.violet,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
    },
    modeBtnText: {
      fontSize: 15,
      color: colors.muted,
      ...fonts.medium,
    },
    modeBtnTextActive: {
      color: "#FFFFFF",
    },

    // ── Headline ─────────────────────────────────────────────
    headline: {
      fontSize: 30,
      color: colors.text,
      ...fonts.medium,
      marginBottom: spacing.xl,
      lineHeight: 36,
    },

    // ── Fields ───────────────────────────────────────────────
    fieldGroup: { marginBottom: spacing.lg },
    fieldLabel: {
      fontSize: 11,
      color: colors.muted,
      ...fonts.medium,
      letterSpacing: 1.2,
      textTransform: "uppercase",
      marginBottom: spacing.sm,
    },
    input: {
      height: 56,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.lg,
      fontSize: 16,
      color: colors.text,
      ...fonts.regular,
    },

    // ── Role selection ───────────────────────────────────────
    roleRow: { flexDirection: "row", gap: spacing.md },
    roleCard: {
      flex: 1,
      backgroundColor: colors.surface,
      borderWidth: 2,
      borderColor: colors.border,
      borderRadius: radius.lg,
      padding: spacing.lg,
      alignItems: "center",
      gap: spacing.sm,
    },
    roleCardActive: {
      backgroundColor: colors.violet50,
      borderColor: colors.violet,
    },
    roleIconCircle: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.bg,
      alignItems: "center",
      justifyContent: "center",
    },
    roleIconCircleActive: {
      backgroundColor: colors.violet50,
    },
    roleTitle: {
      fontSize: 16,
      color: colors.muted,
      ...fonts.medium,
    },
    roleTitleActive: { color: colors.violet },
    roleSubtitle: {
      fontSize: 12,
      color: colors.muted,
      ...fonts.regular,
      textAlign: "center",
      lineHeight: 16,
    },
    roleSubtitleActive: { color: colors.subtext },

    // ── Error ────────────────────────────────────────────────
    error: {
      fontSize: 14,
      color: "#E05050",
      ...fonts.regular,
      marginBottom: spacing.md,
      textAlign: "center",
      backgroundColor: "#FEF0F0",
      borderRadius: radius.md,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      overflow: "hidden",
    },

    // ── Forgot password / notice ─────────────────────────────
    forgotRow: {
      alignSelf: "flex-end",
      marginTop: -spacing.xs,
      marginBottom: spacing.md,
      paddingVertical: 4,
    },
    forgotText: { fontSize: 13, color: colors.violet, ...fonts.medium },
    notice: {
      fontSize: 14,
      color: colors.sage,
      ...fonts.regular,
      marginBottom: spacing.md,
      textAlign: "center",
      backgroundColor: colors.sageSoft,
      borderRadius: radius.md,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      overflow: "hidden",
    },

    // ── Consent (signup) ─────────────────────────────────────
    agreeRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 1.5,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 1,
    },
    checkboxChecked: {
      backgroundColor: colors.violet,
      borderColor: colors.violet,
    },
    agreeText: {
      flex: 1,
      fontSize: 13,
      lineHeight: 19,
      color: colors.muted,
      ...fonts.regular,
    },
    agreeLink: {
      color: colors.violet,
      ...fonts.medium,
      textDecorationLine: "underline",
    },

    // ── Submit ───────────────────────────────────────────────
    btn: {
      height: 58,
      backgroundColor: colors.violet,
      borderRadius: radius.pill,
      alignItems: "center",
      justifyContent: "center",
      marginTop: spacing.sm,
      shadowColor: colors.violet,
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.38,
      shadowRadius: 14,
      elevation: 7,
    },
    btnDisabled: { opacity: 0.7 },
    btnText: {
      fontSize: 17,
      color: "#FFFFFF",
      ...fonts.medium,
      letterSpacing: 0.2,
    },
  }), [colors]);

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
        {/* Brand */}
        <View style={styles.brandSection}>
          <Image
            source={isDark ? require("../../assets/logo-stacked-light.png") : require("../../assets/logo-stacked-dark.png")}
            style={styles.brandLogo}
            resizeMode="contain"
          />
        </View>

        {/* Mode toggle */}
        <View style={styles.modeToggle}>
          <TouchableOpacity
            style={[styles.modeBtn, mode === "login" && styles.modeBtnActive]}
            onPress={() => { setMode("login"); setError(""); }}
            activeOpacity={0.8}
          >
            <Text style={[styles.modeBtnText, mode === "login" && styles.modeBtnTextActive]}>Sign In</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, mode === "signup" && styles.modeBtnActive]}
            onPress={() => { setMode("signup"); setError(""); }}
            activeOpacity={0.8}
          >
            <Text style={[styles.modeBtnText, mode === "signup" && styles.modeBtnTextActive]}>Sign Up</Text>
          </TouchableOpacity>
        </View>

        {/* Headline */}
        <Text style={styles.headline}>
          {mode === "login" ? "Welcome back." : "Create your account."}
        </Text>

        {/* Name (signup only) */}
        {mode === "signup" && (
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Your Name</Text>
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
          <Text style={styles.fieldLabel}>Email</Text>
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
          <Text style={styles.fieldLabel}>Password</Text>
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

        {/* Forgot password (login only) */}
        {mode === "login" && (
          <TouchableOpacity
            style={styles.forgotRow}
            onPress={handleForgotPassword}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Forgot password"
          >
            <Text style={styles.forgotText}>Forgot password?</Text>
          </TouchableOpacity>
        )}

        {/* Role selection (signup only) */}
        {mode === "signup" && (
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>I am a</Text>
            <View style={styles.roleRow}>
              <TouchableOpacity
                style={[styles.roleCard, role === "patient" && styles.roleCardActive]}
                onPress={() => setRole("patient")}
                activeOpacity={0.8}
              >
                <View style={[styles.roleIconCircle, role === "patient" && styles.roleIconCircleActive]}>
                  <Ionicons name="heart" size={22} color={role === "patient" ? colors.violet : colors.muted} />
                </View>
                <Text style={[styles.roleTitle, role === "patient" && styles.roleTitleActive]}>Patient</Text>
                <Text style={[styles.roleSubtitle, role === "patient" && styles.roleSubtitleActive]}>
                  Daily routines{"\n"}& reminders
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.roleCard, role === "caregiver" && styles.roleCardActive]}
                onPress={() => setRole("caregiver")}
                activeOpacity={0.8}
              >
                <View style={[styles.roleIconCircle, role === "caregiver" && styles.roleIconCircleActive]}>
                  <Ionicons name="shield-checkmark" size={22} color={role === "caregiver" ? colors.violet : colors.muted} />
                </View>
                <Text style={[styles.roleTitle, role === "caregiver" && styles.roleTitleActive]}>Caregiver</Text>
                <Text style={[styles.roleSubtitle, role === "caregiver" && styles.roleSubtitleActive]}>
                  Monitor{"\n"}& manage care
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Consent (signup only) */}
        {mode === "signup" && (
          <TouchableOpacity
            style={styles.agreeRow}
            activeOpacity={0.8}
            onPress={() => setAgreed((v) => !v)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: agreed }}
            accessibilityLabel="I am 18 or older and agree to the Privacy Policy and Terms of Use"
          >
            <View style={[styles.checkbox, agreed && styles.checkboxChecked]}>
              {agreed && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
            </View>
            <Text style={styles.agreeText}>
              I am 18 or older and agree to the{" "}
              <Text style={styles.agreeLink} onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}>Privacy Policy</Text>
              {" "}and{" "}
              <Text style={styles.agreeLink} onPress={() => Linking.openURL(TERMS_URL)}>Terms of Use</Text>.
            </Text>
          </TouchableOpacity>
        )}

        {/* Notice / Error */}
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {/* Submit */}
        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={handleSubmit}
          activeOpacity={0.88}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.btnText}>
              {mode === "login" ? "Sign in" : "Create account"}
            </Text>
          )}
        </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
