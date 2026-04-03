import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { useCaregiver } from "../../hooks/useCaregiver";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { getMyLinkCode, syncProfile } from "../../api/client";
import { SectionHeader } from "../../components/shared/SectionHeader";
import { EmptyState } from "../../components/shared/EmptyState";
import { fonts, spacing, radius } from "../../config/theme";

export function AddCaregiverScreen() {
  const { colors } = useTheme();
  const { profiles, refresh } = useCaregiver();
  const { user } = useAuth();
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // If user is a patient, fetch link code (retry sync if needed)
  useEffect(() => {
    if (user?.role === "patient") {
      getMyLinkCode()
        .then((res) => setLinkCode(res.link_code))
        .catch(async () => {
          try {
            await syncProfile(user.name, user.role);
            const res = await getMyLinkCode();
            setLinkCode(res.link_code);
          } catch {}
        });
    }
  }, [user?.role]);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    content: { padding: spacing.xl, paddingBottom: 100 },

    // Screen header
    screenHeader: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.lg,
      paddingBottom: spacing.lg,
    },
    screenTitle: {
      fontSize: 28,
      color: colors.text,
      ...fonts.medium,
    },

    codeCard: {
      backgroundColor: colors.bg,
      borderRadius: radius.xl,
      padding: spacing.xl,
      alignItems: "center",
      marginBottom: spacing.xl,
      shadowColor: "#7B5CE7",
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 3,
    },
    codeLabel: {
      fontSize: 11,
      color: colors.muted,
      ...fonts.medium,
      letterSpacing: 1.2,
      textTransform: "uppercase",
      marginBottom: spacing.md,
    },
    codeValue: {
      fontSize: 34,
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
    profileCard: {
      backgroundColor: colors.bg,
      borderRadius: radius.lg,
      padding: spacing.lg,
      flexDirection: "row",
      alignItems: "center",
      marginBottom: spacing.sm,
      gap: spacing.md,
      shadowColor: "#7B5CE7",
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.07,
      shadowRadius: 10,
      elevation: 2,
    },
    profileAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.violet50,
      alignItems: "center",
      justifyContent: "center",
    },
    profileInitial: {
      fontSize: 18,
      color: colors.violet,
      ...fonts.medium,
    },
    profileInfo: { flex: 1 },
    profileName: {
      fontSize: 16,
      color: colors.text,
      ...fonts.medium,
    },
    profileMeta: {
      fontSize: 13,
      color: colors.muted,
      ...fonts.regular,
      marginTop: 2,
    },
  }), [colors]);

  return (
    <View style={styles.container}>
    <View style={styles.screenHeader}>
      <Text style={styles.screenTitle}>Care Team</Text>
    </View>
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={async () => {
            setLoading(true);
            await refresh();
            setLoading(false);
          }}
          tintColor={colors.violet}
        />
      }
    >
      {/* Link Code Section (patient only) */}
      {user?.role === "patient" && linkCode && (
        <View style={styles.codeCard}>
          <Text style={styles.codeLabel}>YOUR LINK CODE</Text>
          <Text style={styles.codeValue}>{linkCode}</Text>
          <Text style={styles.codeHint}>
            Share this code with your caregiver so they can connect to your
            account.
          </Text>
        </View>
      )}

      {/* Care Team */}
      <SectionHeader label="Care Team" />
      {profiles.length === 0 ? (
        <EmptyState
          title="No caregivers linked"
          subtitle={
            user?.role === "patient"
              ? "Share your link code above with a caregiver"
              : "You are the only caregiver linked to this patient"
          }
        />
      ) : (
        profiles.map((profile) => (
          <View key={profile.id} style={styles.profileCard}>
            <View style={styles.profileAvatar}>
              <Text style={styles.profileInitial}>
                {profile.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{profile.name}</Text>
              {profile.email && (
                <Text style={styles.profileMeta}>{profile.email}</Text>
              )}
            </View>
          </View>
        ))
      )}
    </ScrollView>
    </View>
  );
}
