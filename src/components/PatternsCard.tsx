import React, { useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { listPatterns, dismissPattern } from "../api/patterns";
import { useCurrentProfile } from "../hooks/useCurrentProfile";

export default function PatternsCard() {
  const { patientId } = useCurrentProfile();
  const [patterns, setPatterns] = useState<any[]>([]);

  const load = async () => {
    if (patientId) {
      try {
        const r = await listPatterns(patientId);
        setPatterns(r.patterns.filter((p: any) => !p.dismissedAt));
      } catch {}
    }
  };
  useEffect(() => { load(); }, [patientId]);

  if (patterns.length === 0) return null;
  return (
    <View style={{ backgroundColor: "#eff6ff", padding: 16, borderRadius: 12, marginVertical: 12 }}>
      <Text style={{ fontWeight: "700", fontSize: 14, color: "#1d4ed8", marginBottom: 8 }}>Patterns we've noticed</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {patterns.slice(0, 5).map((p: any) => (
          <View key={p._id} style={{ width: 260, marginRight: 12, backgroundColor: "white", padding: 12, borderRadius: 10 }}>
            <Text style={{ fontWeight: "600" }}>{p.title}</Text>
            <Text style={{ color: "#64748b", marginTop: 4, fontSize: 13 }}>{p.description}</Text>
            <Pressable
              onPress={async () => { if (patientId) { await dismissPattern(patientId, p._id); load(); } }}
              style={{ marginTop: 8 }}>
              <Text style={{ color: "#6366f1", fontSize: 12 }}>Dismiss</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
