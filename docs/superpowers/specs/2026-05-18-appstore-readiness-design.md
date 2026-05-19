# App Store Readiness — VVision-App
**Date:** 2026-05-18  
**Submission rejected:** Build 1.0 (11), Submission ID 4510345c-fce4-4c87-aee6-c61949df9dab  
**Review device:** iPad Air 11-inch (M3), iPadOS 26.5

---

## Rejection Issues & Fixes

### 1. Guideline 2.3.10 — Screenshots contain non-iOS status bar

**Root cause:** App Store screenshots were generated from HTML mockup files (`docs/app-store-previews.html`, `docs/app-store-previews-ipad.html`). These render a fake UI with a status bar that doesn't match a real iOS device (wrong time format, icons, or styling). Apple treats this as "imagery of other mobile platforms."

**Fix:** Retake all screenshots directly from iOS Simulator. The Simulator produces a clean iOS status bar (correct time, carrier, battery). Upload to App Store Connect via Media Manager.

**Required sizes:**
- iPhone 6.9" — 1320×2868px
- iPhone 6.7" — 1290×2796px
- iPad Pro 13" — 2064×2752px

**Files affected:** None (process change only — new screenshots uploaded to App Store Connect).

---

### 2. Guideline 2.1(a) — Microphone button greyed out on iPad

**Root cause:** In `src/screens/caregiver/CheckInScreen.tsx` line 97, the microphone Start button is `disabled={!patientId}`. The reviewer's demo account had no linked patient, so `patientId` was null and the button was permanently greyed out. There is no explanatory text — the reviewer had no way to know why.

**Fix (two parts):**

**Part A — Code:** Add a helper message beneath the disabled button when `!patientId`:
- Text: *"No patient linked. Set up your care circle to use voice check-ins."*
- Shown only when button is disabled
- File: `src/screens/caregiver/CheckInScreen.tsx`

**Part B — Process:** Provide a demo account in App Review Information (App Store Connect) with:
- Caregiver role
- At least one patient linked
- Expired free trial (so reviewer can also test the paywall)

---

### 3. Guideline 5.1.1(iv) — HealthKit permission uses "Connect" button

**Root cause:** `src/screens/patient/HealthOnboardingScreen.tsx` line 61 renders a button labeled `"Connect"`. Apple's reviewer flagged this as an "inappropriate" button label on a pre-permission primer screen.

**Fix:** Change button label from `"Connect"` to `"Continue"`.

**File:** `src/screens/patient/HealthOnboardingScreen.tsx` — one word change.

---

### 4. Guideline 2.5.4 — UIBackgroundModes declares `location` without persistent location feature

**Root cause:** `ios/VelaVision/Info.plist` lines 78–82 declares:
```xml
<key>UIBackgroundModes</key>
<array>
  <string>fetch</string>
  <string>location</string>
</array>
```

The app uses Expo's `Location.startGeofencingAsync()` (in `src/services/locationWatcher.ts`) for zone-exit alerts — but the code itself contains a comment confirming that geofencing via Expo's task manager does **not** require `location` in UIBackgroundModes. The reviewer also couldn't find the geofencing feature because it's buried in patient profile setup.

**Fix (Option A — chosen):** Remove `<string>location</string>` from UIBackgroundModes. Keep `<string>fetch</string>`. Geofencing continues to work via Expo task manager.

**File:** `ios/VelaVision/Info.plist`

**Also:** Add a note to App Review Notes explaining the geofencing feature and how to find it.

---

### 5. Guideline 2.1(b) — IAP flow after trial expiry not reviewable

**Root cause:** Apple couldn't review the post-trial paywall because they had no demo account with an expired trial.

**The actual flow (document this in Review Notes):**
1. New user starts a 7-day free trial (2-seat Starter plan via RevenueCat)
2. Trial expires → RevenueCat fires EXPIRATION webhook → backend sets subscription to "free" tier
3. User is capped at 1 seat (themselves). Adding a second caregiver returns HTTP 402.
4. The app intercepts the 402 and navigates to `PaywallScreen.tsx`
5. PaywallScreen shows two plans: Starter ($9.99/mo, 2 seats) and Unlimited ($14.99/mo)
6. Both plans are purchasable via App Store In-App Purchase (RevenueCat handles the StoreKit flow)

**Fix:** 
- Provide demo credentials (caregiver + linked patient + expired trial) in App Review Information in App Store Connect
- Write out the above flow verbatim in the App Review Notes field

---

## Proactive Fixes (not in rejection but flagged during audit)

### 6. Remove deprecated `NSLocationAlwaysUsageDescription`

**File:** `ios/VelaVision/Info.plist` lines 66–67  
**Reason:** This key has been deprecated since iOS 13. Apple's tools flag it. Remove it — `NSLocationAlwaysAndWhenInUseUsageDescription` (also present, lines 64–65) covers the same use case.

---

### 7. HealthKit iPad guard

**Current state:** `src/services/healthkit.ts` line 22 already checks `Platform.OS === 'ios'` before initializing HealthKit. HealthKit is not available on iPad.

**Verify:** Confirm `src/screens/patient/HealthOnboardingScreen.tsx` is never reachable from the iPad navigation path, or add a device check (`Platform.isPad`) to skip HealthKit onboarding on iPad entirely. HealthKit data should not be displayed on iPad — show a "Health data is only available on iPhone" placeholder instead.

---

## What Is NOT Changing

- HomeKit (`NSHomeKitUsageDescription`) — HomeKit is implemented in `src/lib/homekit/index.ts` and called from `RootNavigator.tsx`. Key is legitimate, stays.
- All other permission strings — all have legitimate usage and are implemented.
- RevenueCat integration — IAP flow is correctly implemented. No code changes needed for IAP itself.
- Android — not being submitted, no changes needed.

---

## Delivery Checklist

- [ ] Remove `location` from UIBackgroundModes in Info.plist
- [ ] Remove deprecated `NSLocationAlwaysUsageDescription` from Info.plist
- [ ] Change "Connect" → "Continue" in HealthOnboardingScreen.tsx
- [ ] Add disabled-state helper text to CheckInScreen.tsx microphone button
- [ ] Verify HealthKit screens are guarded on iPad
- [ ] Retake all screenshots from iOS Simulator (iPhone 6.9", 6.7", iPad Pro 13")
- [ ] Write App Review Notes (geofencing explanation + IAP flow)
- [ ] Create demo account with expired trial + linked patient
- [ ] Enter demo credentials in App Store Connect → App Review Information
