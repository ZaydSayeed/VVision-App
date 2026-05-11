# Invite Deep Link Design

## Goal

When a primary caregiver shares an invite link, the recipient taps it, the app opens (or they're sent to the App Store if not installed), they sign up or log in, and are automatically added to the care team — no manual token entry.

## Architecture

Universal Links on iOS. The invite URL (`https://velavision.org/invite/TOKEN`) is intercepted by iOS and opens the Vela app directly. If the app is not installed, the URL falls through to a Netlify-hosted fallback page with an App Store download link. Apple verifies the domain authorization via an `apple-app-site-association` (AASA) file served from Netlify.

Token persistence via AsyncStorage handles the unauthenticated case: if the user isn't logged in when the link is tapped, the token is saved locally, the user completes login or signup, and the app resumes the invite acceptance automatically.

## Tech Stack

React Native + Expo SDK 54, `expo-linking`, AsyncStorage, Netlify (static file hosting), Apple Universal Links, EAS Build.

---

## Section 1: Netlify (velavision.org)

**Apple Team ID:** `AL6H52BYM2`  
**Bundle ID:** `com.velavision.caregiver`

### `/.well-known/apple-app-site-association`

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

Must be served with `Content-Type: application/json`. Netlify does this automatically for `.json` files. Apple fetches this file when the app is installed to verify the domain association.

### `/invite/index.html`

Static fallback page shown when the app is not installed. Contains:
- Brief explanation ("You've been invited to join a care team on Vela")
- App Store download button linking to the Vela app listing
- No dynamic content — purely static HTML

### `netlify.toml` redirect rule

```toml
[[redirects]]
  from = "/invite/*"
  to = "/invite/index.html"
  status = 200
```

This ensures `/invite/abc123def456` serves the fallback HTML instead of 404ing.

---

## Section 2: App Config

### `app.json` — iOS `associatedDomains`

Add to the `ios` section:
```json
"associatedDomains": ["applinks:velavision.org"]
```

This registers the domain as authorized to open the app via Universal Links. iOS verifies it against the AASA file on install.

**Requires a new EAS build.** This is a native capability — it cannot be delivered via OTA update. Shipping order:
1. Add AASA file to Netlify (domain side ready)
2. Merge all code changes
3. EAS Build → TestFlight (Build 3)
4. Install Build 3 → Universal Links activate

### `src/screens/caregiver/InviteSeatScreen.tsx` — fix invite URL

Change line 120 from:
```ts
const link = `https://velavision.app/invite/${token}`;
```
To:
```ts
const link = `https://velavision.org/invite/${token}`;
```

---

## Section 3: Deep Link Handling

### URL interception — `src/navigation/RootNavigator.tsx`

On mount, `RootNavigator` sets up two listeners using `expo-linking`:

**Cold start** (app launched by tapping the link):
```ts
Linking.getInitialURL().then(url => handleInviteUrl(url));
```

**App already open**:
```ts
Linking.addEventListener('url', ({ url }) => handleInviteUrl(url));
```

`handleInviteUrl(url)` extracts the token:
```ts
function handleInviteUrl(url: string | null) {
  if (!url) return;
  const match = url.match(/\/invite\/([a-f0-9]+)/);
  if (!match) return;
  const token = match[1];
  // branch on auth state (see below)
}
```

**If user is logged in:** call `navigation.navigate("AcceptInvite", { token })` on the active stack.

**If user is not logged in:** save token to AsyncStorage under `@vela/pending_invite`, then let the normal login flow proceed.

### Token persistence — AsyncStorage key: `@vela/pending_invite`

Written when: URL is intercepted and user is not logged in.  
Read when: user successfully logs in or signs up.  
Cleared when: AcceptInviteScreen mounts and begins processing.

### Post-login check — `src/context/AuthContext.tsx`

After a successful `login()` or `signup()` call resolves, check AsyncStorage:
```ts
const pending = await AsyncStorage.getItem('@vela/pending_invite');
if (pending) {
  setPendingInviteToken(pending);
  await AsyncStorage.removeItem('@vela/pending_invite');
}
```

`pendingInviteToken` is added to `AuthContextValue` so `RootNavigator` can react to it and navigate to `AcceptInviteScreen`.

---

## Section 4: AcceptInviteScreen Updates

File: `src/screens/AcceptInviteScreen.tsx`

### Auth guard

At the top of the `useEffect`, if no user session is present, show an error state immediately rather than letting `acceptInvite()` fail with a cryptic auth error:
```ts
if (!user) {
  setMessage("Please log in before accepting this invite.");
  setStatus("error");
  return;
}
```

### Success routing

After successful acceptance, check onboarding completion before routing:
```ts
// On success:
const onboardingKey = `@vela/onboarding_complete:${user.id}`;
const done = await AsyncStorage.getItem(onboardingKey);
if (done) {
  navigation.replace("CaregiverHome");
} else {
  navigation.replace("OnboardingNavigator");
}
```

This ensures a brand-new user who signed up to accept an invite lands on the caregiver onboarding flow rather than jumping straight to the dashboard.

---

## Data Flow

```
Recipient taps link
  └─ App installed?
       ├─ YES → iOS intercepts URL → app opens → RootNavigator reads URL
       │          └─ Logged in?
       │               ├─ YES → navigate to AcceptInviteScreen(token) → accept → route to home/onboarding
       │               └─ NO  → save token to AsyncStorage → show login
       │                          └─ After login → read AsyncStorage → navigate to AcceptInviteScreen(token)
       └─ NO  → Netlify fallback page → "Download Vela" → App Store
```

---

## Out of Scope

- Android deep links (Android Intent Filters) — v2
- Expired/used invite link UX beyond the existing error state in AcceptInviteScreen
- Email delivery of the invite (currently share sheet only)
