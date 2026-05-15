import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  Keyboard,
  ActivityIndicator,
  Animated,
  Dimensions,
  Linking,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { PanGestureHandler, State } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { fonts, spacing, radius, gradients } from "../config/theme";
import { sendVisionMessage, saveConversationTurn, fetchConversations } from "../api/client";
import { ConversationTurn } from "../types";
import { triggerReminderReload, triggerTaskReload, triggerMedReload } from "../utils/reminderEvents";

const PRIVACY_POLICY_URL = "https://velavision.org/privacy/";
const AI_CONSENT_KEY_PREFIX = "@vela/ai_consent:";

const SCREEN_H = Dimensions.get("window").height;
const HALF_Y = SCREEN_H * 0.25;   // sheet shows bottom 75%
const FULL_Y = 0;                  // sheet fills screen
const DISMISS_Y = SCREEN_H;        // sheet off screen

const SUGGESTION_CHIPS = [
  "What's left today?",
  "Add a reminder",
  "How's the routine going?",
];

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function VisionSheet({ visible, onClose }: Props) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<ConversationTurn[]>([]);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [consented, setConsented] = useState<boolean | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const consentKey = user?.id ? `${AI_CONSENT_KEY_PREFIX}${user.id}` : null;

  useEffect(() => {
    if (!visible || !consentKey) return;
    let cancelled = false;
    AsyncStorage.getItem(consentKey)
      .then((val) => { if (!cancelled) setConsented(val === "true"); })
      .catch(() => { if (!cancelled) setConsented(false); });
    return () => { cancelled = true; };
  }, [visible, consentKey]);

  const grantConsent = async () => {
    if (!consentKey) return;
    try { await AsyncStorage.setItem(consentKey, "true"); } catch {}
    setConsented(true);
  };

  const translateY = useRef(new Animated.Value(HALF_Y)).current;
  const baseY = useRef(HALF_Y);
  const isFullRef = useRef(false);
  const snapToRef = useRef(snapTo);
  useEffect(() => { snapToRef.current = snapTo; }, [snapTo]);

  // Track keyboard height manually (KeyboardAvoidingView doesn't work with absolute sheets)
  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates.height);
      // Auto-snap to full screen when keyboard opens
      if (!isFullRef.current) snapToRef.current(FULL_Y);
      // Keep latest messages visible
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  function snapTo(toValue: number) {
    baseY.current = toValue;
    isFullRef.current = toValue === FULL_Y;
    setIsFullScreen(toValue === FULL_Y);
    Animated.spring(translateY, {
      toValue,
      useNativeDriver: true,
      bounciness: 0,
      speed: 20,
    }).start();
  }

  useEffect(() => {
    if (!visible) {
      translateY.setValue(HALF_Y);
      baseY.current = HALF_Y;
      isFullRef.current = false;
      setIsFullScreen(false);
    }
  }, [visible]);

  useEffect(() => {
    if (visible && consented === true) {
      fetchConversations().then(setMessages).catch(() => {});
    }
  }, [visible, consented]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  const handleSend = async (overrideText?: string) => {
    const text = (overrideText ?? inputText).trim();
    if (!text || sending) return;
    setInputText("");
    setSending(true);
    const userMsg: ConversationTurn = {
      id: Math.random().toString(36).slice(2) + Date.now().toString(36),
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    try {
      const { reply, reminderCreated, taskCreated, medicationCreated } = await sendVisionMessage(text);
      if (reminderCreated) triggerReminderReload();
      if (taskCreated) triggerTaskReload();
      if (medicationCreated) triggerMedReload();
      const assistantMsg: ConversationTurn = {
        id: Math.random().toString(36).slice(2) + Date.now().toString(36),
        role: "assistant",
        content: reply,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      await Promise.all([
        saveConversationTurn("user", text),
        saveConversationTurn("assistant", reply),
      ]);
    } catch {
      setMessages((prev) => [...prev, {
        id: Math.random().toString(36).slice(2) + Date.now().toString(36),
        role: "assistant",
        content: "Sorry, I couldn't connect right now. Please try again.",
        created_at: new Date().toISOString(),
      }]);
    } finally {
      setSending(false);
    }
  };

  const styles = useMemo(() => StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.4)",
    },
    sheet: {
      position: "absolute",
      left: 0,
      right: 0,
      top: 0,
      height: SCREEN_H,
      backgroundColor: colors.bg,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
    },
    handleZone: {
      width: "100%",
      alignItems: "center",
      paddingBottom: 14,
    },
    handle: {
      width: 40,
      height: 4,
      backgroundColor: colors.border,
      borderRadius: 2,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.md,
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
    avatar: {
      width: 36, height: 36, borderRadius: radius.pill,
      backgroundColor: colors.violet50, borderWidth: 1.5,
      borderColor: colors.violet300, alignItems: "center", justifyContent: "center",
    },
    titleText: { fontSize: 15, color: colors.text, ...fonts.medium },
    subtitleText: { fontSize: 11, color: colors.muted, ...fonts.regular },
    closeBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
    scrollContent: { padding: spacing.lg, gap: 12 },
    visionBubbleRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
    bubbleAvatar: {
      width: 26, height: 26, borderRadius: radius.pill,
      backgroundColor: colors.violet50, alignItems: "center",
      justifyContent: "center", marginTop: 2, flexShrink: 0,
    },
    visionBubble: {
      backgroundColor: colors.surface, borderRadius: 12,
      borderTopLeftRadius: 2, padding: spacing.md, maxWidth: "80%",
    },
    userBubble: {
      backgroundColor: colors.violet, borderRadius: 12,
      borderBottomRightRadius: 2, padding: spacing.md,
      maxWidth: "78%", alignSelf: "flex-end",
    },
    visionText: { fontSize: 13, color: colors.text, lineHeight: 20, ...fonts.regular },
    userText: { fontSize: 13, color: "#FFFFFF", lineHeight: 20, ...fonts.regular },
    inputWrap: {
      paddingBottom: isFullScreen
        ? keyboardHeight + insets.bottom + spacing.sm
        : HALF_Y + spacing.lg,
    },
    inputBar: {
      flexDirection: "row", alignItems: "center",
      marginHorizontal: spacing.lg, marginTop: spacing.sm,
      backgroundColor: colors.surface, borderRadius: radius.pill,
      paddingHorizontal: spacing.lg, paddingVertical: 10,
      borderWidth: 1.5, borderColor: colors.border, gap: 10,
    },
    input: { flex: 1, fontSize: 13, color: colors.text, ...fonts.regular },
    micBtn: {
      width: 34, height: 34, borderRadius: radius.pill,
      alignItems: "center", justifyContent: "center", overflow: "hidden",
    },
    chipsRow: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: spacing.xs,
    },
    chipsScroll: {
      gap: spacing.sm,
    },
    chip: {
      backgroundColor: colors.violet50,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderWidth: 1,
      borderColor: colors.violet300,
    },
    chipText: {
      fontSize: 12,
      color: colors.violet,
      ...fonts.medium,
    },
    consentScroll: {
      padding: spacing.xl,
      paddingBottom: spacing.xxxl,
      alignItems: "center",
    },
    consentIcon: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.violet50,
      alignItems: "center",
      justifyContent: "center",
      marginTop: spacing.md,
      marginBottom: spacing.md,
    },
    consentTitle: {
      fontSize: 20,
      color: colors.text,
      ...fonts.medium,
      marginBottom: spacing.sm,
      textAlign: "center",
    },
    consentBody: {
      fontSize: 14,
      lineHeight: 20,
      color: colors.muted,
      ...fonts.regular,
      textAlign: "center",
      marginBottom: spacing.xl,
      paddingHorizontal: spacing.md,
    },
    consentCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.lg,
      width: "100%",
      marginBottom: spacing.lg,
    },
    consentSectionLabel: {
      fontSize: 11,
      letterSpacing: 1.2,
      color: colors.muted,
      ...fonts.medium,
      marginBottom: spacing.sm,
    },
    consentItem: {
      fontSize: 13,
      lineHeight: 20,
      color: colors.text,
      ...fonts.regular,
      marginBottom: 4,
    },
    consentLink: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: spacing.xl,
    },
    consentLinkText: {
      fontSize: 13,
      color: colors.violet,
      ...fonts.medium,
      textDecorationLine: "underline",
    },
    consentButtons: {
      flexDirection: "row",
      gap: spacing.md,
      width: "100%",
    },
    consentBtn: {
      flex: 1,
      height: 50,
      borderRadius: radius.pill,
      alignItems: "center",
      justifyContent: "center",
    },
    consentBtnSecondary: {
      backgroundColor: colors.surface,
    },
    consentBtnSecondaryText: {
      fontSize: 15,
      color: colors.text,
      ...fonts.medium,
    },
    consentBtnPrimary: {
      flex: 1,
      height: 50,
      borderRadius: radius.pill,
      overflow: "hidden",
    },
    consentBtnGradient: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    consentBtnPrimaryText: {
      fontSize: 15,
      color: "#FFFFFF",
      ...fonts.medium,
    },
    consentLoading: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
  }), [colors, isFullScreen, keyboardHeight, insets.bottom]);

  // When full screen, pad the pill below the dynamic island
  const handleTopPad = isFullScreen ? insets.top + 14 : 14;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
          <PanGestureHandler
            onGestureEvent={({ nativeEvent }) => {
              const newY = baseY.current + nativeEvent.translationY;
              translateY.setValue(Math.max(FULL_Y, Math.min(DISMISS_Y, newY)));
            }}
            onHandlerStateChange={({ nativeEvent }) => {
              if (nativeEvent.state !== State.END) return;
              const dy = nativeEvent.translationY;
              if (isFullRef.current) {
                dy > 80 ? snapTo(HALF_Y) : snapTo(FULL_Y);
              } else {
                if (dy < -80) {
                  snapTo(FULL_Y);
                } else if (dy > 80) {
                  onClose();
                  translateY.setValue(HALF_Y);
                  baseY.current = HALF_Y;
                  isFullRef.current = false;
                  setIsFullScreen(false);
                } else {
                  snapTo(HALF_Y);
                }
              }
            }}
          >
            <View style={[styles.handleZone, { paddingTop: handleTopPad }]}>
              <View style={styles.handle} />
            </View>
          </PanGestureHandler>

          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.avatar}>
                <Ionicons name="sparkles" size={16} color={colors.violet} />
              </View>
              <View>
                <Text style={styles.titleText}>Vision</Text>
                <Text style={styles.subtitleText}>AI Assistant</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={20} color={colors.muted} />
            </TouchableOpacity>
          </View>

          {consented === false ? (
            <ScrollView contentContainerStyle={styles.consentScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.consentIcon}>
                <Ionicons name="sparkles" size={28} color={colors.violet} />
              </View>
              <Text style={styles.consentTitle}>Talk to Vision</Text>
              <Text style={styles.consentBody}>
                Vision uses an AI service to help with your routine, medications, and reminders.
              </Text>

              <View style={styles.consentCard}>
                <Text style={styles.consentSectionLabel}>WHAT IS SENT</Text>
                <Text style={styles.consentItem}>• The messages you type</Text>
                <Text style={styles.consentItem}>• Your routines, medications, and reminders</Text>
                <Text style={styles.consentItem}>• Recent conversation history with Vision</Text>

                <Text style={[styles.consentSectionLabel, { marginTop: spacing.md }]}>WHO RECEIVES IT</Text>
                <Text style={styles.consentItem}>
                  Groq, Inc. — an AI service provider in the United States. Your name and email are not shared with Groq.
                </Text>

                <Text style={[styles.consentSectionLabel, { marginTop: spacing.md }]}>HOW IT IS USED</Text>
                <Text style={styles.consentItem}>
                  Solely to generate Vision's reply. Data is not used to train Groq's models.
                </Text>
              </View>

              <TouchableOpacity
                style={styles.consentLink}
                onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
                activeOpacity={0.7}
              >
                <Ionicons name="open-outline" size={14} color={colors.violet} />
                <Text style={styles.consentLinkText}>Read our Privacy Policy</Text>
              </TouchableOpacity>

              <View style={styles.consentButtons}>
                <TouchableOpacity
                  style={[styles.consentBtn, styles.consentBtnSecondary]}
                  onPress={onClose}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Don't allow AI assistant"
                >
                  <Text style={styles.consentBtnSecondaryText}>Don't Allow</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.consentBtnPrimary}
                  onPress={grantConsent}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="Allow AI assistant"
                >
                  <LinearGradient
                    colors={[...gradients.primary]}
                    style={styles.consentBtnGradient}
                  >
                    <Text style={styles.consentBtnPrimaryText}>Allow</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </ScrollView>
          ) : consented === null ? (
            <View style={styles.consentLoading}>
              <ActivityIndicator color={colors.violet} />
            </View>
          ) : (
            <>
              <ScrollView ref={scrollRef} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {messages.length === 0 && !sending && (
                  <View style={styles.visionBubbleRow}>
                    <View style={styles.bubbleAvatar}>
                      <Ionicons name="sparkles" size={12} color={colors.violet} />
                    </View>
                    <View style={styles.visionBubble}>
                      <Text style={styles.visionText}>Hello! I can help you with your routine, medications, and reminders. What would you like to know?</Text>
                    </View>
                  </View>
                )}
                {messages.map((msg) =>
                  msg.role === "assistant" ? (
                    <View key={msg.id} style={styles.visionBubbleRow}>
                      <View style={styles.bubbleAvatar}>
                        <Ionicons name="sparkles" size={12} color={colors.violet} />
                      </View>
                      <View style={styles.visionBubble}>
                        <Text style={styles.visionText}>{msg.content}</Text>
                      </View>
                    </View>
                  ) : (
                    <View key={msg.id} style={styles.userBubble}>
                      <Text style={styles.userText}>{msg.content}</Text>
                    </View>
                  )
                )}
                {sending && (
                  <View style={styles.visionBubbleRow}>
                    <View style={styles.bubbleAvatar}>
                      <Ionicons name="sparkles" size={12} color={colors.violet} />
                    </View>
                    <View style={styles.visionBubble}>
                      <ActivityIndicator size="small" color={colors.violet} />
                    </View>
                  </View>
                )}
              </ScrollView>

              <View style={styles.inputWrap}>
                {messages.length === 0 && !sending && (
                  <View style={styles.chipsRow}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
                      {SUGGESTION_CHIPS.map((chip) => (
                        <TouchableOpacity
                          key={chip}
                          style={styles.chip}
                          activeOpacity={0.7}
                          onPress={() => handleSend(chip)}
                        >
                          <Text style={styles.chipText}>{chip}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}

                <View style={styles.inputBar}>
                  <TextInput
                    style={styles.input}
                    value={inputText}
                    onChangeText={setInputText}
                    placeholder="Ask Vision anything..."
                    placeholderTextColor={colors.muted}
                    onSubmitEditing={() => handleSend()}
                    returnKeyType="send"
                    editable={!sending}
                  />
                  <TouchableOpacity onPress={() => handleSend()} activeOpacity={0.8} style={styles.micBtn} disabled={sending}>
                    <LinearGradient
                      colors={[...gradients.primary]}
                      style={{ width: 34, height: 34, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" }}
                    >
                      <Ionicons name="send" size={14} color="#FFFFFF" />
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}
