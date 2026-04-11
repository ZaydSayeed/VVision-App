# Onboarding Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 3-screen swipeable onboarding experience shown to new users after signup

**Architecture:** Single new screen component + minor RootNavigator modification. Onboarding completion tracked in AsyncStorage. No backend changes.

**Tech Stack:** React Native ScrollView (pagingEnabled), AsyncStorage, expo-linear-gradient, Ionicons

---

## Files

| File | Action | Purpose |
|---|---|---|
| `src/screens/OnboardingScreen.tsx` | Create | 3-screen swipeable onboarding with role-specific content |
| `src/navigation/RootNavigator.tsx` | Modify | Check AsyncStorage for onboarding completion, show OnboardingScreen if needed |

---

## Task 1: Create OnboardingScreen.tsx

**Files:**
- Create: `src/screens/OnboardingScreen.tsx`

- [ ] **Step 1: Create the full OnboardingScreen component**

Create `src/screens/OnboardingScreen.tsx` with the following complete content:

```typescript
import React, { useMemo, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  TouchableOpacity,
  Image,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { fonts, spacing, radius, gradients } from "../config/theme";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

interface SlideData {
  type: "welcome" | "info";
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBg: string;
  title: string;
  subtitle: string;
}

function getPatientSlides(firstName: string): SlideData[] {
  return [
    {
      type: "welcome",
      icon: "sunny",
      iconColor: "#FFFFFF",
      iconBg: "rgba(255,255,255,0.2)",
      title: `Hi ${firstName}!`,
      subtitle: "Your daily companion for staying on track.",
    },
    {
      type: "info",
      icon: "calendar",
      iconColor: "#5C8E7A",
      iconBg: "#EAF4EF",
      title: "Your Day",
      subtitle:
        "We'll help you remember your tasks and medications each day.",
    },
    {
      type: "info",
      icon: "hand-left",
      iconColor: "#D95F5F",
      iconBg: "#FDEAEA",
      title: "Get Help",
      subtitle:
        "Need help? Tap the help button anytime and your caregiver will be notified right away.",
    },
  ];
}

function getCaregiverSlides(firstName: string): SlideData[] {
  return [
    {
      type: "welcome",
      icon: "shield-checkmark",
      iconColor: "#FFFFFF",
      iconBg: "rgba(255,255,255,0.2)",
      title: `Hi ${firstName}!`,
      subtitle: "Everything you need to support your loved one.",
    },
    {
      type: "info",
      icon: "pulse",
      iconColor: "#7B5CE7",
      iconBg: "#F0EEFF",
      title: "Stay Connected",
      subtitle:
        "See your patient's daily progress, medication status, and activity in real time.",
    },
    {
      type: "info",
      icon: "notifications",
      iconColor: "#E8934A",
      iconBg: "#FEF3E8",
      title: "Smart Alerts",
      subtitle:
        "Get notified when your patient needs help or when something needs your attention.",
    },
  ];
}

export function OnboardingScreen({ onComplete }: { onComplete: () => void }) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const firstName = (user?.name ?? "").split(" ")[0] || "there";
  const slides =
    user?.role === "caregiver"
      ? getCaregiverSlides(firstName)
      : getPatientSlides(firstName);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
      setActiveIndex(index);
    },
    []
  );

  const goNext = useCallback(() => {
    if (activeIndex < slides.length - 1) {
      scrollRef.current?.scrollTo({
        x: SCREEN_W * (activeIndex + 1),
        animated: true,
      });
    }
  }, [activeIndex, slides.length]);

  const finish = useCallback(async () => {
    if (user?.id) {
      await AsyncStorage.setItem(
        `@vela/onboarding_complete:${user.id}`,
        "true"
      );
    }
    onComplete();
  }, [user?.id, onComplete]);

  const isLast = activeIndex === slides.length - 1;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.bg },
        scrollContent: { flexGrow: 1 },
        slide: {
          width: SCREEN_W,
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: spacing.xxxl,
        },
        welcomeGradient: {
          width: SCREEN_W,
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: spacing.xxxl,
        },
        logo: { width: 64, height: 64, marginBottom: spacing.xxl },
        iconCircle: {
          width: 100,
          height: 100,
          borderRadius: 50,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: spacing.xxxl,
        },
        titleWelcome: {
          fontSize: 34,
          color: "#FFFFFF",
          ...fonts.medium,
          textAlign: "center",
          letterSpacing: -0.5,
        },
        subtitleWelcome: {
          fontSize: 17,
          color: "rgba(255,255,255,0.85)",
          ...fonts.regular,
          textAlign: "center",
          marginTop: spacing.md,
          lineHeight: 24,
          paddingHorizontal: spacing.lg,
        },
        titleInfo: {
          fontSize: 28,
          color: colors.text,
          ...fonts.medium,
          textAlign: "center",
          letterSpacing: -0.3,
        },
        subtitleInfo: {
          fontSize: 16,
          color: colors.muted,
          ...fonts.regular,
          textAlign: "center",
          marginTop: spacing.md,
          lineHeight: 24,
          paddingHorizontal: spacing.sm,
        },
        footer: {
          paddingBottom: 56,
          paddingHorizontal: spacing.xxxl,
          alignItems: "center",
          gap: spacing.xl,
        },
        footerWelcome: {
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          paddingBottom: 56,
          paddingHorizontal: spacing.xxxl,
          alignItems: "center",
          gap: spacing.xl,
        },
        dots: {
          flexDirection: "row",
          gap: spacing.sm,
        },
        dot: {
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: colors.border,
        },
        dotActive: {
          width: 24,
          height: 8,
          borderRadius: 4,
          backgroundColor: colors.violet,
        },
        dotWelcome: {
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: "rgba(255,255,255,0.4)",
        },
        dotWelcomeActive: {
          width: 24,
          height: 8,
          borderRadius: 4,
          backgroundColor: "#FFFFFF",
        },
        btn: {
          backgroundColor: colors.violet,
          borderRadius: radius.pill,
          paddingVertical: 16,
          paddingHorizontal: 48,
          alignItems: "center",
          width: "100%",
        },
        btnWelcome: {
          backgroundColor: "#FFFFFF",
          borderRadius: radius.pill,
          paddingVertical: 16,
          paddingHorizontal: 48,
          alignItems: "center",
          width: "100%",
        },
        btnText: {
          fontSize: 16,
          color: "#FFFFFF",
          ...fonts.medium,
        },
        btnTextWelcome: {
          fontSize: 16,
          color: "#7B5CE7",
          ...fonts.medium,
        },
        skip: {
          position: "absolute",
          top: 60,
          right: spacing.xl,
          zIndex: 10,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.lg,
        },
        skipText: {
          fontSize: 15,
          color: colors.muted,
          ...fonts.regular,
        },
        skipTextWelcome: {
          fontSize: 15,
          color: "rgba(255,255,255,0.7)",
          ...fonts.regular,
        },
      }),
    [colors]
  );

  const renderDots = (isWelcome: boolean) => (
    <View style={styles.dots}>
      {slides.map((_, i) => (
        <View
          key={i}
          style={
            i === activeIndex
              ? isWelcome
                ? styles.dotWelcomeActive
                : styles.dotActive
              : isWelcome
              ? styles.dotWelcome
              : styles.dot
          }
        />
      ))}
    </View>
  );

  const isWelcomeActive = slides[activeIndex]?.type === "welcome";

  return (
    <View style={styles.container}>
      {/* Skip button */}
      <TouchableOpacity
        style={styles.skip}
        onPress={finish}
        activeOpacity={0.7}
      >
        <Text
          style={isWelcomeActive ? styles.skipTextWelcome : styles.skipText}
        >
          Skip
        </Text>
      </TouchableOpacity>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={styles.scrollContent}
      >
        {slides.map((slide, index) => {
          if (slide.type === "welcome") {
            return (
              <LinearGradient
                key={index}
                colors={[...gradients.primary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.welcomeGradient}
              >
                <Image
                  source={require("../../assets/icon.png")}
                  style={styles.logo}
                  resizeMode="contain"
                />
                <Text style={styles.titleWelcome}>{slide.title}</Text>
                <Text style={styles.subtitleWelcome}>{slide.subtitle}</Text>
              </LinearGradient>
            );
          }

          return (
            <View key={index} style={styles.slide}>
              <View
                style={[
                  styles.iconCircle,
                  { backgroundColor: slide.iconBg },
                ]}
              >
                <Ionicons
                  name={slide.icon}
                  size={44}
                  color={slide.iconColor}
                />
              </View>
              <Text style={styles.titleInfo}>{slide.title}</Text>
              <Text style={styles.subtitleInfo}>{slide.subtitle}</Text>
            </View>
          );
        })}
      </ScrollView>

      {/* Footer — positioned differently for welcome vs info slides */}
      <View style={isWelcomeActive ? styles.footerWelcome : styles.footer}>
        {renderDots(isWelcomeActive)}
        <TouchableOpacity
          style={isWelcomeActive ? styles.btnWelcome : styles.btn}
          onPress={isLast ? finish : goNext}
          activeOpacity={0.85}
        >
          <Text
            style={isWelcomeActive ? styles.btnTextWelcome : styles.btnText}
          >
            {isLast ? "Get Started" : "Next"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
```

- [ ] **Step 2: Commit**

```
git add src/screens/OnboardingScreen.tsx
git commit -m "Add OnboardingScreen with role-specific 3-screen swipeable flow"
```

---

## Task 2: Wire OnboardingScreen into RootNavigator

**Files:**
- Modify: `src/navigation/RootNavigator.tsx`

- [ ] **Step 1: Add imports for AsyncStorage and OnboardingScreen**

At the top of `src/navigation/RootNavigator.tsx`, add these two imports after the existing imports:

```typescript
import AsyncStorage from "@react-native-async-storage/async-storage";
import { OnboardingScreen } from "../screens/OnboardingScreen";
```

- [ ] **Step 2: Add onboarding state and check logic inside RootNavigator**

Inside the `RootNavigator` function, after the existing `const contentOpacity = useRef(...)` line and before the first `useEffect`, add:

```typescript
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
```

- [ ] **Step 3: Add onboarding gate after the loading and auth checks**

Replace the line:

```typescript
if (!user) return <LoginScreen />;
```

with:

```typescript
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
```

This means:
- `onboardingDone === null` — still checking AsyncStorage, show splash briefly
- `onboardingDone === false` — first time user, show onboarding
- `onboardingDone === true` — done, proceed to main app

- [ ] **Step 4: Commit**

```
git add src/navigation/RootNavigator.tsx
git commit -m "Wire onboarding flow into RootNavigator with AsyncStorage check"
```

---

## Task 3: Manual Test Verification

- [ ] **Step 1: Test new user onboarding (patient)**

1. Run `npx expo start` and open in Expo Go
2. Sign up as a new patient
3. Verify you see the 3-screen onboarding instead of the main app:
   - Screen 1: Violet gradient with "Hi {name}!", Vela Vision logo, "Your daily companion..."
   - Screen 2: White/cream with calendar icon, "Your Day" title
   - Screen 3: White/cream with hand icon, "Get Help" title
4. Verify you can swipe between screens
5. Verify dot indicators update as you swipe
6. Verify "Next" button advances to next screen
7. Verify "Get Started" appears on screen 3 and takes you to the main app
8. Verify closing and reopening the app does NOT show onboarding again

- [ ] **Step 2: Test new user onboarding (caregiver)**

1. Sign up as a new caregiver
2. Verify you see caregiver-specific content:
   - Screen 1: "Hi {name}!" with "Everything you need to support your loved one."
   - Screen 2: Pulse icon, "Stay Connected"
   - Screen 3: Notifications icon, "Smart Alerts"
3. Verify "Get Started" on screen 3 takes you to the caregiver dashboard

- [ ] **Step 3: Test skip button**

1. Sign up as a new user (either role)
2. Tap "Skip" in the top-right corner on any screen
3. Verify you go straight to the main app
4. Verify closing and reopening does NOT show onboarding again

- [ ] **Step 4: Test existing user login**

1. Log in as an existing user (NOT a new signup)
2. Verify you go straight to the main app with NO onboarding shown
   - Note: existing users will see onboarding once since there's no AsyncStorage key for them yet. This is expected and harmless — they skip or complete it once, then never see it again.

- [ ] **Step 5: Test dark mode**

1. Complete onboarding, then enable dark mode from the side drawer
2. Log out, sign up as a new user
3. Verify onboarding screens respect dark mode (dark backgrounds, light text on info screens)
