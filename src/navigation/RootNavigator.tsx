import React, { useMemo, useEffect, useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ScrollView,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useNetwork } from "../context/NetworkContext";
import { setOnNetworkChange } from "../api/client";
import { LoginScreen } from "../screens/LoginScreen";
import { CaregiverTabNavigator } from "./CaregiverTabNavigator";
import { PatientTabNavigator } from "./PatientTabNavigator";
import { HelpHistoryScreen } from "../screens/caregiver/HelpHistoryScreen";
import CheckInScreen from "../screens/caregiver/CheckInScreen";
import CheckInTextScreen from "../screens/caregiver/CheckInTextScreen";
import VisitsScreen from "../screens/caregiver/VisitsScreen";
import ScheduleVisitScreen from "../screens/caregiver/ScheduleVisitScreen";
import { OfflineBanner } from "../components/OfflineBanner";
import { SideDrawer } from "../components/SideDrawer";
import { VisionSheet } from "../components/VisionSheet";
import { useHelpAlert } from "../hooks/useHelpAlert";
import { ResolveSheet, HelpCause } from "../components/ResolveSheet";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { OnboardingScreen } from "../screens/OnboardingScreen";
import { fonts, spacing, gradients, radius } from "../config/theme";
import { formatRelativeTime } from "../hooks/useDashboardData";

const CaregiverStack = createNativeStackNavigator();

const SCREEN_W = Dimensions.get("window").width;
const SCREEN_H = Dimensions.get("window").height;
const PANEL_W = SCREEN_W * 0.85;

export function RootNavigator() {
  const { user, loading } = useAuth();
  const { colors } = useTheme();
  const { setOffline } = useNetwork();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [visionOpen, setVisionOpen] = useState(false);
  const contentOpacity = useRef(new Animated.Value(0)).current;

  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) {
      setOnboardingDone(null);
      return;
    }
    AsyncStorage.getItem(`@vela/onboarding_complete:${user.id}`).then(
      (val) => setOnboardingDone(val === "true")
    );
  }, [user]);

  const completeOnboarding = useCallback(() => {
    setOnboardingDone(true);
  }, []);

  useEffect(() => {
    setOnNetworkChange(setOffline);
  }, [setOffline]);

  useEffect(() => {
    if (!loading) {
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }).start();
    }
  }, [loading]);

  const styles = useMemo(() => StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    splash: {
      flex: 1, backgroundColor: colors.bg,
      alignItems: "center", justifyContent: "center", gap: 16,
    },
    splashLogo: { width: 72, height: 72 },
    splashText: { fontSize: 20, color: colors.violet, ...fonts.medium, letterSpacing: 0.3 },
    visionFab: {
      position: "absolute", bottom: 108, right: 24,
      width: 56, height: 56, borderRadius: 28,
      shadowColor: colors.violet, shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.45, shadowRadius: 14, elevation: 12, overflow: "hidden",
    },
    visionFabGradient: {
      width: 56, height: 56, borderRadius: 28,
      alignItems: "center", justifyContent: "center",
    },
  }), [colors]);

  if (loading) {
    return (
      <View style={styles.splash}>
        <Image source={require("../../assets/icon.png")} style={styles.splashLogo} resizeMode="contain" />
        <Text style={styles.splashText}>Vela Vision</Text>
      </View>
    );
  }

  if (!user) return <LoginScreen />;

  if (onboardingDone === null) {
    return (
      <View style={styles.splash}>
        <Image source={require("../../assets/icon.png")} style={styles.splashLogo} resizeMode="contain" />
        <Text style={styles.splashText}>Vela Vision</Text>
      </View>
    );
  }

  if (!onboardingDone) {
    return <OnboardingScreen onComplete={completeOnboarding} />;
  }

  if (user.role === "caregiver") {
    return (
      <Animated.View style={[styles.root, { opacity: contentOpacity }]}>
        <CaregiverView
          user={user}
          drawerOpen={drawerOpen}
          onOpenDrawer={() => setDrawerOpen(true)}
          onCloseDrawer={() => setDrawerOpen(false)}
        />
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.root, { opacity: contentOpacity }]}>
      <Header onOpenDrawer={() => setDrawerOpen(true)} user={user} />
      <OfflineBanner />
      <PatientTabNavigator patientName={user.name} />
      <SideDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <VisionSheet visible={visionOpen} onClose={() => setVisionOpen(false)} />
      <TouchableOpacity onPress={() => setVisionOpen(true)} style={styles.visionFab} activeOpacity={0.85}>
        <LinearGradient colors={[...gradients.primary]} style={styles.visionFabGradient}>
          <Ionicons name="sparkles" size={22} color="#FFFFFF" />
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Caregiver root wrapper (owns help alert state) ──────────────────────────

function CaregiverView({
  user, drawerOpen, onOpenDrawer, onCloseDrawer,
}: {
  user: import("../types").AppUser;
  drawerOpen: boolean;
  onOpenDrawer: () => void;
  onCloseDrawer: () => void;
}) {
  const { colors } = useTheme();
  const { alerts: helpAlerts, pendingCount, dismissAlert: dismissHelp, resolveAlert } = useHelpAlert();

  const [visionOpen, setVisionOpen] = useState(false);

  // Notifications slide panel
  const [notifOpen, setNotifOpen] = useState(false);
  const notifX = useRef(new Animated.Value(SCREEN_W)).current;

  const openNotif = useCallback(() => {
    setNotifOpen(true);
    Animated.spring(notifX, { toValue: 0, useNativeDriver: true, bounciness: 0, speed: 20 }).start();
  }, [notifX]);

  const closeNotif = useCallback(() => {
    Animated.spring(notifX, { toValue: SCREEN_W, useNativeDriver: true, bounciness: 0, speed: 20 }).start(() => setNotifOpen(false));
  }, [notifX]);

  // Urgent alert overlay
  const [urgentVisible, setUrgentVisible] = useState(false);
  const [resolveSheetVisible, setResolveSheetVisible] = useState(false);
  const prevCountRef = useRef<number | null>(null);
  const pulse1 = useRef(new Animated.Value(0)).current;
  const pulse2 = useRef(new Animated.Value(0)).current;
  const pulse3 = useRef(new Animated.Value(0)).current;
  const urgentFadeIn = useRef(new Animated.Value(0)).current;

  // Show urgent overlay when pending count increases
  useEffect(() => {
    const isFirst = prevCountRef.current === null;
    const prev = prevCountRef.current ?? 0;
    prevCountRef.current = pendingCount;

    if (pendingCount > 0 && (isFirst || pendingCount > prev)) {
      setUrgentVisible(true);
    }
    if (pendingCount === 0) {
      setUrgentVisible(false);
    }
  }, [pendingCount]);

  // Pulse animation + haptic when overlay appears
  useEffect(() => {
    if (!urgentVisible) {
      pulse1.stopAnimation();
      pulse2.stopAnimation();
      pulse3.stopAnimation();
      urgentFadeIn.setValue(0);
      return;
    }

    // Haptic burst
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 400);
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 800);

    // Fade in overlay
    Animated.timing(urgentFadeIn, { toValue: 1, duration: 300, useNativeDriver: true }).start();

    // Staggered pulsing rings
    const startRing = (anim: Animated.Value, delay: number) => {
      anim.setValue(0);
      setTimeout(() => {
        Animated.loop(
          Animated.timing(anim, { toValue: 1, duration: 2200, useNativeDriver: true })
        ).start();
      }, delay);
    };

    startRing(pulse1, 0);
    startRing(pulse2, 733);
    startRing(pulse3, 1466);
  }, [urgentVisible]);

  const pendingHelp = helpAlerts.filter((a) => !a.dismissed);
  const latestAlert = pendingHelp[0];

  const handleRespondingNow = useCallback(() => setUrgentVisible(false), []);

  // Ring interpolations
  const makeRing = (anim: Animated.Value) => ({
    scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 3.2] }),
    opacity: anim.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.55, 0] }),
  });
  const ring1 = makeRing(pulse1);
  const ring2 = makeRing(pulse2);
  const ring3 = makeRing(pulse3);

  const styles = useMemo(() => StyleSheet.create({
    root: { flex: 1 },

    // Notifications panel overlay
    notifBackdrop: {
      position: "absolute", top: 0, bottom: 0, left: 0, right: 0,
      backgroundColor: "rgba(0,0,0,0.35)", zIndex: 50,
    },
    notifPanel: {
      position: "absolute", top: 0, bottom: 0, right: 0,
      width: PANEL_W, backgroundColor: colors.bg, zIndex: 60,
      shadowColor: "#000", shadowOffset: { width: -3, height: 0 },
      shadowOpacity: 0.15, shadowRadius: 20, elevation: 20,
    },
    panelHeader: {
      paddingTop: 60, paddingHorizontal: spacing.xl, paddingBottom: spacing.md,
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    panelTitle: { fontSize: 24, color: colors.text, ...fonts.medium },
    closeBtn: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
    panelContent: { padding: spacing.xl, gap: spacing.md, paddingBottom: 60 },
    notifSectionLabel: {
      fontSize: 11, ...fonts.medium, letterSpacing: 1.2,
      textTransform: "uppercase", color: colors.coral, marginBottom: spacing.sm,
    },
    helpCard: {
      backgroundColor: colors.bg, borderRadius: radius.xl, padding: spacing.xl,
      borderLeftWidth: 4, borderLeftColor: colors.coral,
      shadowColor: colors.coral, shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.12, shadowRadius: 12, elevation: 3,
    },
    helpTop: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.md },
    helpIconCircle: {
      width: 44, height: 44, borderRadius: 22,
      backgroundColor: colors.coralSoft, alignItems: "center", justifyContent: "center",
    },
    helpInfo: { flex: 1 },
    helpTitle: { fontSize: 15, color: colors.text, ...fonts.medium },
    helpTime: { fontSize: 12, color: colors.muted, ...fonts.regular, marginTop: 2 },
    helpDismissBtn: {
      backgroundColor: colors.coral, borderRadius: radius.pill,
      paddingHorizontal: spacing.xl, paddingVertical: 10, alignItems: "center",
    },
    helpDismissText: { fontSize: 13, color: "#FFFFFF", ...fonts.medium },
    emptyWrap: { alignItems: "center", paddingVertical: spacing.xxxl, gap: spacing.md },
    emptyText: { fontSize: 15, color: colors.muted, ...fonts.regular },

    // ── Urgent alert overlay ────────────────────────────────────────────────
    urgentOverlay: {
      position: "absolute", top: 0, bottom: 0, left: 0, right: 0, zIndex: 999,
    },
    urgentGradient: { flex: 1, alignItems: "center", justifyContent: "center" },
    urgentTop: {
      flex: 1, alignItems: "center", justifyContent: "center", width: "100%",
    },
    ringContainer: {
      width: 120, height: 120,
      alignItems: "center", justifyContent: "center",
    },
    ringAbsolute: {
      position: "absolute",
      width: 120, height: 120,
      borderRadius: 60,
      borderWidth: 2,
      borderColor: "rgba(255,255,255,0.6)",
    },
    urgentIconCircle: {
      width: 120, height: 120, borderRadius: 60,
      backgroundColor: "rgba(255,255,255,0.18)",
      borderWidth: 2.5, borderColor: "rgba(255,255,255,0.9)",
      alignItems: "center", justifyContent: "center",
    },
    urgentLabel: {
      fontSize: 11, color: "rgba(255,255,255,0.7)", ...fonts.medium,
      letterSpacing: 4, textTransform: "uppercase", marginTop: 36,
    },
    urgentTitle: {
      fontSize: 38, color: "#FFFFFF", ...fonts.medium,
      letterSpacing: -0.5, marginTop: 8, textAlign: "center",
      paddingHorizontal: spacing.xl,
    },
    urgentSubtitle: {
      fontSize: 15, color: "rgba(255,255,255,0.75)", ...fonts.regular,
      textAlign: "center", marginTop: 10, paddingHorizontal: spacing.xxxl,
      lineHeight: 22,
    },
    urgentTimeWrap: {
      flexDirection: "row", alignItems: "center", gap: 6,
      backgroundColor: "rgba(0,0,0,0.2)", borderRadius: radius.pill,
      paddingHorizontal: spacing.lg, paddingVertical: 7, marginTop: 20,
    },
    urgentTime: { fontSize: 13, color: "rgba(255,255,255,0.85)", ...fonts.medium },
    urgentBottom: {
      width: "100%", paddingHorizontal: spacing.xl,
      paddingBottom: 52, gap: spacing.md,
    },
    urgentCountWrap: {
      alignItems: "center", marginBottom: spacing.md,
    },
    urgentCount: {
      fontSize: 13, color: "rgba(255,255,255,0.65)", ...fonts.regular, letterSpacing: 0.3,
    },
    btnHandled: {
      backgroundColor: "#FFFFFF", borderRadius: radius.pill,
      paddingVertical: 17, alignItems: "center",
      shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25, shadowRadius: 12, elevation: 8,
    },
    btnHandledText: { fontSize: 16, color: "#C0392B", ...fonts.medium },
    btnResponding: {
      backgroundColor: "rgba(255,255,255,0.15)",
      borderRadius: radius.pill, borderWidth: 1.5,
      borderColor: "rgba(255,255,255,0.4)",
      paddingVertical: 16, alignItems: "center",
    },
    btnRespondingText: { fontSize: 16, color: "#FFFFFF", ...fonts.medium },
  }), [colors]);

  return (
    <View style={styles.root}>
      <Header onOpenDrawer={onOpenDrawer} user={user} notifCount={pendingCount} onOpenNotif={openNotif} />
      <OfflineBanner />
      <CaregiverStack.Navigator screenOptions={{ headerShown: false }}>
        <CaregiverStack.Screen name="CaregiverTabs">
          {() => <CaregiverTabNavigator helpPendingCount={pendingCount} />}
        </CaregiverStack.Screen>
        <CaregiverStack.Screen name="HelpHistory" component={HelpHistoryScreen} />
        <CaregiverStack.Screen name="CheckIn" component={CheckInScreen} options={{ headerShown: true, title: "Check In" }} />
        <CaregiverStack.Screen name="CheckInText" component={CheckInTextScreen} options={{ headerShown: true, title: "Text Check-In" }} />
        <CaregiverStack.Screen name="Visits" component={VisitsScreen} options={{ headerShown: true, title: "Visits" }} />
        <CaregiverStack.Screen name="ScheduleVisit" component={ScheduleVisitScreen} options={{ headerShown: true, title: "Schedule Visit" }} />
      </CaregiverStack.Navigator>
      <SideDrawer visible={drawerOpen} onClose={onCloseDrawer} />
      <VisionSheet visible={visionOpen} onClose={() => setVisionOpen(false)} />
      <TouchableOpacity
        onPress={() => setVisionOpen(true)}
        style={{
          position: "absolute", bottom: 108, right: 24,
          width: 56, height: 56, borderRadius: 28,
          shadowColor: colors.violet, shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.45, shadowRadius: 14, elevation: 12, overflow: "hidden",
        }}
        activeOpacity={0.85}
      >
        <LinearGradient colors={[...gradients.primary]} style={{
          width: 56, height: 56, borderRadius: 28,
          alignItems: "center", justifyContent: "center",
        }}>
          <Ionicons name="sparkles" size={22} color="#FFFFFF" />
        </LinearGradient>
      </TouchableOpacity>

      {/* Notifications panel */}
      {notifOpen && (
        <>
          <TouchableOpacity style={styles.notifBackdrop} activeOpacity={1} onPress={closeNotif} />
          <Animated.View style={[styles.notifPanel, { transform: [{ translateX: notifX }] }]}>
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>Notifications</Text>
              <TouchableOpacity style={styles.closeBtn} onPress={closeNotif} activeOpacity={0.7}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.panelContent} showsVerticalScrollIndicator={false}>
              <Text style={styles.notifSectionLabel}>Help Requests</Text>
              {pendingHelp.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <Ionicons name="checkmark-circle" size={40} color={colors.border} />
                  <Text style={styles.emptyText}>No pending help requests</Text>
                </View>
              ) : (
                pendingHelp.map((alert) => (
                  <View key={alert.id} style={styles.helpCard}>
                    <View style={styles.helpTop}>
                      <View style={styles.helpIconCircle}>
                        <Ionicons name="hand-left" size={20} color={colors.coral} />
                      </View>
                      <View style={styles.helpInfo}>
                        <Text style={styles.helpTitle}>Patient needs help</Text>
                        <Text style={styles.helpTime}>{formatRelativeTime(alert.timestamp)}</Text>
                      </View>
                    </View>
                    <TouchableOpacity style={styles.helpDismissBtn} onPress={() => dismissHelp(alert.id)} activeOpacity={0.85}>
                      <Text style={styles.helpDismissText}>Mark as handled</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>
          </Animated.View>
        </>
      )}

      {/* ── URGENT ALERT OVERLAY ─────────────────────────────────────────── */}
      {urgentVisible && (
        <Animated.View style={[styles.urgentOverlay, { opacity: urgentFadeIn }]}>
          <LinearGradient
            colors={["#7B0000", "#C0392B", "#E74C3C"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.3, y: 1 }}
            style={styles.urgentGradient}
          >
            {/* Top — icon + rings + text */}
            <View style={styles.urgentTop}>
              {/* Pulsing rings */}
              <View style={styles.ringContainer}>
                <Animated.View style={[styles.ringAbsolute, { transform: [{ scale: ring1.scale }], opacity: ring1.opacity }]} />
                <Animated.View style={[styles.ringAbsolute, { transform: [{ scale: ring2.scale }], opacity: ring2.opacity }]} />
                <Animated.View style={[styles.ringAbsolute, { transform: [{ scale: ring3.scale }], opacity: ring3.opacity }]} />
                <View style={styles.urgentIconCircle}>
                  <Ionicons name="hand-left" size={52} color="#FFFFFF" />
                </View>
              </View>

              <Text style={styles.urgentLabel}>Urgent</Text>
              <Text style={styles.urgentTitle}>Help Requested</Text>
              <Text style={styles.urgentSubtitle}>
                Your patient needs immediate assistance. Please respond now.
              </Text>

              {latestAlert && (
                <View style={styles.urgentTimeWrap}>
                  <Ionicons name="time-outline" size={14} color="rgba(255,255,255,0.85)" />
                  <Text style={styles.urgentTime}>{formatRelativeTime(latestAlert.timestamp)}</Text>
                </View>
              )}
            </View>

            {/* Bottom — actions */}
            <View style={styles.urgentBottom}>
              {pendingHelp.length > 1 && (
                <View style={styles.urgentCountWrap}>
                  <Text style={styles.urgentCount}>
                    {pendingHelp.length} pending request{pendingHelp.length !== 1 ? "s" : ""}
                  </Text>
                </View>
              )}
              <TouchableOpacity style={styles.btnHandled} onPress={() => setResolveSheetVisible(true)} activeOpacity={0.85}>
                <Text style={styles.btnHandledText}>Mark as Handled</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnResponding} onPress={handleRespondingNow} activeOpacity={0.85}>
                <Text style={styles.btnRespondingText}>I'm Responding Now</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </Animated.View>
      )}
      <ResolveSheet
        visible={resolveSheetVisible}
        onResolve={async (cause: HelpCause, note: string) => {
          if (latestAlert) {
            try { await resolveAlert(latestAlert.id, cause, note || undefined); } catch { /* ignore */ }
          }
          setResolveSheetVisible(false);
          setUrgentVisible(false);
        }}
        onSkip={async () => {
          if (latestAlert) {
            try { await dismissHelp(latestAlert.id); } catch { /* ignore */ }
          }
          setResolveSheetVisible(false);
          setUrgentVisible(false);
        }}
        onCancel={() => setResolveSheetVisible(false)}
      />
    </View>
  );
}

// ─── Header ──────────────────────────────────────────────────────────────────

function Header({
  onOpenDrawer, user, notifCount, onOpenNotif,
}: {
  onOpenDrawer: () => void;
  user: import("../types").AppUser | null;
  notifCount?: number;
  onOpenNotif?: () => void;
}) {
  const { colors, isDark } = useTheme();
  const [clock, setClock] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const timeStr = clock.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const dateStr = clock.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });

  return (
    <View style={[headerStyles.wrap, { backgroundColor: colors.bg }]}>
      <View style={[headerStyles.bar, { shadowColor: colors.border }]}>
        <TouchableOpacity style={headerStyles.logo} onPress={onOpenDrawer} activeOpacity={0.8}>
          <Image source={require("../../assets/icon.png")} style={headerStyles.logoIcon} resizeMode="contain" />
          <Text style={[headerStyles.logoText, { color: colors.text }]}>Vela Vision</Text>
        </TouchableOpacity>

        <View style={headerStyles.rightRow}>
          {onOpenNotif && (
            <TouchableOpacity onPress={onOpenNotif} activeOpacity={0.7} style={headerStyles.bellBtn}>
              <Ionicons name="notifications-outline" size={24} color={colors.text} />
              {notifCount != null && notifCount > 0 && (
                <View style={[headerStyles.badge, { backgroundColor: colors.coral }]}>
                  <Text style={headerStyles.badgeText}>{notifCount > 9 ? "9+" : notifCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={onOpenDrawer} activeOpacity={0.7} style={headerStyles.menuBtn}>
            <Ionicons name="menu-outline" size={26} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <LinearGradient
        colors={isDark ? [...gradients.dark] : [...gradients.primary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={headerStyles.timeBanner}
      >
        <Text style={headerStyles.timeText}>{timeStr}</Text>
        <Text style={headerStyles.dateText}>{dateStr}</Text>
      </LinearGradient>
    </View>
  );
}

const headerStyles = StyleSheet.create({
  wrap: { zIndex: 10 },
  bar: {
    paddingTop: 54, paddingHorizontal: spacing.xl, paddingBottom: spacing.md,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  logo: { flexDirection: "row", alignItems: "center", gap: 8 },
  logoIcon: { width: 28, height: 28 },
  logoText: { fontSize: 17, ...fonts.medium, letterSpacing: 0.2 },
  rightRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  bellBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  badge: {
    position: "absolute", top: 2, right: 2,
    minWidth: 16, height: 16, borderRadius: 8,
    alignItems: "center", justifyContent: "center", paddingHorizontal: 3,
  },
  badgeText: { fontSize: 9, color: "#FFFFFF", ...fonts.medium },
  menuBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  timeBanner: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
  },
  timeText: { fontSize: 22, color: "#FFFFFF", ...fonts.medium },
  dateText: { fontSize: 14, color: "rgba(255,255,255,0.85)", ...fonts.regular },
});
