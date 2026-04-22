# Plan G Smoke Tests

Run on iOS dev client (Expo Go will not load — react-native-health requires dev client).

1. **New signup** — Create a brand new Supabase user as caregiver. After sign-in, lands on ProfileBasicsStep (not CaregiverHome).
2. **Full flow** — Complete all 6 steps without skipping. Ends on CaregiverHome with no reminder banner visible.
3. **Skip path** — Complete ProfileBasics, skip story, siblings, smart home, phone, and paywall. Ends on CaregiverHome. Yellow "Start your 7-day trial" reminder banner is visible.
4. **Resume** — Close the app mid-onboarding (after completing ProfileStory). Relaunch. App resumes at InviteSiblingsStep (first incomplete step after story).
5. **Backend progress** — After completing some steps, `GET /api/profiles/:patientId/onboarding` reflects the correct progress object.
6. **Completion** — Once all 6 steps complete, `completedAt` is set; next app open routes directly to CaregiverHome.
