import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TextInput,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { PersonCard } from "../components/PersonCard";
import { SectionHeader } from "../components/shared/SectionHeader";
import { EmptyState } from "../components/shared/EmptyState";
import { enrollFace } from "../api/client";
import { spacing, fonts, radius } from "../config/theme";
import { useTheme } from "../context/ThemeContext";
import { Person } from "../types";

interface PeopleScreenProps {
  people: Person[];
  loading: boolean;
  onRefresh: () => void;
}

export function PeopleScreen({ people, loading, onRefresh }: PeopleScreenProps) {
  const { colors } = useTheme();
  const [query, setQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [relation, setRelation] = useState("");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const filtered = query.trim()
    ? people.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))
    : people;

  async function pickPhoto() {
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) {
      setPhotoUri(result.assets[0].uri);
    }
  }

  async function handleAdd() {
    if (!name.trim()) { setError("Please enter a name."); return; }
    if (!relation.trim()) { setError("Please enter their relation."); return; }
    if (!photoUri) { setError("Please take a photo first."); return; }
    setError("");
    setUploading(true);
    try {
      await enrollFace(name.trim(), relation.trim(), photoUri);
      onRefresh();
      closeModal();
    } catch (e: any) {
      const msg = e?.message ?? "";
      if (msg.toLowerCase().includes("no face detected")) {
        setError("No face detected. Please retake with a clearer view of the face.");
      } else {
        setError("Could not connect to the glasses system. Make sure you're on the same network.");
      }
    } finally {
      setUploading(false);
    }
  }

  function closeModal() {
    setShowModal(false);
    setError("");
    setName("");
    setRelation("");
    setPhotoUri(null);
  }

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    content: { padding: spacing.xl, paddingBottom: 100 },
    searchWrap: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.md,
      marginBottom: spacing.lg,
      height: 44,
      shadowColor: "#7B5CE7",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 6,
      elevation: 1,
    },
    searchIcon: { marginRight: spacing.sm },
    searchInput: {
      flex: 1,
      fontSize: 15,
      color: colors.text,
      ...fonts.regular,
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
    modalTitle: { fontSize: 22, color: colors.text, ...fonts.medium, marginBottom: spacing.sm },
    photoBtn: { alignSelf: "stretch", marginBottom: spacing.sm },
    photoPlaceholder: {
      height: 80,
      backgroundColor: colors.violet50,
      borderWidth: 1.5,
      borderColor: colors.violet,
      borderStyle: "dashed",
      borderRadius: radius.md,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
    },
    photoPlaceholderText: { fontSize: 16, color: colors.violet, ...fonts.medium },
    photoTaken: {
      height: 80,
      backgroundColor: colors.violet50,
      borderWidth: 1.5,
      borderColor: colors.violet,
      borderRadius: radius.md,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
    },
    photoTakenText: { fontSize: 14, color: colors.violet, ...fonts.medium },
    fieldLabel: {
      fontSize: 10,
      color: colors.muted,
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
      borderRadius: radius.md,
      paddingHorizontal: spacing.lg,
      fontSize: 20,
      color: colors.text,
      ...fonts.regular,
    },
    error: { fontSize: 14, color: colors.violet, ...fonts.regular, marginTop: spacing.xs },
    modalBtns: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg },
    btnOutline: {
      flex: 1,
      height: 56,
      borderWidth: 1.5,
      borderColor: colors.violet,
      borderRadius: radius.pill,
      alignItems: "center",
      justifyContent: "center",
    },
    btnOutlineText: { fontSize: 17, color: colors.violet, ...fonts.medium },
    btnPrimary: {
      flex: 1,
      height: 56,
      backgroundColor: colors.violet,
      borderRadius: radius.pill,
      alignItems: "center",
      justifyContent: "center",
    },
    btnDisabled: { opacity: 0.6 },
    btnPrimaryText: { fontSize: 17, color: "#FFFFFF", ...fonts.medium },
  }), [colors]);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={colors.violet} />
        }
      >
        <SectionHeader
          label="Known People"
          action={{ label: "+ Add Person", onPress: () => setShowModal(true) }}
        />

        {/* Search */}
        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={16} color={colors.muted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search by name..."
            placeholderTextColor={colors.muted}
            clearButtonMode="while-editing"
          />
        </View>

        {filtered.length > 0 ? (
          filtered.map((person) => (
            <PersonCard
              key={person.id ?? person._id}
              person={person}
              onRefresh={onRefresh}
            />
          ))
        ) : query.trim() ? (
          <EmptyState
            title={`No results for "${query}"`}
            subtitle="Try a different name"
          />
        ) : (
          <EmptyState
            title="No contacts yet"
            subtitle="Tap '+ Add Person' to enroll someone for the glasses to recognize"
          />
        )}
      </ScrollView>

      {/* Add Person Modal */}
      <Modal visible={showModal} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Add a Person</Text>

            <TouchableOpacity style={styles.photoBtn} onPress={pickPhoto}>
              {photoUri ? (
                <View style={styles.photoTaken}>
                  <Ionicons name="checkmark-circle-outline" size={24} color={colors.violet} />
                  <Text style={styles.photoTakenText}>Photo taken — tap to retake</Text>
                </View>
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Ionicons name="camera-outline" size={24} color={colors.violet} />
                  <Text style={styles.photoPlaceholderText}>Take Photo</Text>
                </View>
              )}
            </TouchableOpacity>

            <Text style={styles.fieldLabel}>THEIR NAME</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Sarah"
              placeholderTextColor={colors.muted}
              autoCapitalize="words"
            />

            <Text style={styles.fieldLabel}>RELATION TO PATIENT</Text>
            <TextInput
              style={styles.input}
              value={relation}
              onChangeText={setRelation}
              placeholder="e.g. Daughter, Nurse, Neighbor"
              placeholderTextColor={colors.muted}
              autoCapitalize="words"
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.btnOutline} onPress={closeModal}>
                <Text style={styles.btnOutlineText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnPrimary, uploading && styles.btnDisabled]}
                onPress={handleAdd}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.btnPrimaryText}>Add</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
