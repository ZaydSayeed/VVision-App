import React, { useState } from "react";
import { View, Text, Pressable, ScrollView, Alert } from "react-native";
import { useVoiceSession } from "../../hooks/useVoiceSession";
import { useCurrentProfile } from "../../hooks/useCurrentProfile";
import { authFetch } from "../../api/authFetch";
import { captureGaitWindow } from "../../lib/biomarkers/gait";
import { queueEvent, flush } from "../../lib/eventBatcher";

export default function CheckInScreen({ navigation }: any) {
  const { patientId } = useCurrentProfile();
  const { state, transcript, start, stop } = useVoiceSession(patientId);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!transcript.trim() || !patientId) return;
    setSaving(true);
    try {
      await authFetch(`/api/profiles/${patientId}/memory`, {
        method: "POST",
        body: JSON.stringify({
          content: transcript,
          metadata: { source: "voice_check_in", capturedAt: new Date().toISOString() },
        }),
      });
      navigation.goBack();
    } catch (e: any) {
      Alert.alert("Save failed", e.message);
    } finally { setSaving(false); }
  };

  const startWithGait = async () => {
    // Capture 30s gait window in parallel with voice start — fire-and-forget
    start();
    captureGaitWindow(30000).then(async (result) => {
      if (patientId && result.sampleCount > 0) {
        await queueEvent({ kind: "gait", capturedAt: new Date().toISOString(), data: result as any, patientId });
        flush();
      }
    }).catch(() => {}); // non-blocking
  };

  return (
    <View style={{ flex: 1, padding: 24 }}>
      <Text style={{ fontSize: 22, fontWeight: "700" }}>How is Mom today?</Text>
      <Text style={{ color: "#64748b", marginTop: 4 }}>Speak naturally for 30–60 seconds.</Text>

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

      <View style={{ flexDirection: "row", gap: 12 }}>
        {state === "listening" ? (
          <Pressable onPress={stop} style={{ flex: 1, backgroundColor: "#dc2626", padding: 18, borderRadius: 14 }}>
            <Text style={{ color: "white", textAlign: "center", fontWeight: "700", fontSize: 16 }}>Stop</Text>
          </Pressable>
        ) : (
          <Pressable onPress={startWithGait} style={{ flex: 1, backgroundColor: "#6366f1", padding: 18, borderRadius: 14 }}>
            <Text style={{ color: "white", textAlign: "center", fontWeight: "700", fontSize: 16 }}>
              {state === "connecting" ? "Connecting…" : "🎙️  Start"}
            </Text>
          </Pressable>
        )}
        <Pressable
          disabled={!transcript || saving}
          onPress={save}
          style={{ flex: 1, backgroundColor: transcript ? "#059669" : "#cbd5e1", padding: 18, borderRadius: 14 }}
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
