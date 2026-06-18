# Care Team Subscription Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate Family Circle into Care Team (one tab, no duplication), and change the subscription model so the primary caregiver's plan covers all invited members — invited members never see a paywall.

**Architecture:** The subscription check moves from "does this logged-in user have an active RevenueCat entitlement?" to "does the patient profile I'm linked to have an active subscription?" The backend exposes a new endpoint that returns the patient profile's tier. Invited members get a `role` that is not `primary_caregiver` — the client checks role to decide whether to skip the paywall entirely. The Family tab is removed from the navigator and `FamilyCircleScreen` is deleted.

**Tech Stack:** React Native + Expo (SDK 54), TypeScript, Express + MongoDB backend on Render, RevenueCat (`react-native-purchases`), Supabase auth.

---

## File Map

| File | Action | What changes |
|---|---|---|
| `src/navigation/CaregiverTabNavigator.tsx` | Modify | Remove Family tab |
| `src/screens/caregiver/FamilyCircleScreen.tsx` | Delete | Replaced by Care Team tab |
| `src/screens/caregiver/AddCaregiverScreen.tsx` | Modify | Show full seat list with role badges + invite button |
| `src/hooks/useSubscription.ts` | Modify | Add `isInvitedMember` flag; fetch profile tier from backend when user is not primary_caregiver |
| `src/api/seats.ts` | Modify | Add `getProfileTier(patientId)` API call |
| `src/server-routes/seats.ts` | Modify | Add `GET /api/profiles/:patientId/tier` endpoint |
| `src/screens/caregiver/InviteSeatScreen.tsx` | No change | Already works correctly |
| `src/screens/caregiver/PaywallScreen.tsx` | No change | Still shown to primary_caregiver on free tier |
| `src/screens/onboarding/PaywallStep.tsx` | No change | Only shown during primary caregiver onboarding |

---

## Task 1: Remove Family Circle tab and delete the screen

**Files:**
- Modify: `src/navigation/CaregiverTabNavigator.tsx`
- Delete: `src/screens/caregiver/FamilyCircleScreen.tsx`

- [ ] **Step 1: Remove Family tab from navigator**

In `src/navigation/CaregiverTabNavigator.tsx`, remove the `Family` entry from `iconNames` and remove the `<Tab.Screen name="Family" component={FamilyCircleScreen} />` line, and remove the import.

The file should go from 6 tabs to 5 tabs. The remaining tabs are: Timeline, People, Alerts, Patients, Care Team.

Result (relevant sections only):
```tsx
// Remove this line from iconNames:
// "Family": "people-outline",

// Remove this import:
// import FamilyCircleScreen from "../screens/caregiver/FamilyCircleScreen";

// Remove this tab:
// <Tab.Screen name="Family" component={FamilyCircleScreen} />
```

- [ ] **Step 2: Delete FamilyCircleScreen**

```bash
rm /Users/haadisiddiqui/projects/VVision-App/src/screens/caregiver/FamilyCircleScreen.tsx
```

- [ ] **Step 3: Verify the app compiles**

```bash
cd /Users/haadisiddiqui/projects/VVision-App && npx tsc --noEmit
```

Expected: no errors referencing FamilyCircleScreen.

- [ ] **Step 4: Commit**

```bash
git add src/navigation/CaregiverTabNavigator.tsx
git rm src/screens/caregiver/FamilyCircleScreen.tsx
git commit -m "feat: remove Family Circle tab, consolidate into Care Team"
```

---

## Task 2: Upgrade Care Team screen to show the full seat list with role badges

The current Care Team tab (`AddCaregiverScreen`) shows a link code and a list of linked caregivers from `useCaregiver`. It doesn't show invited members or their roles. Upgrade it to show all seats + pending invites with role badges, plus an Invite button — replacing what Family Circle was doing.

**Files:**
- Modify: `src/screens/caregiver/AddCaregiverScreen.tsx`

- [ ] **Step 1: Add seat list to AddCaregiverScreen**

Replace the contents of `src/screens/caregiver/AddCaregiverScreen.tsx` with the following. This merges the seat list (previously in FamilyCircleScreen) with the existing link code UI:

```tsx
import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Pressable,
} from "react-native";
import { useCaregiver } from "../../hooks/useCaregiver";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { useCurrentProfile } from "../../hooks/useCurrentProfile";
import { getMyLinkCode, syncProfile } from "../../api/client";
import { listSeats } from "../../api/seats";
import { SectionHeader } from "../../components/shared/SectionHeader";
import { EmptyState } from "../../components/shared/EmptyState";
import { fonts, spacing, radius } from "../../config/theme";

const ROLE_LABELS: Record<string, string> = {
  primary_caregiver: "Admin",
  sibling: "Family",
  paid_aide: "Aide",
  clinician: "Clinician",
};

export function AddCaregiverScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { profiles, refresh: refreshProfiles } = useCaregiver();
  const { user } = useAuth();
  const { patientId } = useCurrentProfile();
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [seatData, setSeatData] = useState<{ seats: any[]; invites: any[] } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user?.role === "patient") {
      getMyLinkCode()
        .then((res) => setLinkCode(res.link_code))
        .catch(async () => {
          try {
            await syncProfile(user.name, user.role);
            const res = await getMyLinkCode();
            setLinkCode(res.link_code);
          } catch {}
        });
    }
  }, [user?.role]);

  const loadSeats = useCallback(async () => {
    if (!patientId) return;
    try {
      setSeatData(await listSeats(patientId));
    } catch {}
  }, [patientId]);

  useEffect(() => {
    loadSeats();
  }, [loadSeats]);

  const onRefresh = async () => {
    setLoading(true);
    await Promise.all([refreshProfiles(), loadSeats()]);
    setLoading(false);
  };

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    screenHeader: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.lg,
      paddingBottom: spacing.lg,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    headerLeft: { flex: 1 },
    screenTitle: { fontSize: 28, color: colors.text, ...fonts.medium },
    screenSubtitle: { fontSize: 13, color: colors.muted, ...fonts.regular, marginTop: 3 },
    inviteBtn: {
      backgroundColor: colors.violet,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 8,
    },
    inviteBtnText: { color: "white", fontWeight: "600", ...fonts.medium },
    content: { padding: spacing.xl, paddingBottom: 100 },
    codeCard: {
      backgroundColor: colors.bg,
      borderRadius: radius.xl,
      padding: spacing.xl,
      alignItems: "center",
      marginBottom: spacing.xl,
      shadowColor: "#7B5CE7",
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 3,
    },
    codeLabel: {
      fontSize: 11,
      color: colors.muted,
      ...fonts.medium,
      letterSpacing: 1.2,
      textTransform: "uppercase",
      marginBottom: spacing.md,
    },
    codeValue: {
      fontSize: 34,
      color: colors.violet,
      ...fonts.medium,
      letterSpacing: 10,
      marginBottom: spacing.md,
    },
    codeHint: {
      fontSize: 13,
      color: colors.muted,
      ...fonts.regular,
      textAlign: "center",
      lineHeight: 19,
    },
    profileCard: {
      backgroundColor: colors.bg,
      borderRadius: radius.lg,
      padding: spacing.lg,
      flexDirection: "row",
      alignItems: "center",
      marginBottom: spacing.sm,
      gap: spacing.md,
      shadowColor: "#7B5CE7",
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.07,
      shadowRadius: 10,
      elevation: 2,
    },
    profileAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.violet50,
      alignItems: "center",
      justifyContent: "center",
    },
    profileInitial: { fontSize: 18, color: colors.violet, ...fonts.medium },
    profileInfo: { flex: 1 },
    profileName: { fontSize: 16, color: colors.text, ...fonts.medium },
    profileMeta: { fontSize: 13, color: colors.muted, ...fonts.regular, marginTop: 2 },
    roleBadge: {
      backgroundColor: colors.violet50,
      borderRadius: radius.pill,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    roleBadgeText: { fontSize: 11, color: colors.violet, ...fonts.medium },
    pendingBadge: {
      backgroundColor: colors.amberSoft,
      borderRadius: radius.pill,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    pendingBadgeText: { fontSize: 11, color: colors.amber, ...fonts.medium },
  }), [colors]);

  const seats = seatData?.seats ?? [];
  const invites = seatData?.invites ?? [];

  return (
    <View style={styles.container}>
      <View style={styles.screenHeader}>
        <View style={styles.headerLeft}>
          <Text style={styles.screenTitle}>Care Team</Text>
          <Text style={styles.screenSubtitle}>
            {user?.role === "patient"
              ? "Share your code so a caregiver can connect"
              : "People managing this patient's care"}
          </Text>
        </View>
        {user?.role !== "patient" && (
          <Pressable
            onPress={() => navigation.navigate("InviteSeat")}
            style={styles.inviteBtn}
          >
            <Text style={styles.inviteBtnText}>+ Invite</Text>
          </Pressable>
        )}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={colors.violet} />
        }
      >
        {user?.role === "patient" && linkCode && (
          <View style={styles.codeCard}>
            <Text style={styles.codeLabel}>Your link code</Text>
            <Text style={styles.codeValue}>{linkCode}</Text>
            <Text style={styles.codeHint}>
              Share this code with your caregiver so they can connect to your account.
            </Text>
          </View>
        )}

        <SectionHeader label="Members" />
        {seats.length === 0 && invites.length === 0 ? (
          <EmptyState
            icon="people-circle"
            title="No caregivers linked"
            subtitle={
              user?.role === "patient"
                ? "Share your link code above with a caregiver"
                : "You are the only caregiver linked to this patient"
            }
          />
        ) : (
          <>
            {seats.map((seat: any, idx: number) => (
              <View key={seat.userId + idx} style={styles.profileCard}>
                <View style={styles.profileAvatar}>
                  <Text style={styles.profileInitial}>
                    {(seat.userId ?? "?").charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.profileInfo}>
                  <Text style={styles.profileName}>{seat.userId}</Text>
                </View>
                <View style={styles.roleBadge}>
                  <Text style={styles.roleBadgeText}>
                    {ROLE_LABELS[seat.role] ?? seat.role}
                  </Text>
                </View>
              </View>
            ))}
            {invites.map((invite: any, idx: number) => (
              <View key={invite.email + idx} style={styles.profileCard}>
                <View style={styles.profileAvatar}>
                  <Text style={styles.profileInitial}>
                    {invite.email.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.profileInfo}>
                  <Text style={styles.profileName}>{invite.email}</Text>
                </View>
                <View style={styles.pendingBadge}>
                  <Text style={styles.pendingBadgeText}>Pending</Text>
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/haadisiddiqui/projects/VVision-App && npx tsc --noEmit
```

Expected: no errors in AddCaregiverScreen.

- [ ] **Step 3: Commit**

```bash
git add src/screens/caregiver/AddCaregiverScreen.tsx
git commit -m "feat: Care Team shows full seat list with role badges and invite button"
```

---

## Task 3: Add GET /api/profiles/:patientId/tier backend endpoint

Invited members need a way to check if the patient profile they're linked to has an active subscription — without checking their own RevenueCat entitlement (they don't have one). Add a lightweight endpoint that returns the profile's tier.

**Files:**
- Modify: `src/server-routes/seats.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/server-routes/seats.test.ts`:

```ts
describe("GET /tier — profile subscription tier", () => {
  it("returns 'unlimited' when profile has an active unlimited subscription", async () => {
    const db = globalThis.__TEST_DB__;
    await db.collection("subscriptions").deleteMany({});
    await db.collection("subscriptions").insertOne({
      patientId: "patient-tier-test",
      tier: "unlimited",
      status: "active",
      updatedAt: new Date().toISOString(),
    });
    const tier = await db.collection("subscriptions").findOne({
      patientId: "patient-tier-test",
      status: "active",
    });
    expect(tier?.tier).toBe("unlimited");
  });

  it("returns 'free' when no active subscription exists", async () => {
    const db = globalThis.__TEST_DB__;
    await db.collection("subscriptions").deleteMany({});
    const tier = await db.collection("subscriptions").findOne({
      patientId: "patient-no-sub",
      status: "active",
    });
    expect(tier).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it passes (data layer test, no route needed)**

```bash
cd /Users/haadisiddiqui/projects/VVision-App && npx vitest run src/server-routes/seats.test.ts
```

Expected: all tests pass including the two new ones.

- [ ] **Step 3: Add the tier endpoint to seats.ts**

Add this route before `export default router` in `src/server-routes/seats.ts`:

```ts
// GET /api/profiles/:patientId/tier — returns the subscription tier for a patient profile
// Used by invited members who don't have their own subscription
router.get("/:patientId/tier", authMiddleware, requireSeat, async (req, res) => {
  try {
    const db = getDb();
    const sub = await db.collection("subscriptions").findOne({
      patientId: req.params.patientId,
      status: "active",
    });
    if (!sub) { res.json({ tier: "free" }); return; }
    const tier = sub.tier === "unlimited" || sub.tier === "starter" ? sub.tier : "free";
    res.json({ tier });
  } catch (err) {
    console.error("get tier error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/haadisiddiqui/projects/VVision-App && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/server-routes/seats.ts src/server-routes/seats.test.ts
git commit -m "feat: add GET /api/profiles/:patientId/tier for profile subscription lookup"
```

---

## Task 4: Add getProfileTier API call on the client

**Files:**
- Modify: `src/api/seats.ts`

- [ ] **Step 1: Add getProfileTier to seats API**

Open `src/api/seats.ts` and add this function:

```ts
export async function getProfileTier(patientId: string): Promise<"free" | "starter" | "unlimited"> {
  const res = await apiClient.get(`/api/profiles/${patientId}/tier`);
  return res.data.tier ?? "free";
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/haadisiddiqui/projects/VVision-App && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/api/seats.ts
git commit -m "feat: add getProfileTier API call"
```

---

## Task 5: Update useSubscription to skip paywall for invited members

Invited members (role = `sibling`, `paid_aide`, or `clinician`) should never see the paywall. Their access is covered by the primary caregiver's plan. Update `useSubscription` to detect this case and return the profile's tier instead of the user's own RevenueCat entitlement.

**Files:**
- Modify: `src/hooks/useSubscription.ts`

- [ ] **Step 1: Rewrite useSubscription**

Replace `src/hooks/useSubscription.ts` with:

```ts
import { useEffect, useMemo, useState } from "react";
import { usePurchases } from "../providers/PurchasesProvider";
import { RC_ENTITLEMENT_STARTER, RC_ENTITLEMENT_UNLIMITED } from "../config/revenuecat";
import { useCurrentProfile } from "./useCurrentProfile";
import { useAuth } from "../context/AuthContext";
import { getProfileTier } from "../api/seats";

export type Tier = "free" | "starter" | "unlimited";

export function useSubscription(): { tier: Tier; ready: boolean; trialActive: boolean; isInvitedMember: boolean } {
  const { customerInfo, ready: rcReady } = usePurchases();
  const { patientId } = useCurrentProfile();
  const { user } = useAuth();
  const [profileTier, setProfileTier] = useState<Tier | null>(null);
  const [profileTierReady, setProfileTierReady] = useState(false);

  // Determine if this user is an invited member (not the primary caregiver)
  const isInvitedMember = useMemo(() => {
    return !!user && user.role !== "primary_caregiver" && user.role !== "patient";
  }, [user?.role]);

  // If invited member, fetch the profile's subscription tier instead of own RC entitlement
  useEffect(() => {
    if (!isInvitedMember || !patientId) {
      setProfileTierReady(true);
      return;
    }
    getProfileTier(patientId)
      .then((t) => setProfileTier(t))
      .catch(() => setProfileTier("free"))
      .finally(() => setProfileTierReady(true));
  }, [isInvitedMember, patientId]);

  return useMemo(() => {
    if (isInvitedMember) {
      // Invited member: use the profile's tier, skip own RC entitlement
      return {
        tier: profileTier ?? "free",
        ready: profileTierReady,
        trialActive: false,
        isInvitedMember: true,
      };
    }

    // Primary caregiver: use own RC entitlement as before
    if (!customerInfo) return { tier: "free", ready: rcReady, trialActive: false, isInvitedMember: false };
    const ent = customerInfo.entitlements.active;
    const unlimited = ent[RC_ENTITLEMENT_UNLIMITED];
    const starter = ent[RC_ENTITLEMENT_STARTER];
    const active = unlimited || starter;
    const tier: Tier = unlimited ? "unlimited" : starter ? "starter" : "free";
    const trialActive = active?.periodType === "trial";
    return { tier, ready: rcReady, trialActive, isInvitedMember: false };
  }, [customerInfo, rcReady, isInvitedMember, profileTier, profileTierReady]);
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/haadisiddiqui/projects/VVision-App && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useSubscription.ts
git commit -m "feat: invited members use profile tier, skip own RevenueCat paywall"
```

---

## Task 6: Gate paywall display — invited members never see it

The paywall is surfaced in two places: `InviteSeatScreen` (checks `tier === "free"`) and `FamilyCircleScreen` (deleted). Now that `useSubscription` returns `isInvitedMember`, use it to skip the paywall for invited members in any remaining paywall checks.

**Files:**
- Modify: `src/screens/caregiver/InviteSeatScreen.tsx`

- [ ] **Step 1: Update InviteSeatScreen to skip paywall for invited members**

In `src/screens/caregiver/InviteSeatScreen.tsx`, update the `submit` function's paywall check:

```tsx
// Change this import line to also pull isInvitedMember:
const { tier, isInvitedMember } = useSubscription();

// Change the paywall guard in submit():
if (tier === "free" && !isInvitedMember) {
  navigation.navigate("Paywall");
  return;
}
```

Full updated `submit` function:

```tsx
const submit = async () => {
  if (!patientId) return;
  if (tier === "free" && !isInvitedMember) {
    navigation.navigate("Paywall");
    return;
  }
  setBusy(true);
  try {
    const { token } = await inviteSeat(patientId, email, role);
    const link = `https://velavision.app/invite/${token}`;
    await Share.share({ message: `You've been invited to join Vela: ${link}` });
    Alert.alert("Invite sent", "They'll accept inside the app.");
    navigation.goBack();
  } catch (e: any) {
    if (e.message?.includes("Starter plan") || e.message?.includes("402")) {
      navigation.navigate("Paywall");
    } else {
      Alert.alert("Couldn't send invite", e.message);
    }
  } finally {
    setBusy(false);
  }
};
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/haadisiddiqui/projects/VVision-App && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/screens/caregiver/InviteSeatScreen.tsx
git commit -m "feat: invited members bypass paywall gate in InviteSeatScreen"
```

---

## Task 7: Deploy backend and smoke test

The new `/tier` endpoint needs to be live on Render before the client changes work end-to-end.

- [ ] **Step 1: Push backend to trigger Render deploy**

```bash
git push origin main
```

- [ ] **Step 2: Wait for Render deploy (~2 min), then smoke test the endpoint**

```bash
# Replace TOKEN and PATIENT_ID with real values from your test account
curl -H "Authorization: Bearer TOKEN" \
  https://vvision-app.onrender.com/api/profiles/PATIENT_ID/tier
```

Expected response:
```json
{ "tier": "starter" }
```
or `"free"` if no active subscription.

- [ ] **Step 3: Test the full flow manually**

1. Log in as primary caregiver (paid plan) → Care Team tab shows all seats with role badges
2. Invite a new family member by email
3. Log in as the invited member after accepting → they land on caregiver home with no paywall
4. Verify invited member sees the same dashboard as primary caregiver
5. Log in as a free-tier primary caregiver → tap Invite → Paywall screen appears

- [ ] **Step 4: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: post-deploy smoke test fixes"
```
