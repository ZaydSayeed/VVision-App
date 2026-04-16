import React, { useState, useRef, useEffect } from "react";
import { View, Text, TextInput, Pressable, Alert, Platform, Keyboard, KeyboardEvent, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { authFetch } from "../../api/authFetch";
import { useCurrentProfile } from "../../hooks/useCurrentProfile";
import { usePatients } from "../../hooks/usePatients";
import { computeTypingMetrics } from "../../lib/biomarkers/typing";
import { queueEvent, flush } from "../../lib/eventBatcher";

export default function CheckInTextScreen({ route, navigation }: any) {
  const [text, setText] = useState(route.params?.prefill ?? "");
  const [saving, setSaving] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const { patientId: defaultPatientId } = useCurrentProfile();
  const { patients } = usePatients();
  const [selectedPatientId, setSelectedPatientId] = useState<string | undefined>(undefined);
  const patientId = selectedPatientId ?? defaultPatientId ?? (patients.length === 1 ? patients[0].id : undefined);
  const keystrokesRef = useRef<number[]>([]);
  const selectedPatient = patients.find(p => p.id === patientId);

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", (e: KeyboardEvent) => setKeyboardHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => setKeyboardHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  const save = async () => {
    if (!text.trim() || !patientId) return;
    setSaving(true);
    try {
      await authFetch(`/api/profiles/${patientId}/memory`, {
        method: "POST",
        body: JSON.stringify({ content: text, metadata: { source: "text_check_in" } }),
      });
      // Queue typing biomarker
      const m = computeTypingMetrics(keystrokesRef.current);
      if (m.keystrokes >= 2) {
        await queueEvent({ kind: "typing_cadence", capturedAt: new Date().toISOString(), data: m as any, patientId });
        flush();
      }
      navigation.popToTop();
    } catch (e: any) { Alert.alert("Save failed", e.message); }
    finally { setSaving(false); }
  };

  return (
    <View style={{ flex: 1, padding: 24, paddingBottom: keyboardHeight > 0 ? keyboardHeight + 16 : 24 }}>
      <Text style={{ fontSize: 22, fontWeight: "700" }}>
        {selectedPatient ? `How is ${selectedPatient.name} today?` : "How is your patient today?"}
      </Text>

      {patients.length > 1 && (
        <View style={{ marginTop: 10, marginBottom: 4 }}>
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

      <TextInput
        multiline value={text}
        onChangeText={(t) => { keystrokesRef.current.push(Date.now()); setText(t); }}
        placeholder="Type anything — this feeds Mom's Living Profile."
        style={{ flex: 1, marginVertical: 16, padding: 16, backgroundColor: "#f8fafc", borderRadius: 12, textAlignVertical: "top", fontSize: 16 }}
      />
      {!patientId && patients.length > 1 && (
        <Text style={{ color: "#94a3b8", textAlign: "center", marginBottom: 12, fontSize: 13 }}>
          Pick a patient above to begin.
        </Text>
      )}
      <Pressable onPress={save} disabled={!text.trim() || saving || !patientId}
        style={{ backgroundColor: text.trim() && patientId ? "#059669" : "#cbd5e1", padding: 18, borderRadius: 14 }}>
        <Text style={{ color: "white", textAlign: "center", fontWeight: "700", fontSize: 16 }}>
          {saving ? "Saving…" : "Save"}
        </Text>
      </Pressable>
    </View>
  );
}
