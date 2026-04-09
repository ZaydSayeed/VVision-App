import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
  Dimensions,
} from "react-native";
import { PanGestureHandler, State } from "react-native-gesture-handler";

const SCREEN_H = Dimensions.get("window").height;
const HALF_H = SCREEN_H * 0.75;
const FULL_H = SCREEN_H;
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../context/ThemeContext";
import { fonts, spacing, radius, gradients } from "../config/theme";
import { sendVisionMessage, saveConversationTurn, fetchConversations } from "../api/client";
import { ConversationTurn } from "../types";
import { triggerReminderReload } from "../utils/reminderEvents";

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function VisionSheet({ visible, onClose }: Props) {
  const { colors } = useTheme();
  const [messages, setMessages] = useState<ConversationTurn[]>([]);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const sheetHeight = useRef(new Animated.Value(HALF_H)).current;

  function animateTo(toValue: number, cb?: () => void) {
    Animated.spring(sheetHeight, {
      toValue,
      useNativeDriver: false,
      bounciness: 0,
      speed: 16,
    }).start(cb);
  }

  useEffect(() => {
    if (!visible) {
      sheetHeight.setValue(HALF_H);
      setIsFullScreen(false);
    }
  }, [visible]);

  useEffect(() => {
    if (visible) {
      fetchConversations()
        .then(setMessages)
        .catch(() => {});
    }
  }, [visible]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  const handleSend = async () => {
    const text = inputText.trim();
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
      const { reply, reminderCreated } = await sendVisionMessage(text);
      if (reminderCreated) triggerReminderReload();
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
      const errMsg: ConversationTurn = {
        id: String(Date.now() + 1),
        role: "assistant",
        content: "Sorry, I couldn't connect right now. Please try again.",
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setSending(false);
    }
  };

  const styles = useMemo(() => StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: "rgba(0,0,0,0.4)",
    },
    sheet: {
      backgroundColor: colors.bg,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingBottom: 24,
    },
    handleZone: {
      width: "100%",
      paddingVertical: 14,
      alignItems: "center",
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
    headerLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: radius.pill,
      backgroundColor: colors.violet50,
      borderWidth: 1.5,
      borderColor: colors.violet300,
      alignItems: "center",
      justifyContent: "center",
    },
    titleText: {
      fontSize: 15,
      color: colors.text,
      ...fonts.medium,
    },
    subtitleText: {
      fontSize: 11,
      color: colors.muted,
      ...fonts.regular,
    },
    closeBtn: {
      width: 32,
      height: 32,
      alignItems: "center",
      justifyContent: "center",
    },
    scrollContent: {
      padding: spacing.lg,
      gap: 12,
    },
    visionBubbleRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
    },
    bubbleAvatar: {
      width: 26,
      height: 26,
      borderRadius: radius.pill,
      backgroundColor: colors.violet50,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 2,
      flexShrink: 0,
    },
    visionBubble: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderTopLeftRadius: 2,
      padding: spacing.md,
      maxWidth: "80%",
    },
    userBubble: {
      backgroundColor: colors.violet,
      borderRadius: 12,
      borderBottomRightRadius: 2,
      padding: spacing.md,
      maxWidth: "78%",
      alignSelf: "flex-end",
    },
    visionText: {
      fontSize: 13,
      color: colors.text,
      lineHeight: 20,
      ...fonts.regular,
    },
    userText: {
      fontSize: 13,
      color: "#FFFFFF",
      lineHeight: 20,
      ...fonts.regular,
    },
    inputBar: {
      flexDirection: "row",
      alignItems: "center",
      marginHorizontal: spacing.lg,
      marginTop: spacing.sm,
      backgroundColor: colors.surface,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.lg,
      paddingVertical: 10,
      borderWidth: 1.5,
      borderColor: colors.border,
      gap: 10,
    },
    input: {
      flex: 1,
      fontSize: 13,
      color: colors.text,
      ...fonts.regular,
    },
    micBtn: {
      width: 34,
      height: 34,
      borderRadius: radius.pill,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
  }), [colors]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Animated.View style={[styles.sheet, { height: sheetHeight }]}>
          <PanGestureHandler
            onHandlerStateChange={({ nativeEvent }) => {
              if (nativeEvent.state !== State.END) return;
              if (nativeEvent.translationY < -60) {
                // Swipe up → expand to full screen
                animateTo(FULL_H, () => setIsFullScreen(true));
              } else if (nativeEvent.translationY > 60) {
                if (isFullScreen) {
                  // Swipe down from full → back to half
                  animateTo(HALF_H, () => setIsFullScreen(false));
                } else {
                  // Swipe down from half → close
                  onClose();
                }
              }
            }}
          >
            <View style={styles.handleZone}>
              <View style={styles.handle} />
            </View>
          </PanGestureHandler>

          {/* Header */}
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

          {/* Messages */}
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
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

          {/* Input bar */}
          <View style={styles.inputBar}>
            <TextInput
              style={styles.input}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Ask Vision anything..."
              placeholderTextColor={colors.muted}
              onSubmitEditing={handleSend}
              returnKeyType="send"
              editable={!sending}
            />
            <TouchableOpacity onPress={handleSend} activeOpacity={0.8} style={styles.micBtn} disabled={sending}>
              <LinearGradient
                colors={[...gradients.primary]}
                style={{ width: 34, height: 34, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" }}
              >
                <Ionicons name="send" size={14} color="#FFFFFF" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
