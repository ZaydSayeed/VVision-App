import React, { useEffect, useState, useCallback } from "react";
import { View, Text, FlatList, Pressable, Linking, Alert } from "react-native";
import { listVisits } from "../../api/visits";
import { useCurrentProfile } from "../../hooks/useCurrentProfile";
import { authFetch } from "../../api/authFetch";

export default function VisitsScreen({ navigation }: any) {
  const { patientId } = useCurrentProfile();
  const [visits, setVisits] = useState<any[]>([]);
  const load = useCallback(async () => {
    if (patientId) {
      try { const r = await listVisits(patientId); setVisits(r.visits); } catch {}
    }
  }, [patientId]);
  useEffect(() => { load(); }, [load]);

  return (
    <View style={{ flex: 1, padding: 24 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ fontSize: 22, fontWeight: "700" }}>Upcoming visits</Text>
        <Pressable onPress={() => navigation.navigate("ScheduleVisit", { onCreated: load })}
          style={{ backgroundColor: "#6366f1", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 }}>
          <Text style={{ color: "white", fontWeight: "600" }}>+ Schedule</Text>
        </Pressable>
      </View>
      <FlatList data={visits} keyExtractor={(v: any) => v._id} style={{ marginTop: 16 }}
        ListEmptyComponent={<Text style={{ color: "#64748b", textAlign: "center", marginTop: 40 }}>No visits scheduled.</Text>}
        renderItem={({ item }: any) => (
          <View style={{ padding: 16, backgroundColor: "#f8fafc", borderRadius: 10, marginBottom: 8 }}>
            <Text style={{ fontWeight: "600" }}>{item.providerName}</Text>
            <Text style={{ color: "#64748b" }}>{new Date(item.scheduledFor).toLocaleString()}</Text>
            {item.prepGeneratedAt ? (
              <Pressable onPress={async () => {
                try {
                  const res = await authFetch(`/api/profiles/${patientId}/visits/${item._id}/prep.pdf`);
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  Linking.openURL(url);
                } catch (e: any) { Alert.alert("Error", e.message); }
              }}>
                <Text style={{ color: "#6366f1", marginTop: 6 }}>📄 Download visit prep</Text>
              </Pressable>
            ) : (
              <Text style={{ color: "#94a3b8", marginTop: 6, fontSize: 12 }}>Visit prep generates 3 days before.</Text>
            )}
          </View>
        )} />
    </View>
  );
}
