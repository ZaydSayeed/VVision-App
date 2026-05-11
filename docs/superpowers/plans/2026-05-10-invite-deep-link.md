# Invite Deep Link Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a primary caregiver shares an invite link, the recipient taps it, the Vela app opens (or App Store if not installed), they sign up or log in, and are automatically added to the care team.

**Architecture:** Universal Links on iOS — `https://velavision.org/invite/TOKEN` is intercepted by iOS and opens the app directly. An `apple-app-site-association` file on Netlify authorizes the domain. Token persistence via AsyncStorage handles unauthenticated recipients: the token is saved before login and consumed after. A navigation ref at the `NavigationContainer` level enables imperative navigation from the Linking handler.

**Tech Stack:** React Native + Expo SDK 54, `expo-linking`, `@react-native-async-storage/async-storage`, React Navigation 6, Netlify (static files), Apple Universal Links, EAS Build.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `deploy/netlify-velavision-org/.well-known/apple-app-site-association` | Create | AASA file for Universal Links domain verification |
| `deploy/netlify-velavision-org/invite/index.html` | Create | Fallback page when app not installed |
| `deploy/netlify-velavision-org/netlify.toml` | Create | Redirect rule for `/invite/*` paths |
| `app.json` | Modify | Add `associatedDomains` to iOS section |
| `src/screens/caregiver/InviteSeatScreen.tsx` | Modify | Fix invite URL domain (`.app` → `.org`) |
| `src/navigation/navigationRef.ts` | Create | Exported navigation container ref |
| `App.tsx` | Modify | Attach navigation ref to `NavigationContainer` |
| `src/context/AuthContext.tsx` | Modify | Add `pendingInviteToken` state + post-login AsyncStorage check |
| `src/navigation/RootNavigator.tsx` | Modify | Add `expo-linking` handlers for cold start + foreground URLs |
| `src/screens/AcceptInviteScreen.tsx` | Modify | Add auth guard + clear pending token on mount |

---

## Task 1: Create Netlify domain files

These files go to the **velavision.org** Netlify site — not this app repo. Create them locally under `deploy/netlify-velavision-org/` as a staging area, then upload them to Netlify separately (see Step 4).

**Files:**
- Create: `deploy/netlify-velavision-org/.well-known/apple-app-site-association`
- Create: `deploy/netlify-velavision-org/invite/index.html`
- Create: `deploy/netlify-velavision-org/netlify.toml`

- [ ] **Step 1: Create the staging directory**

```bash
mkdir -p /Users/haadisiddiqui/projects/VVision-App/deploy/netlify-velavision-org/.well-known
mkdir -p /Users/haadisiddiqui/projects/VVision-App/deploy/netlify-velavision-org/invite
```

- [ ] **Step 2: Write the AASA file**

Create `deploy/netlify-velavision-org/.well-known/apple-app-site-association` with this exact content (no extra whitespace or BOM):

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "AL6H52BYM2.com.velavision.caregiver",
        "paths": ["/invite/*"]
      }
    ]
  }
}
```

- [ ] **Step 3: Write the fallback page**

Create `deploy/netlify-velavision-org/invite/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Join a Care Team — Vela Vision</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #0F0D18;
      color: #FFFFFF;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      max-width: 400px;
      width: 100%;
      text-align: center;
    }
    .logo {
      font-size: 28px;
      font-weight: 700;
      color: #9B8BFF;
      margin-bottom: 32px;
      letter-spacing: -0.5px;
    }
    h1 {
      font-size: 26px;
      font-weight: 700;
      line-height: 1.2;
      margin-bottom: 14px;
    }
    p {
      font-size: 16px;
      color: rgba(255,255,255,0.65);
      line-height: 1.6;
      margin-bottom: 36px;
    }
    .btn {
      display: inline-block;
      background: #7B5CE7;
      color: #FFFFFF;
      font-size: 16px;
      font-weight: 600;
      padding: 16px 36px;
      border-radius: 999px;
      text-decoration: none;
    }
    .note {
      font-size: 13px;
      color: rgba(255,255,255,0.4);
      margin-top: 20px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">Vela Vision</div>
    <h1>You've been invited to a care team</h1>
    <p>Download the Vela app to accept your invite and start supporting your loved one's care.</p>
    <a class="btn" href="https://apps.apple.com/app/id6767374702">Download on the App Store</a>
    <p class="note">Already have the app? Open it and sign in — your invite will be waiting.</p>
  </div>
</body>
</html>
```

- [ ] **Step 4: Write the Netlify redirect rule**

Create `deploy/netlify-velavision-org/netlify.toml`:

```toml
[[redirects]]
  from = "/invite/*"
  to = "/invite/index.html"
  status = 200
```

- [ ] **Step 5: Deploy to velavision.org on Netlify**

Go to [app.netlify.com](https://app.netlify.com), open the velavision.org site, and drag-and-drop the contents of `deploy/netlify-velavision-org/` into the Netlify deploy UI. Alternatively, if the site is connected to a GitHub repo, copy the files into that repo and push.

Verify the AASA file is live:
```bash
curl -s https://velavision.org/.well-known/apple-app-site-association
```
Expected: the JSON content from Step 2.

Verify the fallback page:
```bash
curl -s -o /dev/null -w "%{http_code}" https://velavision.org/invite/sometoken123
```
Expected: `200`

- [ ] **Step 6: Commit the deploy staging files**

```bash
cd /Users/haadisiddiqui/projects/VVision-App
git add deploy/
git commit -m "chore: add Netlify deploy files for Universal Links (velavision.org)"
```

---

## Task 2: App config + fix invite URL

**Files:**
- Modify: `app.json`
- Modify: `src/screens/caregiver/InviteSeatScreen.tsx:120`

- [ ] **Step 1: Add associatedDomains to app.json**

Find the `"ios"` section in `app.json`. It already contains `"bundleIdentifier": "com.velavision.caregiver"`. Add `"associatedDomains"` alongside it:

```json
"ios": {
  "bundleIdentifier": "com.velavision.caregiver",
  "associatedDomains": ["applinks:velavision.org"],
  ...existing ios keys...
}
```

- [ ] **Step 2: Fix the invite URL domain**

In `src/screens/caregiver/InviteSeatScreen.tsx`, find line 120:
```ts
const link = `https://velavision.app/invite/${token}`;
```
Change to:
```ts
const link = `https://velavision.org/invite/${token}`;
```

- [ ] **Step 3: TypeScript check**

```bash
cd /Users/haadisiddiqui/projects/VVision-App && npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors in `InviteSeatScreen.tsx`.

- [ ] **Step 4: Commit**

```bash
cd /Users/haadisiddiqui/projects/VVision-App
git add app.json src/screens/caregiver/InviteSeatScreen.tsx
git commit -m "feat: add associatedDomains for Universal Links, fix invite URL domain"
```

---

## Task 3: Create navigation ref

A navigation ref lets code outside the React component tree (like the Linking handler) call `navigate()` imperatively. This is the standard React Navigation pattern for navigating from URL handlers.

**Files:**
- Create: `src/navigation/navigationRef.ts`
- Modify: `App.tsx`

- [ ] **Step 1: Create the navigation ref module**

Create `src/navigation/navigationRef.ts`:

```ts
import { createNavigationContainerRef } from "@react-navigation/native";

export const navigationRef = createNavigationContainerRef<any>();
```

- [ ] **Step 2: Attach the ref to NavigationContainer in App.tsx**

In `App.tsx`, add this import at the top:
```ts
import { navigationRef } from "./src/navigation/navigationRef";
```

Find the `<NavigationContainer>` tag in `App.tsx` and add the `ref` prop:
```tsx
<NavigationContainer ref={navigationRef}>
```

- [ ] **Step 3: TypeScript check**

```bash
cd /Users/haadisiddiqui/projects/VVision-App && npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/haadisiddiqui/projects/VVision-App
git add src/navigation/navigationRef.ts App.tsx
git commit -m "feat: add navigation ref for imperative navigation from Linking handlers"
```

---

## Task 4: AuthContext — pending invite token

After a successful login or signup, check AsyncStorage for a saved invite token and expose it via context so `RootNavigator` can react to it.

**Files:**
- Modify: `src/context/AuthContext.tsx`

- [ ] **Step 1: Update AuthContextValue interface**

At the top of `src/context/AuthContext.tsx`, find the `AuthContextValue` interface and add two fields:

```ts
interface AuthContextValue {
  user: AppUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string, role: UserRole) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (user: AppUser) => void;
  pendingInviteToken: string | null;
  clearPendingInviteToken: () => void;
}
```

- [ ] **Step 2: Add AsyncStorage import**

At the top of `src/context/AuthContext.tsx`, add:
```ts
import AsyncStorage from "@react-native-async-storage/async-storage";
```

- [ ] **Step 3: Add state and clearPendingInviteToken in AuthProvider**

Inside `AuthProvider`, after the existing `useState` declarations, add:

```ts
const [pendingInviteToken, setPendingInviteToken] = useState<string | null>(null);

const clearPendingInviteToken = useCallback(() => {
  setPendingInviteToken(null);
}, []);
```

- [ ] **Step 4: Add post-login AsyncStorage check to login()**

Inside the `login` callback, after `setUser(appUser)` and `resetInactivityTimer()`, add:

```ts
const pending = await AsyncStorage.getItem("@vela/pending_invite");
if (pending) {
  setPendingInviteToken(pending);
  await AsyncStorage.removeItem("@vela/pending_invite");
}
```

The full end of the `login` callback should look like:
```ts
setUser(appUser);
resetInactivityTimer();

const pending = await AsyncStorage.getItem("@vela/pending_invite");
if (pending) {
  setPendingInviteToken(pending);
  await AsyncStorage.removeItem("@vela/pending_invite");
}
```

- [ ] **Step 5: Add the same check to signup()**

Inside the `signup` callback, after `setUser(appUser)` and `resetInactivityTimer()`, add the same block:

```ts
setUser(appUser);
resetInactivityTimer();

const pending = await AsyncStorage.getItem("@vela/pending_invite");
if (pending) {
  setPendingInviteToken(pending);
  await AsyncStorage.removeItem("@vela/pending_invite");
}
```

- [ ] **Step 6: Add pendingInviteToken and clearPendingInviteToken to Provider value**

Find the `<AuthContext.Provider value={...}>` and add the two new fields:

```tsx
<AuthContext.Provider
  value={{ user, loading, login, signup, logout, updateUser, pendingInviteToken, clearPendingInviteToken }}
>
```

- [ ] **Step 7: TypeScript check**

```bash
cd /Users/haadisiddiqui/projects/VVision-App && npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors in `AuthContext.tsx`.

- [ ] **Step 8: Commit**

```bash
cd /Users/haadisiddiqui/projects/VVision-App
git add src/context/AuthContext.tsx
git commit -m "feat: add pendingInviteToken to AuthContext for post-login invite resumption"
```

---

## Task 5: RootNavigator — Linking handlers

Intercept incoming URLs on cold start and while the app is open. Extract the invite token and either navigate immediately (if logged in) or save to AsyncStorage (if not).

**Files:**
- Modify: `src/navigation/RootNavigator.tsx`

- [ ] **Step 1: Add imports**

At the top of `src/navigation/RootNavigator.tsx`, add these two imports (alongside the existing imports):

```ts
import * as Linking from "expo-linking";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { navigationRef } from "./navigationRef";
```

- [ ] **Step 2: Add the Linking useEffect inside RootNavigator**

`RootNavigator` is a function component. Find the component body (where the existing `useEffect` hooks are) and add this new `useEffect`. It must be inside `RootNavigator` so it has access to `useAuth()`.

Add these lines in the `RootNavigator` function body, after the existing hook calls:

```ts
const { user, pendingInviteToken, clearPendingInviteToken } = useAuth();

// Handle Universal Link invite URLs
useEffect(() => {
  function handleInviteUrl(url: string | null) {
    if (!url) return;
    const match = url.match(/\/invite\/([a-f0-9]+)/);
    if (!match) return;
    const token = match[1];
    if (user) {
      // Already logged in — navigate immediately
      if (navigationRef.isReady()) {
        navigationRef.navigate("AcceptInvite" as never, { token } as never);
      }
    } else {
      // Not logged in — save for after login
      AsyncStorage.setItem("@vela/pending_invite", token);
    }
  }

  // Cold start: app was launched by tapping the link
  Linking.getInitialURL().then(handleInviteUrl);

  // Foreground: app was already open when link was tapped
  const subscription = Linking.addEventListener("url", ({ url }) => handleInviteUrl(url));
  return () => subscription.remove();
}, [user]);

// After login: pendingInviteToken was set by AuthContext — navigate now
useEffect(() => {
  if (!pendingInviteToken) return;
  if (navigationRef.isReady()) {
    navigationRef.navigate("AcceptInvite" as never, { token: pendingInviteToken } as never);
    clearPendingInviteToken();
  }
}, [pendingInviteToken]);
```

Note: `useAuth()` is already called in `RootNavigator` — do not add a duplicate call. Just destructure `pendingInviteToken` and `clearPendingInviteToken` from the existing `useAuth()` call if one already exists, or add it if not.

- [ ] **Step 3: TypeScript check**

```bash
cd /Users/haadisiddiqui/projects/VVision-App && npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors in `RootNavigator.tsx`.

- [ ] **Step 4: Commit**

```bash
cd /Users/haadisiddiqui/projects/VVision-App
git add src/navigation/RootNavigator.tsx
git commit -m "feat: intercept Universal Link invite URLs in RootNavigator"
```

---

## Task 6: AcceptInviteScreen updates

Add an auth guard (so the screen fails gracefully if somehow reached without a session) and clear any pending token from AsyncStorage on mount.

**Files:**
- Modify: `src/screens/AcceptInviteScreen.tsx`

- [ ] **Step 1: Add imports**

In `src/screens/AcceptInviteScreen.tsx`, add:

```ts
import { useAuth } from "../context/AuthContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
```

- [ ] **Step 2: Destructure user from useAuth**

Inside the `AcceptInviteScreen` function, after `const { colors } = useTheme();`, add:

```ts
const { user } = useAuth();
```

- [ ] **Step 3: Replace the useEffect with the updated version**

Replace the entire existing `useEffect` block with:

```ts
useEffect(() => {
  // Clear any pending invite token from AsyncStorage (the navigation already happened)
  AsyncStorage.removeItem("@vela/pending_invite");

  if (!token) {
    setMessage("Invalid invite link.");
    setStatus("error");
    return;
  }
  if (!user) {
    setMessage("Please log in before accepting this invite.");
    setStatus("error");
    return;
  }
  (async () => {
    try {
      const r = await acceptInvite(token);
      setMessage(`You're now part of this care team as ${r.role.replace("_", " ")}.`);
      setStatus("done");
    } catch (e: any) {
      setMessage(e.message ?? "This invite link is not valid.");
      setStatus("error");
    }
  })();
}, [token, user]);
```

- [ ] **Step 4: TypeScript check**

```bash
cd /Users/haadisiddiqui/projects/VVision-App && npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors in `AcceptInviteScreen.tsx`.

- [ ] **Step 5: Commit**

```bash
cd /Users/haadisiddiqui/projects/VVision-App
git add src/screens/AcceptInviteScreen.tsx
git commit -m "feat: AcceptInviteScreen auth guard + clear pending token on mount"
```

---

## Task 7: Push + EAS Build 3

Universal Links require a native build — the `associatedDomains` entitlement is baked into the binary. OTA updates cannot activate it.

- [ ] **Step 1: Push all changes to main**

```bash
cd /Users/haadisiddiqui/projects/VVision-App && git push origin main
```

- [ ] **Step 2: Confirm Netlify files are live**

Before building, verify the AASA file is accessible (Apple will fetch it on install):

```bash
curl -s https://velavision.org/.well-known/apple-app-site-association
```

Expected output:
```json
{"applinks":{"apps":[],"details":[{"appID":"AL6H52BYM2.com.velavision.caregiver","paths":["/invite/*"]}]}}
```

If this returns a 404 or HTML, the Netlify deploy from Task 1 hasn't completed yet. Do not build until this is live.

- [ ] **Step 3: Trigger EAS Build**

```bash
cd /Users/haadisiddiqui/projects/VVision-App && npx eas build --profile production --platform ios
```

This is Build 3. Takes ~15-20 minutes.

- [ ] **Step 4: Submit to TestFlight**

After the build completes:
```bash
npx eas submit --platform ios --latest
```

- [ ] **Step 5: Install Build 3 on a test device**

Install via TestFlight. Universal Links are registered by iOS at install time — they will not work on a build that was installed before `associatedDomains` was added.

- [ ] **Step 6: Smoke test the full flow**

**Test A — logged-in user:**
1. Log into the app as a primary caregiver on a paid plan
2. Go to Care Team → tap + Invite → send invite to a test email
3. On another device (or simulator), open the invite share message
4. Tap the link `https://velavision.org/invite/TOKEN`
5. Expected: app opens directly to AcceptInviteScreen showing a spinner, then "Welcome to the care team"

**Test B — unauthenticated user:**
1. On a fresh device with the app installed but not logged in, tap the invite link
2. Expected: app opens, user sees the login screen
3. Log in with the invited email
4. Expected: after login, app navigates automatically to AcceptInviteScreen and accepts the invite

**Test C — app not installed:**
1. On a device without the app, tap the invite link from a message
2. Expected: browser opens `https://velavision.org/invite/TOKEN`, shows the fallback page with the App Store download button
