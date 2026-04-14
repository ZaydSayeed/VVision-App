import React from "react";
import { View, Text, Switch, ScrollView } from "react-native";
import { useSensorPrefs } from "../../hooks/useSensorPrefs";

export default function SensorSettingsScreen() {
  const { prefs, update } = useSensorPrefs();
  return (
    <ScrollView contentContainerStyle={{ padding: 24 }}>
      <Text style={{ fontSize: 22, fontWeight: "700", marginBottom: 16 }}>Sensors</Text>
      <Text style={{ color: "#64748b", marginBottom: 24 }}>
        All sensing is off by default for the patient. These toggles affect the CAREGIVER'S phone during check-ins — general wellness signals only, never a diagnosis.
      </Text>
      <Row label="Gait cadence (during voice check-ins)" value={prefs.gaitEnabled} onChange={(v) => update({ gaitEnabled: v })} />
      <Row label="Typing cadence (during text check-ins)" value={prefs.typingEnabled} onChange={(v) => update({ typingEnabled: v })} />
      <Row label="Smart home events (HomeKit / Matter)" value={prefs.smartHomeEnabled} onChange={(v) => update({ smartHomeEnabled: v })} />
    </ScrollView>
  );
}

function Row({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderColor: "#e2e8f0" }}>
      <Text style={{ flex: 1, fontSize: 15 }}>{label}</Text>
      <Switch value={value} onValueChange={onChange} />
    </View>
  );
}
