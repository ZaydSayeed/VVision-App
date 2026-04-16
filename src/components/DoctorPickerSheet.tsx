import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  View, Text, TextInput, Modal, TouchableOpacity, ScrollView,
  StyleSheet, KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { fonts, spacing, radius } from "../config/theme";
import { Doctor, fetchDoctors, addDoctor } from "../api/doctors";

interface Props {
  visible: boolean;
  patientId: string;
  onSelect: (doctor: Doctor) => void;
  onClose: () => void;
}

export function DoctorPickerSheet({ visible, patientId, onSelect, onClose }: Props) {
  const { colors } = useTheme();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try { setDoctors(await fetchDoctors(patientId)); }
    catch { setDoctors([]); }
    finally { setLoading(false); }
  }, [patientId]);

  useEffect(() => { if (visible) load(); }, [visible, load]);

  const handleAdd = async () => {
    if (!newName.trim() || !newEmail.trim()) return;
    setAdding(true);
    try {
      const doc = await addDoctor(patientId, newName.trim(), newEmail.trim());
      setDoctors(prev => [...prev, doc]);
      setShowAdd(false);
      setNewName("");
      setNewEmail("");
      onSelect(doc);
    } catch (e: any) { Alert.alert("Error", e.message); }
    finally { setAdding(false); }
  };

  const styles = useMemo(() => StyleSheet.create({
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
    sheet: {
      backgroundColor: colors.bg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
      paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxxxl,
      maxHeight: "70%",
    },
    handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: spacing.lg },
    title: { fontSize: 18, color: colors.text, ...fonts.medium, marginBottom: spacing.lg },
    row: {
      flexDirection: "row", alignItems: "center", gap: spacing.md,
      paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    avatar: {
      width: 40, height: 40, borderRadius: 20, backgroundColor: colors.violet50,
      alignItems: "center", justifyContent: "center",
    },
    avatarText: { fontSize: 16, color: colors.violet, ...fonts.medium },
    name: { fontSize: 15, color: colors.text, ...fonts.medium },
    email: { fontSize: 12, color: colors.muted, ...fonts.regular },
    addBtn: {
      flexDirection: "row", alignItems: "center", gap: spacing.sm,
      paddingVertical: spacing.lg, justifyContent: "center",
    },
    addBtnText: { fontSize: 15, color: colors.violet, ...fonts.medium },
    input: {
      height: 48, backgroundColor: colors.surface, borderRadius: radius.md,
      paddingHorizontal: spacing.lg, fontSize: 15, color: colors.text, ...fonts.regular,
      marginBottom: spacing.sm,
    },
    saveBtn: {
      backgroundColor: colors.violet, borderRadius: radius.pill,
      paddingVertical: spacing.md, alignItems: "center", marginTop: spacing.sm,
    },
    saveBtnText: { fontSize: 15, color: "#FFFFFF", ...fonts.medium },
    cancelLink: { alignItems: "center", marginTop: spacing.md },
    cancelText: { fontSize: 14, color: colors.muted, ...fonts.regular },
  }), [colors]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
          <View style={styles.sheet} onStartShouldSetResponder={() => true}>
            <View style={styles.handle} />
            <Text style={styles.title}>Send to Doctor</Text>

            {loading ? (
              <ActivityIndicator color={colors.violet} style={{ marginVertical: spacing.xl }} />
            ) : showAdd ? (
              <View>
                <TextInput style={styles.input} placeholder="Doctor's name" placeholderTextColor={colors.muted} value={newName} onChangeText={setNewName} />
                <TextInput style={styles.input} placeholder="Email address" placeholderTextColor={colors.muted} value={newEmail} onChangeText={setNewEmail} keyboardType="email-address" autoCapitalize="none" />
                <TouchableOpacity style={styles.saveBtn} onPress={handleAdd} disabled={adding} activeOpacity={0.8}>
                  <Text style={styles.saveBtnText}>{adding ? "Saving…" : "Save & Send"}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelLink} onPress={() => setShowAdd(false)} activeOpacity={0.7}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {doctors.map(d => (
                  <TouchableOpacity key={d.id} style={styles.row} onPress={() => onSelect(d)} activeOpacity={0.7}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{d.name.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{d.name}</Text>
                      <Text style={styles.email}>{d.email}</Text>
                    </View>
                    <Ionicons name="send-outline" size={18} color={colors.violet} />
                  </TouchableOpacity>
                ))}
                <TouchableOpacity style={styles.addBtn} onPress={() => setShowAdd(true)} activeOpacity={0.7}>
                  <Ionicons name="add-circle-outline" size={20} color={colors.violet} />
                  <Text style={styles.addBtnText}>Add a doctor</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
}
