# Help Request History & Resolution Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add caregiver notes/cause-tagging to resolved help requests, a history screen, and patient-side feedback when their request is handled.

**Architecture:** Extend the `help_alerts` MongoDB collection with `cancelled`, `resolved`, `note`, `cause`, `resolved_at` fields. Add a `/resolve` backend endpoint (caregiver-side). A shared `ResolveSheet` component handles cause + note input before resolving. The patient polls every 15s and detects when their active alert flips to `resolved: true`, showing a brief "Handled" confirmation. The caregiver Alerts tab gains a collapsible Today's History section; a new `HelpHistoryScreen` shows all-time records grouped by date.

**Tech Stack:** React Native + Expo, Express/TypeScript backend on Render, MongoDB Atlas, Zod validation, `react-native-gesture-handler` (existing), `@expo/vector-icons` Ionicons, existing `fonts/spacing/radius/colors` design tokens.

---

## Files

| File | Action | Purpose |
|---|---|---|
| `src/types/index.ts` | Modify | Add `cancelled`, `resolved`, `note`, `cause`, `resolved_at` to `HelpAlert` |
| `src/server-routes/helpAlerts.ts` | Modify | Add `cancelled: true` to dismiss, add `PATCH /:id/resolve` endpoint |
| `src/api/client.ts` | Modify | Add `resolveHelpAlert(id, note, cause)` function |
| `src/hooks/useHelpAlert.ts` | Modify | Add `resolveAlert(id, note, cause)` + `resolvedAlert` state for patient UI |
| `src/screens/patient/HelpScreen.tsx` | Modify | Show 3-second "handled" confirmation when active alert is resolved by caregiver |
| `src/components/ResolveSheet.tsx` | Create | Bottom sheet: cause tag picker + optional note text input |
| `src/screens/AlertsScreen.tsx` | Modify | Wire "Mark as handled" → ResolveSheet; add Today's History section |
| `src/navigation/RootNavigator.tsx` | Modify | Wire urgent overlay "Mark as Handled" → ResolveSheet |
| `src/screens/caregiver/HelpHistoryScreen.tsx` | Create | Full-screen history list grouped by date with cause chips and notes |
| `src/navigation/CaregiverTabNavigator.tsx` | Modify | Register HelpHistoryScreen in navigation stack |

---

## Task 1: Extend HelpAlert type and backend

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/server-routes/helpAlerts.ts`

- [ ] **Step 1: Extend the HelpAlert type**

In `src/types/index.ts`, replace the existing `HelpAlert` interface:

```typescript
export interface HelpAlert {
  id: string;
  patient_id?: string;
  timestamp: string;
  dismissed: boolean;
  cancelled?: boolean;
  resolved?: boolean;
  note?: string;
  cause?: string;
  resolved_at?: string;
}
```

- [ ] **Step 2: Update alertOut in helpAlerts.ts to include new fields**

In `src/server-routes/helpAlerts.ts`, replace the `alertOut` function:

```typescript
function alertOut(doc: any) {
  return {
    id: String(doc._id),
    patient_id: String(doc.patient_id),
    timestamp: doc.timestamp,
    dismissed: doc.dismissed ?? false,
    cancelled: doc.cancelled ?? false,
    resolved: doc.resolved ?? false,
    note: doc.note ?? null,
    cause: doc.cause ?? null,
    resolved_at: doc.resolved_at ?? null,
  };
}
```

- [ ] **Step 3: Update dismiss endpoint to mark as cancelled**

In `src/server-routes/helpAlerts.ts`, update the dismiss PATCH handler's `$set` to also set `cancelled: true`:

```typescript
{ $set: { dismissed: true, cancelled: true } }
```

The full updated dismiss route:

```typescript
// PATCH /api/help-alerts/:alertId/dismiss
router.patch("/:alertId/dismiss", authMiddleware, resolvePatientId, async (req, res) => {
  if (!ObjectId.isValid(String(req.params.alertId))) {
    res.status(400).json({ detail: "Invalid ID" });
    return;
  }
  try {
    const db = getDb();
    const result = await db.collection("help_alerts").updateOne(
      { _id: new ObjectId(String(req.params.alertId)), patient_id: req.patientId! },
      { $set: { dismissed: true, cancelled: true } }
    );
    if (result.matchedCount === 0) {
      res.status(404).json({ detail: "Help alert not found" });
      return;
    }
    const doc = await db.collection("help_alerts").findOne({ _id: new ObjectId(String(req.params.alertId)) });
    if (!doc) {
      res.status(404).json({ detail: "Help alert not found" });
      return;
    }
    res.json(alertOut(doc));
  } catch (err) {
    console.error("dismiss help alert error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});
```

- [ ] **Step 4: Add the resolve endpoint**

Add this after the dismiss route in `src/server-routes/helpAlerts.ts`. Add the zod import at the top of the file first:

```typescript
import { z } from "zod";
```

Then add the resolve schema and route:

```typescript
const VALID_CAUSES = ["Confusion", "Pain", "Anxiety", "Fell", "Wandered", "Sundowning", "Other"] as const;

const resolveSchema = z.object({
  note: z.string().max(500).trim().optional(),
  cause: z.enum(VALID_CAUSES),
});

// PATCH /api/help-alerts/:alertId/resolve
router.patch("/:alertId/resolve", authMiddleware, resolvePatientId, async (req, res) => {
  if (!ObjectId.isValid(String(req.params.alertId))) {
    res.status(400).json({ detail: "Invalid ID" });
    return;
  }
  const parsed = resolveSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ detail: parsed.error.issues[0].message });
    return;
  }
  try {
    const db = getDb();
    const updates: any = {
      dismissed: true,
      resolved: true,
      cause: parsed.data.cause,
      resolved_at: new Date().toISOString(),
    };
    if (parsed.data.note) updates.note = parsed.data.note;

    const result = await db.collection("help_alerts").updateOne(
      { _id: new ObjectId(String(req.params.alertId)), patient_id: req.patientId! },
      { $set: updates }
    );
    if (result.matchedCount === 0) {
      res.status(404).json({ detail: "Help alert not found" });
      return;
    }
    const doc = await db.collection("help_alerts").findOne({ _id: new ObjectId(String(req.params.alertId)) });
    if (!doc) {
      res.status(404).json({ detail: "Help alert not found" });
      return;
    }
    res.json(alertOut(doc));
  } catch (err) {
    console.error("resolve help alert error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});
```

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts src/server-routes/helpAlerts.ts
git commit -m "feat: extend help_alerts with cancelled/resolved/note/cause fields and /resolve endpoint"
```

---

## Task 2: Add resolveHelpAlert to API client and hook

**Files:**
- Modify: `src/api/client.ts`
- Modify: `src/hooks/useHelpAlert.ts`

- [ ] **Step 1: Add resolveHelpAlert to client.ts**

In `src/api/client.ts`, after the `dismissHelpAlert` function, add:

```typescript
export async function resolveHelpAlert(id: string, cause: string, note?: string): Promise<HelpAlert> {
  return request<HelpAlert>(`/api/help-alerts/${id}/resolve`, {
    method: "PATCH",
    body: JSON.stringify({ cause, note }),
  });
}
```

Also add `resolveHelpAlert` to the import list at the top of the file (it's a local function, so no import needed — just confirm it's exported).

- [ ] **Step 2: Add resolveAlert to useHelpAlert hook**

In `src/hooks/useHelpAlert.ts`, add `resolveHelpAlert` to the imports at the top:

```typescript
import {
  fetchHelpAlerts,
  createHelpAlert,
  dismissHelpAlert,
  resolveHelpAlert,
} from "../api/client";
```

Then add `resolveAlert` after `dismissAlert`:

```typescript
const resolveAlert = useCallback(async (id: string, cause: string, note?: string) => {
  try {
    const updated = await resolveHelpAlert(id, cause, note);
    setAlerts((prev) => prev.map((a) => (a.id === id ? updated : a)));
  } catch (e: any) {
    throw e;
  }
}, []);
```

Update the return statement to include `resolveAlert`:

```typescript
return { alerts, pendingCount, sending, sentAt, sendError, sendHelp, dismissAlert, resolveAlert, clearSentState, reload: load };
```

- [ ] **Step 3: Commit**

```bash
git add src/api/client.ts src/hooks/useHelpAlert.ts
git commit -m "feat: add resolveHelpAlert API function and resolveAlert hook method"
```

---

## Task 3: Patient side — show "handled" confirmation

**Files:**
- Modify: `src/screens/patient/HelpScreen.tsx`

When the patient's active (non-cancelled) alert gets `resolved: true` from polling, show the "Your caregiver is on the way ✓" state for 3 seconds then reset.

- [ ] **Step 1: Add handled detection logic**

In `src/screens/patient/HelpScreen.tsx`, after the existing hook destructuring, add:

```typescript
const [handledVisible, setHandledVisible] = useState(false);
const prevAlertsRef = useRef<typeof alerts>([]);

useEffect(() => {
  const prev = prevAlertsRef.current;
  prevAlertsRef.current = alerts;

  // Detect when an alert we sent (not cancelled) just got resolved by caregiver
  const justResolved = alerts.find(
    (a) => a.resolved && !a.cancelled && !prev.find((p) => p.id === a.id)?.resolved
  );
  if (justResolved) {
    setHandledVisible(true);
    clearSentState();
    setTimeout(() => setHandledVisible(false), 3000);
  }
}, [alerts]);
```

Also add `useState` and `useRef` to the imports if not already present (they already are).

- [ ] **Step 2: Show the handled state in the button**

The `handlePress` should not fire when `handledVisible`. Update the disabled check and button content:

```typescript
// Change the disabled prop:
disabled={sent || sending || handledVisible}

// Change the button content — add a new condition before `sent`:
{handledVisible ? (
  <>
    <Ionicons name="checkmark-circle" size={72} color="#FFFFFF" />
    <Text style={styles.btnLabelSent}>{"Your caregiver\nis on the way!"}</Text>
  </>
) : sent ? (
  <>
    <Ionicons name="checkmark-circle" size={72} color="#FFFFFF" />
    <Text style={styles.btnLabelSent}>{"Help is on\nthe way!"}</Text>
  </>
) : sending ? (
  <>
    <Ionicons name="radio-outline" size={72} color="#FFFFFF" />
    <Text style={styles.btnLabelSent}>Sending…</Text>
  </>
) : (
  <>
    <Ionicons name="hand-left" size={72} color="#FFFFFF" />
    <Text style={styles.btnLabel}>I Need Help</Text>
  </>
)}
```

Update the header text too — add a condition for `handledVisible`:

```typescript
<Text style={styles.headerTitle}>
  {handledVisible ? "Help is coming!" : sent ? "Help is coming!" : "Need help?"}
</Text>
<Text style={styles.headerSub}>
  {handledVisible ? (
    <Text><Text style={styles.headerSubName}>{caregiverDisplay}</Text> is on their way.</Text>
  ) : sent ? (
    <Text><Text style={styles.headerSubName}>{caregiverDisplay}</Text> has been notified.</Text>
  ) : (
    <Text>Don't worry, <Text style={styles.headerSubName}>{patientName}</Text>. We're here.</Text>
  )}
</Text>
```

Hide the Cancel button when `handledVisible`:

```typescript
{sent && !handledVisible && (
  <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel} activeOpacity={0.75}>
    <Text style={styles.cancelBtnText}>Cancel Request</Text>
  </TouchableOpacity>
)}
```

- [ ] **Step 3: Commit**

```bash
git add src/screens/patient/HelpScreen.tsx
git commit -m "feat: patient sees 3-second handled confirmation when caregiver resolves request"
```

---

## Task 4: ResolveSheet component

**Files:**
- Create: `src/components/ResolveSheet.tsx`

This is a bottom sheet Modal used by both AlertsScreen and the urgent overlay in RootNavigator. It shows cause tag chips and an optional note text input.

- [ ] **Step 1: Create ResolveSheet.tsx**

```typescript
import React, { useState, useMemo } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useTheme } from "../context/ThemeContext";
import { fonts, spacing, radius } from "../config/theme";

export const HELP_CAUSES = ["Confusion", "Pain", "Anxiety", "Fell", "Wandered", "Sundowning", "Other"] as const;
export type HelpCause = typeof HELP_CAUSES[number];

interface ResolveSheetProps {
  visible: boolean;
  onResolve: (cause: HelpCause, note: string) => void;
  onSkip: () => void;
  onCancel: () => void;
}

export function ResolveSheet({ visible, onResolve, onSkip, onCancel }: ResolveSheetProps) {
  const { colors } = useTheme();
  const [selectedCause, setSelectedCause] = useState<HelpCause | null>(null);
  const [note, setNote] = useState("");

  function handleResolve() {
    if (!selectedCause) return;
    onResolve(selectedCause, note.trim());
    setSelectedCause(null);
    setNote("");
  }

  function handleSkip() {
    setSelectedCause(null);
    setNote("");
    onSkip();
  }

  function handleCancel() {
    setSelectedCause(null);
    setNote("");
    onCancel();
  }

  const styles = useMemo(() => StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.45)",
      justifyContent: "flex-end",
    },
    sheet: {
      backgroundColor: colors.bg,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: spacing.xl,
      paddingBottom: 40,
    },
    handle: {
      width: 40,
      height: 4,
      backgroundColor: colors.border,
      borderRadius: 2,
      alignSelf: "center",
      marginBottom: spacing.lg,
    },
    title: {
      fontSize: 20,
      color: colors.text,
      ...fonts.medium,
      marginBottom: spacing.xs,
    },
    subtitle: {
      fontSize: 13,
      color: colors.muted,
      ...fonts.regular,
      marginBottom: spacing.lg,
    },
    sectionLabel: {
      fontSize: 11,
      color: colors.muted,
      ...fonts.medium,
      letterSpacing: 1.2,
      textTransform: "uppercase",
      marginBottom: spacing.sm,
    },
    causeRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },
    causeChip: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: radius.pill,
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    causeChipSelected: {
      borderColor: colors.coral,
      backgroundColor: colors.coralSoft,
    },
    causeChipText: {
      fontSize: 13,
      color: colors.muted,
      ...fonts.medium,
    },
    causeChipTextSelected: {
      color: colors.coral,
    },
    noteInput: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      fontSize: 14,
      color: colors.text,
      ...fonts.regular,
      minHeight: 72,
      textAlignVertical: "top",
      marginBottom: spacing.lg,
    },
    btnRow: {
      flexDirection: "row",
      gap: spacing.md,
    },
    btnSkip: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: radius.pill,
      borderWidth: 1.5,
      borderColor: colors.border,
      alignItems: "center",
    },
    btnSkipText: {
      fontSize: 14,
      color: colors.muted,
      ...fonts.medium,
    },
    btnResolve: {
      flex: 2,
      paddingVertical: 14,
      borderRadius: radius.pill,
      backgroundColor: colors.coral,
      alignItems: "center",
    },
    btnResolveDisabled: {
      backgroundColor: colors.border,
    },
    btnResolveText: {
      fontSize: 14,
      color: "#FFFFFF",
      ...fonts.medium,
    },
    btnCancelRow: {
      marginTop: spacing.md,
      alignItems: "center",
    },
    btnCancelText: {
      fontSize: 13,
      color: colors.muted,
      ...fonts.regular,
    },
  }), [colors]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleCancel}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>What happened?</Text>
          <Text style={styles.subtitle}>Select a cause to log this request. This helps track patterns over time.</Text>

          <Text style={styles.sectionLabel}>Cause</Text>
          <View style={styles.causeRow}>
            {HELP_CAUSES.map((cause) => (
              <TouchableOpacity
                key={cause}
                style={[styles.causeChip, selectedCause === cause && styles.causeChipSelected]}
                onPress={() => setSelectedCause(cause)}
                activeOpacity={0.75}
              >
                <Text style={[styles.causeChipText, selectedCause === cause && styles.causeChipTextSelected]}>
                  {cause}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.sectionLabel}>Note (optional)</Text>
          <TextInput
            style={styles.noteInput}
            value={note}
            onChangeText={setNote}
            placeholder="e.g. Patient was disoriented, needed reassurance"
            placeholderTextColor={colors.muted}
            multiline
            maxLength={500}
          />

          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.btnSkip} onPress={handleSkip} activeOpacity={0.75}>
              <Text style={styles.btnSkipText}>Skip</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btnResolve, !selectedCause && styles.btnResolveDisabled]}
              onPress={handleResolve}
              disabled={!selectedCause}
              activeOpacity={0.85}
            >
              <Text style={styles.btnResolveText}>Mark as Handled</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.btnCancelRow} onPress={handleCancel} activeOpacity={0.7}>
            <Text style={styles.btnCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ResolveSheet.tsx
git commit -m "feat: ResolveSheet component — cause tag picker + optional note"
```

---

## Task 5: Wire ResolveSheet into AlertsScreen

**Files:**
- Modify: `src/screens/AlertsScreen.tsx`

Replace the existing "Mark as handled" direct-dismiss flow with ResolveSheet. Also add a "Today's History" section below pending requests.

- [ ] **Step 1: Add imports and state**

Add to the imports in `src/screens/AlertsScreen.tsx`:

```typescript
import { useState } from "react";
import { ResolveSheet, HelpCause } from "../components/ResolveSheet";
```

Update the hook destructure to include `resolveAlert`:

```typescript
const { alerts: helpAlerts, dismissAlert: dismissHelp, resolveAlert, reload: reloadHelp } = useHelpAlert();
```

Add state for the sheet:

```typescript
const [resolvingId, setResolvingId] = useState<string | null>(null);
```

- [ ] **Step 2: Update the dismiss handler and add resolve handler**

Replace the `dismissHelp` call in the map with `setResolvingId`:

```typescript
// In pendingHelp.map:
<TouchableOpacity
  style={styles.helpDismissBtn}
  onPress={() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setResolvingId(alert.id);
  }}
  activeOpacity={0.85}
  accessibilityRole="button"
  accessibilityLabel="Mark help request as handled"
>
  <Text style={styles.helpDismissText}>Mark as handled</Text>
</TouchableOpacity>
```

- [ ] **Step 3: Add Today's History section**

After the pending help section, add a history section in the JSX. Add this after the closing `</View>` of the Help Requests section and before the Face Recognition section:

```typescript
{/* ── Today's History ── */}
{(() => {
  const today = new Date().toISOString().slice(0, 10);
  const todayHistory = helpAlerts.filter(
    (a) => (a.resolved || a.cancelled) && a.timestamp.slice(0, 10) === today
  );
  if (todayHistory.length === 0) return null;
  return (
    <View style={styles.section}>
      <View style={styles.sectionLabelRow}>
        <View style={[styles.sectionDot, { backgroundColor: colors.muted }]} />
        <Text style={[styles.sectionLabel, { color: colors.muted }]}>Today's History</Text>
      </View>
      {todayHistory.map((alert) => (
        <View key={alert.id} style={styles.historyCard}>
          <View style={styles.historyLeft}>
            <Text style={styles.historyTime}>{formatRelativeTime(alert.timestamp)}</Text>
            {alert.cause && (
              <View style={[styles.causePill, alert.cancelled && styles.causePillCancelled]}>
                <Text style={[styles.causePillText, alert.cancelled && styles.causePillTextCancelled]}>
                  {alert.cancelled ? "Cancelled" : alert.cause}
                </Text>
              </View>
            )}
            {alert.cancelled && !alert.cause && (
              <View style={styles.causePillCancelled}>
                <Text style={styles.causePillTextCancelled}>Cancelled</Text>
              </View>
            )}
          </View>
          {alert.note ? (
            <Text style={styles.historyNote} numberOfLines={2}>{alert.note}</Text>
          ) : null}
        </View>
      ))}
      <TouchableOpacity
        style={styles.viewAllBtn}
        onPress={() => (navigation as any).navigate("HelpHistory")}
        activeOpacity={0.8}
      >
        <Text style={styles.viewAllText}>View All History →</Text>
      </TouchableOpacity>
    </View>
  );
})()}
```

Note: `navigation` needs to be passed as a prop or accessed via `useNavigation`. Use `useNavigation` from `@react-navigation/native`:

```typescript
import { useNavigation } from "@react-navigation/native";
// inside component:
const navigation = useNavigation();
```

- [ ] **Step 4: Add new styles**

Add to the `StyleSheet.create` in `AlertsScreen`:

```typescript
historyCard: {
  backgroundColor: colors.surface,
  borderRadius: radius.lg,
  padding: spacing.md,
  marginBottom: spacing.sm,
  gap: spacing.xs,
},
historyLeft: {
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.sm,
  flexWrap: "wrap",
},
historyTime: {
  fontSize: 13,
  color: colors.muted,
  ...fonts.regular,
},
causePill: {
  backgroundColor: colors.coralSoft,
  borderRadius: radius.pill,
  paddingHorizontal: spacing.md,
  paddingVertical: 3,
},
causePillCancelled: {
  backgroundColor: colors.surface,
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: radius.pill,
  paddingHorizontal: spacing.md,
  paddingVertical: 3,
},
causePillText: {
  fontSize: 11,
  color: colors.coral,
  ...fonts.medium,
},
causePillTextCancelled: {
  fontSize: 11,
  color: colors.muted,
  ...fonts.medium,
},
historyNote: {
  fontSize: 12,
  color: colors.muted,
  ...fonts.regular,
  lineHeight: 18,
},
viewAllBtn: {
  marginTop: spacing.sm,
  alignItems: "flex-end",
},
viewAllText: {
  fontSize: 13,
  color: colors.violet,
  ...fonts.medium,
},
```

- [ ] **Step 5: Add ResolveSheet to JSX and wire handlers**

At the bottom of the component return, before the closing `</View>`, add:

```typescript
<ResolveSheet
  visible={resolvingId !== null}
  onResolve={async (cause: HelpCause, note: string) => {
    if (!resolvingId) return;
    try {
      await resolveAlert(resolvingId, cause, note || undefined);
    } catch {
      // silently fail — polling will reconcile
    }
    setResolvingId(null);
  }}
  onSkip={async () => {
    if (!resolvingId) return;
    try { await dismissHelp(resolvingId); } catch { /* ignore */ }
    setResolvingId(null);
  }}
  onCancel={() => setResolvingId(null)}
/>
```

- [ ] **Step 6: Commit**

```bash
git add src/screens/AlertsScreen.tsx
git commit -m "feat: wire ResolveSheet into Alerts tab, add Today's History section"
```

---

## Task 6: Wire ResolveSheet into the urgent overlay

**Files:**
- Modify: `src/navigation/RootNavigator.tsx`

The urgent overlay's "Mark as Handled" button currently calls `dismissHelp` directly. Change it to open the ResolveSheet instead.

- [ ] **Step 1: Add imports and state to CaregiverView**

Add to the top of `RootNavigator.tsx`:

```typescript
import { ResolveSheet, HelpCause } from "../components/ResolveSheet";
```

In `CaregiverView`, add:

```typescript
const [resolveSheetVisible, setResolveSheetVisible] = useState(false);
```

Update `useHelpAlert` destructure to include `resolveAlert`:

```typescript
const { alerts: helpAlerts, pendingCount, dismissAlert: dismissHelp, resolveAlert } = useHelpAlert();
```

- [ ] **Step 2: Change the "Mark as Handled" button in urgent overlay**

In the urgent overlay JSX, change `handleMarkHandled` to open the sheet:

```typescript
<TouchableOpacity style={styles.btnHandled} onPress={() => setResolveSheetVisible(true)} activeOpacity={0.85}>
  <Text style={styles.btnHandledText}>Mark as Handled</Text>
</TouchableOpacity>
```

- [ ] **Step 3: Add ResolveSheet to CaregiverView JSX**

After the urgent overlay block (before the closing `</View>`):

```typescript
<ResolveSheet
  visible={resolveSheetVisible}
  onResolve={async (cause: HelpCause, note: string) => {
    if (latestAlert) {
      try { await resolveAlert(latestAlert.id, cause, note || undefined); } catch { /* ignore */ }
    }
    setResolveSheetVisible(false);
    setUrgentVisible(false);
  }}
  onSkip={async () => {
    if (latestAlert) {
      try { await dismissHelp(latestAlert.id); } catch { /* ignore */ }
    }
    setResolveSheetVisible(false);
    setUrgentVisible(false);
  }}
  onCancel={() => setResolveSheetVisible(false)}
/>
```

- [ ] **Step 4: Commit**

```bash
git add src/navigation/RootNavigator.tsx
git commit -m "feat: urgent overlay Mark as Handled opens ResolveSheet"
```

---

## Task 7: HelpHistoryScreen

**Files:**
- Create: `src/screens/caregiver/HelpHistoryScreen.tsx`

Full-screen list of all help alerts, grouped by date, with cause chips and notes.

- [ ] **Step 1: Create HelpHistoryScreen.tsx**

```typescript
import React, { useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useHelpAlert } from "../../hooks/useHelpAlert";
import { useTheme } from "../../context/ThemeContext";
import { fonts, spacing, radius } from "../../config/theme";
import { formatRelativeTime, formatTimeShort } from "../../hooks/useDashboardData";
import { HelpAlert } from "../../types";

function groupByDate(alerts: HelpAlert[]): { date: string; items: HelpAlert[] }[] {
  const map = new Map<string, HelpAlert[]>();
  for (const a of alerts) {
    const d = a.timestamp.slice(0, 10);
    if (!map.has(d)) map.set(d, []);
    map.get(d)!.push(a);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, items]) => ({ date, items }));
}

function formatDateLabel(iso: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (iso === today) return "Today";
  if (iso === yesterday) return "Yesterday";
  return new Date(iso).toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
}

const CAUSE_COLORS: Record<string, string> = {
  Confusion: "#7B5CE7",
  Pain: "#E74C3C",
  Anxiety: "#E8934A",
  Fell: "#C0392B",
  Wandered: "#2980B9",
  Sundowning: "#8E44AD",
  Other: "#7F8C8D",
};

export function HelpHistoryScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const { alerts, reload } = useHelpAlert();
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  const allHandled = alerts.filter((a) => a.dismissed);
  const grouped = useMemo(() => groupByDate(allHandled), [allHandled]);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.lg,
      paddingBottom: spacing.md,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
    },
    backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
    headerTitle: { fontSize: 24, color: colors.text, ...fonts.medium },
    content: { paddingBottom: 80 },
    dateGroup: { marginBottom: spacing.xxl },
    dateLabel: {
      fontSize: 13,
      color: colors.muted,
      ...fonts.medium,
      letterSpacing: 0.5,
      paddingHorizontal: spacing.xl,
      marginBottom: spacing.sm,
    },
    alertCard: {
      marginHorizontal: spacing.xl,
      marginBottom: spacing.sm,
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      padding: spacing.lg,
      borderLeftWidth: 3,
    },
    alertTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: spacing.xs,
    },
    alertTime: { fontSize: 13, color: colors.muted, ...fonts.regular },
    statusBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
      borderRadius: radius.pill,
    },
    statusText: { fontSize: 11, ...fonts.medium },
    causeRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.xs },
    causeDot: { width: 8, height: 8, borderRadius: 4 },
    causeText: { fontSize: 13, color: colors.text, ...fonts.medium },
    noteText: {
      fontSize: 13,
      color: colors.muted,
      ...fonts.regular,
      marginTop: spacing.sm,
      lineHeight: 20,
    },
    emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80, gap: spacing.md },
    emptyText: { fontSize: 16, color: colors.muted, ...fonts.regular },
  }), [colors]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help History</Text>
      </View>

      {grouped.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="time-outline" size={44} color={colors.border} />
          <Text style={styles.emptyText}>No help requests yet</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.violet} />}
          showsVerticalScrollIndicator={false}
        >
          {grouped.map(({ date, items }) => (
            <View key={date} style={styles.dateGroup}>
              <Text style={styles.dateLabel}>{formatDateLabel(date)}</Text>
              {items.map((alert) => {
                const isResolved = alert.resolved && !alert.cancelled;
                const isCancelled = alert.cancelled;
                const causeColor = alert.cause ? (CAUSE_COLORS[alert.cause] ?? colors.muted) : colors.muted;
                const borderColor = isCancelled ? colors.border : isResolved ? colors.coral : colors.amber;
                return (
                  <View key={alert.id} style={[styles.alertCard, { borderLeftColor: borderColor }]}>
                    <View style={styles.alertTop}>
                      <Text style={styles.alertTime}>{formatTimeShort(alert.timestamp)}</Text>
                      <View style={[styles.statusBadge, {
                        backgroundColor: isCancelled ? colors.surface : isResolved ? colors.coralSoft : colors.amberSoft,
                      }]}>
                        <Text style={[styles.statusText, {
                          color: isCancelled ? colors.muted : isResolved ? colors.coral : colors.amber,
                        }]}>
                          {isCancelled ? "Cancelled" : "Handled"}
                        </Text>
                      </View>
                    </View>

                    {alert.cause && !isCancelled && (
                      <View style={styles.causeRow}>
                        <View style={[styles.causeDot, { backgroundColor: causeColor }]} />
                        <Text style={styles.causeText}>{alert.cause}</Text>
                      </View>
                    )}

                    {alert.note ? (
                      <Text style={styles.noteText}>"{alert.note}"</Text>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/caregiver/HelpHistoryScreen.tsx
git commit -m "feat: HelpHistoryScreen — all-time help requests grouped by date with cause and notes"
```

---

## Task 8: Register HelpHistoryScreen in navigation

**Files:**
- Modify: `src/navigation/CaregiverTabNavigator.tsx`

The caregiver tab navigator needs to become a stack navigator that can push `HelpHistoryScreen`.

- [ ] **Step 1: Wrap CaregiverTabNavigator in a stack**

The cleanest approach: create a `CaregiverStackNavigator` that sits above the tabs and handles `HelpHistoryScreen`. In `RootNavigator.tsx`, the caregiver path currently renders `<CaregiverTabNavigator helpPendingCount={pendingCount} />`. Wrap this in a new stack.

Add to `RootNavigator.tsx` imports:

```typescript
import { createStackNavigator } from "@react-navigation/stack";
import { HelpHistoryScreen } from "../screens/caregiver/HelpHistoryScreen";
```

Install if not present: `@react-navigation/stack` — check `package.json` first:

```bash
grep "@react-navigation/stack" package.json
```

If missing, install:

```bash
npx expo install @react-navigation/stack
```

Create the stack inside `CaregiverView` in `RootNavigator.tsx`:

```typescript
const CaregiverStack = createStackNavigator();
```

Wrap the caregiver render inside `CaregiverView` — replace `<CaregiverTabNavigator ... />` with:

```typescript
<NavigationContainer independent={true}>
  <CaregiverStack.Navigator screenOptions={{ headerShown: false }}>
    <CaregiverStack.Screen name="CaregiverTabs">
      {() => <CaregiverTabNavigator helpPendingCount={pendingCount} />}
    </CaregiverStack.Screen>
    <CaregiverStack.Screen name="HelpHistory" component={HelpHistoryScreen} />
  </CaregiverStack.Navigator>
</NavigationContainer>
```

**Important:** If the app already uses a top-level `NavigationContainer` in `App.tsx`, using `independent={true}` on an inner one is required. Check `App.tsx` first.

```bash
grep -n "NavigationContainer" /Users/haadisiddiqui/projects/VVision-App/App.tsx
```

If `NavigationContainer` already wraps the whole app, use `useNavigation` from `@react-navigation/native` in `AlertsScreen` and `HelpHistoryScreen` (which is already in the plan). The `"HelpHistory"` screen will be reachable via `navigation.navigate("HelpHistory")` from anywhere within the navigator.

- [ ] **Step 2: Verify navigation wiring**

Run the app and navigate: Alerts tab → Today's History → "View All History →" → should push HelpHistoryScreen with a back arrow. Tap back → returns to Alerts tab.

- [ ] **Step 3: Commit**

```bash
git add src/navigation/CaregiverTabNavigator.tsx src/navigation/RootNavigator.tsx
git commit -m "feat: register HelpHistoryScreen in caregiver navigation stack"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Patient side reflects caregiver resolve (Task 3 — 3-second "on the way" then reset)
- ✅ Help calls auto-logged (already in DB; history shows all dismissed alerts)
- ✅ Caregiver history tab — Today's History in Alerts tab (Task 5), all-time via HelpHistoryScreen (Task 7)
- ✅ Caregiver note + cause on handled request — ResolveSheet (Task 4), wired in Task 5 + 6
- ✅ History shows cause/note details (Task 7 — HelpHistoryScreen cards)
- ✅ Backend updated — cancelled flag, resolve endpoint (Task 1)

**Placeholder scan:** None found.

**Type consistency:**
- `HelpCause` defined in `ResolveSheet.tsx` and used in `AlertsScreen.tsx` and `RootNavigator.tsx` ✅
- `resolveAlert(id, cause, note?)` signature consistent across hook, client, and both call sites ✅
- `HelpAlert.cause`, `.note`, `.resolved`, `.cancelled`, `.resolved_at` defined in Task 1 and used in Tasks 3, 5, 7 ✅
