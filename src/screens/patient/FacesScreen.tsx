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
      await deletePerson(person.name);
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

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    content: { padding: spacing.xl, paddingBottom: 120 },

    /* Empty CTA */
    emptyCTA: {
      alignItems: "center",
      paddingTop: 60,
      gap: spacing.md,
    },
    bigAddBtn: {
      width: 100,
      height: 100,
      borderRadius: 50,
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
      fontSize: 24,
      color: colors.text,
      ...fonts.display,
    },
    emptyCTASubtitle: {
      fontSize: 15,
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
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      padding: spacing.lg,
      alignItems: "center",
      gap: spacing.xs,
    },
    faceInitials: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.violet,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.xs,
    },
    faceInitialsText: { fontSize: 28, color: "#FAF8F4", ...fonts.medium },
    faceName: { fontSize: 16, color: colors.text, ...fonts.medium, textAlign: "center" },
    faceRelation: { fontSize: 13, color: colors.lavender, ...fonts.regular, textAlign: "center" },
    faceHint: { fontSize: 11, color: colors.muted, ...fonts.regular },

    /* Modal */
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
    modalTitle: { fontSize: 26, color: colors.text, ...fonts.display, marginBottom: spacing.sm },
    photoBtn: { alignSelf: "stretch", marginBottom: spacing.sm },
    photoPlaceholder: {
      height: 80,
      backgroundColor: colors.violet50,
      borderWidth: 1.5,
      borderColor: colors.violet100,
      borderStyle: "dashed",
      borderRadius: radius.sm,
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
      borderRadius: radius.sm,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
    },
    photoTakenText: { fontSize: 14, color: colors.violet, ...fonts.medium },
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
    error: { fontSize: 14, color: colors.violet, ...fonts.regular, marginTop: spacing.xs },
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
    btnDisabled: { opacity: 0.6 },
    btnPrimaryText: { fontSize: 17, color: "#F5F0E8", ...fonts.medium },
  }), [colors]);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <SectionHeader label="People I Know" />

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
              <Ionicons name="add" size={40} color="#FAF8F4" />
            </TouchableOpacity>
            <Text style={styles.emptyCTATitle}>Add a Face</Text>
            <Text style={styles.emptyCTASubtitle}>
              Add photos of people you know so{"\n"}the glasses can recognize them
            </Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {people.map((person) => {
              const initials = person.name
                .split(" ")
                .map((w) => w[0])
                .join("")
                .slice(0, 2)
                .toUpperCase();
              return (
                <TouchableOpacity
                  key={person.id ?? person._id}
                  style={styles.faceCard}
                  onLongPress={() => handleDelete(person)}
                  activeOpacity={0.85}
                >
                  <View style={styles.faceInitials}>
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
          <Ionicons name="add" size={28} color="#FAF8F4" />
        </TouchableOpacity>
      )}

      {/* Add Face Modal */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
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
                  <ActivityIndicator color="#FAF8F4" />
                ) : (
                  <Text style={styles.btnPrimaryText}>Add</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
