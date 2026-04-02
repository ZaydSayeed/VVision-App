import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useAuth } from "../../context/AuthContext";
import { getMyLinkCode } from "../../api/client";
import { fonts, spacing, radius } from "../../config/theme";
import { useTheme } from "../../context/ThemeContext";

export function SettingsScreen() {
  const { colors, isDark, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [codeLoading, setCodeLoading] = useState(true);

  useEffect(() => {
    async function fetchCode() {
      if (!user) return;
      try {
        const { link_code } = await getMyLinkCode();
        setLinkCode(link_code);
      } catch {
        setLinkCode(null);
      }
      setCodeLoading(false);
    }
    fetchCode();
  }, [user]);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    content: { padding: spacing.xl, paddingBottom: 100 },
    profileCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      padding: spacing.xl,
      alignItems: "center",
      marginBottom: spacing.xxl,
      shadowColor: "#7B5CE7",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 10,
      elevation: 2,
    },
    avatar: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.violet,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.md,
    },
    avatarText: {
      fontSize: 30,
      color: "#FFFFFF",
      ...fonts.medium,
    },
    profileName: {
      fontSize: 22,
      color: colors.text,
      ...fonts.medium,
    },
    profileEmail: {
      fontSize: 14,
      color: colors.muted,
      ...fonts.regular,
      marginTop: spacing.xs,
    },
    sectionLabel: {
      fontSize: 13,
      color: colors.text,
      ...fonts.medium,
      marginBottom: spacing.sm,
    },
    codeCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      padding: spacing.xl,
      alignItems: "center",
      marginBottom: spacing.xxl,
      shadowColor: "#7B5CE7",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 10,
      elevation: 2,
    },
    codeValue: {
      fontSize: 36,
      color: colors.violet,
      ...fonts.medium,
      letterSpacing: 10,
      marginBottom: spacing.md,
    },
    codeHint: {
      fontSize: 13,
      color: colors.muted,
      ...fonts.regular,
      textAlign: "center",
      lineHeight: 19,
    },
    settingsCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      marginBottom: spacing.xxl,
      overflow: "hidden",
      shadowColor: "#7B5CE7",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 10,
      elevation: 2,
    },
    settingsRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.lg,
    },
    settingsLabel: {
      fontSize: 16,
      color: colors.text,
      ...fonts.regular,
    },
    logoutBtn: {
      height: 56,
      backgroundColor: "rgba(123,92,231,0.08)",
      borderRadius: radius.pill,
      alignItems: "center",
      justifyContent: "center",
    },
    logoutText: {
      fontSize: 17,
      color: colors.violet,
      ...fonts.medium,
    },
  }), [colors]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.name?.charAt(0).toUpperCase() ?? "?"}
          </Text>
        </View>
        <Text style={styles.profileName}>{user?.name}</Text>
        <Text style={styles.profileEmail}>{user?.email}</Text>
      </View>

      {/* Link Code */}
      <Text style={styles.sectionLabel}>CAREGIVER LINK CODE</Text>
      <View style={styles.codeCard}>
        {codeLoading ? (
          <ActivityIndicator color={colors.violet} />
        ) : linkCode ? (
          <>
            <Text style={styles.codeValue}>{linkCode}</Text>
            <Text style={styles.codeHint}>
              Share this code with your caregiver so they can connect to your account.
            </Text>
          </>
        ) : (
          <Text style={styles.codeHint}>Could not load link code. Please try again.</Text>
        )}
      </View>

      {/* Appearance */}
      <Text style={styles.sectionLabel}>APPEARANCE</Text>
      <View style={styles.settingsCard}>
        <View style={styles.settingsRow}>
          <Text style={styles.settingsLabel}>Dark Mode</Text>
          <Switch
            value={isDark}
            onValueChange={toggleTheme}
            trackColor={{ false: "#D1C9E0", true: colors.violet }}
            thumbColor="#FFFFFF"
          />
        </View>
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <Text style={styles.logoutText}>Sign out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
