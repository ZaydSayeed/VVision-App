import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Pressable,
} from "react-native";
import { useCaregiver } from "../../hooks/useCaregiver";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { useCurrentProfile } from "../../hooks/useCurrentProfile";
import { getMyLinkCode, syncProfile } from "../../api/client";
import { listSeats } from "../../api/seats";
import { SectionHeader } from "../../components/shared/SectionHeader";
import { EmptyState } from "../../components/shared/EmptyState";
import { fonts, spacing, radius } from "../../config/theme";

const ROLE_LABELS: Record<string, string> = {
  primary_caregiver: "Admin",
  sibling: "Family",
  paid_aide: "Aide",
  clinician: "Clinician",
};

export function AddCaregiverScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { profiles, refresh: refreshProfiles } = useCaregiver();
  const { user } = useAuth();
  const { patientId } = useCurrentProfile();
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [seatData, setSeatData] = useState<{ seats: any[]; invites: any[] } | null>(null);
  const [loading, setLoading] = useState(false);

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

  const loadSeats = useCallback(async () => {
    if (!patientId) return;
    try {
      setSeatData(await listSeats(patientId));
    } catch {}
  }, [patientId]);

  useEffect(() => {
    loadSeats();
  }, [loadSeats]);

  const onRefresh = async () => {
    setLoading(true);
    await Promise.all([refreshProfiles(), loadSeats()]);
    setLoading(false);
  };

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    screenHeader: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.lg,
      paddingBottom: spacing.lg,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    headerLeft: { flex: 1 },
    screenTitle: { fontSize: 28, color: colors.text, ...fonts.medium },
    screenSubtitle: { fontSize: 13, color: colors.muted, ...fonts.regular, marginTop: 3 },
    inviteBtn: {
      backgroundColor: colors.violet,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 8,
    },
    inviteBtnText: { color: "white", fontWeight: "600", ...fonts.medium },
    content: { padding: spacing.xl, paddingBottom: 100 },
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
    profileInitial: { fontSize: 18, color: colors.violet, ...fonts.medium },
    profileInfo: { flex: 1 },
    profileName: { fontSize: 16, color: colors.text, ...fonts.medium },
    roleBadge: {
      backgroundColor: colors.violet50,
      borderRadius: radius.pill,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    roleBadgeText: { fontSize: 11, color: colors.violet, ...fonts.medium },
    pendingBadge: {
      backgroundColor: colors.amberSoft,
      borderRadius: radius.pill,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    pendingBadgeText: { fontSize: 11, color: colors.amber, ...fonts.medium },
  }), [colors]);

  const seats = seatData?.seats ?? [];
  const invites = seatData?.invites ?? [];

  return (
    <View style={styles.container}>
      <View style={styles.screenHeader}>
        <View style={styles.headerLeft}>
          <Text style={styles.screenTitle}>Care Team</Text>
          <Text style={styles.screenSubtitle}>
            {user?.role === "patient"
              ? "Share your code so a caregiver can connect"
              : "People managing this patient's care"}
          </Text>
        </View>
        {user?.role !== "patient" && (
          <Pressable
            onPress={() => navigation.navigate("InviteSeat")}
            style={styles.inviteBtn}
          >
            <Text style={styles.inviteBtnText}>+ Invite</Text>
          </Pressable>
        )}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={colors.violet} />
        }
      >
        {user?.role === "patient" && linkCode && (
          <View style={styles.codeCard}>
            <Text style={styles.codeLabel}>Your link code</Text>
            <Text style={styles.codeValue}>{linkCode}</Text>
            <Text style={styles.codeHint}>
              Share this code with your caregiver so they can connect to your account.
            </Text>
          </View>
        )}

        <SectionHeader label="Members" />
        {seats.length === 0 && invites.length === 0 ? (
          <EmptyState
            icon="people-circle"
            title="No caregivers linked"
            subtitle={
              user?.role === "patient"
                ? "Share your link code above with a caregiver"
                : "You are the only caregiver linked to this patient"
            }
          />
        ) : (
          <>
            {seats.map((seat: any, idx: number) => (
              <View key={seat.userId + idx} style={styles.profileCard}>
                <View style={styles.profileAvatar}>
                  <Text style={styles.profileInitial}>
                    {(seat.userId ?? "?").charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.profileInfo}>
                  <Text style={styles.profileName}>{seat.userId}</Text>
                </View>
                <View style={styles.roleBadge}>
                  <Text style={styles.roleBadgeText}>
                    {ROLE_LABELS[seat.role] ?? seat.role}
                  </Text>
                </View>
              </View>
            ))}
            {invites.map((invite: any, idx: number) => (
              <View key={invite.email + idx} style={styles.profileCard}>
                <View style={styles.profileAvatar}>
                  <Text style={styles.profileInitial}>
                    {invite.email.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.profileInfo}>
                  <Text style={styles.profileName}>{invite.email}</Text>
                </View>
                <View style={styles.pendingBadge}>
                  <Text style={styles.pendingBadgeText}>Pending</Text>
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}
