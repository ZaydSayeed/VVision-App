# Patient UX Fixes — Design Spec
**Date:** 2026-05-05
**Status:** Approved

## Scope

Three changes to the patient-facing app:

1. **Bug fix** — task row: checkbox toggles completion, row tap opens detail sheet
2. **New Routine tab** — 5th tab (replaces the `_blank` placeholder), full tasks + meds view
3. **Home redesign** — two full-width stacked expandable cards instead of side-by-side split boxes

---

## 1. Task Row Fix (`TodayScreen.tsx`)

### Problem
The task row is one `TouchableOpacity` whose `onPress` opens `TaskDetailSheet`. The checkbox inside is a plain `View` — tapping it also opens the detail sheet instead of toggling completion. `toggleComplete` is never called from the row.

### Fix
Split into two touch targets:

```
<View style={rowStyle}>
  <TouchableOpacity onPress={() => toggleComplete(item.id)}>
    <CheckboxView done={item.done} color={colors.sage} />
  </TouchableOpacity>
  <TouchableOpacity style={{ flex: 1 }} onPress={() => setDetailTask(item.task)}>
    <Text>{item.label}</Text>
  </TouchableOpacity>
</View>
```

- The outer element is a plain `View` (not `TouchableOpacity`)
- Left: `TouchableOpacity` wrapping the checkbox — calls `toggleComplete(item.id)`
- Right: `TouchableOpacity` wrapping the label — calls `setDetailTask(item.task)` for tasks, or `onDelete` confirmation for reminders
- Reminders have no detail sheet — tapping a reminder label does nothing (label area is non-interactive for reminders)
- Same fix applies to the meds row: checkbox calls `toggleTaken(med.id)`, label area is non-interactive (meds have no detail sheet)

---

## 2. Routine Tab

### Nav bar changes (`PatientTabNavigator.tsx`)

Replace the hidden `_blank` tab with a real `Routine` tab. New order:

| Position | Tab | Icon |
|---|---|---|
| 1 | Home | `home` |
| 2 | Faces | `people` |
| 3 | **Help (FAB, centered)** | coral FAB |
| 4 | **Routine** | `list-outline` |
| 5 | Health | `pulse` |

The `iconNames` map gets `Routine: "list-outline"`. Remove the `_blank` screen and its `tabBarButton: () => null` hack.

### New screen (`src/screens/patient/RoutineScreen.tsx`)

Replaces the legacy `RoutineScreen.tsx` (which was merged into TodayScreen and is no longer in nav). New screen shows tasks and meds as a combined scrollable list:

**Structure:**
- `ScrollView` with pull-to-refresh (calls `reloadRoutine` + `reloadMeds`)
- **Tasks section** at top:
  - Section header "Tasks" with sage accent
  - Each task row: checkbox `TouchableOpacity` (calls `toggleComplete`) + label `TouchableOpacity` (opens `TaskDetailSheet`)
  - Progress bar at bottom of section (X of Y done)
  - "+ Add Task" button
- **Medications section** below:
  - Section header "Medications" with amber accent  
  - Each med row: checkbox `TouchableOpacity` (calls `toggleTaken`) + label text
  - Progress bar at bottom of section (X of Y taken)
  - "+ Add Med" button
- Reuses `useRoutine(patientId)` and `useMeds(patientId)` hooks
- Reuses `TaskDetailSheet` for task detail
- Add task and add med modals identical to TodayScreen (extract shared modal or inline same code)

**Not included:** Reminders are TodayScreen-only. RoutineScreen shows only `tasks` and `meds`.

---

## 3. Home Redesign (`TodayScreen.tsx`)

### Problem
Tasks and meds are in a `splitRow` with two `splitCard` side-by-side boxes. Small boxes limit readability, especially with many items.

### Fix
Replace `splitRow` + two `splitCard` with two full-width stacked cards:

**Tasks card** (full width, sage accent, stacked on top):
- White/surface background, `radius.xl`, sage left border (4px)
- Header row: "Tasks" label + sage progress pill ("3 of 5 done") + "+" button
- Each item: checkbox `TouchableOpacity` (toggles) + label `TouchableOpacity` (opens detail for tasks)
- No fixed height — card grows with content
- Progress bar at bottom

**Medications card** (full width, amber accent, below tasks):
- Same structure as tasks card but amber accent
- Each item: checkbox `TouchableOpacity` (toggles `toggleTaken`) + label text (non-interactive)
- No fixed height

The `splitRow`, `splitCard`, `splitItem`, `splitCheckbox`, `splitItemText`, `splitItemDone`, `splitFooter`, `splitProgress`, `splitProgressTrack`, `splitProgressFill`, `splitProgressText`, `splitPlusBtn`, `splitPlusBtnText` styles are all replaced with new `taskCard`, `medCard`, `cardHeader`, `cardItem`, `checkbox`, `itemLabel` etc. styles.

---

## Files Affected

| File | Change |
|---|---|
| `src/navigation/PatientTabNavigator.tsx` | Replace `_blank` with `Routine` tab |
| `src/screens/patient/RoutineScreen.tsx` | New screen — tasks + meds full view |
| `src/screens/patient/TodayScreen.tsx` | Fix task/med rows + redesign home cards |

---

## Error Handling

- If `useRoutine` or `useMeds` returns a load error, show a muted error message in the relevant section
- Pull-to-refresh works independently for each section (both hooks called in parallel)
- TaskDetailSheet already handles its own error states
