import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { listSeats } from "../../api/seats";
import { useCurrentProfile } from "../../hooks/useCurrentProfile";
import { useSubscription } from "../../hooks/useSubscription";
import { useTheme } from "../../context/ThemeContext";

export default function FamilyCircleScreen({ navigation }: any) {
  const { patientId } = useCurrentProfile();
  const { tier } = useSubscription();
  const { colors } = useTheme();
  const [data, setData] = useState<{ seats: any[]; invites: any[] } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.bg, padding: 24 },
        header: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        },
        title: { fontSize: 22, fontWeight: "700", color: colors.text },
        inviteBtn: {
          backgroundColor: colors.violet,
          paddingHorizontal: 14,
          paddingVertical: 8,
          borderRadius: 8,
        },
        inviteBtnText: { color: "white", fontWeight: "600" },
        trialBanner: {
          backgroundColor: colors.amberSoft,
          padding: 16,
          borderRadius: 10,
          marginBottom: 16,
        },
        trialBannerTitle: { fontWeight: "600", color: colors.amber },
        trialBannerBody: { color: colors.amber, marginTop: 4 },
        card: {
          padding: 16,
          backgroundColor: colors.surface,
          borderRadius: 10,
          marginBottom: 8,
        },
        cardName: { fontWeight: "600", color: colors.text },
        cardSub: { color: colors.muted, marginTop: 2 },
        empty: { color: colors.muted, textAlign: "center", marginTop: 40 },
      }),
    [colors]
  );

  const load = useCallback(async () => {
    if (!patientId) return;
    setRefreshing(true);
    try {
      setData(await listSeats(patientId));
    } catch {
      // silently fail — empty state handles it
    } finally {
      setRefreshing(false);
    }
  }, [patientId]);

  useEffect(() => {
    load();
  }, [load]);

  const items = [
    ...(data?.seats ?? []).map((s: any) => ({ type: "seat", ...s })),
    ...(data?.invites ?? []).map((i: any) => ({ type: "invite", ...i })),
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Family Circle</Text>
        <Pressable
          onPress={() => navigation.navigate("InviteSeat")}
          style={styles.inviteBtn}
        >
          <Text style={styles.inviteBtnText}>+ Invite</Text>
        </Pressable>
      </View>

      {tier === "free" && (
        <Pressable
          onPress={() => navigation.navigate("Paywall")}
          style={styles.trialBanner}
        >
          <Text style={styles.trialBannerTitle}>Start your 7-day trial</Text>
          <Text style={styles.trialBannerBody}>
            Invite family and unlock the full Living Profile.
          </Text>
        </Pressable>
      )}

      <FlatList
        data={items}
        keyExtractor={(item: any, idx) =>
          (item.userId ?? item.email ?? idx.toString()) + idx
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={load} />
        }
        ListEmptyComponent={
          <Text style={styles.empty}>No one here yet.</Text>
        }
        renderItem={({ item }: any) => (
          <View style={styles.card}>
            <Text style={styles.cardName}>
              {item.type === "seat" ? item.userId : item.email}
            </Text>
            <Text style={styles.cardSub}>
              {item.role}
              {item.type === "invite" ? " · pending invite" : ""}
            </Text>
          </View>
        )}
      />
    </View>
  );
}
