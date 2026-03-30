import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from "react-native";
import { useCaregiver } from "../../hooks/useCaregiver";
import { SectionHeader } from "../../components/shared/SectionHeader";
import { EmptyState } from "../../components/shared/EmptyState";
import { colors, fonts, spacing, radius } from "../../config/theme";

export function AddCaregiverScreen() {
  const { profiles, addProfile, deleteProfile } = useCaregiver();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [relation, setRelation] = useState("");
  const [error, setError] = useState("");

  async function handleAdd() {
    if (!name.trim() || !phone.trim() || !relation.trim()) {
      setError("All fields are required.");
      return;
    }
    setError("");
    await addProfile(name.trim(), phone.trim(), relation.trim());
    setName("");
    setPhone("");
    setRelation("");
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Existing Profiles */}
      <SectionHeader label="Care Team" />
      {profiles.length === 0 ? (
        <EmptyState
          emoji="👥"
          title="No caregivers yet"
          subtitle="Add your first caregiver below"
        />
      ) : (
        profiles.map((profile) => (
          <View key={profile.id} style={styles.profileCard}>
            <View style={styles.profileAvatar}>
              <Text style={styles.profileInitial}>
                {profile.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{profile.name}</Text>
              <Text style={styles.profileMeta}>
                {profile.relation} · {profile.phone}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => deleteProfile(profile.id)}
              style={styles.removeBtn}
            >
              <Text style={styles.removeText}>Remove</Text>
            </TouchableOpacity>
          </View>
        ))
      )}

      {/* Add Form */}
      <View style={styles.formSection}>
        <SectionHeader label="Add Caregiver" />

        <Text style={styles.fieldLabel}>NAME</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. John Smith"
          placeholderTextColor={colors.muted}
          autoCapitalize="words"
        />

        <Text style={styles.fieldLabel}>PHONE NUMBER</Text>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          placeholder="e.g. (214) 555-0100"
          placeholderTextColor={colors.muted}
          keyboardType="phone-pad"
        />

        <Text style={styles.fieldLabel}>RELATION TO PATIENT</Text>
        <TextInput
          style={styles.input}
          value={relation}
          onChangeText={setRelation}
          placeholder="e.g. Son, Nurse, Neighbor"
          placeholderTextColor={colors.muted}
          autoCapitalize="words"
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity style={styles.btn} onPress={handleAdd}>
          <Text style={styles.btnText}>Add to Care Team</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl, paddingBottom: 100 },
  profileCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  profileAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.violet,
    alignItems: "center",
    justifyContent: "center",
  },
  profileInitial: {
    fontSize: 18,
    color: "#FAF8F4",
    ...fonts.medium,
  },
  profileInfo: { flex: 1 },
  profileName: {
    fontSize: 16,
    color: colors.text,
    ...fonts.medium,
  },
  profileMeta: {
    fontSize: 13,
    color: colors.muted,
    ...fonts.regular,
    marginTop: 2,
  },
  removeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  removeText: {
    fontSize: 12,
    color: colors.muted,
    ...fonts.regular,
  },
  formSection: { marginTop: spacing.xxl },
  fieldLabel: {
    fontSize: 10,
    color: colors.lavender,
    ...fonts.medium,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  input: {
    height: 52,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.lg,
    fontSize: 16,
    color: colors.text,
    ...fonts.regular,
  },
  error: {
    fontSize: 13,
    color: colors.violet,
    ...fonts.regular,
    marginTop: spacing.sm,
  },
  btn: {
    height: 52,
    backgroundColor: colors.violet,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.lg,
  },
  btnText: {
    fontSize: 16,
    color: "#F5F0E8",
    ...fonts.medium,
  },
});
