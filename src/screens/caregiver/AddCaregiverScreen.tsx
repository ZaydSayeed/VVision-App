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
    codeCard: {
      backgroundColor: colors.violet50,
      borderWidth: 1,
      borderColor: colors.violet100,
      borderRadius: radius.md,
      padding: spacing.xl,
      alignItems: "center",
      marginBottom: spacing.xxl,
    },
    codeLabel: {
      fontSize: 10,
      color: colors.lavender,
      ...fonts.medium,
      letterSpacing: 1.5,
      textTransform: "uppercase",
      marginBottom: spacing.sm,
    },
    codeValue: {
      fontSize: 36,
      color: colors.violet,
      ...fonts.medium,
      letterSpacing: 8,
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
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      padding: spacing.lg,
      flexDirection: "row",
      alignItems: "center",
      marginBottom: spacing.sm,
      gap: spacing.md,
    },
    profileAvatar: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: colors.violet,
      alignItems: "center",
      justifyContent: "center",
    },
    profileInitial: {
      fontSize: 18,
      color: "#FAF8F4",
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
    <ScrollView
      style={styles.container}
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
  );
}
