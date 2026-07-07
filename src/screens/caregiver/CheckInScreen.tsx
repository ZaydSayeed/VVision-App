import React, { useState, useMemo } from "react";
import { View, Text, Pressable, ScrollView, Alert, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useVoiceSession } from "../../hooks/useVoiceSession";
import { useCurrentProfile } from "../../hooks/useCurrentProfile";
import { usePatients } from "../../hooks/usePatients";
import { authFetch } from "../../api/authFetch";
import { useTheme } from "../../context/ThemeContext";
import { fonts, radius, spacing, typography } from "../../config/theme";

export default function CheckInScreen({ navigation }: any) {
  const { patientId: defaultPatientId } = useCurrentProfile();
  const { patients } = usePatients();
  const [selectedPatientId, setSelectedPatientId] = useState<string | undefined>(undefined);
  const patientId = selectedPatientId ?? defaultPatientId ?? (patients.length === 1 ? patients[0].id : undefined);
  const { state, transcript, start, stop } = useVoiceSession(patientId);
  const [saving, setSaving] = useState(false);
  const { colors } = useTheme();

  const selectedPatient = patients.find(p => p.id === patientId);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, padding: spacing.xxl, backgroundColor: colors.bg },
    title: { ...typography.titleStyle, ...fonts.medium, color: colors.text },
    subtitle: { ...typography.bodyStyle, ...fonts.regular, color: colors.muted, marginTop: spacing.xs },
    pickerWrap: { marginTop: spacing.md, marginBottom: spacing.xs },
    pickerLabel: { ...typography.labelStyle, ...fonts.medium, color: colors.muted, marginBottom: spacing.sm },
    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    chip: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      minHeight: 44,
      borderRadius: radius.pill,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
    },
    chipActive: { backgroundColor: colors.violet },
    chipInactive: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    chipTextActive: { ...typography.smallStyle, ...fonts.medium, color: "#FFFFFF" },
    chipTextInactive: { ...typography.smallStyle, ...fonts.medium, color: colors.subtext },
    transcriptBox: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.lg,
      marginVertical: spacing.lg,
    },
    transcriptText: { ...typography.bodyStyle, ...fonts.regular, color: colors.text },
    transcriptPlaceholder: { ...typography.bodyStyle, ...fonts.regular, color: colors.muted },
    errorText: {
      ...typography.smallStyle,
      ...fonts.regular,
      color: colors.coral,
      marginBottom: spacing.sm,
      textAlign: "center",
    },
    hintText: {
      ...typography.smallStyle,
      ...fonts.regular,
      color: colors.muted,
      textAlign: "center",
      marginBottom: spacing.md,
    },
    btnRow: { flexDirection: "row", gap: spacing.md },
    btn: {
      flex: 1,
      paddingVertical: 16,
      borderRadius: radius.pill,
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
    },
    btnViolet: { backgroundColor: colors.violet },
    btnCoral: { backgroundColor: colors.coral },
    btnSage: { backgroundColor: colors.sage },
    btnDisabled: { opacity: 0.45 },
    btnText: { ...fonts.medium, fontSize: typography.body, color: "#FFFFFF", textAlign: "center" },
    linkBtn: { backgroundColor: colors.violet, paddingVertical: 16, minHeight: 44, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
    typeInsteadBtn: { marginTop: spacing.sm, paddingVertical: spacing.md, minHeight: 44, alignItems: "center", justifyContent: "center" },
    typeInsteadText: { ...typography.bodyStyle, ...fonts.medium, color: colors.violet, textAlign: "center" },
  }), [colors]);

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
    <View style={styles.container}>
      <Text style={styles.title}>
        {selectedPatient ? `How is ${selectedPatient.name} today?` : "How is your patient today?"}
      </Text>
      <Text style={styles.subtitle}>Speak naturally for 30–60 seconds.</Text>

      {/* Patient picker — only shown when caregiver has multiple patients */}
      {patients.length > 1 && (
        <View style={styles.pickerWrap}>
          <Text style={styles.pickerLabel}>Checking in for</Text>
          <View style={styles.chipRow}>
            {patients.map(p => (
              <TouchableOpacity
                key={p.id}
                onPress={() => setSelectedPatientId(p.id)}
                style={[styles.chip, patientId === p.id ? styles.chipActive : styles.chipInactive]}
              >
                {patientId === p.id && <Ionicons name="checkmark" size={13} color="#FFFFFF" />}
                <Text style={patientId === p.id ? styles.chipTextActive : styles.chipTextInactive}>
                  {p.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <ScrollView style={styles.transcriptBox}>
        <Text style={transcript ? styles.transcriptText : styles.transcriptPlaceholder}>
          {transcript || (state === "listening" ? "Listening…" : "Tap the mic to start.")}
        </Text>
      </ScrollView>

      {state === "error" && (
        <Text style={styles.errorText}>
          Microphone unavailable on this device. Allow microphone access in Settings, or tap “Type instead” below to continue.
        </Text>
      )}

      {!patientId && (
        <Text style={styles.hintText}>
          {patients.length > 1
            ? "Pick a patient above to begin."
            : "No patient linked yet. Ask your patient to share their link code from the Vela app."}
        </Text>
      )}

      {patients.length === 0 ? (
        <Pressable
          onPress={() => navigation.navigate("CaregiverHome", { screen: "Patients", params: { startView: "link" } })}
          style={styles.linkBtn}
        >
          <Text style={styles.btnText}>
            Link a patient to get started
          </Text>
        </Pressable>
      ) : (
      <View style={styles.btnRow}>
        {state === "listening" ? (
          <Pressable onPress={stop} style={[styles.btn, styles.btnCoral]}>
            <Text style={styles.btnText}>Stop</Text>
          </Pressable>
        ) : (
          <Pressable
            disabled={!patientId}
            onPress={start}
            style={[styles.btn, styles.btnViolet, !patientId && styles.btnDisabled]}
          >
            {state !== "connecting" && <Ionicons name="mic" size={18} color="#FFFFFF" />}
            <Text style={styles.btnText}>
              {state === "connecting" ? "Connecting…" : "Start"}
            </Text>
          </Pressable>
        )}
        <Pressable
          disabled={!transcript || saving || !patientId}
          onPress={save}
          style={[styles.btn, styles.btnSage, !(transcript && patientId) && styles.btnDisabled]}
        >
          <Text style={styles.btnText}>
            {saving ? "Saving…" : "Save"}
          </Text>
        </Pressable>
      </View>
      )}

      <Pressable onPress={() => navigation.navigate("CheckInText", { prefill: transcript })} style={styles.typeInsteadBtn}>
        <Text style={styles.typeInsteadText}>Voice not working? Type instead</Text>
      </Pressable>
    </View>
  );
}
