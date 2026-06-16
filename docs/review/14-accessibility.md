## Accessibility Audit (HIG + WCAG + senior-friendly)

For an app whose entire value proposition is serving presbyopic 45-65 caregivers and cognitively-impaired, often low-vision dementia patients, accessibility is shockingly thin and the gaps were confirmed in code, not just inferred from docs. The muted text token fails WCAG AA contrast across all backgrounds and is used in 180 places; VoiceOver labelling covers roughly 13% of interactive elements; there is zero Dynamic Type, Reduce Motion, or screen-reader-announcement support anywhere in the codebase; and the single most safety-critical flow — the incoming "Help Requested" SOS overlay — is haptics-only with no sound and no spoken announcement. One sub-claim was corrected during verification (expo-av IS used elsewhere, in the voice session hook), but that does not change the conclusion: the help overlay itself plays no sound and never announces to VoiceOver. Every Critical and High finding below was verified against the actual source.

### [A11Y-1] Primary muted text color fails WCAG AA contrast on every background
**Severity:** Critical · **Effort:** Medium

- **Issue:** `colors.muted` (#9590B0) fails WCAG AA contrast on bg, surface, and warm backgrounds.
- **Description:** `colors.muted` is #9590B0 (theme.ts:19) on bg #F4EEFC (theme.ts:4) / surface #F7F5FF (theme.ts:5). Computed contrast ≈2.68-2.89:1 — below the 4.5:1 AA threshold for normal text and below the 3.0:1 large-text floor. Applied in 180 confirmed `color: colors.muted` sites, overwhelmingly on 11-13px caption/label/meta text.
- **Why it matters:** Muted text carries timestamps, statuses, sub-labels, and medication metadata — secondary but often clinically relevant info. Failing contrast at small sizes makes it unreadable for the presbyopic target demographic.
- **Impact:** Caregivers and low-vision patients cannot reliably read status/metadata; clinical timing info is missed; concrete ADA/508 and Apple HIG exposure.
- **Recommendation:** Darken muted to ≈#6E6890 (~4.5:1 on bg) for normal text, or restrict the current value to ≥18px bold. Add a relative-luminance contrast lint to CI so tokens can't regress.
- **Expected impact:** Brings ~180 text instances into WCAG AA compliance and removes a concrete accessibility-litigation/App Store risk.
- **Evidence:** theme.ts:19, :4, :5; computed 2.68/2.82/2.89:1; 180 `color: colors.muted` usages (confirmed via grep).

### [A11Y-2] No Dynamic Type / Larger Text support — fonts are fixed pixel sizes
**Severity:** Critical · **Effort:** Large

- **Issue:** Zero Dynamic Type accommodation; layouts built on fixed pixel dimensions that clip when system text is enlarged.
- **Description:** 0 `allowFontScaling` occurrences confirmed. Typography tokens (theme.ts:99-115) are absolute pixel constants (hero 34, body 15, small 13, caption 11), with 200+ inline small fontSize literals. RN scales text by default, but fixed-height containers (tab bar 72px, fixed-height cards) will clip/overflow at Larger Text, and nothing was QA'd for it.
- **Why it matters:** Apple HIG and the senior-care thesis demand Dynamic Type. A 60-year-old caregiver who already runs iOS Large/XL text hits truncated buttons and clipped med names.
- **Impact:** The core paying demographic gets a broken layout the moment they use the OS accessibility setting they rely on; patients get no in-app enlargement path.
- **Recommendation:** Scale type via `PixelRatio.getFontScale()` (clamped), set `maxFontSizeMultiplier` on critical buttons, convert fixed `height` rows/cards to `minHeight`, and QA every primary screen at iOS XL/XXL. Treat Dynamic Type as a release gate.
- **Expected impact:** Unlocks usability for the majority of the 45-65 cohort running enlarged text and satisfies a hard HIG requirement.
- **Evidence:** theme.ts:99-115; 0 `allowFontScaling`; fixed-height tab bar and card styles.

### [A11Y-4] Emergency "Help Requested" overlay is silent to screen readers and plays no sound
**Severity:** Critical · **Effort:** Medium

- **Issue:** The incoming SOS overlay fires haptics only — no sound, no VoiceOver announcement.
- **Description:** The full-screen help overlay (RootNavigator.tsx:696 "Help Requested") triggers `Haptics.notificationAsync(Error)` plus two Heavy impacts (RootNavigator.tsx:399-401) and a fade-in. Verified: there is no `Sound`/`playAsync`/expo-av/expo-speech call in RootNavigator.tsx, and the entire codebase has 0 `accessibilityLiveRegion` / `announceForAccessibility` / `AccessibilityInfo`. (Note: expo-av does exist in the app — used by `useVoiceSession.ts` — so the library is available; it simply is not used for this alert.) A VoiceOver user focused elsewhere gets no spoken notice their dependent triggered an SOS.
- **Why it matters:** This is the most safety-critical event in the product. A silent, haptic-only, screen-reader-unannounced alert means a blind or distracted caregiver can miss a genuine emergency; haptics alone are unreliable if the phone is on a table.
- **Impact:** Patient safety — a missed help alert can mean an unattended fall, wandering, or medical event; also destroys caregiver trust.
- **Recommendation:** On alert arrival: play an attention sound via the already-present expo-av (respect silent switch with a setting), call `AccessibilityInfo.announceForAccessibility` and set `accessibilityLiveRegion="assertive"` on the overlay so VoiceOver speaks it, and have the overlay grab accessibility focus. Keep the haptics.
- **Expected impact:** Converts a silent, easily-missed SOS into a multi-sensory (sound + haptic + spoken) alert, directly reducing emergency-miss risk on the most vulnerable flow.
- **Evidence:** RootNavigator.tsx:399-401 (haptics only), :696; no sound call in RootNavigator.tsx (confirmed); 0 liveRegion/announce/AccessibilityInfo app-wide; expo-av present at useVoiceSession.ts:2.

### [A11Y-3] VoiceOver coverage ~13% — most interactive elements have no accessibility label
**Severity:** High · **Effort:** Medium

- **Issue:** ~200 interactive elements, only ~26 labelled; icon-only buttons expose no name to VoiceOver.
- **Description:** Confirmed counts: 26 `accessibilityLabel`, 22 `accessibilityRole`, 2 `accessibilityHint` against ~200 Touchable/Pressable. FacesScreen has 15 interactive elements and 0 accessibility labels (confirmed). Icon-only buttons (bell, menu, close, FABs) announce only as "button" — WCAG 4.1.2 (Name, Role, Value) failure.
- **Why it matters:** The dementia-caregiving population overlaps heavily with vision loss; some caregivers are blind. Unlabelled icon buttons make core flows unusable with a screen reader.
- **Impact:** Blind/low-vision caregivers cannot operate managing faces, opening patient detail, or navigating the dashboard.
- **Recommendation:** Audit every Touchable/Pressable: add `accessibilityRole="button"` + descriptive `accessibilityLabel`; add hints for non-obvious actions. Start with FacesScreen, PatientsDashboardScreen, and all header/FAB icons.
- **Expected impact:** Raises VoiceOver coverage from ~13% toward 100%, closing a clear WCAG 4.1.2 violation.
- **Evidence:** 26 label / 22 role / 2 hint vs ~200 touchables (confirmed); FacesScreen.tsx 15 touchables / 0 labels.

### [A11Y-5] Navigation and sheet icon buttons fall below the 44pt minimum touch target
**Severity:** High · **Effort:** Small

- **Issue:** Header and sheet icon buttons are 32-36pt, below the HIG 44pt minimum, with almost no hitSlop compensation.
- **Description:** Confirmed sizes: bellBtn 36×36 and menuBtn 36×36 (RootNavigator.tsx:823,830), closeBtn 34×34 (RootNavigator.tsx:455), VisionSheet close 32×32 (VisionSheet.tsx:215). Only 1 `hitSlop` exists app-wide, so almost none compensate with an expanded tap region.
- **Why it matters:** Motor precision declines with age and with conditions common in this cohort (arthritis, tremor). Sub-44pt targets cause missed taps; for a dementia patient a missed tap adds confusion.
- **Impact:** Older caregivers and tremor/arthritis users mis-tap navigation, notifications, and close buttons; HIG non-compliance flaggable in review.
- **Recommendation:** Set icon-button containers to ≥44×44pt, or keep visual size and add `hitSlop={{top:8,bottom:8,left:8,right:8}}`. Introduce a shared 44pt IconButton component to prevent regression.
- **Expected impact:** Eliminates mis-taps on every primary navigation control for motor-impaired users; low-effort, high-value HIG fix.
- **Evidence:** RootNavigator.tsx:455,823,830; VisionSheet.tsx:215; hitSlop usage = 1 app-wide (confirmed).

### [A11Y-7] Amber accent fails contrast for white text and small-text foreground
**Severity:** High · **Effort:** Small

- **Issue:** White-on-amber pills/badges compute ~2.41:1, failing AA and the large-text floor.
- **Description:** `colors.amber` #E8934A (theme.ts:26) with white text ≈2.41:1 — fails AA (4.5) and the 3.0 large-text floor. Sage white ≈3.75:1 and coral white ≈3.65:1 pass only for large/bold text. Amber is the meds / "needs attention" accent, so white-on-amber chips carrying medication and attention messaging are below readable contrast.
- **Why it matters:** Medication and "needs attention" states are exactly the information that must be readable; a 2.41:1 amber chip is effectively illegible to low-vision users — a WCAG 1.4.3 failure on a clinically meaningful element.
- **Impact:** Low-vision caregivers/patients miss medication and attention cues rendered as white-on-amber.
- **Recommendation:** Darken amber to ≈#B86C1E for white-text surfaces (or use dark text on amber), and reserve sage/coral-on-white for ≥18px bold only. Add to the A11Y-1 contrast lint.
- **Expected impact:** Brings medication/attention chips into WCAG AA compliance for low-vision users.
- **Evidence:** theme.ts:26 (#E8934A); computed white-on-amber 2.41:1, sage 3.75:1, coral 3.65:1.

### [A11Y-8] Voice check-in (CheckInScreen) bypasses theme with hardcoded low-contrast hex and breaks in dark mode
**Severity:** High · **Effort:** Medium

- **Issue:** CheckInScreen uses inline hardcoded slate-gray hex that fails contrast and ignores dark mode.
- **Description:** Confirmed hardcoded literals: #64748b (line 45), #94a3b8 (lines 50, 73, 85), #0f172a (73), #dc2626 (79, 104). #94a3b8 on white ≈2.56:1 — fails AA. These literals never adapt to dark mode (ThemeContext ignored), so in dark mode the transcript/instructions render near-invisible. The transcript Pressables also lack accessibility labels.
- **Why it matters:** Voice check-in is a flagship Plan-C accessibility path for users who can't type. The one flow built for vision/motor-limited users is itself low-contrast and dark-mode-broken, with a tiny gray transcript exactly for the users most likely to rely on it.
- **Impact:** Low-vision users can't read the live transcript/instructions; dark-mode users may see invisible text; the accessibility-first feature is inaccessible.
- **Recommendation:** Replace all hardcoded hex with theme tokens inside the `useMemo(StyleSheet)` pattern; render transcript with `colors.text` at ≥16px; add `accessibilityLabel`/`Role` to the mic Pressables and `accessibilityLiveRegion` on the transcript.
- **Expected impact:** Restores the voice flow's usability in both themes and for low-vision users, and fixes a dark-mode invisibility bug.
- **Evidence:** CheckInScreen.tsx:45,50,73,79,85,104 (confirmed hardcoded hex); #94a3b8 on white ≈2.56:1.

### [A11Y-6] Color-only status signaling (sage/amber/coral) with no text or icon redundancy
**Severity:** Medium · **Effort:** Small

- **Issue:** Patient status is conveyed by accent-strip and avatar color alone, failing WCAG 1.4.1.
- **Description:** The design system signals status purely through color: 4-5px colored left strips and avatar colors (sage=on track, amber=needs attention, coral=alert). Sage (#5C8E7A) and amber (#E8934A) are mid-tone green/orange that are hard to distinguish under red-green CVD (~8% of men).
- **Why it matters:** WCAG 1.4.1 requires color never be the sole means of conveying information. A colorblind caregiver scanning a dashboard cannot tell "on track" from "needs attention" by accent strip alone.
- **Impact:** Colorblind caregivers misread status at a glance; a "needs attention" patient blends in, delaying escalation.
- **Recommendation:** Pair every color cue with a non-color signal — status icon (check vs warning), always-visible text label, or a shape/pattern difference. Verify the dashboard is legible in grayscale.
- **Expected impact:** Makes patient triage reliable for ~8% of male caregivers with CVD and satisfies WCAG 1.4.1.
- **Evidence:** theme.ts:24-29; PatientsDashboardScreen left-accent + avatar-color status per design system.

### [A11Y-9] 11px uppercase section labels too small and low-contrast for seniors
**Severity:** Medium · **Effort:** Small

- **Issue:** 11px uppercase tracked labels, frequently in failing muted gray.
- **Description:** `labelStyle` and `captionStyle` are 11px (theme.ts:113-114); labelStyle adds letterSpacing 1.2 + uppercase. These section labels are repeatedly paired with `colors.muted`. 11px uppercase tracked text in a failing-contrast gray is among the least legible styles for presbyopic eyes.
- **Why it matters:** Section labels provide orientation ("Today's History", "Checking in for") — for a dementia-care app, orientation and predictability are core cognitive-accessibility needs; uppercase further reduces word-shape legibility.
- **Impact:** Seniors and presbyopic caregivers lose structural cues that make screens scannable, raising cognitive load.
- **Recommendation:** Raise label/caption minimum to 13px, drop full uppercase (or keep it only at ≥13px with a darker color), and never pair with the failing muted color — use `subtext` (#3D3560, ~9.85:1) instead.
- **Expected impact:** Makes the orienting structure of every screen legible to the target age group.
- **Evidence:** theme.ts:113-114; widespread labelStyle/captionStyle usage paired with colors.muted.

### [A11Y-10] Looping animations with no Reduce Motion support
**Severity:** Medium · **Effort:** Small

- **Issue:** Five files run continuous loop animations regardless of the iOS Reduce Motion setting.
- **Description:** Confirmed `Animated.loop`/`withRepeat` in RootNavigator.tsx, FacesScreen.tsx (pulsing glasses chip), PatientsDashboardScreen.tsx, HelpScreen.tsx (pulsing ring), SplashScreen.tsx. The codebase has 0 `isReduceMotionEnabled`/`useReducedMotion`/`AccessibilityInfo`, so loops run regardless of the OS preference.
- **Why it matters:** WCAG 2.3.3 / HIG: persistent motion can cause discomfort or vestibular issues, and for a cognitively-impaired patient, constantly-moving UI increases confusion and reduces focus.
- **Impact:** Patients with dementia and vestibular-sensitive users are distracted by perpetual motion they cannot stop from within the app.
- **Recommendation:** Read `AccessibilityInfo.isReduceMotionEnabled()` (and subscribe to its change event), freeze loops to a static state when enabled, via a shared `useReducedMotion`-aware hook.
- **Expected impact:** Honors a system accessibility setting across 5 animated surfaces, reducing distraction for the patient population.
- **Evidence:** Animated.loop/withRepeat in 5 files (confirmed); 0 isReduceMotionEnabled/useReducedMotion app-wide.

### [A11Y-11] Decorative/ambient elements not consistently hidden from VoiceOver
**Severity:** Low · **Effort:** Medium

- **Issue:** Only a handful of decorative Views are hidden from VoiceOver, cluttering the reading order.
- **Description:** Only 7 `accessibilityElementsHidden`/`importantForAccessibility` usages exist app-wide (confirmed: TimelineScreen, BackgroundDecor, TodayScreen), while the design system is heavy with decorative gradients, ambient/blur layers, accent strips, and progress-bar Views. Unmarked, VoiceOver announces them or inserts empty/duplicated stops.
- **Why it matters:** A clean, predictable reading order is essential for the screen-reader users in this cohort; decorative noise plus low label coverage (A11Y-3) compounds into an unusable audio experience.
- **Impact:** Screen-reader users wade through meaningless announcements between real controls, slowing every task.
- **Recommendation:** Mark all purely decorative Views with `accessibilityElementsHidden`/`importantForAccessibility="no-hide-descendants"`, and group composite cards into a single accessible element with a combined label.
- **Expected impact:** Produces a clean, efficient VoiceOver reading order, multiplying the benefit of A11Y-3's label work.
- **Evidence:** 7 accessibilityElementsHidden/importantForAccessibility usages app-wide (TimelineScreen, BackgroundDecor, TodayScreen); decorative gradient/ambient/accent-strip patterns per design system.
