# App Store Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all 5 App Store rejection issues from Build 1.0 (11) and ship a clean resubmission.

**Architecture:** Four surgical code changes (Info.plist, HealthOnboardingScreen, CheckInScreen) plus two process tasks (screenshots from Simulator, Review Notes + demo account in App Store Connect). No new screens, no new dependencies.

**Tech Stack:** React Native / Expo, Info.plist (iOS native config), iOS Simulator for screenshots, App Store Connect for metadata.

**Spec:** `docs/superpowers/specs/2026-05-18-appstore-readiness-design.md`

---

## File Map

| File | Change |
|------|--------|
| `ios/VelaVision/Info.plist` | Remove `<string>location</string>` from UIBackgroundModes; remove `NSLocationAlwaysUsageDescription` key+value |
| `src/screens/patient/HealthOnboardingScreen.tsx` | Change button label "Connect" → "Continue"; add iPad guard |
| `src/screens/caregiver/CheckInScreen.tsx` | Add explanatory text when no patient is linked |

---

## Task 1: Info.plist — Remove `location` background mode and deprecated key

**Files:**
- Modify: `ios/VelaVision/Info.plist` (lines 66–67 and 78–82)

### Why
Apple rejected under 2.5.4 because the app declares `location` in UIBackgroundModes but the reviewer couldn't find a feature requiring persistent location. The geofencing code itself has a comment confirming it does not need this key. Removing it eliminates the rejection vector while geofencing continues to work via Expo's task manager. `NSLocationAlwaysUsageDescription` is deprecated since iOS 13 — Apple tools flag it.

- [ ] **Step 1: Remove `location` from UIBackgroundModes**

Open `ios/VelaVision/Info.plist`. Find lines 78–82:
```xml
<key>UIBackgroundModes</key>
<array>
  <string>fetch</string>
  <string>location</string>
</array>
```

Replace with:
```xml
<key>UIBackgroundModes</key>
<array>
  <string>fetch</string>
</array>
```

- [ ] **Step 2: Remove deprecated `NSLocationAlwaysUsageDescription`**

In the same file, find and delete lines 66–67 entirely:
```xml
<key>NSLocationAlwaysUsageDescription</key>
<string>Vela uses your location in the background to alert your caregiver if you leave your safe zone.</string>
```

The `NSLocationAlwaysAndWhenInUseUsageDescription` key (lines 64–65) covers this use case on iOS 13+. Do not remove it.

- [ ] **Step 3: Verify the plist is still valid XML**

Run:
```bash
plutil -lint ios/VelaVision/Info.plist
```
Expected output: `ios/VelaVision/Info.plist: OK`

- [ ] **Step 4: Commit**

```bash
git add ios/VelaVision/Info.plist
git commit -m "fix: remove location UIBackgroundMode and deprecated NSLocationAlwaysUsageDescription"
```

---

## Task 2: HealthOnboardingScreen — "Connect" → "Continue" + iPad guard

**Files:**
- Modify: `src/screens/patient/HealthOnboardingScreen.tsx`

### Why
2 issues are fixed here:
- Guideline 5.1.1(iv): Apple requires the button on a pre-permission primer screen to say "Continue" or "Next", not "Connect"
- HealthKit is unavailable on iPad. The reviewer was on iPad Air 11-inch. If a patient uses the app on iPad and reaches the Health tab, the HealthKit init will silently fail. Add a `Platform.isPad` guard to show a clear "available on iPhone only" message instead.

- [ ] **Step 1: Add Platform import**

`src/screens/patient/HealthOnboardingScreen.tsx` line 2 currently imports from `react-native`:
```tsx
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from "react-native";
```

Add `Platform` to the import:
```tsx
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Platform } from "react-native";
```

- [ ] **Step 2: Add iPad guard before the main return**

After line 35 (the closing `}` of `onConnect`), add an early return for iPad:
```tsx
  if (Platform.isPad) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 32 }}>
        <Ionicons name="phone-portrait-outline" size={48} color={colors.muted} />
        <Text style={{ ...fonts.medium, fontSize: 18, color: colors.text, textAlign: "center", marginTop: 16 }}>
          Health data is only available on iPhone
        </Text>
        <Text style={{ ...fonts.regular, fontSize: 15, color: colors.muted, textAlign: "center", marginTop: 8, lineHeight: 22 }}>
          Open Vela on your iPhone to connect Apple Health.
        </Text>
      </View>
    );
  }
```

- [ ] **Step 3: Change "Connect" to "Continue"**

Find line 61:
```tsx
{busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonLabel}>Connect</Text>}
```

Change to:
```tsx
{busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonLabel}>Continue</Text>}
```

- [ ] **Step 4: Verify the full file looks correct**

The final file should look like this (showing the relevant changed sections):
```tsx
import React, { useMemo, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Platform } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../config/theme";
import { requestPermissions } from "../../services/healthkit";

// ... (ONBOARDED_KEY and isHealthOnboarded unchanged)

export function HealthOnboardingScreen() {
  const { colors } = useTheme();
  const nav = useNavigation<any>();
  const [busy, setBusy] = useState(false);

  const onConnect = async () => { /* unchanged */ };

  // iPad guard — HealthKit is iPhone-only
  if (Platform.isPad) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 32 }}>
        <Ionicons name="phone-portrait-outline" size={48} color={colors.muted} />
        <Text style={{ ...fonts.medium, fontSize: 18, color: colors.text, textAlign: "center", marginTop: 16 }}>
          Health data is only available on iPhone
        </Text>
        <Text style={{ ...fonts.regular, fontSize: 15, color: colors.muted, textAlign: "center", marginTop: 8, lineHeight: 22 }}>
          Open Vela on your iPhone to connect Apple Health.
        </Text>
      </View>
    );
  }

  const styles = useMemo(() => StyleSheet.create({ /* unchanged */ }), [colors]);

  return (
    // ... all existing JSX unchanged except:
    // Line 61: "Connect" → "Continue"
    {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonLabel}>Continue</Text>}
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add src/screens/patient/HealthOnboardingScreen.tsx
git commit -m "fix: HealthKit button label Connect→Continue, add iPad unavailable guard"
```

---

## Task 3: CheckInScreen — explain why mic button is disabled

**Files:**
- Modify: `src/screens/caregiver/CheckInScreen.tsx`

### Why
Guideline 2.1(a): The reviewer saw a greyed-out microphone button with no explanation. The button is `disabled={!patientId}` (line 97). When `patients.length === 0` (no linked patient), there is no message telling the user what to do. The existing message at lines 84–88 only fires when `patients.length > 1`. A caregiver with no linked patient gets a grey button and silence.

- [ ] **Step 1: Locate the existing "Pick a patient" message block**

In `src/screens/caregiver/CheckInScreen.tsx`, find lines 84–88:
```tsx
{!patientId && patients.length > 1 && (
  <Text style={{ color: "#94a3b8", textAlign: "center", marginBottom: 12, fontSize: 13 }}>
    Pick a patient above to begin.
  </Text>
)}
```

- [ ] **Step 2: Replace with a message that covers both cases**

Replace that block with:
```tsx
{!patientId && (
  <Text style={{ color: "#94a3b8", textAlign: "center", marginBottom: 12, fontSize: 13 }}>
    {patients.length > 1
      ? "Pick a patient above to begin."
      : "No patient linked yet. Ask your patient to share their link code from the Vela app."}
  </Text>
)}
```

- [ ] **Step 3: Commit**

```bash
git add src/screens/caregiver/CheckInScreen.tsx
git commit -m "fix: show explanation when mic button is disabled due to no linked patient"
```

---

## Task 4: Screenshots — retake from iOS Simulator

### Why
Guideline 2.3.10: The submitted screenshots were generated from HTML mockup files in `docs/`. Their status bar didn't match a real iOS device. Screenshots must come from the actual iOS Simulator.

- [ ] **Step 1: Build the app for Simulator**

```bash
cd ~/projects/VVision-App
npx expo run:ios --configuration Release
```

Wait for the build to complete and the Simulator to launch.

- [ ] **Step 2: Set the Simulator clock to a clean time**

In the Simulator menu: **Device → Override Status Bar → Time → 9:41 AM**. This is Apple's standard demo time and will not raise flags.

- [ ] **Step 3: Take iPhone screenshots (6.9" — iPhone 16 Pro Max)**

In Simulator, select **File → New Simulator** and choose **iPhone 16 Pro Max** (or whichever device produces 1320×2868px screenshots).

Navigate to each key screen and take a screenshot using **Command+S** (saves to Desktop). Take screenshots of:
1. Caregiver — Timeline/dashboard
2. Caregiver — Patient status
3. Patient — Today screen (routines + meds)
4. Patient — Help screen
5. Caregiver — Paywall/plans screen

- [ ] **Step 4: Take iPhone 6.7" screenshots**

Switch Simulator device to iPhone 16 Plus (produces 1290×2796px). Repeat the same 5 screens.

- [ ] **Step 5: Take iPad screenshots (iPad Pro 13")**

Switch Simulator device to iPad Pro 13-inch M4 (produces 2064×2752px). Repeat the same 5 screens.

- [ ] **Step 6: Upload to App Store Connect**

1. Go to [App Store Connect](https://appstoreconnect.apple.com) → My Apps → Vela
2. Select the app version → Previews and Screenshots
3. Click **View All Sizes in Media Manager**
4. Delete existing screenshots for each device size
5. Upload the new Simulator screenshots for each size
6. Save

---

## Task 5: App Review Notes and demo account

### Why
Guideline 2.1(b): Apple couldn't review the post-trial paywall because they had no demo account with an expired trial. Guideline 2.5.4: Geofencing needs to be explained in notes so the reviewer can find it. Both require action in App Store Connect, not in code.

- [ ] **Step 1: Create a demo caregiver account with expired trial**

Set up a test account at https://vvision-app.onrender.com or via the app:
- Email: `reviewer@vela-demo.com` (or use any throwaway email)
- Role: Caregiver
- Linked patient: create a dummy patient account and link it to this caregiver
- Trial: via RevenueCat dashboard, manually expire the trial for this account OR set up the account and wait for the 7-day trial to lapse naturally

In RevenueCat dashboard: find the user by their app user ID, manually set subscription to expired if there is a test override option. Otherwise use RevenueCat's sandbox environment with a test Apple ID and expire it via StoreKit testing.

- [ ] **Step 2: Write App Review Notes in App Store Connect**

Go to App Store Connect → App Version → App Review Information → Notes field. Enter:

```
Demo account (caregiver with expired trial + linked patient):
Email: reviewer@vela-demo.com
Password: [your password]

POST-TRIAL PURCHASE FLOW:
1. Log in with the demo account above.
2. Tap the "People" tab → "Invite Caregiver."
3. The app will show a 402 error and navigate to the subscription paywall.
4. The paywall shows two plans: Starter ($9.99/mo, 2 seats) and Unlimited ($14.99/mo).
5. Both plans are purchasable via App Store In-App Purchase.
The trial was 7 days. After expiry, the account reverts to the free tier (1 seat).

GEOFENCING / BACKGROUND LOCATION:
We removed "location" from UIBackgroundModes — Expo's task manager handles geofencing without requiring it.
To find the feature: log in as caregiver → go to a patient's profile → Safe Zone settings → set a home address.
The app will alert the caregiver if the patient's device leaves the defined radius.
This is the only location use case in the app.
```

- [ ] **Step 3: Enter demo credentials in App Review Information**

In App Store Connect → App Version → App Review Information:
- Check **Sign-in required**
- Username: `reviewer@vela-demo.com`
- Password: [the password you set]
- Click **Save**

- [ ] **Step 4: Final pre-submission checklist**

Before clicking Submit for Review, confirm:
- [ ] Info.plist changes are in the new build
- [ ] "Continue" button is in the new build (not "Connect")
- [ ] Mic disabled message is in the new build
- [ ] New Simulator screenshots uploaded for all 3 device sizes
- [ ] App Review Notes filled in with the geofencing explanation + IAP flow
- [ ] Demo account credentials entered in App Review Information
- [ ] Build version bumped — open `app.json` and increment `"buildNumber"` under `ios` (e.g. `"11"` → `"12"`)

- [ ] **Step 5: Submit**

```bash
cd ~/projects/VVision-App
eas submit --platform ios
```

Or submit manually from App Store Connect.
