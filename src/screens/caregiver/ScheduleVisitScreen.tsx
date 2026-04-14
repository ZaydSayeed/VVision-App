import React, { useState } from "react";
import { View, Text, TextInput, Pressable, Alert, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { createVisit } from "../../api/visits";
import { useCurrentProfile } from "../../hooks/useCurrentProfile";

export default function ScheduleVisitScreen({ route, navigation }: any) {
  const { patientId } = useCurrentProfile();
  const [providerName, setProviderName] = useState("");
  const [providerRole, setProviderRole] = useState("");
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!providerName.trim() || !date.trim() || !patientId) {
      Alert.alert("Required", "Provider name and date are required.");
      return;
    }
    setSaving(true);
    try {
      await createVisit(patientId, {
        providerName: providerName.trim(),
        scheduledFor: new Date(date).toISOString(),
        providerRole: providerRole.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      route.params?.onCreated?.();
      navigation.goBack();
    } catch (e: any) { Alert.alert("Save failed", e.message); }
    finally { setSaving(false); }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 24 }}>
        <Text style={{ fontSize: 22, fontWeight: "700", marginBottom: 20 }}>Schedule Visit</Text>
        <Field label="Provider name *" value={providerName} onChange={setProviderName} placeholder="Dr. Patel" />
        <Field label="Role" value={providerRole} onChange={setProviderRole} placeholder="neurologist" />
        <Field label="Date & time (YYYY-MM-DD HH:MM) *" value={date} onChange={setDate} placeholder="2026-05-10 14:00" />
        <Field label="Notes" value={notes} onChange={setNotes} placeholder="Quarterly check-in" multiline />
        <Pressable onPress={save} disabled={saving}
          style={{ backgroundColor: "#6366f1", padding: 18, borderRadius: 14, marginTop: 8 }}>
          <Text style={{ color: "white", textAlign: "center", fontWeight: "700", fontSize: 16 }}>
            {saving ? "Saving…" : "Schedule"}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, value, onChange, placeholder, multiline }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean;
}) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ fontSize: 13, color: "#64748b", marginBottom: 4 }}>{label}</Text>
      <TextInput
        value={value} onChangeText={onChange} placeholder={placeholder}
        multiline={multiline} numberOfLines={multiline ? 3 : 1}
        style={{ backgroundColor: "#f8fafc", borderRadius: 10, padding: 12, fontSize: 16, textAlignVertical: multiline ? "top" : "center" }}
      />
    </View>
  );
}
