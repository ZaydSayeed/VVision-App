import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useAuth } from "../../context/AuthContext";
import { getMyLinkCode } from "../../api/client";
import { colors, fonts, spacing, radius } from "../../config/theme";

export function SettingsScreen() {
  const { user, logout } = useAuth();
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [codeLoading, setCodeLoading] = useState(true);

  useEffect(() => {
    getMyLinkCode()
      .then((res) => setLinkCode(res.link_code))
      .catch(() => setLinkCode(null))
      .finally(() => setCodeLoading(false));
  }, []);

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
          <Text style={styles.codeHint}>
            Could not load link code — make sure you're connected to the network.
          </Text>
        )}
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <Text style={styles.logoutText}>Sign out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
});
