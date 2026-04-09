# Smooth Gestures & Safe Area Design

## Goal
Fix gesture animations so sheets follow the finger in real time, fix full-screen layout to respect the dynamic island on iPhone 15, and simplify the time picker to a single slider.

## Architecture
Use `translateY` (native driver) instead of `height` for all sheet animations. This moves animation off the JS thread onto the UI thread, giving smooth finger tracking. Safe area insets from `react-native-safe-area-context` handle the dynamic island.

## Part 1 — VisionSheet

- Sheet renders at `FULL_H` height always, positioned at bottom
- `baseTranslate`: Animated.Value — committed position (`FULL_H * 0.25` = half, `0` = full, `FULL_H` = dismissed)
- `dragY`: Animated.Value — live finger delta via `Animated.event` (native driver)
- Displayed `translateY` = `Animated.add(baseTranslate, dragY)`
- On gesture release: evaluate `translationY` threshold and current state → snap `baseTranslate` to target, reset `dragY` to 0
- When full screen (`baseTranslate = 0`): apply `paddingTop = insets.top` to push pill below dynamic island
- Borders: `borderTopLeftRadius` / `borderTopRightRadius` set to 0 when full screen, 20 when half

## Part 2 — Task/Med Modals

- Each modal gets same `translateY` pattern
- Wraps the sheet `View` (not `KeyboardAvoidingView`) in `Animated.View` with `translateY`
- On open: animate from `SCREEN_H` to `0`
- Swipe down past 80px → dismiss (calls the modal's close handler)
- Live finger tracking via `Animated.event` + native driver
- `paddingBottom = insets.bottom` so buttons clear the home indicator

## Part 3 — Time Slider

- Single `Slider` component, `min=0`, `max=95`, `step=1`
- Each step = 15 minutes: `hours = floor(step / 4)`, `minutes = (step % 4) * 15`
- Large time display above ("9:30 AM") updates live
- Output: 24-hour string "HH:MM" for backend compatibility
- Replaces `TimeSlider.tsx` entirely

## Files Changed
- `src/components/VisionSheet.tsx`
- `src/components/shared/TimeSlider.tsx`
- `src/screens/patient/TodayScreen.tsx` (modal sheets)
