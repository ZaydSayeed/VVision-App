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
import { getMyLinkCode, syncProfile } from "../../api/client";
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
        setLinkCode(link_code || null);
      } catch {
        // Profile may not be synced to backend yet — retry sync then fetch again
        try {
          await syncProfile(user.name, user.role);
          const { link_code } = await getMyLinkCode();
          setLinkCode(link_code || null);
        } catch {
          setLinkCode(null);
        }
      } finally {
        setCodeLoading(false);
      }
    }
    fetchCode();
  }, [user]);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    content: { padding: spacing.xl, paddingBottom: 100 },
    profileCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      padding: spacing.xl,
      alignItems: "center",
      marginBottom: spacing.xxl,
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
      color: "#FAF8F4",
      ...fonts.medium,
    },
    profileName: {
      fontSize: 22,
      color: colors.text,
      ...fonts.display,
    },
    profileEmail: {
      fontSize: 14,
      color: colors.muted,
      ...fonts.regular,
      marginTop: spacing.xs,
    },
    sectionLabel: {
      fontSize: 10,
      color: colors.lavender,
      ...fonts.medium,
      letterSpacing: 1.5,
      textTransform: "uppercase",
      marginBottom: spacing.sm,
    },
    codeCard: {
      backgroundColor: colors.violet50,
      borderWidth: 1,
      borderColor: colors.violet100,
      borderRadius: radius.md,
      padding: spacing.xl,
      alignItems: "center",
      marginBottom: spacing.xxl,
    },
    codeValue: {
      fontSize: 40,
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
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      marginBottom: spacing.xxl,
      overflow: "hidden",
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
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: radius.sm,
      alignItems: "center",
      justifyContent: "center",
    },
    logoutText: {
      fontSize: 17,
      color: colors.muted,
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
            thumbColor="#FAF8F4"
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
