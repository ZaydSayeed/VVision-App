# VVision-App Full Remodel Manual

Written 2026-07-06 by Claude (Fable 5) as a handoff for the future full-UI-redesign session. Read this whole file before touching code. Companion research: `~/Desktop/BRAIN/Research Library/` and BRAIN doc "VelaVision Website + App Redesign 2026-07-06".

## 1. The assignment
The app works but looks vibecoded. The goal is a ground-up remodel of both sides so each screen looks intentionally designed for its user: a person with dementia (patient side) and a stressed family caregiver (caregiver side). Not a reskin — layout, hierarchy, and navigation are all in scope. Invoke the `frontend-design` skill before any UI code (repo rule), and treat the dementia-UX numbers in §4 as hard requirements, not suggestions.

## 2. Current state (verified 2026-07-06)
- React Native + Expo 54, React Navigation v7, Supabase auth, Express backend in-repo (deployed on Render, manual deploys). Fonts: DM Sans 400/500 only. `maxFontSizeMultiplier: 1.4` global.
- **Mode split:** `user.role` from Supabase metadata; caregiver → CaregiverView, else patient. RootNavigator.tsx owns global chrome (AppHeader logo bar + violet time banner, OfflineBanner, SideDrawer, VisionSheet AI chat + "Ask Vela" FAB, UrgentAlertOverlay, ResolveSheet).
- **Patient tabs:** Home (TodayScreen) | Help (coral FAB tab) | Health. TodayScreen order: GreetingHeader → UpNextCard (single-focus, added 2026-07-06) → MoodCheckIn → caregiver note → MedicationsCard → TasksCard. Modals: add/edit task, add med (TimeSlider = day-part chips + ±30min), TaskDetailSheet, NotesHistoryModal, NotificationPanel (right slide-in schedule).
- **Caregiver tabs:** Alerts | Patients | Care Team. PatientsTab is a useState view-switcher (dashboard → detail → logs → logDetail, + link, livestream) — NOT a stack; hardware-back support was patched in, but there's no iOS swipe-back and no URL/history. Pushed screens via CaregiverStack: HelpHistory, CheckIn (voice), CheckInText, VisitReports, CaregiverHealth, Paywall, InviteSeat. 6-step onboarding wizard for new caregivers.
- **Design system** (`src/config/theme.ts`): violet brand palette + patient warm palette (sage=routine, amber=meds, coral=SOS, violet=brand/AI), light+dark variants, spacing/radius/typography/shadow tokens, `patientType` + `patientTouch` tokens (added 2026-07-06). ALL screens now consume the theme (off-system slate/indigo screens were converted 2026-07-06). Rule: StyleSheets inside `useMemo(..., [colors])` for dark mode.
- **What already got fixed (don't redo):** patient type/touch enlarged to spec; dead "Reminders on" toggle removed; Help cancel two-step + 20s handled state; Health accents on-palette; caregiver dashboard status banner ("Everything looks okay"); TimeSlider preset chips; "Ask Vela" FAB labels; CheckIn/CheckInText/AcceptInvite/onboarding/PatternsCard/InviteSeat restyled.
- **Dead weight to delete during remodel:** `src/screens/patient/RoutineScreen.tsx` (unrouted legacy), `OnboardingReminderBanner` (orphaned), stale navigation section in CLAUDE.md.

## 3. Hard constraints — violate these and the app crashes or gets rejected
1. **Old-architecture React Native.** `PanGestureHandler` inside `Modal` = fatal crash. Native `@react-native-community/slider` inside `Modal` = fatal crash. Use `animationType="slide"` + Pressable overlays. Check the dev client before adding ANY native module (Expo Go doesn't load the app since react-native-health).
2. `~/Documents/VVision-App` is the real repo; `~/projects/VVision-App` is a stale duplicate.
3. Run `npx tsc --noEmit` + `npm run test` (154 tests) before calling anything done. Metro needs Node 20 (`/opt/homebrew/opt/node@20/bin`) — Node 25 hangs silently. Port 8081 may be taken by mentra-bridge-app.
4. Backend deploys are MANUAL on Render; live DB is `haadisiddiqui1_db_user`, not `dvision`.
5. Code guardrails to preserve: patients never auto-logout; help intents never lost (offline queue); paywall never traps (Apple 2.1(b)); font scaling capped 1.4×; UrgentAlertOverlay haptics/VoiceOver/reduced-motion.
6. IAP product IDs are case-sensitive: `VelaVisionStarter` / `VelaVisionUnlimited`.
7. Never use `.toISOString()` for "today" — use local-date helpers.

## 4. Non-negotiable UX numbers (from clinical research; sources in Research Library)
**Patient side:** touch targets ≥56dp, primary actions ≥88dp; body text ≥19–20pt, titles 24pt+; contrast 7:1 for body text; tap-only (no swipe/drag/long-press/double-tap; debounce 300–500ms after taps); representational icons ALWAYS with text labels; one task per screen, ≤2 items carried across transitions; no timeouts or auto-dismissing dialogs; no typing in the patient path; day-part words ("this afternoon") over bare clock abstractions; recognition over recall (photos of real people); errors route to the caregiver, not the patient; avoid blue-vs-purple and pastel-on-pastel pairs; warm off-white (`colors.warm`) not pure white; no large pure-black areas.
**Caregiver side:** home answers "is everything okay?" affirmatively before anything else; honest staleness ("last updated 2h ago · phone off") — never show stale as fresh; three alert tiers (FYI digest / amber snoozable / red urgent that can't be muted); alerts must be specific ("left home at 2:14 AM") and auto-resolve; celebrate good days (morning digest — evidence: LEAF RCT cut caregiver depression/anxiety); gain framing over fear framing.

## 5. Anti-slop design rules (why it currently reads "vibecoded")
- One visual language per side, executed precisely. The patient side is warm cream + sage/amber/coral accents; the caregiver side is the violet system. Don't mix a third dialect in.
- Kill: gradient-on-everything, violet-tinted shadows on every card, decorative icons beside every heading, 10–11px uppercase labels used as the only hierarchy device, three-stat hero cards, emoji in buttons.
- Hierarchy from size and space, not from adding chrome. Fewer cards, bigger content.
- Every control must do something real (the "Reminders on" toggle that did nothing is the canonical sin).
- Copy is design: verbs on buttons ("I took it", not "Submit"), the same action keeps the same name everywhere, empty states say what to do next.
- Steal structure from proven products, not dribbble: RAZ Memory Phone (patient), Nanit/Owlet status-first (caregiver), Dexcom alert tiers.

## 6. Target information architecture (the actual remodel)
**Patient side → 2 tabs:** Today | Help.
- Today = UpNext focus card (exists) + simplified checklist + caregiver note. Mood check-in becomes a gentle once-daily moment, not a permanent card. Health moves off the tab bar into caregiver-land (patients rarely self-serve charts) — keep the HealthKit sync running invisibly.
- Add a **Family/faces surface** (photos + names + relationship, caregiver-curated) — recognition over recall; this is also the glasses' data. Placement: second card on Today or the Help screen's calm state.
- Kill the patient notification bell + slide-in panel (caregiver pattern on a patient screen); "See schedule" from UpNext covers it.
- Evening mode (after ~16:00: calmer palette, fewer elements, suppress non-critical prompts) — sundowning affects 20–45%.
**Caregiver side → status-first home:** Home (status hero → active alerts → today digest → patient cards) | Patients | Care Team. Alerts stops being a destination tab and becomes the top of Home; AlertsScreen content folds in. Merge CheckIn + CheckInText into ONE check-in flow (voice-first, text fallback, same screen). Convert PatientsTab to a real native stack. Empty the SideDrawer: link code and subscription become visible rows on Care Team; consent toggles move to a Settings screen.
**Open product decisions — ASK HAADI, don't assume:**
1. Do patients keep add/edit powers for tasks/meds, or does data entry go caregiver-only (RAZ pattern — recommended by all evidence)? This decides whether the add-modals survive on the patient side.
2. Does the patient keep "Ask Vela" AI chat (typing violates patient-path rules — voice-only version?)?
3. Morning digest + alert tiers need backend work (thresholds, digest cron) — in scope or UI-only remodel?

## 7. Process for the remodel session
1. Read this file + `frontend-design` skill + `~/Desktop/BRAIN/Research Library/` index.
2. Confirm the §6 open decisions with Haadi first.
3. Design tokens/IA on paper (in-chat) before code; get Haadi's yes on ONE screen (patient Today) before fanning out.
4. Work side by side: finish the patient side fully, verify, then caregiver. Typecheck + tests after every screen.
5. Verify on device via Metro (Node 20, port 8082) — screenshots to Haadi at each milestone. He judges by look; show, don't describe.
6. Mirror every decision to BRAIN as you go (standing rule).
