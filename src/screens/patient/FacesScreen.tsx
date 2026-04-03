import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { Person } from "../../types";
import { fetchPeople, enrollFace, deletePerson } from "../../api/client";
import { SectionHeader } from "../../components/shared/SectionHeader";
import { EmptyState } from "../../components/shared/EmptyState";
import { fonts, spacing, radius } from "../../config/theme";
import { useTheme } from "../../context/ThemeContext";

export function FacesScreen() {
  const { colors } = useTheme();
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [relation, setRelation] = useState("");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await fetchPeople();
      setPeople(data);
      setOffline(false);
    } catch {
      setOffline(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
    if (!relation.trim()) { setError("Please enter their relation (e.g. Son, Nurse)."); return; }
    if (!photoUri) { setError("Please take a photo first."); return; }
    setError("");
    setUploading(true);
    try {
      await enrollFace(name.trim(), relation.trim(), photoUri);
      await load();
      setName("");
      setRelation("");
      setPhotoUri(null);
      setShowModal(false);
    } catch (e: any) {
      const msg = e?.message ?? "";
      if (msg.toLowerCase().includes("no face detected")) {
        setError("No face detected in the photo. Please retake with a clearer view of the face.");
      } else {
        setError("Could not connect to the glasses system. Make sure you're on the same network.");
      }
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(person: Person) {
    try {
      await deletePerson(person.id ?? person._id);
      await load();
    } catch {}
  }

  function closeModal() {
    setShowModal(false);
    setError("");
    setName("");
    setRelation("");
    setPhotoUri(null);
  }

  const showFAB = !loading && (offline || people.length > 0);
  const showEmptyCTA = !loading && !offline && people.length === 0;

  // Colors for avatar backgrounds — cycles through a palette
  const avatarColors = ["#7B5CE7", "#5A40D0", "#A695F5", "#8B6ED0", "#6B4FC8"];

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    content: { padding: spacing.xl, paddingBottom: 120 },

    // Screen header
    screenHeader: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.lg,
      paddingBottom: spacing.xl,
    },
    screenTitle: {
      fontSize: 28,
      color: colors.text,
      ...fonts.medium,
    },
    screenSubtitle: {
      fontSize: 14,
      color: colors.muted,
      ...fonts.regular,
      marginTop: 4,
    },

    /* Empty CTA */
    emptyCTA: {
      alignItems: "center",
      paddingTop: 60,
      gap: spacing.md,
    },
    bigAddBtn: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: colors.violet,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: colors.violet,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.35,
      shadowRadius: 16,
      elevation: 8,
      marginBottom: spacing.sm,
    },
    emptyCTATitle: {
      fontSize: 22,
      color: colors.text,
      ...fonts.medium,
    },
    emptyCTASubtitle: {
      fontSize: 14,
      color: colors.muted,
      ...fonts.regular,
      textAlign: "center",
      lineHeight: 22,
    },

    /* Floating Action Button */
    fab: {
      position: "absolute",
      bottom: 32,
      right: 24,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.violet,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: colors.violet,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 12,
      elevation: 8,
    },

    /* Face grid */
    grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
    faceCard: {
      width: "47%",
      backgroundColor: colors.bg,
      borderRadius: radius.xl,
      padding: spacing.lg,
      alignItems: "center",
      gap: spacing.xs,
      shadowColor: "#7B5CE7",
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 3,
    },
    faceInitials: {
      width: 72,
      height: 72,
      borderRadius: 36,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.sm,
    },
    faceInitialsText: { fontSize: 26, color: "#FFFFFF", ...fonts.medium },
    faceName: { fontSize: 15, color: colors.text, ...fonts.medium, textAlign: "center" },
    faceRelation: { fontSize: 12, color: colors.violet, ...fonts.regular, textAlign: "center" },
    faceHint: { fontSize: 11, color: colors.muted, ...fonts.regular, marginTop: spacing.xs },

    /* Modal */
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(30,27,58,0.45)",
      justifyContent: "flex-end",
    },
    modalSheet: {
      backgroundColor: colors.bg,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      padding: spacing.xxl,
      gap: spacing.sm,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.1,
      shadowRadius: 20,
      elevation: 20,
    },
    modalHandle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      alignSelf: "center",
      marginBottom: spacing.lg,
    },
    modalTitle: { fontSize: 22, color: colors.text, ...fonts.medium, marginBottom: spacing.sm },
    photoBtn: { alignSelf: "stretch", marginBottom: spacing.sm },
    photoPlaceholder: {
      height: 80,
      backgroundColor: colors.violet50,
      borderWidth: 1.5,
      borderColor: colors.violet,
      borderStyle: "dashed",
      borderRadius: radius.lg,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
    },
    photoPlaceholderText: { fontSize: 15, color: colors.violet, ...fonts.medium },
    photoTaken: {
      height: 80,
      backgroundColor: colors.violet50,
      borderWidth: 1.5,
      borderColor: colors.violet,
      borderRadius: radius.lg,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
    },
    photoTakenText: { fontSize: 14, color: colors.violet, ...fonts.medium },
    fieldLabel: {
      fontSize: 11,
      color: colors.muted,
      ...fonts.medium,
      letterSpacing: 1.2,
      textTransform: "uppercase",
      marginTop: spacing.md,
      marginBottom: spacing.xs,
    },
    input: {
      height: 54,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.lg,
      fontSize: 16,
      color: colors.text,
      ...fonts.regular,
    },
    error: { fontSize: 13, color: "#E05050", ...fonts.regular, marginTop: spacing.xs },
    modalBtns: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg },
    btnOutline: {
      flex: 1,
      height: 54,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: radius.pill,
      alignItems: "center",
      justifyContent: "center",
    },
    btnOutlineText: { fontSize: 16, color: colors.text, ...fonts.medium },
    btnPrimary: {
      flex: 1,
      height: 54,
      backgroundColor: colors.violet,
      borderRadius: radius.pill,
      alignItems: "center",
      justifyContent: "center",
    },
    btnDisabled: { opacity: 0.6 },
    btnPrimaryText: { fontSize: 16, color: "#FFFFFF", ...fonts.medium },
  }), [colors]);

  return (
    <View style={styles.container}>
      {/* Screen Header */}
      <View style={styles.screenHeader}>
        <Text style={styles.screenTitle}>Known Faces</Text>
        <Text style={styles.screenSubtitle}>People the glasses will recognize</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>

        {loading ? (
          <ActivityIndicator color={colors.violet} style={{ marginTop: 40 }} />
        ) : offline ? (
          <EmptyState
            title="Not connected"
            subtitle="Make sure your phone is on the same network as the glasses system, then pull down to refresh."
          />
        ) : showEmptyCTA ? (
          /* Big centered CTA when no faces yet */
          <View style={styles.emptyCTA}>
            <TouchableOpacity
              style={styles.bigAddBtn}
              onPress={() => setShowModal(true)}
              activeOpacity={0.85}
            >
              <Ionicons name="add" size={40} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.emptyCTATitle}>Add a Face</Text>
            <Text style={styles.emptyCTASubtitle}>
              Add photos of people you know so{"\n"}the glasses can recognize them
            </Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {people.map((person, idx) => {
              const initials = person.name
                .split(" ")
                .map((w) => w[0])
                .join("")
                .slice(0, 2)
                .toUpperCase();
              const bgColor = avatarColors[idx % avatarColors.length];
              return (
                <TouchableOpacity
                  key={person.id ?? person._id}
                  style={styles.faceCard}
                  onLongPress={() => handleDelete(person)}
                  activeOpacity={0.85}
                >
                  <View style={[styles.faceInitials, { backgroundColor: bgColor }]}>
                    <Text style={styles.faceInitialsText}>{initials}</Text>
                  </View>
                  <Text style={styles.faceName}>{person.name}</Text>
                  <Text style={styles.faceRelation}>{person.relation}</Text>
                  <Text style={styles.faceHint}>Hold to remove</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Floating Add Button — shown when faces exist or offline */}
      {showFAB && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setShowModal(true)}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </TouchableOpacity>
      )}

      {/* Add Face Modal */}
      <Modal visible={showModal} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Add a Face</Text>

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

            <Text style={styles.fieldLabel}>RELATION TO YOU</Text>
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
