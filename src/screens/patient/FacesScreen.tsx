import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Dimensions,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import { Person } from "../../types";
import { fetchPeople, enrollFace, deletePerson } from "../../api/client";
import { fonts, spacing, radius } from "../../config/theme";
import { useTheme } from "../../context/ThemeContext";

const CARD_GAP = 12;
const CARD_WIDTH = (Dimensions.get("window").width - spacing.xl * 2 - CARD_GAP) / 2;

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

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  useEffect(() => {
    if (!loading) {
      shimmerAnim.setValue(1);
      return;
    }
    const shimmer = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(shimmerAnim, { toValue: 0.3, duration: 900, useNativeDriver: true }),
      ])
    );
    shimmer.start();
    return () => shimmer.stop();
  }, [loading, shimmerAnim]);

  const [refreshing, setRefreshing] = useState(false);
  const [cacheAge, setCacheAge] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchPeople();
      setPeople(data);
      setOffline(false);
      setCacheAge(null);
    } catch {
      try {
        const raw = await AsyncStorage.getItem("@vela/api_cache:/api/people");
        if (raw) {
          const parsed = JSON.parse(raw) as Person[];
          setPeople(parsed);
          const ts = await AsyncStorage.getItem("@vela/api_cache_ts:/api/people");
          if (ts) {
            const mins = Math.round((Date.now() - parseInt(ts)) / 60000);
            setCacheAge(mins < 1 ? "just now" : mins < 60 ? `${mins}m ago` : `${Math.round(mins / 60)}h ago`);
          }
        }
      } catch {}
      setOffline(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  async function pickPhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Camera permission required", "Please allow camera access in your device settings to add face photos.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
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
      setName(""); setRelation(""); setPhotoUri(null); setShowModal(false);
    } catch (e: any) {
      const msg = e?.message ?? "";
      if (msg.toLowerCase().includes("no face detected")) {
        setError("No face detected. Please retake with a clearer view of the face.");
      } else {
        setError("Couldn't save this person. Please check your connection and try again.");
      }
    } finally {
      setUploading(false);
    }
  }

  function handleDelete(person: Person) {
    Alert.alert(
      "Remove person?",
      `"${person.name}" will be removed and the glasses will no longer recognize them.`,
      [
        { text: "Keep them", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await deletePerson(person.id ?? person._id);
              await load();
            } catch {
              Alert.alert("Error", "Could not remove. Check your connection.");
            }
          },
        },
      ]
    );
  }

  function closeModal() {
    setShowModal(false); setError(""); setName(""); setRelation(""); setPhotoUri(null);
  }

  const showFAB = !loading && (offline || people.length > 0);
  const showEmptyCTA = !loading && !offline && people.length === 0;

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    scrollContent: { padding: spacing.xl, paddingBottom: 120 },

    // ── Glasses status chip ──────────────────────────────────
    statusChip: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      gap: 8,
      backgroundColor: colors.violet50,
      borderWidth: 1,
      borderColor: colors.violet100,
      borderRadius: radius.pill,
      paddingVertical: 10,
      paddingHorizontal: 16,
      marginBottom: spacing.xl,
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    statusText: {
      fontSize: 13,
      color: colors.lavender,
      ...fonts.medium,
      letterSpacing: 0.3,
    },

    // ── Screen header ────────────────────────────────────────
    screenHeader: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.lg,
      paddingBottom: spacing.xl,
    },
    screenTitle: {
      fontSize: 32,
      color: colors.text,
      ...fonts.medium,
      lineHeight: 38,
    },
    screenSubtitle: {
      fontSize: 16,
      color: colors.muted,
      ...fonts.regular,
      marginTop: 6,
    },

    // ── Face grid ────────────────────────────────────────────
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: CARD_GAP,
    },
    faceCard: {
      width: CARD_WIDTH,
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      padding: spacing.lg,
      alignItems: "center",
      gap: spacing.xs,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: colors.violet,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 16,
      elevation: 4,
    },
    initialsRing: {
      width: 88,
      height: 88,
      borderRadius: 44,
      padding: 3,
      marginBottom: spacing.sm,
    },
    initialsInner: {
      flex: 1,
      borderRadius: 41,
      alignItems: "center",
      justifyContent: "center",
    },
    initialsText: {
      fontSize: 28,
      color: "#FFFFFF",
      ...fonts.medium,
    },
    faceName: {
      fontSize: 18,
      color: colors.text,
      ...fonts.medium,
      textAlign: "center",
    },
    faceRelation: {
      fontSize: 14,
      color: colors.lavender,
      ...fonts.regular,
      textAlign: "center",
    },
    faceHint: {
      fontSize: 11,
      color: colors.muted,
      ...fonts.regular,
      marginTop: spacing.xs,
    },

    // ── Skeleton ─────────────────────────────────────────────
    skeletonCard: {
      width: CARD_WIDTH,
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      padding: spacing.lg,
      alignItems: "center",
      gap: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    skeletonCircle: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: colors.violet100,
      marginBottom: spacing.sm,
    },
    skeletonLine: {
      height: 14,
      borderRadius: radius.pill,
      backgroundColor: colors.violet100,
    },

    // ── Empty / loading states ───────────────────────────────
    centered: {
      alignItems: "center",
      paddingTop: 60,
      gap: spacing.md,
    },
    emptyRing: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: colors.violet50,
      borderWidth: 1,
      borderColor: colors.violet100,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.sm,
    },
    emptyTitle: {
      fontSize: 22,
      color: colors.text,
      ...fonts.medium,
    },
    emptySub: {
      fontSize: 16,
      color: colors.muted,
      ...fonts.regular,
      textAlign: "center",
      lineHeight: 24,
    },
    addFirstBtn: {
      marginTop: spacing.md,
      backgroundColor: colors.violet,
      borderRadius: radius.pill,
      paddingHorizontal: 28,
      paddingVertical: 14,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    addFirstBtnText: {
      fontSize: 17,
      color: "#FFFFFF",
      ...fonts.medium,
    },

    // ── FAB ─────────────────────────────────────────────────
    fab: {
      position: "absolute",
      bottom: 32,
      right: 24,
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: colors.violet,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: colors.violet,
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.5,
      shadowRadius: 14,
      elevation: 10,
    },

    // ── Add modal ────────────────────────────────────────────
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "flex-end",
    },
    modalSheet: {
      backgroundColor: colors.bg,
      borderTopLeftRadius: radius.xxl,
      borderTopRightRadius: radius.xxl,
      padding: spacing.xxl,
      gap: spacing.sm,
      borderTopWidth: 1,
      borderColor: colors.border,
    },
    modalHandle: {
      width: 40, height: 4, borderRadius: radius.pill,
      backgroundColor: colors.border, alignSelf: "center", marginBottom: spacing.lg,
    },
    modalTitle: { fontSize: 22, color: colors.text, ...fonts.medium, marginBottom: spacing.sm },
    photoBtn: { alignSelf: "stretch", marginBottom: spacing.sm },
    photoPlaceholder: {
      height: 80, backgroundColor: colors.surface,
      borderWidth: 1.5, borderColor: colors.violet300, borderStyle: "dashed",
      borderRadius: radius.lg, flexDirection: "row",
      alignItems: "center", justifyContent: "center", gap: spacing.sm,
    },
    photoPlaceholderText: { fontSize: 15, color: colors.lavender, ...fonts.medium },
    photoTaken: {
      height: 80, backgroundColor: colors.sageSoft,
      borderWidth: 1.5, borderColor: colors.sage,
      borderRadius: radius.lg, flexDirection: "row",
      alignItems: "center", justifyContent: "center", gap: spacing.sm,
    },
    photoTakenText: { fontSize: 14, color: colors.sage, ...fonts.medium },
    fieldLabel: {
      fontSize: 11, color: colors.muted, ...fonts.medium,
      letterSpacing: 1.2, textTransform: "uppercase",
      marginTop: spacing.md, marginBottom: spacing.xs,
    },
    input: {
      height: 54, backgroundColor: colors.surface,
      borderRadius: radius.lg, paddingHorizontal: spacing.lg,
      fontSize: 16, color: colors.text, ...fonts.regular,
      borderWidth: 1, borderColor: colors.border,
    },
    error: { fontSize: 13, color: colors.coral, ...fonts.regular, marginTop: spacing.xs },
    modalBtns: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg },
    btnOutline: {
      flex: 1, height: 54, borderWidth: 1.5, borderColor: colors.border,
      borderRadius: radius.pill, alignItems: "center", justifyContent: "center",
    },
    btnOutlineText: { fontSize: 16, color: colors.subtext, ...fonts.medium },
    btnPrimary: {
      flex: 1, height: 54, backgroundColor: colors.violet,
      borderRadius: radius.pill, alignItems: "center", justifyContent: "center",
    },
    btnDisabled: { opacity: 0.6 },
    btnPrimaryText: { fontSize: 16, color: "#FFFFFF", ...fonts.medium },
  }), [colors]);

  return (
    <View style={styles.container}>
      {/* Screen header */}
      <View style={styles.screenHeader}>
        <Text style={styles.screenTitle}>People{"\n"}I Know</Text>
        <Text style={styles.screenSubtitle}>Your glasses will recognize these people</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.violet} />
        }
      >
        {/* Glasses status chip */}
        <View style={styles.statusChip}>
          <Animated.View
            style={[
              styles.statusDot,
              {
                backgroundColor: offline ? colors.amber : colors.sage,
                opacity: offline ? 1 : pulseAnim,
              },
            ]}
          />
          <Text style={styles.statusText}>
            {offline
              ? `Glasses not connected${cacheAge ? ` · last synced ${cacheAge}` : ""}`
              : "Glasses are active"}
          </Text>
        </View>

        {loading ? (
          <Animated.View style={[styles.grid, { opacity: shimmerAnim }]}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={styles.skeletonCard}>
                <View style={styles.skeletonCircle} />
                <View style={[styles.skeletonLine, { width: CARD_WIDTH * 0.55 }]} />
                <View style={[styles.skeletonLine, { width: CARD_WIDTH * 0.4 }]} />
              </View>
            ))}
          </Animated.View>
        ) : showEmptyCTA ? (
          <View style={styles.centered}>
            <View style={styles.emptyRing}>
              <Ionicons name="people" size={40} color={colors.lavender} />
            </View>
            <Text style={styles.emptyTitle}>No one added yet</Text>
            <Text style={styles.emptySub}>
              Add photos of people you know{"\n"}so the glasses can recognize them
            </Text>
            <TouchableOpacity style={styles.addFirstBtn} onPress={() => setShowModal(true)} activeOpacity={0.85}>
              <Ionicons name="add" size={20} color="#FFFFFF" />
              <Text style={styles.addFirstBtnText}>Add a person</Text>
            </TouchableOpacity>
          </View>
        ) : offline ? (
          <View style={styles.centered}>
            <View style={styles.emptyRing}>
              <Ionicons name="wifi" size={36} color={colors.muted} />
            </View>
            <Text style={styles.emptyTitle}>Not connected</Text>
            <Text style={styles.emptySub}>
              Make sure your phone is on the{"\n"}same network as the glasses system
            </Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {people.map((person, idx) => {
              const initials = person.name
                .split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
              const gradientSets: [string, string][] = [
                ["#7B5CE7", "#A695F5"],
                ["#5A40D0", "#7B5CE7"],
                ["#4A3AB8", "#6B5AE0"],
                ["#8B6ED0", "#C4B8FF"],
                ["#6B4FC8", "#9B8BFF"],
              ];
              const [g1, g2] = gradientSets[idx % gradientSets.length];
              return (
                <TouchableOpacity
                  key={person.id ?? person._id}
                  style={styles.faceCard}
                  onLongPress={() => handleDelete(person)}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={[g1, g2]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.initialsRing}
                  >
                    <View style={styles.initialsInner}>
                      <Text style={styles.initialsText}>{initials}</Text>
                    </View>
                  </LinearGradient>
                  <Text style={styles.faceName} numberOfLines={1}>{person.name}</Text>
                  <Text style={styles.faceRelation} numberOfLines={1}>{person.relation}</Text>
                  <Text style={styles.faceHint}>Hold to remove</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {showFAB && (
        <TouchableOpacity style={styles.fab} onPress={() => setShowModal(true)} activeOpacity={0.85}>
          <Ionicons name="add" size={30} color="#FFFFFF" />
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
            <Text style={styles.modalTitle}>Add a Person</Text>

            <TouchableOpacity style={styles.photoBtn} onPress={pickPhoto}>
              {photoUri ? (
                <View style={styles.photoTaken}>
                  <Ionicons name="checkmark-circle" size={24} color={colors.sage} />
                  <Text style={styles.photoTakenText}>Photo taken — tap to retake</Text>
                </View>
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Ionicons name="camera" size={24} color={colors.lavender} />
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
                {uploading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.btnPrimaryText}>Add</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
