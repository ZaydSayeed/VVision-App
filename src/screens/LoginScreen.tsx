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
import { fonts, spacing, radius } from "../config/theme";

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
        showsVerticalScrollIndicator={false}
      >
        {/* Logo + Branding */}
        <View style={styles.brandSection}>
          <View style={styles.logoCircle}>
            <Image
              source={require("../../assets/icon.png")}
              style={styles.logoIcon}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.logoText}>Vela Vision</Text>
          <Text style={styles.tagline}>Care made calm and simple.</Text>
        </View>

        {/* Mode toggle pill */}
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
            <Text style={styles.fieldLabel}>YOUR NAME</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Sarah Johnson"
              placeholderTextColor="#B0AABF"
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
            placeholderTextColor="#B0AABF"
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
            placeholderTextColor="#B0AABF"
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
                style={[styles.roleCard, role === "patient" && styles.roleCardActive]}
                onPress={() => setRole("patient")}
                activeOpacity={0.8}
              >
                <Text style={[styles.roleTitle, role === "patient" && styles.roleTitleActive]}>
                  Patient
                </Text>
                <Text style={[styles.roleSubtitle, role === "patient" && styles.roleSubtitleActive]}>
                  Daily routines & reminders
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.roleCard, role === "caregiver" && styles.roleCardActive]}
                onPress={() => setRole("caregiver")}
                activeOpacity={0.8}
              >
                <Text style={[styles.roleTitle, role === "caregiver" && styles.roleTitleActive]}>
                  Caregiver
                </Text>
                <Text style={[styles.roleSubtitle, role === "caregiver" && styles.roleSubtitleActive]}>
                  Monitor & manage care
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FFFFFF" },
  container: {
    flexGrow: 1,
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xxxxl,
    paddingBottom: spacing.xxxxl,
    backgroundColor: "#FFFFFF",
  },

  // Brand
  brandSection: {
    alignItems: "center",
    marginBottom: spacing.xxxl,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#F0EEFF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
    shadowColor: "#7B5CE7",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  logoIcon: { width: 44, height: 44 },
  logoText: {
    fontSize: 22,
    color: "#1E1B3A",
    ...fonts.medium,
    letterSpacing: 0.3,
  },
  tagline: {
    fontSize: 15,
    color: "#9590B0",
    ...fonts.regular,
    marginTop: spacing.xs,
    textAlign: "center",
  },

  // Mode toggle
  modeToggle: {
    flexDirection: "row",
    backgroundColor: "#F0EEFF",
    borderRadius: radius.pill,
    padding: 4,
    marginBottom: spacing.xxl,
  },
  modeBtn: {
    flex: 1,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
  },
  modeBtnActive: {
    backgroundColor: "#7B5CE7",
    shadowColor: "#7B5CE7",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  modeBtnText: {
    fontSize: 15,
    color: "#9590B0",
    ...fonts.medium,
  },
  modeBtnTextActive: {
    color: "#FFFFFF",
  },

  headline: {
    fontSize: 26,
    color: "#1E1B3A",
    ...fonts.medium,
    marginBottom: spacing.xl,
  },

  fieldGroup: { marginBottom: spacing.lg },
  fieldLabel: {
    fontSize: 11,
    color: "#9590B0",
    ...fonts.medium,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: spacing.sm,
  },
  input: {
    height: 54,
    backgroundColor: "#F7F5FF",
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    fontSize: 16,
    color: "#1E1B3A",
    ...fonts.regular,
  },

  roleRow: { flexDirection: "row", gap: spacing.md },
  roleCard: {
    flex: 1,
    backgroundColor: "#F7F5FF",
    borderWidth: 2,
    borderColor: "#E8E4F5",
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: "center",
    gap: spacing.xs,
  },
  roleCardActive: {
    backgroundColor: "#F0EEFF",
    borderColor: "#7B5CE7",
  },
  roleTitle: {
    fontSize: 16,
    color: "#9590B0",
    ...fonts.medium,
  },
  roleTitleActive: { color: "#7B5CE7" },
  roleSubtitle: {
    fontSize: 12,
    color: "#B0AABF",
    ...fonts.regular,
    textAlign: "center",
  },
  roleSubtitleActive: {
    color: "#9590B0",
  },

  error: {
    fontSize: 13,
    color: "#E05050",
    ...fonts.regular,
    marginBottom: spacing.md,
    textAlign: "center",
  },

  btn: {
    height: 56,
    backgroundColor: "#7B5CE7",
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.sm,
    shadowColor: "#7B5CE7",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  btnDisabled: { opacity: 0.7 },
  btnText: {
    fontSize: 17,
    color: "#FFFFFF",
    ...fonts.medium,
  },
});
