import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
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
import { getMyLinkCode } from "../api/client";
import { fonts, spacing, radius, colors } from "../config/theme";
import { triggerOnboardingReset } from "../utils/reminderEvents";

const DRAWER_WIDTH = Dimensions.get("window").width * 0.78;

interface SideDrawerProps {
  visible: boolean;
  onClose: () => void;
}

export function SideDrawer({ visible, onClose }: SideDrawerProps) {
  const { user, logout } = useAuth();
  const { colors, toggleTheme, isDark } = useTheme();
  const navigation = useNavigation<any>();
  const { patients } = usePatients();
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [codeLoading, setCodeLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showPatientPicker, setShowPatientPicker] = useState(false);

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
    } else {
      Animated.timing(slideAnim, {
        toValue: -DRAWER_WIDTH,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

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
                      setShowPatientPicker(true);
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

            {/* Sign out */}
            <View style={styles.section}>
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

            {/* Patient picker modal for Visit Reports */}
            <Modal visible={showPatientPicker} transparent animationType="fade" onRequestClose={() => setShowPatientPicker(false)}>
              <TouchableOpacity style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", alignItems: "center" }} activeOpacity={1} onPress={() => setShowPatientPicker(false)}>
                <View style={{ backgroundColor: colors.bg, borderRadius: 16, padding: 24, width: "80%" }}>
                  <Text style={{ fontSize: 17, ...fonts.medium, color: colors.text, marginBottom: 16 }}>Which patient?</Text>
                  {patients.map(p => (
                    <TouchableOpacity
                      key={p.id}
                      style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}
                      onPress={() => {
                        setShowPatientPicker(false);
                        onClose();
                        navigation.navigate("VisitReports", { patientId: p.id, patientName: p.name });
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontSize: 15, ...fonts.regular, color: colors.text }}>{p.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </TouchableOpacity>
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
});
