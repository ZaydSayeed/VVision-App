# Plan B — Seats UI & Subscription Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use `- [ ]` checkboxes.

**Goal:** Wire the caregiver-facing UI for seat management (invite sibling, list family, accept invite) plus the RevenueCat-backed Starter/Unlimited subscription.

**Architecture:** React Native + Expo screens that consume Plan A's `/api/profiles/:patientId/seats`, `/accept-invite` endpoints. RevenueCat SDK on device + a backend `/subscription/status` endpoint that joins RC subscriber data with the patient record. A thin `requireActiveSubscription` middleware gates write-heavy routes by subscription tier; seat count enforcement happens on `POST /:patientId/seats`.

**Tech Stack:** React Native · Expo (SDK 54) · TypeScript · `react-native-purchases` (RevenueCat) · existing Express backend · MongoDB

**Depends on:** Plan A (Living Profile Foundation) merged to main.

**Worktree setup:** Start by using `superpowers:using-git-worktrees` to create `.worktrees/seats-ui-subscription` on a new branch `feature/seats-ui-subscription` from current main. Do NOT reuse Plan A's worktree.

---

### Task 1: Install `react-native-purchases` and add env config

**Files:**
- Modify: `package.json`
- Modify: `src/server-core/config.ts`
- Modify: `.env.example`

- [ ] **Step 1:** `npx expo install react-native-purchases react-native-purchases-ui` (use `expo install`, not `npm install` — it pins to Expo-compatible versions). If that fails, run `npm install --save react-native-purchases react-native-purchases-ui --legacy-peer-deps`.

- [ ] **Step 2:** In `src/server-core/config.ts`, append inside the `config` export:
```ts
revenueCatSecretKey: process.env.REVENUECAT_SECRET_KEY || "",
revenueCatWebhookSecret: process.env.REVENUECAT_WEBHOOK_SECRET || "",
```

- [ ] **Step 3:** Append to `.env.example`:
```
# RevenueCat (subscription)
REVENUECAT_SECRET_KEY=
REVENUECAT_WEBHOOK_SECRET=
# Public key (app-side) lives in app config, not here. See src/config/revenuecat.ts.
```

- [ ] **Step 4:** Create `src/config/revenuecat.ts` (app-side keys — safe to commit):
```ts
// RevenueCat public SDK keys — these are meant to be public.
// Replace with real keys from https://app.revenuecat.com before shipping.
export const RC_API_KEY_IOS = "appl_PLACEHOLDER";
export const RC_API_KEY_ANDROID = "goog_PLACEHOLDER";
export const RC_ENTITLEMENT_STARTER = "starter";
export const RC_ENTITLEMENT_UNLIMITED = "unlimited";
export const RC_PRODUCT_STARTER_MONTHLY = "vela_starter_monthly";
export const RC_PRODUCT_UNLIMITED_MONTHLY = "vela_unlimited_monthly";
```

- [ ] **Step 5:** Commit:
```bash
git add package.json package-lock.json src/server-core/config.ts .env.example src/config/revenuecat.ts
git commit -m "chore: install react-native-purchases + add RevenueCat config"
```

---

### Task 2: Backend — subscription status + tier enforcement

**Files:**
- Create: `src/server-routes/subscription.ts`
- Create: `src/server-routes/subscription.test.ts`
- Modify: `src/server.ts`

- [ ] **Step 1: Write failing test.** `src/server-routes/subscription.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { enforceSeatLimit } from "./subscription";

describe("enforceSeatLimit", () => {
  it("allows adding a seat when under starter cap (2 seats)", () => {
    expect(enforceSeatLimit("starter", 1)).toBe(true);
  });
  it("blocks adding a seat when at starter cap", () => {
    expect(enforceSeatLimit("starter", 2)).toBe(false);
  });
  it("allows unlimited-tier regardless of count", () => {
    expect(enforceSeatLimit("unlimited", 100)).toBe(true);
  });
  it("blocks adding when tier is free (no subscription)", () => {
    expect(enforceSeatLimit("free", 0)).toBe(false);
  });
});
```

Run: `npm test -- src/server-routes/subscription.test.ts` → FAIL.

- [ ] **Step 2: Implement.** `src/server-routes/subscription.ts`:
```ts
import { Router } from "express";
import { z } from "zod";
import { getDb } from "../server-core/database";
import { authMiddleware } from "../server-core/security";
import { requireSeat } from "../server-core/seatResolver";

export type Tier = "free" | "starter" | "unlimited";
const STARTER_SEAT_CAP = 2;

export function enforceSeatLimit(tier: Tier, existingSeats: number): boolean {
  if (tier === "unlimited") return true;
  if (tier === "starter") return existingSeats < STARTER_SEAT_CAP;
  return false;
}

async function loadTier(patientId: string): Promise<Tier> {
  const db = getDb();
  const sub = await db.collection("subscriptions").findOne({ patientId, status: "active" });
  if (!sub) return "free";
  if (sub.tier === "unlimited" || sub.tier === "starter") return sub.tier;
  return "free";
}

const router = Router();

router.get("/:patientId/subscription", authMiddleware, requireSeat, async (req, res) => {
  try {
    const tier = await loadTier(req.params.patientId);
    const db = getDb();
    const seatCount = await db.collection("seats").countDocuments({ patientId: req.params.patientId });
    res.json({
      tier,
      seatCount,
      seatLimit: tier === "unlimited" ? null : STARTER_SEAT_CAP,
      canAddSeat: enforceSeatLimit(tier, seatCount),
    });
  } catch (err) {
    console.error("sub status error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

// Called by RevenueCat webhook or client refresh
const statusUpdateSchema = z.object({
  tier: z.enum(["free", "starter", "unlimited"]),
  status: z.enum(["active", "expired", "past_due", "canceled"]),
  expiresAt: z.string().optional(),
});

router.post("/:patientId/subscription", authMiddleware, requireSeat, async (req, res) => {
  const parsed = statusUpdateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ detail: parsed.error.issues[0].message }); return; }
  try {
    const db = getDb();
    await db.collection("subscriptions").updateOne(
      { patientId: req.params.patientId },
      { $set: { ...parsed.data, patientId: req.params.patientId, updatedAt: new Date().toISOString() } },
      { upsert: true }
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("sub update error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

export default router;
```

Run: `npm test -- src/server-routes/subscription.test.ts` → PASS.

- [ ] **Step 3:** In `src/server.ts`, add `import subscriptionRoutes from "./server-routes/subscription";` and `app.use("/api/profiles", subscriptionRoutes);`. Also add index in `src/server-core/database.ts` inside `connectDb`:
```ts
await db.collection("subscriptions").createIndex({ patientId: 1 }, { unique: true });
```

- [ ] **Step 4:** Commit:
```bash
git add src/server-routes/subscription.ts src/server-routes/subscription.test.ts src/server.ts src/server-core/database.ts
git commit -m "feat: add subscription tier enforcement + status endpoints"
```

---

### Task 3: Backend — enforce seat cap on POST /:patientId/seats

**Files:**
- Modify: `src/server-routes/seats.ts`
- Modify: `src/server-routes/seats.test.ts`

- [ ] **Step 1: Write failing test** — append to `seats.test.ts`:
```ts
describe("seat cap enforcement (data layer)", () => {
  it("blocks a 3rd seat on starter tier", async () => {
    const db = globalThis.__TEST_DB__;
    await db.collection("seats").deleteMany({});
    await db.collection("subscriptions").deleteMany({});
    const patientId = "patient-cap";
    await db.collection("subscriptions").insertOne({
      patientId, tier: "starter", status: "active", updatedAt: new Date().toISOString()
    });
    await db.collection("seats").insertMany([
      { userId: "u1", patientId, role: "primary_caregiver", createdAt: new Date().toISOString() },
      { userId: "u2", patientId, role: "sibling", createdAt: new Date().toISOString() },
    ]);
    const count = await db.collection("seats").countDocuments({ patientId });
    expect(count).toBe(2); // at cap
  });
});
```

Run: PASS (data-layer shape test).

- [ ] **Step 2: Add cap check to the invite handler.** In `src/server-routes/seats.ts`, inside the `POST /:patientId/seats` handler, after the primary_caregiver role check and BEFORE the `db.collection("seat_invites").insertOne(...)` call, add:
```ts
const tier = await (async () => {
  const sub = await db.collection("subscriptions").findOne({ patientId: req.params.patientId, status: "active" });
  if (!sub) return "free" as const;
  if (sub.tier === "unlimited" || sub.tier === "starter") return sub.tier;
  return "free" as const;
})();
const seatCount = await db.collection("seats").countDocuments({ patientId: req.params.patientId });
const pendingCount = await db.collection("seat_invites").countDocuments({ patientId: req.params.patientId, status: "pending" });
const projected = seatCount + pendingCount;
if (tier === "free") { res.status(402).json({ detail: "Active subscription required to invite" }); return; }
if (tier === "starter" && projected >= 2) {
  res.status(402).json({ detail: "Starter plan reached (2 seats). Upgrade to Unlimited for more siblings." });
  return;
}
// (Unlimited tier: no cap.)
```

- [ ] **Step 3:** Run `npm test` → all previous tests still pass + new cap test passes.

- [ ] **Step 4:** Commit:
```bash
git add src/server-routes/seats.ts src/server-routes/seats.test.ts
git commit -m "feat: enforce seat cap on invite based on subscription tier"
```

---

### Task 4: React Native — RevenueCat provider + hook

**Files:**
- Create: `src/providers/PurchasesProvider.tsx`
- Create: `src/hooks/useSubscription.ts`
- Modify: `App.tsx`

- [ ] **Step 1:** `src/providers/PurchasesProvider.tsx`:
```tsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";
import Purchases, { CustomerInfo } from "react-native-purchases";
import { RC_API_KEY_IOS, RC_API_KEY_ANDROID } from "../config/revenuecat";
import { useAuth } from "./AuthProvider"; // existing Supabase auth provider

interface PurchasesContextValue {
  customerInfo: CustomerInfo | null;
  refresh: () => Promise<void>;
  ready: boolean;
}

const PurchasesContext = createContext<PurchasesContextValue>({
  customerInfo: null, refresh: async () => {}, ready: false,
});

export function PurchasesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const key = Platform.OS === "ios" ? RC_API_KEY_IOS : RC_API_KEY_ANDROID;
    Purchases.configure({ apiKey: key, appUserID: user?.id });
    Purchases.addCustomerInfoUpdateListener(setCustomerInfo);
    Purchases.getCustomerInfo().then(setCustomerInfo).finally(() => setReady(true));
    return () => {
      // RN 0.79+: removeCustomerInfoUpdateListener is deprecated; clean via addListener's returned sub if SDK supports.
    };
  }, [user?.id]);

  const refresh = async () => {
    const info = await Purchases.getCustomerInfo();
    setCustomerInfo(info);
  };

  return <PurchasesContext.Provider value={{ customerInfo, refresh, ready }}>{children}</PurchasesContext.Provider>;
}

export const usePurchases = () => useContext(PurchasesContext);
```

- [ ] **Step 2:** `src/hooks/useSubscription.ts`:
```ts
import { useMemo } from "react";
import { usePurchases } from "../providers/PurchasesProvider";
import { RC_ENTITLEMENT_STARTER, RC_ENTITLEMENT_UNLIMITED } from "../config/revenuecat";

export type Tier = "free" | "starter" | "unlimited";

export function useSubscription(): { tier: Tier; ready: boolean; trialActive: boolean } {
  const { customerInfo, ready } = usePurchases();
  return useMemo(() => {
    if (!customerInfo) return { tier: "free", ready, trialActive: false };
    const ent = customerInfo.entitlements.active;
    const unlimited = ent[RC_ENTITLEMENT_UNLIMITED];
    const starter = ent[RC_ENTITLEMENT_STARTER];
    const active = unlimited || starter;
    const tier: Tier = unlimited ? "unlimited" : starter ? "starter" : "free";
    const trialActive = active?.periodType === "trial";
    return { tier, ready, trialActive };
  }, [customerInfo, ready]);
}
```

- [ ] **Step 3:** In `App.tsx`, wrap the existing provider tree with `<PurchasesProvider>` (inside `<AuthProvider>`).

- [ ] **Step 4:** Commit:
```bash
git add src/providers/PurchasesProvider.tsx src/hooks/useSubscription.ts App.tsx
git commit -m "feat: add RevenueCat provider + useSubscription hook"
```

---

### Task 5: Paywall screen (Starter $14.99 / Unlimited $24.99)

**Files:**
- Create: `src/screens/caregiver/PaywallScreen.tsx`

- [ ] **Step 1:** `src/screens/caregiver/PaywallScreen.tsx`:
```tsx
import React, { useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView, Alert, ActivityIndicator } from "react-native";
import Purchases, { PurchasesPackage } from "react-native-purchases";
import { useSubscription } from "../../hooks/useSubscription";
import { useTheme } from "../../hooks/useTheme"; // existing
import { LinearGradient } from "expo-linear-gradient";

export default function PaywallScreen({ navigation }: any) {
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const { tier } = useSubscription();
  const { colors } = useTheme();

  useEffect(() => {
    (async () => {
      const offerings = await Purchases.getOfferings();
      setPackages(offerings.current?.availablePackages ?? []);
      setLoading(false);
    })();
  }, []);

  const handlePurchase = async (pkg: PurchasesPackage) => {
    setPurchasing(pkg.identifier);
    try {
      await Purchases.purchasePackage(pkg);
      navigation.replace("CaregiverHome");
    } catch (e: any) {
      if (!e.userCancelled) Alert.alert("Purchase failed", e.message ?? "Please try again.");
    } finally {
      setPurchasing(null);
    }
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} />;

  const starter = packages.find(p => p.product.identifier.includes("starter"));
  const unlimited = packages.find(p => p.product.identifier.includes("unlimited"));

  return (
    <ScrollView contentContainerStyle={{ padding: 24 }}>
      <Text style={{ fontSize: 28, fontWeight: "700", color: colors.text }}>Pick your plan</Text>
      <Text style={{ color: colors.muted, marginTop: 8, marginBottom: 24 }}>
        7-day free trial · cancel anytime
      </Text>

      {starter && (
        <PlanCard
          title="Starter"
          price={starter.product.priceString + "/mo"}
          seats="You + 1 sibling"
          features={["Full Living Profile", "Voice check-ins", "Coach AI"]}
          cta={tier === "starter" ? "Current plan" : "Start 7-day trial"}
          disabled={tier === "starter" || purchasing === starter.identifier}
          onPress={() => handlePurchase(starter)}
        />
      )}
      {unlimited && (
        <PlanCard
          title="Unlimited"
          price={unlimited.product.priceString + "/mo"}
          seats="Unlimited siblings + aides"
          features={["Everything in Starter", "Unlimited seats", "Priority support"]}
          highlighted
          cta={tier === "unlimited" ? "Current plan" : "Start 7-day trial"}
          disabled={tier === "unlimited" || purchasing === unlimited.identifier}
          onPress={() => handlePurchase(unlimited)}
        />
      )}

      <Pressable onPress={async () => { await Purchases.restorePurchases(); Alert.alert("Restored"); }}>
        <Text style={{ color: colors.accent, textAlign: "center", marginTop: 24 }}>Restore purchases</Text>
      </Pressable>
    </ScrollView>
  );
}

function PlanCard({ title, price, seats, features, cta, disabled, onPress, highlighted }: any) {
  return (
    <LinearGradient
      colors={highlighted ? ["#6366f1", "#8b5cf6"] : ["#f8fafc", "#f1f5f9"]}
      style={{ borderRadius: 16, padding: 20, marginBottom: 16 }}
    >
      <Text style={{ fontSize: 18, fontWeight: "700", color: highlighted ? "white" : "#0f172a" }}>{title}</Text>
      <Text style={{ fontSize: 32, fontWeight: "800", color: highlighted ? "white" : "#0f172a", marginTop: 4 }}>{price}</Text>
      <Text style={{ color: highlighted ? "rgba(255,255,255,0.85)" : "#475569", marginTop: 4 }}>{seats}</Text>
      <View style={{ marginTop: 12 }}>
        {features.map((f: string) => (
          <Text key={f} style={{ color: highlighted ? "white" : "#0f172a", marginVertical: 2 }}>• {f}</Text>
        ))}
      </View>
      <Pressable
        disabled={disabled}
        onPress={onPress}
        style={{
          backgroundColor: highlighted ? "white" : "#0f172a",
          padding: 14, borderRadius: 10, marginTop: 16, opacity: disabled ? 0.5 : 1,
        }}
      >
        <Text style={{ color: highlighted ? "#0f172a" : "white", textAlign: "center", fontWeight: "700" }}>{cta}</Text>
      </Pressable>
    </LinearGradient>
  );
}
```

- [ ] **Step 2:** Commit:
```bash
git add src/screens/caregiver/PaywallScreen.tsx
git commit -m "feat: add PaywallScreen with Starter + Unlimited tiers"
```

---

### Task 6: Invite sibling screen

**Files:**
- Create: `src/screens/caregiver/InviteSeatScreen.tsx`
- Create: `src/api/seats.ts`

- [ ] **Step 1:** `src/api/seats.ts`:
```ts
import { authFetch } from "./authFetch"; // existing helper

export async function inviteSeat(patientId: string, email: string, role: "sibling" | "paid_aide" | "clinician") {
  const res = await authFetch(`/api/profiles/${patientId}/seats`, {
    method: "POST", body: JSON.stringify({ email, role }),
  });
  if (!res.ok) throw new Error((await res.json()).detail ?? "Invite failed");
  return res.json() as Promise<{ token: string; status: "pending" }>;
}

export async function listSeats(patientId: string) {
  const res = await authFetch(`/api/profiles/${patientId}/seats`);
  if (!res.ok) throw new Error("Failed to load seats");
  return res.json() as Promise<{ seats: Array<{ userId: string; role: string; createdAt: string }>; invites: Array<{ email: string; role: string; status: string }> }>;
}

export async function acceptInvite(token: string) {
  const res = await authFetch(`/api/profiles/accept-invite`, {
    method: "POST", body: JSON.stringify({ token }),
  });
  if (!res.ok) throw new Error((await res.json()).detail ?? "Accept failed");
  return res.json() as Promise<{ ok: true; patientId: string; role: string }>;
}
```

- [ ] **Step 2:** `src/screens/caregiver/InviteSeatScreen.tsx`:
```tsx
import React, { useState } from "react";
import { View, Text, TextInput, Pressable, Alert, Share } from "react-native";
import { inviteSeat } from "../../api/seats";
import { useSubscription } from "../../hooks/useSubscription";
import { useCurrentProfile } from "../../hooks/useCurrentProfile"; // resolves primary patientId for caregiver

export default function InviteSeatScreen({ navigation }: any) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"sibling" | "paid_aide">("sibling");
  const [busy, setBusy] = useState(false);
  const { tier } = useSubscription();
  const { patientId } = useCurrentProfile();

  const submit = async () => {
    if (!patientId) return;
    if (tier === "free") { navigation.navigate("Paywall"); return; }
    setBusy(true);
    try {
      const { token } = await inviteSeat(patientId, email, role);
      const link = `https://velavision.app/invite/${token}`;
      await Share.share({ message: `You've been invited to Mom's Vela profile: ${link}` });
      Alert.alert("Invite sent", "They'll accept inside the app.");
      navigation.goBack();
    } catch (e: any) {
      if (e.message.includes("Starter plan reached")) navigation.navigate("Paywall");
      else Alert.alert("Couldn't send invite", e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ padding: 24, gap: 16 }}>
      <Text style={{ fontSize: 22, fontWeight: "700" }}>Invite someone to help</Text>
      <TextInput
        placeholder="Their email"
        autoCapitalize="none" keyboardType="email-address"
        value={email} onChangeText={setEmail}
        style={{ borderWidth: 1, borderColor: "#e2e8f0", padding: 14, borderRadius: 10, fontSize: 16 }}
      />
      <View style={{ flexDirection: "row", gap: 8 }}>
        {(["sibling", "paid_aide"] as const).map(r => (
          <Pressable
            key={r} onPress={() => setRole(r)}
            style={{
              flex: 1, padding: 12, borderRadius: 10,
              backgroundColor: role === r ? "#0f172a" : "#f1f5f9",
            }}
          >
            <Text style={{ textAlign: "center", color: role === r ? "white" : "#0f172a", fontWeight: "600" }}>
              {r === "sibling" ? "Family member" : "Paid aide"}
            </Text>
          </Pressable>
        ))}
      </View>
      <Pressable
        disabled={busy || !email.includes("@")}
        onPress={submit}
        style={{ backgroundColor: "#6366f1", padding: 16, borderRadius: 12, opacity: busy ? 0.5 : 1 }}
      >
        <Text style={{ color: "white", textAlign: "center", fontWeight: "700", fontSize: 16 }}>
          {busy ? "Sending…" : "Send invite"}
        </Text>
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 3:** Commit:
```bash
git add src/api/seats.ts src/screens/caregiver/InviteSeatScreen.tsx
git commit -m "feat: add invite sibling screen + seats API client"
```

---

### Task 7: Family seats list screen

**Files:**
- Create: `src/screens/caregiver/FamilyCircleScreen.tsx`

- [ ] **Step 1:** `src/screens/caregiver/FamilyCircleScreen.tsx`:
```tsx
import React, { useEffect, useState, useCallback } from "react";
import { View, Text, FlatList, Pressable, RefreshControl } from "react-native";
import { listSeats } from "../../api/seats";
import { useCurrentProfile } from "../../hooks/useCurrentProfile";
import { useSubscription } from "../../hooks/useSubscription";

export default function FamilyCircleScreen({ navigation }: any) {
  const { patientId } = useCurrentProfile();
  const { tier } = useSubscription();
  const [data, setData] = useState<{ seats: any[]; invites: any[] } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!patientId) return;
    setRefreshing(true);
    try { setData(await listSeats(patientId)); } finally { setRefreshing(false); }
  }, [patientId]);

  useEffect(() => { load(); }, [load]);

  return (
    <View style={{ flex: 1, padding: 24 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Text style={{ fontSize: 22, fontWeight: "700" }}>Family Circle</Text>
        <Pressable
          onPress={() => navigation.navigate("InviteSeat")}
          style={{ backgroundColor: "#6366f1", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 }}
        >
          <Text style={{ color: "white", fontWeight: "600" }}>+ Invite</Text>
        </Pressable>
      </View>

      {tier === "free" && (
        <Pressable
          onPress={() => navigation.navigate("Paywall")}
          style={{ backgroundColor: "#fef3c7", padding: 16, borderRadius: 10, marginBottom: 16 }}
        >
          <Text style={{ fontWeight: "600", color: "#92400e" }}>Start your 7-day trial</Text>
          <Text style={{ color: "#92400e", marginTop: 4 }}>Invite family and unlock the full Living Profile.</Text>
        </Pressable>
      )}

      <FlatList
        data={[
          ...(data?.seats ?? []).map((s: any) => ({ type: "seat", ...s })),
          ...(data?.invites ?? []).map((i: any) => ({ type: "invite", ...i })),
        ]}
        keyExtractor={(item: any, idx) => (item.userId ?? item.email) + idx}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        ListEmptyComponent={<Text style={{ color: "#64748b", textAlign: "center", marginTop: 40 }}>No one here yet.</Text>}
        renderItem={({ item }: any) => (
          <View style={{ padding: 16, backgroundColor: "#f8fafc", borderRadius: 10, marginBottom: 8 }}>
            <Text style={{ fontWeight: "600" }}>{item.type === "seat" ? (item.userId) : item.email}</Text>
            <Text style={{ color: "#64748b", marginTop: 2 }}>
              {item.role} {item.type === "invite" ? "· pending invite" : ""}
            </Text>
          </View>
        )}
      />
    </View>
  );
}
```

- [ ] **Step 2:** Commit:
```bash
git add src/screens/caregiver/FamilyCircleScreen.tsx
git commit -m "feat: add FamilyCircleScreen listing seats + pending invites"
```

---

### Task 8: Accept invite screen

**Files:**
- Create: `src/screens/AcceptInviteScreen.tsx`
- Modify: `App.tsx` (deep link handler)

- [ ] **Step 1:** `src/screens/AcceptInviteScreen.tsx`:
```tsx
import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, Pressable, Alert } from "react-native";
import { acceptInvite } from "../api/seats";

export default function AcceptInviteScreen({ route, navigation }: any) {
  const { token } = route.params ?? {};
  const [status, setStatus] = useState<"loading" | "error" | "done">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const r = await acceptInvite(token);
        setMessage(`You're now a ${r.role} on this Living Profile.`);
        setStatus("done");
      } catch (e: any) {
        setMessage(e.message);
        setStatus("error");
      }
    })();
  }, [token]);

  if (status === "loading") return <ActivityIndicator style={{ flex: 1 }} />;

  return (
    <View style={{ flex: 1, padding: 24, justifyContent: "center" }}>
      <Text style={{ fontSize: 22, fontWeight: "700", textAlign: "center" }}>
        {status === "done" ? "Welcome to the family" : "Invite not valid"}
      </Text>
      <Text style={{ textAlign: "center", marginTop: 12, color: "#475569" }}>{message}</Text>
      <Pressable
        onPress={() => navigation.replace(status === "done" ? "CaregiverHome" : "SignIn")}
        style={{ backgroundColor: "#6366f1", padding: 16, borderRadius: 12, marginTop: 24 }}
      >
        <Text style={{ color: "white", textAlign: "center", fontWeight: "700" }}>Continue</Text>
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 2:** In `App.tsx`, register linking config (append to existing `NavigationContainer`):
```tsx
linking={{
  prefixes: ["https://velavision.app", "velavision://"],
  config: { screens: { AcceptInvite: "invite/:token" } },
}}
```

- [ ] **Step 3:** Commit:
```bash
git add src/screens/AcceptInviteScreen.tsx App.tsx
git commit -m "feat: accept-invite screen + deep link handler"
```

---

### Task 9: Wire screens into caregiver navigation

**Files:**
- Modify: `src/navigation/CaregiverTabNavigator.tsx` (add Family tab + Paywall + Invite to stack)
- Modify: `src/navigation/RootNavigator.tsx`

- [ ] **Step 1:** Add stack entries for `Paywall`, `InviteSeat`, `AcceptInvite` in the root navigator. Add `FamilyCircleScreen` as a new tab (or merge into existing People tab — caregiver has 5 tabs currently; add Family as the 6th or replace People with Family if functionally equivalent — read `CaregiverTabNavigator.tsx` first to decide).

- [ ] **Step 2:** Commit:
```bash
git add src/navigation/CaregiverTabNavigator.tsx src/navigation/RootNavigator.tsx
git commit -m "feat: wire Family tab + Paywall + Invite into caregiver nav"
```

---

### Task 10: RevenueCat webhook → backend sync

**Files:**
- Create: `src/server-routes/revenueCatWebhook.ts`
- Modify: `src/server.ts`

- [ ] **Step 1:** Create webhook handler:
```ts
import { Router } from "express";
import { getDb } from "../server-core/database";
import { config } from "../server-core/config";

const router = Router();

// POST /api/webhooks/revenuecat — called by RevenueCat when a subscription changes
router.post("/revenuecat", async (req, res) => {
  const auth = req.header("Authorization");
  if (!config.revenueCatWebhookSecret || auth !== `Bearer ${config.revenueCatWebhookSecret}`) {
    res.status(401).json({ detail: "Unauthorized" }); return;
  }
  try {
    const evt = req.body?.event;
    if (!evt) { res.status(400).json({ detail: "No event" }); return; }
    const appUserId: string = evt.app_user_id;
    const productId: string = evt.product_id ?? "";
    const type: string = evt.type; // INITIAL_PURCHASE, RENEWAL, EXPIRATION, CANCELLATION, etc.
    const tier = productId.includes("unlimited") ? "unlimited" : productId.includes("starter") ? "starter" : "free";
    const status = ["EXPIRATION", "CANCELLATION"].includes(type) ? "expired" : "active";

    const db = getDb();
    // appUserId is the Supabase userId. Resolve to the user's primary patientId.
    const user = await db.collection("users").findOne({ supabase_uid: appUserId });
    const patientId = user?.patient_id;
    if (!patientId) { res.json({ ok: true, note: "no patientId on user" }); return; }
    await db.collection("subscriptions").updateOne(
      { patientId },
      { $set: { patientId, tier, status, expiresAt: evt.expiration_at_ms, updatedAt: new Date().toISOString() } },
      { upsert: true }
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("rc webhook error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

export default router;
```

- [ ] **Step 2:** Mount in `src/server.ts`: `app.use("/api/webhooks", revenueCatWebhookRoutes);`

- [ ] **Step 3:** Commit:
```bash
git add src/server-routes/revenueCatWebhook.ts src/server.ts
git commit -m "feat: RevenueCat webhook syncs subscription state to backend"
```

---

### Task 11: Smoke-test checklist (manual, Expo Go)

**Files:**
- Create: `docs/manual-tests/plan-b-smoke.md`

- [ ] **Step 1:** Create a short manual smoke-test doc — since RN UI unit tests require simulator infra that isn't in this plan's scope, document the steps a human runs in Expo Go before shipping:
```markdown
# Plan B Smoke Tests (Expo Go)

Run on both iOS simulator and a physical Android device.

1. **First-run sign-in** — Sign in as a new caregiver. Confirm onboarding routes to `CaregiverHome` and NOT to Paywall.
2. **Paywall entry** — From Family tab, tap "Start your 7-day trial" card. Paywall loads both tiers with live RC prices.
3. **Trial purchase** — Buy Starter via sandbox account. Returns to CaregiverHome; tier shows starter; yellow trial banner gone.
4. **Invite sibling** — From Family tab, tap + Invite, enter email, send. Share sheet opens with invite link.
5. **Second seat** — Use another sandbox user to accept via deep link `velavision://invite/<token>`. Confirm AcceptInviteScreen shows success.
6. **Cap enforcement** — With Starter + 2 seats, try a 3rd invite. Backend 402 routes to Paywall.
7. **Upgrade to Unlimited** — Buy Unlimited. Try 3rd invite again — succeeds.
8. **Restore purchases** — Log out, log back in on same account, tap Restore. Subscription reappears.
9. **Webhook sanity** — Trigger a test webhook in RC dashboard. Confirm backend `subscriptions` row updates.
```

- [ ] **Step 2:** Commit:
```bash
git add docs/manual-tests/plan-b-smoke.md
git commit -m "docs: manual smoke-test checklist for Plan B"
```

---

### Task 12: Update README + CLAUDE.md

**Files:**
- Modify: `README.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1:** In `README.md`, append under the existing Living Profile API section:
```markdown
### Subscription (Plan B)
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/profiles/:patientId/subscription` | Current tier + seat usage |
| POST | `/api/profiles/:patientId/subscription` | Client-side override (mostly for local dev) |
| POST | `/api/webhooks/revenuecat` | RevenueCat server notification sink |

Tiers: **Starter** $14.99/mo (2 seats) · **Unlimited** $24.99/mo (unlimited seats). 7-day free trial on both.
```

- [ ] **Step 2:** In `CLAUDE.md`, append under the Living Profile architecture section:
```markdown
### Subscription (2026-04-13)
- Pricing is controlled by RevenueCat. Entitlements: `starter` (2 seats) and `unlimited`. Configure in https://app.revenuecat.com.
- `useSubscription()` hook returns `{ tier, ready, trialActive }` — use at any screen that gates features.
- Backend enforcement: `POST /:patientId/seats` rejects with 402 when tier is free or at the Starter cap. The client should detect 402 and route to `PaywallScreen`.
```

- [ ] **Step 3:** Final commit:
```bash
git add README.md CLAUDE.md
git commit -m "docs: document subscription tiers + paywall routing"
```

---

## Plan summary

By end of plan:
- React Native: `PurchasesProvider`, `useSubscription`, `PaywallScreen`, `InviteSeatScreen`, `FamilyCircleScreen`, `AcceptInviteScreen`, deep-link handler, navigation wired.
- Backend: `/subscription` status + upsert, seat cap enforcement, RevenueCat webhook, `subscriptions` collection.
- Docs: smoke-test checklist, README + CLAUDE.md updates.

**Next plan:** **C — Voice UI (Gemini Live)** — adds the voice-first check-in flow.
