# Hardware Features Archive

These are the glasses-hardware, face-recognition, and device-syncing features that
were **removed from the shipping app** so it could pass App Store review while the
VelaVision glasses don't yet exist. Apple flagged the app for referencing hardware
that isn't available.

Nothing here was deleted — it was moved out of `src/` so it doesn't build or ship.
When the glasses launch, follow the steps below to put it all back.

A full snapshot of the code **before** removal also lives on the git branch
`feature/hardware-glasses` — if anything below is unclear, diff against that branch.

---

## What's archived (and where it came from)

| Archived file | Original location |
|---|---|
| `src/screens/patient/FacesScreen.tsx` | `src/screens/patient/FacesScreen.tsx` |
| `src/screens/PeopleScreen.tsx` | `src/screens/PeopleScreen.tsx` |
| `src/screens/TimelineScreen.tsx` | `src/screens/TimelineScreen.tsx` |
| `src/components/PersonCard.tsx` | `src/components/PersonCard.tsx` |
| `src/components/GlassesComingSoon.tsx` | `src/components/GlassesComingSoon.tsx` |
| `src/components/GlassesComingSoon.test.tsx` | `src/components/GlassesComingSoon.test.tsx` |
| `src/screens/caregiver/GlassesHubScreen.tsx` | `src/screens/caregiver/GlassesHubScreen.tsx` |
| `src/screens/caregiver/GlassesAlertFeedScreen.tsx` | `src/screens/caregiver/GlassesAlertFeedScreen.tsx` |
| `src/screens/caregiver/DailyDigestScreen.tsx` | `src/screens/caregiver/DailyDigestScreen.tsx` |
| `src/screens/caregiver/NutritionTimelineScreen.tsx` | `src/screens/caregiver/NutritionTimelineScreen.tsx` |
| `src/screens/caregiver/RepetitionPatternScreen.tsx` | `src/screens/caregiver/RepetitionPatternScreen.tsx` |
| `src/screens/caregiver/PatientProfileConfigScreen.tsx` | `src/screens/caregiver/PatientProfileConfigScreen.tsx` |

---

## What was changed in the live app (and must be reverted to restore)

1. **`src/navigation/PatientTabNavigator.tsx`** — removed the **Faces** tab
   (import, `iconNames` entry, `<Tab.Screen name="Faces">`).

2. **`src/navigation/CaregiverTabNavigator.tsx`** — removed the **Timeline** and
   **People** tabs. The file was rewritten to drop the `useDashboardData()` hook (it
   fetched face/alert data) and the face-alert tab badge. Caregiver tabs are now just
   **Alerts | Patients | Care Team**.

3. **`src/screens/AlertsScreen.tsx`** — removed the **"AI Detection"** section
   (unrecognized-face alerts) and its styles. The screen now takes **no props** and
   gets its help-request data from `useHelpAlert()` directly. Restore: re-add the
   `alerts`/`loading`/`onRefresh` props and the face section.

4. **`src/navigation/RootNavigator.tsx`** — removed the 6 `Glasses*` screen imports
   and their 6 `<CaregiverStack.Screen>` routes (GlassesHub, GlassesAlerts,
   GlassesDigest, GlassesNutrition, GlassesRepetitions, GlassesConfig).

5. **`src/hooks/useDashboardData.ts`** — the `useDashboardData()` hook plus
   `computeStats()` / `buildTimeline()` were removed (they consumed face-recognition
   data). The shared time helpers `formatRelativeTime` / `formatTimeShort` were kept
   because the rest of the app uses them. Restore the hook from the git branch.

6. **`tsconfig.json`** and **`jest.config.js`** — added excludes so this
   `hardware-archive/` folder doesn't typecheck or run tests. Remove those excludes
   when restoring.

---

## What was NOT touched (still in the codebase, ready to use)

The **backend** was left fully intact — it isn't part of the app binary Apple reviews,
and it's needed the moment the glasses come online:

- `src/server-routes/people.ts` (face enroll/list/delete)
- `src/server-routes/device.ts` (device linking + glasses alert push)
- `src/server-routes/streamSessions.ts` (glasses live-stream tokens)
- `src/api/client.ts` — `fetchPeople`, `fetchAlerts`, `enrollFace`, `deletePerson`,
  `updateNotes` (now unused by the UI, but kept for restore)
- The `Person` / face-`Alert` types in `src/types/index.ts`

## One thing to review before resubmitting

`src/server-routes/assistant.ts` (the Vision AI system prompt) describes Vision as
*"built into smart glasses and a companion app."* If an App Store reviewer chats with
the assistant, it could mention glasses. Consider softening that line to "a companion
app" only until hardware ships. (Left unchanged here — it's a backend behavior change,
not a UI removal.)

---

## To restore (quick version)

1. `git mv` every file in this folder back to its original location (table above).
2. Revert the 6 live-app changes — easiest is to diff each file against the
   `feature/hardware-glasses` branch and cherry-pick the hardware parts back.
3. Remove the `hardware-archive` excludes from `tsconfig.json` and `jest.config.js`.
4. `npx tsc --noEmit` and `npm test` to confirm everything wires back up.
