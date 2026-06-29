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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../config/supabase";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { fonts, spacing, radius } from "../config/theme";

const MIN_LENGTH = 6;

export function ResetPasswordScreen() {
  const { colors, isDark } = useTheme();
  const { endRecovery } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSave() {
    setError("");
    if (password.length < MIN_LENGTH) {
      setError(`Password must be at least ${MIN_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw new Error(updateError.message);
      setDone(true);
    } catch (e: any) {
      setError(e?.message ?? "Couldn't update your password. Please try again.");
    } finally {
      setLoading(false);
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
    brandSection: { alignItems: "center", marginBottom: spacing.xxxl },
    brandLogo: { width: 180, height: 220 },
    headline: {
      fontSize: 30,
      color: colors.text,
      ...fonts.medium,
      marginBottom: spacing.sm,
      lineHeight: 36,
    },
    subhead: {
      fontSize: 15,
      color: colors.muted,
      ...fonts.regular,
      lineHeight: 22,
      marginBottom: spacing.xl,
    },
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
    btnText: { fontSize: 17, color: "#FFFFFF", ...fonts.medium, letterSpacing: 0.2 },
    cancelRow: { alignSelf: "center", marginTop: spacing.xl, paddingVertical: 4 },
    cancelText: { fontSize: 14, color: colors.muted, ...fonts.medium },
    // Success state
    successIcon: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.sageSoft,
      alignItems: "center",
      justifyContent: "center",
      alignSelf: "center",
      marginBottom: spacing.xl,
    },
  }), [colors]);

  if (done) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark" size={38} color={colors.sage} />
          </View>
          <Text style={[styles.headline, { textAlign: "center" }]}>Password updated.</Text>
          <Text style={[styles.subhead, { textAlign: "center" }]}>
            Sign in with your new password to continue.
          </Text>
          <TouchableOpacity
            style={styles.btn}
            onPress={() => endRecovery()}
            activeOpacity={0.88}
          >
            <Text style={styles.btnText}>Back to sign in</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

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
          <View style={styles.brandSection}>
            <Image
              source={isDark ? require("../../assets/logo-stacked-light.png") : require("../../assets/logo-stacked-dark.png")}
              style={styles.brandLogo}
              resizeMode="contain"
            />
          </View>

          <Text style={styles.headline}>Set a new password.</Text>
          <Text style={styles.subhead}>Choose a new password for your account.</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>New Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.muted}
              secureTextEntry
              autoCapitalize="none"
              returnKeyType="next"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Confirm Password</Text>
            <TextInput
              style={styles.input}
              value={confirm}
              onChangeText={setConfirm}
              placeholder="••••••••"
              placeholderTextColor={colors.muted}
              secureTextEntry
              autoCapitalize="none"
              returnKeyType="go"
              onSubmitEditing={handleSave}
            />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleSave}
            activeOpacity={0.88}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.btnText}>Update password</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelRow} onPress={() => endRecovery()} activeOpacity={0.7}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
