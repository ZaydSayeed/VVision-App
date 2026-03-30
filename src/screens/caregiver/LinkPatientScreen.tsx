import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../context/AuthContext";
import { linkPatient } from "../../api/client";
import { colors, fonts, spacing, radius } from "../../config/theme";

export function LinkPatientScreen() {
  const { user, updateUser } = useAuth();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLink() {
    if (code.trim().length < 6) {
      setError("Please enter the 6-character code from your patient.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const patient = await linkPatient(code.trim());
      if (user) {
        updateUser({ ...user, patient_id: patient.id });
      }
    } catch (e: any) {
      let msg = "Invalid code. Please try again.";
      try {
        const parsed = JSON.parse(e.message);
        msg = parsed.detail || msg;
      } catch {
        if (e.message) msg = e.message;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.headline}>Link to patient</Text>
        <Text style={styles.subtitle}>
          Ask your patient to open their app and share their 6-character link
          code with you.
        </Text>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>LINK CODE</Text>
          <TextInput
            style={styles.input}
            value={code}
            onChangeText={(t) => setCode(t.toUpperCase())}
            placeholder="e.g. A3X9K2"
            placeholderTextColor={colors.muted}
            maxLength={6}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="go"
            onSubmitEditing={handleLink}
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={handleLink}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#F5F0E8" />
          ) : (
            <Text style={styles.btnText}>Connect</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xxxxl,
  },
  headline: {
    fontSize: 36,
    color: colors.text,
    ...fonts.displayLight,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 15,
    color: colors.muted,
    ...fonts.regular,
    lineHeight: 22,
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
    height: 64,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.lg,
    fontSize: 28,
    color: colors.text,
    ...fonts.medium,
    textAlign: "center",
    letterSpacing: 8,
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
  },
  btnDisabled: {
    opacity: 0.7,
  },
  btnText: {
    fontSize: 17,
    color: "#F5F0E8",
    ...fonts.medium,
  },
});
