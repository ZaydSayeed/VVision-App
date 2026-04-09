# Smooth Gestures Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make all bottom sheets follow the finger in real time, fix full-screen VisionSheet to respect iPhone safe area, and replace the dual time sliders with a single 15-minute-increment slider.

**Architecture:** Switch VisionSheet from animating `height` (JS thread only) to animating `translateY` (native thread capable). Sheet renders at full height always; `translateY` controls visibility. `onGestureEvent` fires setValue every frame for live tracking. Task/med modals get a PanGestureHandler that animates translateY live then springs to dismiss on release. Safe area insets from `useSafeAreaInsets` pad the pill below the dynamic island when full screen.

**Tech Stack:** react-native-gesture-handler (already installed), react-native-safe-area-context (already installed), @react-native-community/slider (already installed)

---

## Files

- Modify: `src/components/VisionSheet.tsx` — translateY gesture system + safe area
- Modify: `src/components/shared/TimeSlider.tsx` — rewrite to single slider
- Modify: `src/screens/patient/TodayScreen.tsx` — swipe-to-close on task/med modals

---

## Task 1: Rewrite TimeSlider with single 15-min slider

**Files:**
- Modify: `src/components/shared/TimeSlider.tsx`

- [ ] **Step 1: Replace the full file content**

```tsx
import React, { useState, useEffect, useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import Slider from "@react-native-community/slider";
import { useTheme } from "../../context/ThemeContext";
import { fonts, spacing } from "../../config/theme";

interface TimeSliderProps {
  value: string; // "HH:MM" 24-hour or ""
  onChange: (value: string) => void;
}

// 96 steps: step 0 = 12:00 AM, step 95 = 11:45 PM
function stepToTime(step: number): { display: string; value: string } {
  const totalMinutes = step * 15;
  const h24 = Math.floor(totalMinutes / 60);
  const min = totalMinutes % 60;
  const ampm = h24 < 12 ? "AM" : "PM";
  const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
  const minStr = String(min).padStart(2, "0");
  const h24Str = String(h24).padStart(2, "0");
  return {
    display: `${h12}:${minStr} ${ampm}`,
    value: `${h24Str}:${minStr}`,
  };
}

function timeToStep(value: string): number {
  if (!value || !value.includes(":")) return 36; // default 9:00 AM
  const [h, m] = value.split(":").map(Number);
  return Math.round((h * 60 + m) / 15);
}

export function TimeSlider({ value, onChange }: TimeSliderProps) {
  const { colors } = useTheme();
  const [step, setStep] = useState(timeToStep(value));

  useEffect(() => {
    setStep(timeToStep(value));
  }, [value]);

  // Sync parent on mount with default
  useEffect(() => {
    onChange(stepToTime(timeToStep(value)).value);
  }, []);

  const { display } = stepToTime(step);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      marginTop: spacing.sm,
      marginBottom: spacing.sm,
    },
    timeDisplay: {
      fontSize: 38,
      color: colors.violet,
      ...fonts.medium,
      textAlign: "center",
      marginBottom: spacing.md,
      letterSpacing: 1,
    },
    sliderLabel: {
      fontSize: 11,
      color: colors.muted,
      ...fonts.medium,
      letterSpacing: 1,
      textTransform: "uppercase",
      marginBottom: 4,
      textAlign: "center",
    },
  }), [colors]);

  return (
    <View style={styles.container}>
      <Text style={styles.timeDisplay}>{display}</Text>
      <Text style={styles.sliderLabel}>Drag to set time · 15 min steps</Text>
      <Slider
        minimumValue={0}
        maximumValue={95}
        step={1}
        value={step}
        onValueChange={(v) => {
          setStep(v);
          onChange(stepToTime(v).value);
        }}
        minimumTrackTintColor={colors.violet}
        maximumTrackTintColor={colors.border}
        thumbTintColor={colors.violet}
      />
    </View>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/shared/TimeSlider.tsx
git commit -m "refactor: single 15-min time slider"
```

---

## Task 2: Rewrite VisionSheet with translateY + native driver + safe area

**Files:**
- Modify: `src/components/VisionSheet.tsx`

- [ ] **Step 1: Replace the full file**

```tsx
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../context/ThemeContext";
import { fonts, spacing, radius, gradients } from "../config/theme";
import { sendVisionMessage, saveConversationTurn, fetchConversations } from "../api/client";
import { ConversationTurn } from "../types";
import { triggerReminderReload } from "../utils/reminderEvents";

const SCREEN_H = Dimensions.get("window").height;
// Half position: sheet bottom 75% of screen → translateY = 25% from top
const HALF_Y = SCREEN_H * 0.25;
const FULL_Y = 0;
const DISMISS_Y = SCREEN_H;

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
  const scrollRef = useRef<ScrollView>(null);

  // translateY controls sheet position. HALF_Y = half screen, 0 = full screen.
  const translateY = useRef(new Animated.Value(HALF_Y)).current;
  // Track committed position so gesture can offset from it
  const baseY = useRef(HALF_Y);
  const isFullRef = useRef(false);

  function snapTo(toValue: number, onDone?: () => void) {
    baseY.current = toValue;
    isFullRef.current = toValue === FULL_Y;
    Animated.spring(translateY, {
      toValue,
      useNativeDriver: true,
      bounciness: 0,
      speed: 20,
    }).start(onDone);
  }

  useEffect(() => {
    if (!visible) {
      translateY.setValue(HALF_Y);
      baseY.current = HALF_Y;
      isFullRef.current = false;
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
  }), [colors]);

  // Safe area top padding when in full screen so pill clears dynamic island
  const topInset = isFullRef.current ? insets.top : 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
          <PanGestureHandler
            onGestureEvent={({ nativeEvent }) => {
              // Move sheet with finger in real time
              const newY = baseY.current + nativeEvent.translationY;
              translateY.setValue(Math.max(FULL_Y, Math.min(DISMISS_Y, newY)));
            }}
            onHandlerStateChange={({ nativeEvent }) => {
              if (nativeEvent.state !== State.END) return;
              const dy = nativeEvent.translationY;
              if (isFullRef.current) {
                // Full screen: swipe down → half, else snap back to full
                dy > 80 ? snapTo(HALF_Y) : snapTo(FULL_Y);
              } else {
                // Half screen: swipe up → full, swipe down → dismiss
                if (dy < -80) {
                  snapTo(FULL_Y);
                } else if (dy > 80) {
                  onClose();
                  translateY.setValue(HALF_Y);
                  baseY.current = HALF_Y;
                  isFullRef.current = false;
                } else {
                  snapTo(HALF_Y);
                }
              }
            }}
          >
            <View style={[styles.handleZone, { paddingTop: topInset + 14 }]}>
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/VisionSheet.tsx
git commit -m "fix: VisionSheet finger-tracking gestures + safe area for full screen"
```

---

## Task 3: Swipe-to-close on task/med modals

**Files:**
- Modify: `src/screens/patient/TodayScreen.tsx`

The three modals (Add Task, Edit Task, Add Med) each need:
1. Their own `translateY` Animated.Value and `baseY` ref
2. Spring-in on open, live drag on gesture, spring-out on close
3. `PanGestureHandler` wrapping the `modalSheet` View

- [ ] **Step 1: Add imports at the top of TodayScreen.tsx**

Add `Animated` to the react-native import (it may already be there — check first):
```tsx
import {
  // ... existing imports ...
  Animated,
} from "react-native";
```

Also ensure `State` is imported from gesture handler (it already is via Swipeable, but add `PanGestureHandler` if not present):
```tsx
import { Swipeable, PanGestureHandler, State } from "react-native-gesture-handler";
```

- [ ] **Step 2: Add animated values after existing state declarations**

After the line `const [refreshing, setRefreshing] = useState(false);`, add:

```tsx
// Modal swipe-to-close animation values
const taskModalY = useRef(new Animated.Value(0)).current;
const editModalY = useRef(new Animated.Value(0)).current;
const medModalY = useRef(new Animated.Value(0)).current;
const taskModalBaseY = useRef(0);
const editModalBaseY = useRef(0);
const medModalBaseY = useRef(0);

function slideModalIn(anim: Animated.Value, baseRef: React.MutableRefObject<number>) {
  baseRef.current = 0;
  anim.setValue(600);
  Animated.spring(anim, { toValue: 0, useNativeDriver: true, bounciness: 0, speed: 20 }).start();
}

function slideModalOut(anim: Animated.Value, baseRef: React.MutableRefObject<number>, onDone: () => void) {
  Animated.timing(anim, { toValue: 600, duration: 220, useNativeDriver: true }).start(onDone);
}
```

- [ ] **Step 3: Trigger slide-in when modals open**

Find the existing useEffect for clock (the one with `setInterval`). Add three new useEffects right after it:

```tsx
useEffect(() => { if (showTaskModal) slideModalIn(taskModalY, taskModalBaseY); }, [showTaskModal]);
useEffect(() => { if (editingTask) slideModalIn(editModalY, editModalBaseY); }, [editingTask]);
useEffect(() => { if (showMedModal) slideModalIn(medModalY, medModalBaseY); }, [showMedModal]);
```

- [ ] **Step 4: Wrap Add Task modal sheet in PanGestureHandler + Animated.View**

Find the Add Task modal sheet (around line 783). Replace:
```tsx
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Add a Task</Text>
```
With:
```tsx
          <PanGestureHandler
            onGestureEvent={({ nativeEvent }) => {
              const newY = taskModalBaseY.current + nativeEvent.translationY;
              taskModalY.setValue(Math.max(0, newY));
            }}
            onHandlerStateChange={({ nativeEvent }) => {
              if (nativeEvent.state !== State.END) return;
              if (nativeEvent.translationY > 80) {
                slideModalOut(taskModalY, taskModalBaseY, () => { setShowTaskModal(false); setTaskError(""); });
              } else {
                taskModalBaseY.current = 0;
                Animated.spring(taskModalY, { toValue: 0, useNativeDriver: true, bounciness: 0, speed: 20 }).start();
              }
            }}
          >
            <Animated.View style={[styles.modalSheet, { transform: [{ translateY: taskModalY }] }]}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>Add a Task</Text>
```

And close the `Animated.View` before `</Modal>` by replacing the closing `</View>` of modalSheet with `</Animated.View></PanGestureHandler>`.

The full Add Task modal sheet block becomes:
```tsx
        <PanGestureHandler
          onGestureEvent={({ nativeEvent }) => {
            const newY = taskModalBaseY.current + nativeEvent.translationY;
            taskModalY.setValue(Math.max(0, newY));
          }}
          onHandlerStateChange={({ nativeEvent }) => {
            if (nativeEvent.state !== State.END) return;
            if (nativeEvent.translationY > 80) {
              slideModalOut(taskModalY, taskModalBaseY, () => { setShowTaskModal(false); setTaskError(""); });
            } else {
              taskModalBaseY.current = 0;
              Animated.spring(taskModalY, { toValue: 0, useNativeDriver: true, bounciness: 0, speed: 20 }).start();
            }
          }}
        >
          <Animated.View style={[styles.modalSheet, { transform: [{ translateY: taskModalY }] }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Add a Task</Text>
            <Text style={styles.fieldLabel}>WHAT DO I NEED TO DO?</Text>
            <TextInput
              style={styles.input}
              value={taskLabel}
              onChangeText={setTaskLabel}
              placeholder="e.g. Morning walk"
              placeholderTextColor={colors.muted}
              autoFocus
            />
            <Text style={styles.fieldLabel}>TIME</Text>
            <TimeSlider value={taskTime} onChange={setTaskTime} />
            {taskError ? <Text style={styles.error}>{taskError}</Text> : null}
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.btnOutline} onPress={() => { setShowTaskModal(false); setTaskError(""); }}>
                <Text style={styles.btnOutlineText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnPrimary} onPress={handleAddTask}>
                <Text style={styles.btnPrimaryText}>Add</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </PanGestureHandler>
```

- [ ] **Step 5: Wrap Edit Task modal sheet the same way**

```tsx
        <PanGestureHandler
          onGestureEvent={({ nativeEvent }) => {
            const newY = editModalBaseY.current + nativeEvent.translationY;
            editModalY.setValue(Math.max(0, newY));
          }}
          onHandlerStateChange={({ nativeEvent }) => {
            if (nativeEvent.state !== State.END) return;
            if (nativeEvent.translationY > 80) {
              slideModalOut(editModalY, editModalBaseY, () => { setEditingTask(null); setEditError(""); });
            } else {
              editModalBaseY.current = 0;
              Animated.spring(editModalY, { toValue: 0, useNativeDriver: true, bounciness: 0, speed: 20 }).start();
            }
          }}
        >
          <Animated.View style={[styles.modalSheet, { transform: [{ translateY: editModalY }] }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Edit Task</Text>
            <Text style={styles.fieldLabel}>WHAT DO I NEED TO DO?</Text>
            <TextInput
              style={styles.input}
              value={editLabel}
              onChangeText={setEditLabel}
              placeholder="e.g. Morning walk"
              placeholderTextColor={colors.muted}
              autoFocus
            />
            <Text style={styles.fieldLabel}>TIME</Text>
            <TimeSlider value={editTime} onChange={setEditTime} />
            {editError ? <Text style={styles.error}>{editError}</Text> : null}
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.btnOutline} onPress={() => { setEditingTask(null); setEditError(""); }}>
                <Text style={styles.btnOutlineText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnPrimary} onPress={handleEditTask}>
                <Text style={styles.btnPrimaryText}>Save</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </PanGestureHandler>
```

- [ ] **Step 6: Wrap Add Med modal sheet the same way**

```tsx
        <PanGestureHandler
          onGestureEvent={({ nativeEvent }) => {
            const newY = medModalBaseY.current + nativeEvent.translationY;
            medModalY.setValue(Math.max(0, newY));
          }}
          onHandlerStateChange={({ nativeEvent }) => {
            if (nativeEvent.state !== State.END) return;
            if (nativeEvent.translationY > 80) {
              slideModalOut(medModalY, medModalBaseY, () => { setShowMedModal(false); setMedError(""); });
            } else {
              medModalBaseY.current = 0;
              Animated.spring(medModalY, { toValue: 0, useNativeDriver: true, bounciness: 0, speed: 20 }).start();
            }
          }}
        >
          <Animated.View style={[styles.modalSheet, { transform: [{ translateY: medModalY }] }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Add Medication</Text>
            <Text style={styles.fieldLabel}>MEDICATION NAME</Text>
            <TextInput
              style={styles.input}
              value={medName}
              onChangeText={setMedName}
              placeholder="e.g. Donepezil"
              placeholderTextColor={colors.muted}
              autoFocus
            />
            <Text style={styles.fieldLabel}>DOSAGE</Text>
            <TextInput
              style={styles.input}
              value={medDosage}
              onChangeText={setMedDosage}
              placeholder="e.g. 1 tablet"
              placeholderTextColor={colors.muted}
            />
            <Text style={styles.fieldLabel}>TIME</Text>
            <TimeSlider value={medTime} onChange={setMedTime} />
            {medError ? <Text style={styles.error}>{medError}</Text> : null}
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.btnOutline} onPress={() => { setShowMedModal(false); setMedError(""); }}>
                <Text style={styles.btnOutlineText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnPrimary} onPress={handleAddMed}>
                <Text style={styles.btnPrimaryText}>Add</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </PanGestureHandler>
```

- [ ] **Step 7: Commit**

```bash
git add src/screens/patient/TodayScreen.tsx
git commit -m "fix: swipe-to-close on task/med modals with live finger tracking"
```

---

## Task 4: Push

- [ ] **Step 1: Push all commits**

```bash
git push
```
