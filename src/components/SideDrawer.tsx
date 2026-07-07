import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { usePatients } from "../hooks/usePatients";
import { useConsent } from "../hooks/useConsent";
import { getMyLinkCode, deleteAccount, unlinkPatient } from "../api/client";
import { fonts, spacing, radius, colors } from "../config/theme";
import { triggerOnboardingReset } from "../utils/reminderEvents";
import { isAppleCalendarSyncEnabled, setAppleCalendarSyncEnabled } from "../services/appleCalendarPrefs";
import { requestAppleCalendarPermission } from "../services/appleCalendarSync";

const PRIVACY_POLICY_URL = "https://velavision.org/privacy/";

const DRAWER_WIDTH = Dimensions.get("window").width * 0.78;

interface SideDrawerProps {
  visible: boolean;
  onClose: () => void;
}

export function SideDrawer({ visible, onClose }: SideDrawerProps) {
  const { user, logout, updateUser } = useAuth();
  const { colors, toggleTheme, isDark } = useTheme();
  const navigation = useNavigation<any>();
  const { patients } = usePatients();
  const { consent, setCategory, error: consentError } = useConsent();
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [codeLoading, setCodeLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [patientPickerTarget, setPatientPickerTarget] = useState<"VisitReports" | "Calendar" | null>(null);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showUnlinkModal, setShowUnlinkModal] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [unlinkError, setUnlinkError] = useState<string | null>(null);
  const [appleSyncEnabled, setAppleSyncEnabled] = useState(false);
  const [appleSyncMessage, setAppleSyncMessage] = useState<string | null>(null);

  const linkedPatientName = patients[0]?.name ?? "your patient";

  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 0,
        speed: 20,
      }).start();

      if (user?.role === "patient" && !linkCode) {
        setCodeLoading(true);
        getMyLinkCode()
          .then((res) => setLinkCode(res.link_code))
          .catch(() => {})
          .finally(() => setCodeLoading(false));
      }

      isAppleCalendarSyncEnabled()
        .then(setAppleSyncEnabled)
        .catch(() => {});
    } else {
      Animated.timing(slideAnim, {
        toValue: -DRAWER_WIDTH,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const handleToggleAppleSync = async (value: boolean) => {
    setAppleSyncMessage(null);
    if (value) {
      const granted = await requestAppleCalendarPermission();
      if (granted) {
        await setAppleCalendarSyncEnabled(true);
        setAppleSyncEnabled(true);
      } else {
        setAppleSyncMessage(
          "Calendar access was denied. You can enable it in iPhone Settings > Vela Vision > Calendars."
        );
        setAppleSyncEnabled(false);
      }
    } else {
      await setAppleCalendarSyncEnabled(false);
      setAppleSyncEnabled(false);
    }
  };

  const initials = user?.name
    ?.split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() ?? "?";

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>

        <Animated.View
          style={[styles.drawer, { backgroundColor: colors.bg, transform: [{ translateX: slideAnim }] }]}
        >
          {/* Header */}
          <View style={[styles.drawerHeader, { borderBottomColor: colors.border }]}>
            <View style={[styles.avatarCircle, { backgroundColor: colors.violet50 }]}>
              <Text style={[styles.avatarText, { color: colors.violet }]}>{initials}</Text>
            </View>
            <View style={styles.userInfo}>
              <Text style={[styles.userName, { color: colors.text }]}>{user?.name}</Text>
              <Text style={[styles.userEmail, { color: colors.muted }]}>{user?.email}</Text>
            </View>
          </View>

          <ScrollView style={[styles.drawerBody, { backgroundColor: colors.bg }]}>
            {/* Link code (patient only) */}
            {user?.role === "patient" && (
              <View style={[styles.section, { borderBottomColor: colors.border }]}>
                <Text style={[styles.sectionLabel, { color: colors.text }]}>
                  Caregiver Link Code
                </Text>
                {codeLoading ? (
                  <ActivityIndicator color={colors.violet} style={{ marginTop: 8 }} />
                ) : linkCode ? (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={async () => {
                      await Clipboard.setStringAsync(linkCode);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                  >
                    <Text style={[styles.linkCode, { color: colors.violet }]}>{linkCode}</Text>
                  </TouchableOpacity>
                ) : null}
                <Text style={[styles.codeHint, { color: colors.muted }]}>
                  {copied ? "Copied to clipboard!" : "Tap code to copy · Share with your caregiver"}
                </Text>
              </View>
            )}

            {/* Dark mode */}
            <View style={[styles.section, { borderBottomColor: colors.border }]}>
              <View style={styles.row}>
                <View style={styles.rowLeft}>
                  <Ionicons name="moon-outline" size={20} color={colors.violet} />
                  <Text style={[styles.rowLabel, { color: colors.text }]}>Dark Mode</Text>
                </View>
                <Switch
                  value={isDark}
                  onValueChange={toggleTheme}
                  trackColor={{ false: colors.border, true: colors.violet }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>

            {/* Apple Calendar sync */}
            <View style={[styles.section, { borderBottomColor: colors.border }]}>
              <View style={styles.row}>
                <View style={styles.rowLeft}>
                  <Ionicons name="calendar-outline" size={20} color={colors.violet} />
                  <Text style={[styles.rowLabel, { color: colors.text }]}>Sync to Apple Calendar</Text>
                </View>
                <Switch
                  value={appleSyncEnabled}
                  onValueChange={(v) => { handleToggleAppleSync(v).catch(() => {}); }}
                  trackColor={{ false: colors.border, true: colors.violet }}
                  thumbColor="#FFFFFF"
                  accessibilityLabel="Sync to Apple Calendar"
                />
              </View>
              {appleSyncMessage && (
                <Text style={[styles.codeHint, { color: colors.muted, marginTop: spacing.sm }]}>
                  {appleSyncMessage}
                </Text>
              )}
            </View>

            {/* Linked patient (caregiver only) */}
            {user?.role === "caregiver" && user?.patient_id && (
              <View style={[styles.section, { borderBottomColor: colors.border }]}>
                <Text style={[styles.sectionLabel, { color: colors.text }]}>Linked Patient</Text>
                <View style={styles.row}>
                  <View style={styles.rowLeft}>
                    <Ionicons name="person-circle-outline" size={20} color={colors.violet} />
                    <Text style={[styles.rowLabel, { color: colors.text }]}>{linkedPatientName}</Text>
                  </View>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel="Unlink patient"
                    onPress={() => { setUnlinkError(null); setShowUnlinkModal(true); }}
                  >
                    <Text style={[styles.unlinkText, { color: "#D95F5F" }]}>Unlink</Text>
                  </TouchableOpacity>
                </View>
                <Text style={[styles.codeHint, { color: colors.muted, marginTop: spacing.sm }]}>
                  Unlink to connect a different patient using their link code.
                </Text>
              </View>
            )}

            {/* Visit Reports (caregiver only) */}
            {user?.role === "caregiver" && (
              <View style={[styles.section, { borderBottomColor: colors.border }]}>
                <TouchableOpacity
                  style={styles.row}
                  activeOpacity={0.7}
                  onPress={() => {
                    if (patients.length === 1) {
                      onClose();
                      navigation.navigate("VisitReports", { patientId: patients[0].id, patientName: patients[0].name });
                    } else {
                      setPatientPickerTarget("VisitReports");
                    }
                  }}
                >
                  <View style={styles.rowLeft}>
                    <Ionicons name="document-text-outline" size={20} color={colors.violet} />
                    <Text style={[styles.rowLabel, { color: colors.text }]}>Visit Reports</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                </TouchableOpacity>
              </View>
            )}

            {/* Calendar (caregiver: pick a patient; patient: own calendar) */}
            <View style={[styles.section, { borderBottomColor: colors.border }]}>
              <TouchableOpacity
                style={styles.row}
                activeOpacity={0.7}
                onPress={() => {
                  if (user?.role === "patient") {
                    onClose();
                    navigation.navigate("Calendar");
                    return;
                  }
                  if (patients.length === 1) {
                    onClose();
                    navigation.navigate("Calendar", { patientId: patients[0].id, patientName: patients[0].name });
                  } else {
                    setPatientPickerTarget("Calendar");
                  }
                }}
              >
                <View style={styles.rowLeft}>
                  <Ionicons name="calendar-outline" size={20} color={colors.violet} />
                  <Text style={[styles.rowLabel, { color: colors.text }]}>Calendar</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.muted} />
              </TouchableOpacity>
            </View>

            {/* Subscription (caregiver only) */}
            {user?.role === "caregiver" && (
              <View style={[styles.section, { borderBottomColor: colors.border }]}>
                <TouchableOpacity
                  style={styles.row}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Manage subscription"
                  onPress={() => { onClose(); navigation.navigate("Paywall"); }}
                >
                  <View style={styles.rowLeft}>
                    <Ionicons name="star-outline" size={20} color={colors.violet} />
                    <Text style={[styles.rowLabel, { color: colors.text }]}>Subscription</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                </TouchableOpacity>
              </View>
            )}

            {/* Replay tour */}
            <View style={[styles.section, { borderBottomColor: colors.border }]}>
              <TouchableOpacity
                style={styles.row}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Show app tour again"
                onPress={() => { onClose(); triggerOnboardingReset(); }}
              >
                <View style={styles.rowLeft}>
                  <Ionicons name="play-circle-outline" size={20} color={colors.violet} />
                  <Text style={[styles.rowLabel, { color: colors.text }]}>Show tour again</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.muted} />
              </TouchableOpacity>
            </View>

            {/* Privacy Policy */}
            <View style={[styles.section, { borderBottomColor: colors.border }]}>
              <TouchableOpacity
                style={styles.row}
                activeOpacity={0.7}
                accessibilityRole="link"
                accessibilityLabel="Open privacy policy"
                onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
              >
                <View style={styles.rowLeft}>
                  <Ionicons name="shield-checkmark-outline" size={20} color={colors.violet} />
                  <Text style={[styles.rowLabel, { color: colors.text }]}>Privacy Policy</Text>
                </View>
                <Ionicons name="open-outline" size={16} color={colors.muted} />
              </TouchableOpacity>
            </View>

            {/* Privacy & Sharing (patient or linked caregiver) */}
            {user?.patient_id && (
              <View style={[styles.section, { borderBottomColor: colors.border }]}>
                <TouchableOpacity
                  style={styles.row}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Privacy and sharing settings"
                  onPress={() => setShowPrivacy(true)}
                >
                  <View style={styles.rowLeft}>
                    <Ionicons name="lock-closed-outline" size={20} color={colors.violet} />
                    <Text style={[styles.rowLabel, { color: colors.text }]}>Privacy & Sharing</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                </TouchableOpacity>
              </View>
            )}

            {/* Sign out */}
            <View style={[styles.section, { borderBottomColor: colors.border }]}>
              <TouchableOpacity
                style={[styles.signOutBtn, { backgroundColor: "rgba(123,92,231,0.08)" }]}
                onPress={() => { onClose(); logout(); }}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Sign out"
              >
                <Ionicons name="log-out-outline" size={18} color={colors.violet} />
                <Text style={[styles.signOutText, { color: colors.violet }]}>Sign out</Text>
              </TouchableOpacity>
            </View>

            {/* Delete account */}
            <View style={styles.section}>
              <TouchableOpacity
                style={styles.deleteRow}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Delete account"
                onPress={() => {
                  setDeleteConfirmText("");
                  setDeleteError(null);
                  setShowDeleteModal(true);
                }}
              >
                <Ionicons name="trash-outline" size={18} color="#D95F5F" />
                <Text style={styles.deleteText}>Delete account</Text>
              </TouchableOpacity>
            </View>

            {/* Delete account confirmation */}
            <Modal
              visible={showDeleteModal}
              transparent
              animationType="fade"
              onRequestClose={() => !deleting && setShowDeleteModal(false)}
            >
              <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", alignItems: "center", padding: 24 }}>
                <View style={{ backgroundColor: colors.bg, borderRadius: 20, padding: 24, width: "100%", maxWidth: 400 }}>
                  <View style={{ alignItems: "center", marginBottom: spacing.lg }}>
                    <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: "rgba(217,95,95,0.12)", alignItems: "center", justifyContent: "center", marginBottom: spacing.md }}>
                      <Ionicons name="warning-outline" size={26} color="#D95F5F" />
                    </View>
                    <Text style={{ fontSize: 18, ...fonts.medium, color: colors.text, textAlign: "center" }}>
                      Delete your account?
                    </Text>
                  </View>

                  <Text style={{ fontSize: 14, lineHeight: 20, ...fonts.regular, color: colors.muted, marginBottom: spacing.md }}>
                    This permanently removes your Vela Vision account and all your data:
                  </Text>
                  <View style={{ marginBottom: spacing.lg, gap: 6 }}>
                    {[
                      "Your profile, routines, medications, and reminders",
                      "All conversations with Vision and stored memories",
                      "Face photos, alerts, and notes from your care team",
                      user?.role === "patient"
                        ? "Linked caregivers will be notified and lose access"
                        : "Your access to all linked patients",
                    ].map((line) => (
                      <View key={line} style={{ flexDirection: "row", gap: 8 }}>
                        <Text style={{ color: "#D95F5F", fontSize: 14 }}></Text>
                        <Text style={{ fontSize: 13, lineHeight: 19, ...fonts.regular, color: colors.text, flex: 1 }}>{line}</Text>
                      </View>
                    ))}
                  </View>

                  <Text style={{ fontSize: 13, ...fonts.regular, color: colors.muted, marginBottom: spacing.sm }}>
                    This cannot be undone. Type <Text style={{ ...fonts.medium, color: colors.text }}>DELETE</Text> to confirm.
                  </Text>
                  <TextInput
                    value={deleteConfirmText}
                    onChangeText={(t) => { setDeleteConfirmText(t); setDeleteError(null); }}
                    placeholder="DELETE"
                    placeholderTextColor={colors.muted}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    editable={!deleting}
                    style={{
                      borderWidth: 1.5,
                      borderColor: colors.border,
                      borderRadius: radius.md,
                      paddingHorizontal: spacing.md,
                      paddingVertical: 12,
                      fontSize: 15,
                      color: colors.text,
                      ...fonts.medium,
                      marginBottom: spacing.lg,
                    }}
                  />

                  {deleteError && (
                    <Text style={{ fontSize: 13, color: "#D95F5F", marginBottom: spacing.md, textAlign: "center" }}>
                      {deleteError}
                    </Text>
                  )}

                  <View style={{ flexDirection: "row", gap: spacing.md }}>
                    <TouchableOpacity
                      style={{
                        flex: 1,
                        height: 48,
                        borderRadius: radius.pill,
                        backgroundColor: colors.surface,
                        alignItems: "center",
                        justifyContent: "center",
                        opacity: deleting ? 0.5 : 1,
                      }}
                      onPress={() => setShowDeleteModal(false)}
                      disabled={deleting}
                      activeOpacity={0.8}
                    >
                      <Text style={{ fontSize: 15, ...fonts.medium, color: colors.text }}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{
                        flex: 1,
                        height: 48,
                        borderRadius: radius.pill,
                        backgroundColor: deleteConfirmText === "DELETE" ? "#D95F5F" : "rgba(217,95,95,0.4)",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                      onPress={async () => {
                        if (deleteConfirmText !== "DELETE" || deleting) return;
                        setDeleting(true);
                        setDeleteError(null);
                        try {
                          await deleteAccount();
                          setShowDeleteModal(false);
                          onClose();
                          await logout();
                        } catch (err: any) {
                          setDeleteError(err?.message || "Could not delete account. Please try again.");
                          setDeleting(false);
                        }
                      }}
                      disabled={deleteConfirmText !== "DELETE" || deleting}
                      activeOpacity={0.85}
                    >
                      {deleting ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <Text style={{ fontSize: 15, ...fonts.medium, color: "#FFFFFF" }}>Delete</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>

            {/* Unlink patient confirmation */}
            <Modal
              visible={showUnlinkModal}
              transparent
              animationType="fade"
              onRequestClose={() => !unlinking && setShowUnlinkModal(false)}
            >
              <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", alignItems: "center", padding: 24 }}>
                <View style={{ backgroundColor: colors.bg, borderRadius: 20, padding: 24, width: "100%", maxWidth: 400 }}>
                  <View style={{ alignItems: "center", marginBottom: spacing.lg }}>
                    <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: "rgba(217,95,95,0.12)", alignItems: "center", justifyContent: "center", marginBottom: spacing.md }}>
                      <Ionicons name="unlink-outline" size={24} color="#D95F5F" />
                    </View>
                    <Text style={{ fontSize: 18, ...fonts.medium, color: colors.text, textAlign: "center" }}>
                      Unlink {linkedPatientName}?
                    </Text>
                  </View>

                  <Text style={{ fontSize: 14, lineHeight: 20, ...fonts.regular, color: colors.muted, marginBottom: spacing.lg, textAlign: "center" }}>
                    You'll stop seeing their routines, medications, and alerts. Nothing is deleted — you can reconnect anytime with their link code.
                  </Text>

                  {unlinkError && (
                    <Text style={{ fontSize: 13, color: "#D95F5F", marginBottom: spacing.md, textAlign: "center" }}>
                      {unlinkError}
                    </Text>
                  )}

                  <View style={{ flexDirection: "row", gap: spacing.md }}>
                    <TouchableOpacity
                      style={{ flex: 1, height: 48, borderRadius: radius.pill, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", opacity: unlinking ? 0.5 : 1 }}
                      onPress={() => setShowUnlinkModal(false)}
                      disabled={unlinking}
                      activeOpacity={0.8}
                    >
                      <Text style={{ fontSize: 15, ...fonts.medium, color: colors.text }}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{ flex: 1, height: 48, borderRadius: radius.pill, backgroundColor: "#D95F5F", alignItems: "center", justifyContent: "center", opacity: unlinking ? 0.7 : 1 }}
                      onPress={async () => {
                        if (unlinking) return;
                        setUnlinking(true);
                        setUnlinkError(null);
                        try {
                          await unlinkPatient();
                          if (user) updateUser({ ...user, patient_id: null });
                          setShowUnlinkModal(false);
                          onClose();
                        } catch (err: any) {
                          setUnlinkError(err?.message || "Could not unlink. Please try again.");
                        } finally {
                          setUnlinking(false);
                        }
                      }}
                      disabled={unlinking}
                      activeOpacity={0.85}
                    >
                      {unlinking ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <Text style={{ fontSize: 15, ...fonts.medium, color: "#FFFFFF" }}>Unlink</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>

            {/* Patient picker modal for Visit Reports / Calendar */}
            <Modal visible={patientPickerTarget !== null} transparent animationType="fade" onRequestClose={() => setPatientPickerTarget(null)}>
              <TouchableOpacity style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", alignItems: "center" }} activeOpacity={1} onPress={() => setPatientPickerTarget(null)}>
                <View style={{ backgroundColor: colors.bg, borderRadius: 16, padding: 24, width: "80%" }}>
                  <Text style={{ fontSize: 17, ...fonts.medium, color: colors.text, marginBottom: 16 }}>Which patient?</Text>
                  {patients.map(p => (
                    <TouchableOpacity
                      key={p.id}
                      style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}
                      onPress={() => {
                        const target = patientPickerTarget;
                        setPatientPickerTarget(null);
                        onClose();
                        if (target) navigation.navigate(target, { patientId: p.id, patientName: p.name });
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontSize: 15, ...fonts.regular, color: colors.text }}>{p.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </TouchableOpacity>
            </Modal>

            {/* Privacy & Sharing modal */}
            <Modal visible={showPrivacy} transparent animationType="fade" onRequestClose={() => setShowPrivacy(false)}>
              <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", alignItems: "center", padding: 24 }}>
                <View style={{ backgroundColor: colors.bg, borderRadius: 20, padding: 24, width: "100%", maxWidth: 420 }}>
                  <Text style={{ fontSize: 20, ...fonts.medium, color: colors.text, marginBottom: spacing.sm }}>Privacy & Sharing</Text>
                  <Text style={{ fontSize: 14, lineHeight: 20, ...fonts.regular, color: colors.muted, marginBottom: spacing.lg }}>
                    Choose what's shared with the care team. Everything is off until you turn it on — nothing is collected silently.
                  </Text>

                  {([
                    { key: "healthMetrics", label: "Health metrics", sub: "Steps, heart rate, sleep & activity from Apple Health", value: !!consent?.healthMetrics },
                    { key: "activityPatterns", label: "Activity & typing patterns", sub: "Movement and typing rhythm, used to notice changes over time", value: !!consent?.activityPatterns },
                    { key: "aiAssistant", label: "AI assistant & memory", sub: "Lets Vision answer questions and remember context — sends notes to an AI service", value: !!consent?.aiAssistant },
                  ] as const).map((row) => (
                    <View key={row.key} style={{ flexDirection: "row", alignItems: "center", paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.border }}>
                      <View style={{ flex: 1, paddingRight: spacing.md }}>
                        <Text style={{ fontSize: 15, ...fonts.medium, color: colors.text }}>{row.label}</Text>
                        <Text style={{ fontSize: 12, ...fonts.regular, color: colors.muted, marginTop: 2, lineHeight: 17 }}>{row.sub}</Text>
                      </View>
                      <Switch
                        value={row.value}
                        onValueChange={(v) => { setCategory(row.key, v).catch(() => {}); }}
                        trackColor={{ false: colors.border, true: colors.violet }}
                        thumbColor="#FFFFFF"
                        accessibilityLabel={`Share ${row.label} with the care team`}
                      />
                    </View>
                  ))}

                  {consentError ? (
                    <Text style={{ fontSize: 12, color: "#D95F5F", marginTop: spacing.md }}>{consentError}</Text>
                  ) : consent?.updatedAt ? (
                    <Text style={{ fontSize: 12, ...fonts.regular, color: colors.muted, marginTop: spacing.md }}>
                      Last changed by {consent.updatedByRole === "patient" ? "the patient" : "a caregiver"} on {new Date(consent.updatedAt).toLocaleDateString()}
                    </Text>
                  ) : null}

                  <TouchableOpacity
                    style={{ marginTop: spacing.xl, height: 48, borderRadius: radius.pill, backgroundColor: colors.violet, alignItems: "center", justifyContent: "center" }}
                    onPress={() => setShowPrivacy(false)}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel="Done"
                  >
                    <Text style={{ fontSize: 15, ...fonts.medium, color: "#FFFFFF" }}>Done</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: "row",
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  drawer: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    borderTopRightRadius: 24,
    borderBottomRightRadius: 24,
    overflow: "hidden",
    shadowColor: colors.violet,
    shadowOffset: { width: 6, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 16,
  },
  drawerHeader: {
    paddingTop: 64,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 20,
    ...fonts.medium,
  },
  userInfo: { flex: 1 },
  userName: {
    fontSize: 18,
    ...fonts.medium,
  },
  userEmail: {
    fontSize: 13,
    ...fonts.regular,
    marginTop: 2,
  },
  drawerBody: {
    flex: 1,
  },
  section: {
    padding: spacing.xl,
    borderBottomWidth: 1,
  },
  sectionLabel: {
    fontSize: 13,
    ...fonts.medium,
    marginBottom: spacing.sm,
  },
  linkCode: {
    fontSize: 26,
    ...fonts.medium,
    letterSpacing: 8,
    marginBottom: spacing.xs,
  },
  codeHint: {
    fontSize: 12,
    ...fonts.regular,
    lineHeight: 18,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  rowLabel: {
    fontSize: 16,
    ...fonts.regular,
  },
  signOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    height: 52,
    borderRadius: radius.pill,
  },
  signOutText: {
    fontSize: 16,
    ...fonts.medium,
  },
  deleteRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  deleteText: {
    fontSize: 14,
    color: "#D95F5F",
    ...fonts.medium,
  },
  unlinkText: {
    fontSize: 15,
    ...fonts.medium,
  },
});
