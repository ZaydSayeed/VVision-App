import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { fonts, spacing, radius } from "../config/theme";

interface Props {
  visible: boolean;
  onSave: (text: string, pinned: boolean) => Promise<void>;
  onClose: () => void;
}

export function AddNoteSheet({ visible, onSave, onClose }: Props) {
  const { colors } = useTheme();
  const [text, setText] = useState("");
  const [pinned, setPinned] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (!text.trim()) { setError("Please enter a note."); return; }
    setSaving(true);
    setError("");
    try {
      await onSave(text.trim(), pinned);
      setText("");
      setPinned(false);
      onClose();
    } catch {
      setError("Could not save. Check your connection.");
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    setText("");
    setPinned(false);
    setError("");
    onClose();
  }

  const styles = useMemo(() => StyleSheet.create({
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      padding: spacing.xxl,
      gap: spacing.md,
    },
    topRow: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
    handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, flex: 1, marginHorizontal: spacing.xxl },
    pinBtn: {
      width: 36, height: 36, borderRadius: 10,
      alignItems: "center", justifyContent: "center",
    },
    title: { fontSize: 20, color: colors.text, ...fonts.medium },
    input: {
      backgroundColor: colors.bg,
      borderRadius: radius.lg,
      padding: spacing.lg,
      fontSize: 15,
      color: colors.text,
      ...fonts.regular,
      minHeight: 100,
      textAlignVertical: "top",
      borderWidth: 1,
      borderColor: colors.border,
    },
    pinHint: { fontSize: 12, color: colors.muted, ...fonts.regular },
    error: { fontSize: 13, color: colors.coral, ...fonts.regular },
    btns: { flexDirection: "row", gap: spacing.md },
    btnCancel: {
      flex: 1, height: 52, borderRadius: radius.pill,
      borderWidth: 1.5, borderColor: colors.border,
      alignItems: "center", justifyContent: "center",
    },
    btnCancelText: { fontSize: 15, color: colors.text, ...fonts.medium },
    btnSave: {
      flex: 1, height: 52, borderRadius: radius.pill,
      backgroundColor: colors.violet,
      alignItems: "center", justifyContent: "center",
    },
    btnSaveText: { fontSize: 15, color: "#fff", ...fonts.medium },
  }), [colors]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.sheet}>
          {/* Handle + thumbtack row */}
          <View style={styles.topRow}>
            <View style={styles.handle} />
            <TouchableOpacity
              style={[styles.pinBtn, { backgroundColor: pinned ? colors.violet : colors.surface }]}
              onPress={() => setPinned((p) => !p)}
              activeOpacity={0.75}
              accessibilityLabel={pinned ? "Unpin note" : "Pin note to home screen"}
            >
              <Ionicons
                name={pinned ? "pin" : "pin-outline"}
                size={18}
                color={pinned ? "#fff" : colors.violet}
              />
            </TouchableOpacity>
          </View>

          <Text style={styles.title}>New Note</Text>

          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Write a note for your patient..."
            placeholderTextColor={colors.muted}
            multiline
            maxLength={500}
            autoFocus
          />

          <Text style={styles.pinHint}>
            {pinned ? "This note will be pinned to the patient's home screen." : "Tap the thumbtack to pin to home screen."}
          </Text>

          {!!error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.btns}>
            <TouchableOpacity style={styles.btnCancel} onPress={handleClose} activeOpacity={0.75}>
              <Text style={styles.btnCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnSave} onPress={handleSave} disabled={saving} activeOpacity={0.85}>
              <Text style={styles.btnSaveText}>{saving ? "Saving..." : "Save Note"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
