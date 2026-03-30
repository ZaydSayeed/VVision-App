import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  StyleSheet,
} from "react-native";
import { useMeds } from "../../hooks/useMeds";
import { CheckRow } from "../../components/shared/CheckRow";
import { SectionHeader } from "../../components/shared/SectionHeader";
import { EmptyState } from "../../components/shared/EmptyState";
import { colors, fonts, spacing, radius } from "../../config/theme";

export function MedsScreen() {
  const { meds, addMed, toggleTaken, deleteMed, isTakenToday } = useMeds();
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [dosage, setDosage] = useState("");
  const [time, setTime] = useState("");
  const [error, setError] = useState("");

  const allDone = meds.length > 0 && meds.every(isTakenToday);

  async function handleAdd() {
    if (!name.trim() || !dosage.trim() || !time.trim()) {
      setError("Please fill in all fields.");
      return;
    }
    setError("");
    await addMed(name.trim(), dosage.trim(), time.trim());
    setName("");
    setDosage("");
    setTime("");
    setShowModal(false);
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* All done banner */}
        {allDone && (
          <View style={styles.doneBanner}>
            <Text style={styles.doneBannerText}>✓ All medications taken today!</Text>
          </View>
        )}

        <SectionHeader
          label="My Medications"
          action={{ label: "+ Add Med", onPress: () => setShowModal(true) }}
        />

        {meds.length === 0 ? (
          <EmptyState
            emoji="💊"
            title="No medications"
            subtitle="Tap '+ Add Med' to add your medications"
          />
        ) : (
          meds.map((med) => (
            <CheckRow
              key={med.id}
              label={med.name}
              subLabel={`${med.dosage} · ${med.time}`}
              checked={isTakenToday(med)}
              onToggle={() => toggleTaken(med.id)}
              onDelete={() => deleteMed(med.id)}
            />
          ))
        )}
      </ScrollView>

      {/* Add Med Modal */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Add Medication</Text>

            <Text style={styles.fieldLabel}>MEDICATION NAME</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Donepezil"
              placeholderTextColor={colors.muted}
              autoFocus
            />

            <Text style={styles.fieldLabel}>DOSAGE</Text>
            <TextInput
              style={styles.input}
              value={dosage}
              onChangeText={setDosage}
              placeholder="e.g. 1 tablet"
              placeholderTextColor={colors.muted}
            />

            <Text style={styles.fieldLabel}>TIME (e.g. 08:00)</Text>
            <TextInput
              style={styles.input}
              value={time}
              onChangeText={setTime}
              placeholder="08:00"
              placeholderTextColor={colors.muted}
              keyboardType="numbers-and-punctuation"
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={styles.btnOutline}
                onPress={() => { setShowModal(false); setError(""); }}
              >
                <Text style={styles.btnOutlineText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnPrimary} onPress={handleAdd}>
                <Text style={styles.btnPrimaryText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl, paddingBottom: 100 },
  doneBanner: {
    backgroundColor: colors.violet50,
    borderWidth: 1,
    borderColor: colors.violet100,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    alignItems: "center",
  },
  doneBannerText: {
    fontSize: 17,
    color: colors.violet,
    ...fonts.medium,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(43,35,64,0.3)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.xxl,
    gap: spacing.sm,
  },
  modalTitle: {
    fontSize: 26,
    color: colors.text,
    ...fonts.display,
    marginBottom: spacing.sm,
  },
  fieldLabel: {
    fontSize: 10,
    color: colors.lavender,
    ...fonts.medium,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  input: {
    height: 56,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.lg,
    fontSize: 20,
    color: colors.text,
    ...fonts.regular,
  },
  error: { fontSize: 14, color: colors.violet, ...fonts.regular },
  modalBtns: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg },
  btnOutline: {
    flex: 1,
    height: 56,
    borderWidth: 1.5,
    borderColor: colors.violet,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  btnOutlineText: { fontSize: 17, color: colors.violet, ...fonts.medium },
  btnPrimary: {
    flex: 1,
    height: 56,
    backgroundColor: colors.violet,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  btnPrimaryText: { fontSize: 17, color: "#F5F0E8", ...fonts.medium },
});
