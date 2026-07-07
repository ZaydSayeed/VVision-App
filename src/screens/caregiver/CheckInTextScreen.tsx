import React, { useState, useEffect, useMemo } from "react";
import { View, Text, TextInput, Pressable, Alert, Platform, Keyboard, KeyboardEvent, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { authFetch } from "../../api/authFetch";
import { useCurrentProfile } from "../../hooks/useCurrentProfile";
import { usePatients } from "../../hooks/usePatients";
import { useTheme } from "../../context/ThemeContext";
import { fonts, spacing, radius, typography } from "../../config/theme";

export default function CheckInTextScreen({ route, navigation }: any) {
  const { colors } = useTheme();
  const [text, setText] = useState(route.params?.prefill ?? "");
  const [saving, setSaving] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const { patientId: defaultPatientId } = useCurrentProfile();
  const { patients } = usePatients();
  const [selectedPatientId, setSelectedPatientId] = useState<string | undefined>(undefined);
  const patientId = selectedPatientId ?? defaultPatientId ?? (patients.length === 1 ? patients[0].id : undefined);
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
      const res = await authFetch(`/api/profiles/${patientId}/memory`, {
        method: "POST",
        body: JSON.stringify({ content: text, metadata: { source: "text_check_in" } }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(`Save failed (${res.status}). ${detail}`);
      }
      navigation.popToTop();
    } catch (e: any) { Alert.alert("Save failed", e.message); }
    finally { setSaving(false); }
  };

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg, padding: spacing.xxl },
    title: { ...typography.titleStyle, color: colors.text, ...fonts.medium },
    pickerLabel: {
      ...typography.labelStyle,
      color: colors.muted,
      ...fonts.medium,
      marginBottom: spacing.sm,
    },
    chip: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      minHeight: 44,
      borderRadius: radius.pill,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      justifyContent: "center",
    },
    chipText: { fontSize: 14, ...fonts.medium },
    input: {
      flex: 1,
      marginVertical: spacing.lg,
      padding: spacing.lg,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      textAlignVertical: "top",
      fontSize: 16,
      color: colors.text,
      ...fonts.regular,
    },
    pickHint: { color: colors.muted, textAlign: "center", marginBottom: spacing.md, fontSize: 14, ...fonts.regular },
    saveBtn: {
      padding: spacing.lg + 2,
      borderRadius: radius.pill,
      minHeight: 56,
      justifyContent: "center",
    },
    saveBtnText: { color: "#FFFFFF", textAlign: "center", fontSize: 16, ...fonts.medium },
  }), [colors]);

  return (
    <View style={[styles.container, { paddingBottom: keyboardHeight > 0 ? keyboardHeight + spacing.lg : spacing.xxl }]}>
      <Text style={styles.title}>
        {selectedPatient ? `How is ${selectedPatient.name} today?` : "How is your patient today?"}
      </Text>

      {patients.length > 1 && (
        <View style={{ marginTop: spacing.md, marginBottom: spacing.xs }}>
          <Text style={styles.pickerLabel}>Checking in for</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            {patients.map(p => (
              <TouchableOpacity
                key={p.id}
                onPress={() => setSelectedPatientId(p.id)}
                style={[styles.chip, { backgroundColor: patientId === p.id ? colors.violet : colors.surface }]}
              >
                {patientId === p.id && <Ionicons name="checkmark" size={14} color="#fff" />}
                <Text style={[styles.chipText, { color: patientId === p.id ? "#FFFFFF" : colors.subtext }]}>
                  {p.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <TextInput
        multiline value={text}
        onChangeText={setText}
        placeholder={selectedPatient ? `Type anything — this feeds ${selectedPatient.name}'s Living Profile.` : "Type anything — this feeds their Living Profile."}
        placeholderTextColor={colors.muted}
        style={styles.input}
      />
      {!patientId && patients.length > 1 && (
        <Text style={styles.pickHint}>
          Pick a patient above to begin.
        </Text>
      )}
      <Pressable onPress={save} disabled={!text.trim() || saving || !patientId}
        style={[styles.saveBtn, { backgroundColor: text.trim() && patientId ? colors.sage : colors.border }]}>
        <Text style={styles.saveBtnText}>
          {saving ? "Saving…" : "Save"}
        </Text>
      </Pressable>
    </View>
  );
}
