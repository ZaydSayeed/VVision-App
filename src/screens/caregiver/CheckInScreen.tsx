import React, { useState } from "react";
import { View, Text, Pressable, ScrollView, Alert, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useVoiceSession } from "../../hooks/useVoiceSession";
import { useCurrentProfile } from "../../hooks/useCurrentProfile";
import { usePatients } from "../../hooks/usePatients";
import { authFetch } from "../../api/authFetch";

export default function CheckInScreen({ navigation }: any) {
  const { patientId: defaultPatientId } = useCurrentProfile();
  const { patients } = usePatients();
  const [selectedPatientId, setSelectedPatientId] = useState<string | undefined>(undefined);
  const patientId = selectedPatientId ?? defaultPatientId ?? (patients.length === 1 ? patients[0].id : undefined);
  const { state, transcript, start, stop } = useVoiceSession(patientId);
  const [saving, setSaving] = useState(false);

  const selectedPatient = patients.find(p => p.id === patientId);

  const save = async () => {
    if (!transcript.trim() || !patientId) return;
    setSaving(true);
    try {
      const res = await authFetch(`/api/profiles/${patientId}/memory`, {
        method: "POST",
        body: JSON.stringify({
          content: transcript,
          metadata: { source: "voice_check_in", capturedAt: new Date().toISOString() },
        }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(`Save failed (${res.status}). ${detail}`);
      }
      navigation.goBack();
    } catch (e: any) {
      Alert.alert("Save failed", e.message);
    } finally { setSaving(false); }
  };

  return (
    <View style={{ flex: 1, padding: 24 }}>
      <Text style={{ fontSize: 22, fontWeight: "700" }}>
        {selectedPatient ? `How is ${selectedPatient.name} today?` : "How is your patient today?"}
      </Text>
      <Text style={{ color: "#64748b", marginTop: 4 }}>Speak naturally for 30–60 seconds.</Text>

      {/* Patient picker — only shown when caregiver has multiple patients */}
      {patients.length > 1 && (
        <View style={{ marginTop: 12, marginBottom: 4 }}>
          <Text style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Checking in for</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {patients.map(p => (
              <TouchableOpacity
                key={p.id}
                onPress={() => setSelectedPatientId(p.id)}
                style={{
                  paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999,
                  backgroundColor: patientId === p.id ? "#6366f1" : "#f1f5f9",
                  flexDirection: "row", alignItems: "center", gap: 5,
                }}
              >
                {patientId === p.id && <Ionicons name="checkmark" size={13} color="#fff" />}
                <Text style={{ fontSize: 13, fontWeight: "600", color: patientId === p.id ? "#fff" : "#475569" }}>
                  {p.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <ScrollView style={{ flex: 1, backgroundColor: "#f8fafc", borderRadius: 12, padding: 16, marginVertical: 16 }}>
        <Text style={{ color: transcript ? "#0f172a" : "#94a3b8" }}>
          {transcript || (state === "listening" ? "Listening…" : "Tap the mic to start.")}
        </Text>
      </ScrollView>

      {state === "error" && (
        <Text style={{ color: "#dc2626", marginBottom: 8, textAlign: "center" }}>
          Microphone unavailable. Check app permissions, or use the text option below.
        </Text>
      )}

      {!patientId && patients.length > 1 && (
        <Text style={{ color: "#94a3b8", textAlign: "center", marginBottom: 12, fontSize: 13 }}>
          Pick a patient above to begin.
        </Text>
      )}

      <View style={{ flexDirection: "row", gap: 12 }}>
        {state === "listening" ? (
          <Pressable onPress={stop} style={{ flex: 1, backgroundColor: "#dc2626", padding: 18, borderRadius: 14 }}>
            <Text style={{ color: "white", textAlign: "center", fontWeight: "700", fontSize: 16 }}>Stop</Text>
          </Pressable>
        ) : (
          <Pressable
            disabled={!patientId}
            onPress={start}
            style={{ flex: 1, backgroundColor: patientId ? "#6366f1" : "#cbd5e1", padding: 18, borderRadius: 14 }}
          >
            <Text style={{ color: "white", textAlign: "center", fontWeight: "700", fontSize: 16 }}>
              {state === "connecting" ? "Connecting…" : "🎙️  Start"}
            </Text>
          </Pressable>
        )}
        <Pressable
          disabled={!transcript || saving || !patientId}
          onPress={save}
          style={{ flex: 1, backgroundColor: transcript && patientId ? "#059669" : "#cbd5e1", padding: 18, borderRadius: 14 }}
        >
          <Text style={{ color: "white", textAlign: "center", fontWeight: "700", fontSize: 16 }}>
            {saving ? "Saving…" : "Save"}
          </Text>
        </Pressable>
      </View>

      <Pressable onPress={() => navigation.navigate("CheckInText", { prefill: transcript })} style={{ marginTop: 16 }}>
        <Text style={{ color: "#6366f1", textAlign: "center" }}>Voice not working? Type instead</Text>
      </Pressable>
    </View>
  );
}
