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
} from "react-native";
import { PanGestureHandler, State } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../context/ThemeContext";
import { fonts, spacing, radius, gradients } from "../config/theme";
import { sendVisionMessage, saveConversationTurn, fetchConversations } from "../api/client";
import { ConversationTurn } from "../types";
import { triggerReminderReload, triggerTaskReload, triggerMedReload } from "../utils/reminderEvents";

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
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<ConversationTurn[]>([]);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const translateY = useRef(new Animated.Value(HALF_Y)).current;
  const baseY = useRef(HALF_Y);
  const isFullRef = useRef(false);

  // Track keyboard height manually (KeyboardAvoidingView doesn't work with absolute sheets)
  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates.height);
      // Auto-snap to full screen when keyboard opens
      if (!isFullRef.current) snapTo(FULL_Y);
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
    if (visible) {
      fetchConversations().then(setMessages).catch(() => {});
    }
  }, [visible]);

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
      id: String(Date.now()),
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
        id: String(Date.now() + 1),
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
        id: String(Date.now() + 1),
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
        </Animated.View>
      </View>
    </Modal>
  );
}
