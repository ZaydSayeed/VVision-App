import React, { useState, useRef } from "react";
import { View, Text, TextInput, Pressable, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { authFetch } from "../../api/authFetch";
import { useCurrentProfile } from "../../hooks/useCurrentProfile";
import { computeTypingMetrics } from "../../lib/biomarkers/typing";
import { queueEvent, flush } from "../../lib/eventBatcher";

export default function CheckInTextScreen({ route, navigation }: any) {
  const [text, setText] = useState(route.params?.prefill ?? "");
  const [saving, setSaving] = useState(false);
  const { patientId } = useCurrentProfile();
  const keystrokesRef = useRef<number[]>([]);

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
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, padding: 24 }}>
      <Text style={{ fontSize: 22, fontWeight: "700" }}>How is Mom today?</Text>
      <TextInput
        multiline value={text}
        onChangeText={(t) => { keystrokesRef.current.push(Date.now()); setText(t); }}
        placeholder="Type anything — this feeds Mom's Living Profile."
        style={{ flex: 1, marginVertical: 16, padding: 16, backgroundColor: "#f8fafc", borderRadius: 12, textAlignVertical: "top", fontSize: 16 }}
      />
      <Pressable onPress={save} disabled={!text.trim() || saving}
        style={{ backgroundColor: text.trim() ? "#059669" : "#cbd5e1", padding: 18, borderRadius: 14 }}>
        <Text style={{ color: "white", textAlign: "center", fontWeight: "700", fontSize: 16 }}>
          {saving ? "Saving…" : "Save"}
        </Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}
