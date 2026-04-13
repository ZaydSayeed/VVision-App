# Plan G — Onboarding & Trial Paywall Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** First-run caregiver onboarding that takes a newly-signed-up adult child from zero → a usable Living Profile of their parent in 10–12 minutes, ending on the paywall with a 7-day trial. This ties together Plan A (profile data model), Plan B (paywall + seats), Plan C (voice check-in), and Plan D (sensors) into one cohesive flow.

**Architecture:** A multi-step wizard driven by a single `OnboardingNavigator` that tracks progress in AsyncStorage + backend. Steps are skippable where sensible but return-to-later prompts surface in the main dashboard until complete. The wizard uses Plan C's voice UI for profile intake when available, text fallback otherwise.

**Tech Stack:** React Native · Expo · existing Supabase auth · RevenueCat (Plan B) · authFetch.

**Depends on:** Plan A (required), Plan B (required — paywall). Plan C and D optional — wizard gracefully degrades if their screens don't exist yet.

**Worktree:** `.worktrees/onboarding-trial-paywall`, branch `feature/onboarding-trial-paywall`.

---

### Task 1: Onboarding progress state (backend + client)

**Files:**
- Create: `src/server-routes/onboarding.ts`
- Create: `src/server-routes/onboarding.test.ts`
- Modify: `src/server.ts`

- [ ] **Step 1: Failing test.**
```ts
import { describe, it, expect } from "vitest";
import { onboardingProgressSchema } from "./onboarding";

describe("onboardingProgressSchema", () => {
  it("accepts known steps with boolean values", () => {
    expect(onboardingProgressSchema.safeParse({
      profile_basics: true, profile_story: true, siblings: false, smart_home: false, caller_setup: false, paywall: false,
    }).success).toBe(true);
  });
  it("rejects unknown keys", () => {
    expect(onboardingProgressSchema.safeParse({ unknown: true }).success).toBe(false);
  });
});
```

- [ ] **Step 2:** `onboarding.ts`:
```ts
import { Router } from "express";
import { z } from "zod";
import { getDb } from "../server-core/database";
import { authMiddleware } from "../server-core/security";
import { requireSeat } from "../server-core/seatResolver";

const STEPS = ["profile_basics", "profile_story", "siblings", "smart_home", "caller_setup", "paywall"] as const;
export const onboardingProgressSchema = z.object(
  Object.fromEntries(STEPS.map(s => [s, z.boolean().optional()])) as Record<typeof STEPS[number], z.ZodOptional<z.ZodBoolean>>
).strict();

const router = Router();

router.get("/:patientId/onboarding", authMiddleware, requireSeat, async (req, res) => {
  try {
    const db = getDb();
    const row = await db.collection("onboarding_progress").findOne({ patientId: req.params.patientId });
    res.json({ progress: row?.progress ?? {}, completedAt: row?.completedAt ?? null });
  } catch (err) { res.status(500).json({ detail: "Internal server error" }); }
});

router.patch("/:patientId/onboarding", authMiddleware, requireSeat, async (req, res) => {
  const parsed = onboardingProgressSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ detail: parsed.error.issues[0].message }); return; }
  try {
    const db = getDb();
    const existing = await db.collection("onboarding_progress").findOne({ patientId: req.params.patientId });
    const merged = { ...existing?.progress, ...parsed.data };
    const allDone = STEPS.every((s) => (merged as any)[s]);
    await db.collection("onboarding_progress").updateOne(
      { patientId: req.params.patientId },
      { $set: { patientId: req.params.patientId, progress: merged, completedAt: allDone ? new Date().toISOString() : null } },
      { upsert: true }
    );
    res.json({ progress: merged, completedAt: allDone ? new Date().toISOString() : null });
  } catch (err) { res.status(500).json({ detail: "Internal server error" }); }
});

export default router;
```

- [ ] **Step 3:** Mount + index in `database.ts`:
```ts
await db.collection("onboarding_progress").createIndex({ patientId: 1 }, { unique: true });
```

- [ ] **Step 4:** Commit:
```bash
git add src/server-routes/onboarding.ts src/server-routes/onboarding.test.ts src/server.ts src/server-core/database.ts
git commit -m "feat: onboarding progress endpoints"
```

---

### Task 2: Client onboarding API + hook

**Files:**
- Create: `src/api/onboarding.ts`
- Create: `src/hooks/useOnboarding.ts`

- [ ] **Step 1:**
```ts
// src/api/onboarding.ts
import { authFetch } from "./authFetch";
export type OnboardingStep = "profile_basics" | "profile_story" | "siblings" | "smart_home" | "caller_setup" | "paywall";
export async function getOnboarding(patientId: string) {
  const r = await authFetch(`/api/profiles/${patientId}/onboarding`);
  if (!r.ok) throw new Error("load failed");
  return r.json() as Promise<{ progress: Record<OnboardingStep, boolean>; completedAt: string | null }>;
}
export async function markStep(patientId: string, step: OnboardingStep, done = true) {
  const r = await authFetch(`/api/profiles/${patientId}/onboarding`, { method: "PATCH", body: JSON.stringify({ [step]: done }) });
  if (!r.ok) throw new Error("update failed");
  return r.json();
}
```

```ts
// src/hooks/useOnboarding.ts
import { useCallback, useEffect, useState } from "react";
import { getOnboarding, markStep, OnboardingStep } from "../api/onboarding";
import { useCurrentProfile } from "./useCurrentProfile";

export function useOnboarding() {
  const { patientId } = useCurrentProfile();
  const [progress, setProgress] = useState<Record<OnboardingStep, boolean>>({} as any);
  const [completed, setCompleted] = useState(false);
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    if (!patientId) return;
    const r = await getOnboarding(patientId);
    setProgress(r.progress);
    setCompleted(!!r.completedAt);
    setReady(true);
  }, [patientId]);
  useEffect(() => { load(); }, [load]);

  const complete = async (step: OnboardingStep) => {
    if (!patientId) return;
    const r = await markStep(patientId, step);
    setProgress(r.progress);
    setCompleted(!!r.completedAt);
  };

  return { progress, completed, complete, ready };
}
```

- [ ] **Step 2:** Commit:
```bash
git add src/api/onboarding.ts src/hooks/useOnboarding.ts
git commit -m "feat: onboarding client API + hook"
```

---

### Task 3: Profile basics step

**Files:**
- Create: `src/screens/onboarding/ProfileBasicsStep.tsx`

- [ ] **Step 1:**
```tsx
import React, { useState } from "react";
import { View, Text, TextInput, Pressable, Alert, ScrollView } from "react-native";
import { authFetch } from "../../api/authFetch";
import { useCurrentProfile } from "../../hooks/useCurrentProfile";
import { useOnboarding } from "../../hooks/useOnboarding";

export default function ProfileBasicsStep({ navigation }: any) {
  const { patientId } = useCurrentProfile();
  const { complete } = useOnboarding();
  const [name, setName] = useState("");
  const [stage, setStage] = useState<"mild" | "moderate" | "severe" | "">("");
  const [busy, setBusy] = useState(false);

  const next = async () => {
    if (!patientId || !name.trim()) return;
    setBusy(true);
    try {
      // Patient name lives on the patients collection; PATCH /profiles/mine updates richer fields.
      await authFetch(`/api/patients/mine`, { method: "PATCH", body: JSON.stringify({ name }) });
      if (stage) await authFetch(`/api/profiles/mine`, { method: "PATCH", body: JSON.stringify({ stage }) });
      await complete("profile_basics");
      navigation.navigate("ProfileStory");
    } catch (e: any) { Alert.alert("Couldn't save", e.message); }
    finally { setBusy(false); }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: "700" }}>Tell us about your parent</Text>
      <Text style={{ color: "#64748b" }}>These basics let Vela address them correctly and tune its tone.</Text>

      <TextInput placeholder="Their name (e.g. Mom, or Sharon)" value={name} onChangeText={setName}
        style={{ borderWidth: 1, borderColor: "#e2e8f0", padding: 14, borderRadius: 10, fontSize: 16 }} />

      <Text style={{ fontWeight: "600", marginTop: 8 }}>Current stage (you can change this later)</Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {(["mild", "moderate", "severe"] as const).map(s => (
          <Pressable key={s} onPress={() => setStage(s)}
            style={{ flex: 1, padding: 12, borderRadius: 10, backgroundColor: stage === s ? "#0f172a" : "#f1f5f9" }}>
            <Text style={{ textAlign: "center", color: stage === s ? "white" : "#0f172a", fontWeight: "600", textTransform: "capitalize" }}>{s}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable disabled={!name.trim() || busy} onPress={next}
        style={{ backgroundColor: name.trim() ? "#6366f1" : "#cbd5e1", padding: 16, borderRadius: 12, marginTop: 16 }}>
        <Text style={{ color: "white", textAlign: "center", fontWeight: "700", fontSize: 16 }}>
          {busy ? "Saving…" : "Continue"}
        </Text>
      </Pressable>
    </ScrollView>
  );
}
```

- [ ] **Step 2:** Commit:
```bash
git add src/screens/onboarding/ProfileBasicsStep.tsx
git commit -m "feat: onboarding — profile basics step"
```

---

### Task 4: Profile story step (voice or text)

**Files:**
- Create: `src/screens/onboarding/ProfileStoryStep.tsx`

- [ ] **Step 1:** The story step is a voice-first intake: "Tell me about your mom — where she's from, what she loves, who she grew up with." Transcript is saved as `profile.history` plus a first memory entry.

```tsx
import React, { useState } from "react";
import { View, Text, Pressable, Alert, ScrollView } from "react-native";
import { useVoiceSession } from "../../hooks/useVoiceSession"; // provided by Plan C; if C not merged, this file's voice path is best-effort
import { useCurrentProfile } from "../../hooks/useCurrentProfile";
import { useOnboarding } from "../../hooks/useOnboarding";
import { authFetch } from "../../api/authFetch";

export default function ProfileStoryStep({ navigation }: any) {
  const { patientId } = useCurrentProfile();
  const { complete } = useOnboarding();
  const voice = (() => { try { return useVoiceSession(patientId); } catch { return null; } })();
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async (story: string) => {
    if (!patientId || !story.trim()) return;
    setBusy(true);
    try {
      await authFetch(`/api/profiles/mine`, { method: "PATCH", body: JSON.stringify({ history: story.slice(0, 5000) }) });
      await authFetch(`/api/profiles/${patientId}/memory`, {
        method: "POST",
        body: JSON.stringify({ content: story, metadata: { source: "onboarding_story" } }),
      });
      await complete("profile_story");
      navigation.navigate("InviteSiblingsStep");
    } catch (e: any) { Alert.alert("Couldn't save", e.message); }
    finally { setBusy(false); }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: "700" }}>Tell Vela their story</Text>
      <Text style={{ color: "#64748b" }}>Where they grew up, who they love, what makes them calm. Take your time — this shapes every future interaction.</Text>

      {voice ? (
        <View style={{ gap: 12 }}>
          {voice.state === "listening" ? (
            <Pressable onPress={voice.stop} style={{ backgroundColor: "#dc2626", padding: 16, borderRadius: 14 }}>
              <Text style={{ color: "white", textAlign: "center", fontWeight: "700", fontSize: 16 }}>Stop recording</Text>
            </Pressable>
          ) : (
            <Pressable onPress={voice.start} style={{ backgroundColor: "#6366f1", padding: 16, borderRadius: 14 }}>
              <Text style={{ color: "white", textAlign: "center", fontWeight: "700", fontSize: 16 }}>🎙️  Start recording</Text>
            </Pressable>
          )}
          {voice.transcript ? (
            <>
              <Text style={{ color: "#0f172a", backgroundColor: "#f8fafc", padding: 12, borderRadius: 8 }}>{voice.transcript}</Text>
              <Pressable disabled={busy} onPress={() => save(voice.transcript)}
                style={{ backgroundColor: "#059669", padding: 16, borderRadius: 14 }}>
                <Text style={{ color: "white", textAlign: "center", fontWeight: "700" }}>{busy ? "Saving…" : "Save"}</Text>
              </Pressable>
            </>
          ) : null}
        </View>
      ) : null}

      <View style={{ marginTop: 16 }}>
        <Text style={{ fontWeight: "600", marginBottom: 8 }}>Prefer to type?</Text>
        <View style={{ borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10, minHeight: 120, padding: 12 }}>
          <Text
            onPress={() => Alert.alert("Tip", "Tap the mic above or open CheckInText for a larger textarea.")}
            style={{ color: "#64748b" }}
          >Use the text check-in screen for longer stories.</Text>
        </View>
      </View>

      <Pressable onPress={() => { complete("profile_story"); navigation.navigate("InviteSiblingsStep"); }} style={{ padding: 12 }}>
        <Text style={{ color: "#64748b", textAlign: "center" }}>Skip for now</Text>
      </Pressable>
    </ScrollView>
  );
}
```

- [ ] **Step 2:** Commit:
```bash
git add src/screens/onboarding/ProfileStoryStep.tsx
git commit -m "feat: onboarding — profile story step (voice first, skippable)"
```

---

### Task 5: Invite siblings step

**Files:**
- Create: `src/screens/onboarding/InviteSiblingsStep.tsx`

- [ ] **Step 1:** Reuse Plan B's `inviteSeat` — support adding up to 3 emails in one step. Each success marks `siblings` done. Skip link also marks done (can still invite later in FamilyCircle).

```tsx
import React, { useState } from "react";
import { View, Text, TextInput, Pressable, Alert } from "react-native";
import { inviteSeat } from "../../api/seats";
import { useCurrentProfile } from "../../hooks/useCurrentProfile";
import { useOnboarding } from "../../hooks/useOnboarding";

export default function InviteSiblingsStep({ navigation }: any) {
  const { patientId } = useCurrentProfile();
  const { complete } = useOnboarding();
  const [emails, setEmails] = useState(["", "", ""]);
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!patientId) return;
    setBusy(true);
    try {
      for (const e of emails.filter(x => x.includes("@"))) {
        try { await inviteSeat(patientId, e, "sibling"); } catch (err: any) {
          if (err.message.includes("Starter plan") || err.message.includes("subscription")) break; // Paywall handles upgrade
        }
      }
      await complete("siblings");
      navigation.navigate("SmartHomeStep");
    } catch (e: any) { Alert.alert("Couldn't send", e.message); }
    finally { setBusy(false); }
  };
  const skip = async () => { await complete("siblings"); navigation.navigate("SmartHomeStep"); };

  return (
    <View style={{ padding: 24, gap: 12 }}>
      <Text style={{ fontSize: 24, fontWeight: "700" }}>Invite family</Text>
      <Text style={{ color: "#64748b" }}>Your siblings see the same profile. The more context everyone shares, the better Vela works.</Text>
      {emails.map((e, i) => (
        <TextInput key={i} placeholder={`Sibling ${i + 1} email`} value={e} keyboardType="email-address" autoCapitalize="none"
          onChangeText={(v) => setEmails(emails.map((x, j) => j === i ? v : x))}
          style={{ borderWidth: 1, borderColor: "#e2e8f0", padding: 12, borderRadius: 10 }} />
      ))}
      <Pressable onPress={send} disabled={busy}
        style={{ backgroundColor: "#6366f1", padding: 16, borderRadius: 12, marginTop: 8, opacity: busy ? 0.5 : 1 }}>
        <Text style={{ color: "white", textAlign: "center", fontWeight: "700" }}>Send invites</Text>
      </Pressable>
      <Pressable onPress={skip}><Text style={{ color: "#64748b", textAlign: "center", marginTop: 12 }}>Skip — do this later</Text></Pressable>
    </View>
  );
}
```

- [ ] **Step 2:** Commit.

---

### Task 6: Smart home + caller setup steps (optional, skippable)

**Files:**
- Create: `src/screens/onboarding/SmartHomeStep.tsx`
- Create: `src/screens/onboarding/CallerSetupStep.tsx`

- [ ] **Step 1:** `SmartHomeStep.tsx` — explain what smart-home integration does, link to `SensorSettingsScreen` from Plan D if it exists, else just a "Coming soon" stub. Mark step done on next.

```tsx
import React from "react";
import { View, Text, Pressable } from "react-native";
import { useOnboarding } from "../../hooks/useOnboarding";

export default function SmartHomeStep({ navigation }: any) {
  const { complete } = useOnboarding();
  const advance = async (enabled: boolean) => {
    await complete("smart_home");
    // Optionally route to SensorSettings to enable if user said yes — but for onboarding we just note the preference.
    navigation.navigate("CallerSetupStep");
  };
  return (
    <View style={{ padding: 24, gap: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: "700" }}>Use the smart home you already have?</Text>
      <Text style={{ color: "#64748b" }}>If your parent's home has Apple HomeKit sensors (motion, doors), Vela can quietly learn their rhythms — no new hardware needed.</Text>
      <Pressable onPress={() => advance(true)} style={{ backgroundColor: "#6366f1", padding: 16, borderRadius: 12 }}>
        <Text style={{ color: "white", textAlign: "center", fontWeight: "700" }}>Yes, we have smart home</Text>
      </Pressable>
      <Pressable onPress={() => advance(false)} style={{ padding: 14 }}>
        <Text style={{ color: "#64748b", textAlign: "center" }}>Not right now</Text>
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 2:** `CallerSetupStep.tsx` — small screen that explains the patient companion phone number and offers to register one caller. Reuses Plan E's `addCaller` if present.

- [ ] **Step 3:** Commit both.

---

### Task 7: Paywall step

**Files:**
- Create: `src/screens/onboarding/PaywallStep.tsx`

- [ ] **Step 1:** Wraps Plan B's `PaywallScreen` inside an onboarding frame. After purchase (or skipped with a 3-day soft reminder), mark `paywall` done and route to `CaregiverHome`.

```tsx
import React from "react";
import { View } from "react-native";
import PaywallScreen from "../caregiver/PaywallScreen";
import { useOnboarding } from "../../hooks/useOnboarding";

export default function PaywallStep(props: any) {
  const { complete } = useOnboarding();
  return (
    <View style={{ flex: 1 }}>
      <PaywallScreen
        {...props}
        navigation={{
          ...props.navigation,
          replace: async (route: string) => {
            await complete("paywall");
            props.navigation.replace(route);
          },
        }}
      />
    </View>
  );
}
```

- [ ] **Step 2:** Commit.

---

### Task 8: Onboarding navigator

**Files:**
- Create: `src/navigation/OnboardingNavigator.tsx`
- Modify: `src/navigation/RootNavigator.tsx`

- [ ] **Step 1:** Stack navigator chaining: `ProfileBasicsStep → ProfileStoryStep → InviteSiblingsStep → SmartHomeStep → CallerSetupStep → PaywallStep → CaregiverHome`.

```tsx
import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import ProfileBasicsStep from "../screens/onboarding/ProfileBasicsStep";
import ProfileStoryStep from "../screens/onboarding/ProfileStoryStep";
import InviteSiblingsStep from "../screens/onboarding/InviteSiblingsStep";
import SmartHomeStep from "../screens/onboarding/SmartHomeStep";
import CallerSetupStep from "../screens/onboarding/CallerSetupStep";
import PaywallStep from "../screens/onboarding/PaywallStep";

const Stack = createNativeStackNavigator();
export default function OnboardingNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: true, title: "Setting up" }}>
      <Stack.Screen name="ProfileBasics" component={ProfileBasicsStep} />
      <Stack.Screen name="ProfileStory" component={ProfileStoryStep} />
      <Stack.Screen name="InviteSiblingsStep" component={InviteSiblingsStep} />
      <Stack.Screen name="SmartHomeStep" component={SmartHomeStep} />
      <Stack.Screen name="CallerSetupStep" component={CallerSetupStep} />
      <Stack.Screen name="PaywallStep" component={PaywallStep} options={{ title: "Start your trial" }} />
    </Stack.Navigator>
  );
}
```

- [ ] **Step 2:** In `RootNavigator.tsx`, after sign-in resolves, check `useOnboarding().completed`. If false, render `<OnboardingNavigator />`. If true, render existing caregiver home. Edge case: no patient yet (user just signed up without a linked patient) — route to `ProfileBasics` which creates the patient via `POST /api/patients/mine` (already exists) before marking the first step.

- [ ] **Step 3:** Commit:
```bash
git add src/navigation/OnboardingNavigator.tsx src/navigation/RootNavigator.tsx
git commit -m "feat: onboarding navigator + gate caregiver home on completion"
```

---

### Task 9: Progress indicator + resume behavior

**Files:**
- Create: `src/components/OnboardingProgress.tsx`
- Modify: each onboarding step file to render it at top

- [ ] **Step 1:** `OnboardingProgress.tsx`:
```tsx
import React from "react";
import { View, Text } from "react-native";
import { useOnboarding } from "../hooks/useOnboarding";

const STEPS = ["profile_basics", "profile_story", "siblings", "smart_home", "caller_setup", "paywall"] as const;
const LABELS = { profile_basics: "Basics", profile_story: "Story", siblings: "Family", smart_home: "Sensors", caller_setup: "Phone", paywall: "Plan" };

export default function OnboardingProgress() {
  const { progress } = useOnboarding();
  return (
    <View style={{ flexDirection: "row", paddingHorizontal: 24, paddingTop: 8, gap: 4 }}>
      {STEPS.map((s) => (
        <View key={s} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: progress[s] ? "#6366f1" : "#e2e8f0" }} />
      ))}
    </View>
  );
}
```

- [ ] **Step 2:** Render `<OnboardingProgress />` at the top of each step screen.

- [ ] **Step 3:** Commit.

---

### Task 10: Soft-reminder banner after skipped paywall

**Files:**
- Create: `src/components/OnboardingReminderBanner.tsx`
- Modify: caregiver home screen

- [ ] **Step 1:** When `progress.paywall` is false and the caregiver is in the main app, render a yellow banner: "Start your 7-day trial to unlock family + memory" → opens `PaywallScreen` (Plan B).

- [ ] **Step 2:** Commit.

---

### Task 11: Smoke tests + docs

**Files:** `docs/manual-tests/plan-g-smoke.md`, `README.md`, `CLAUDE.md`

- [ ] **Smoke checklist:**
```markdown
# Plan G Smoke Tests

1. **New signup** — Create a brand new Supabase user. After sign-in, lands on `ProfileBasicsStep`.
2. **Full flow** — Complete all 6 steps without skipping. Ends on CaregiverHome with no reminder banner.
3. **Skip path** — Skip story, siblings, smart home, phone, paywall. Ends on CaregiverHome; yellow "Start your 7-day trial" banner visible.
4. **Resume** — Close app mid-onboarding (after ProfileStory). Relaunch. Lands on the next unfinished step.
5. **Backend progress** — `GET /api/profiles/:patientId/onboarding` reflects the current state.
6. **Completion** — Once all 6 steps true, `completedAt` set; RootNavigator routes to caregiver home on next open.
```

- [ ] **Docs:** README + CLAUDE.md describe the onboarding state model and how steps gate the app.

- [ ] **Commit.**

---

## Plan summary

Backend gets `/api/profiles/:patientId/onboarding` state. Client gets `OnboardingNavigator` + 6 step screens + progress bar + reminder banner. First-run users land in onboarding; completion unlocks the main caregiver experience.

**End of plan set.**

## How to execute these plans

Recommended order (dependency-respecting): **A (done) → B → G** (first user-facing slice) OR **A (done) → C → B → G** if you want voice UX in onboarding. Plans D, E, F can slot anywhere after A.

Execute each with:
1. `superpowers:using-git-worktrees` to create the plan's worktree
2. `superpowers:subagent-driven-development` with the plan doc as the task source
