# App Review Notes — Vela Vision

Paste into **App Store Connect → your version → App Review Information → Notes**.
Fill in the [BRACKETED] demo-account values before submitting.

---

Vela Vision is a standalone caregiver + patient companion app for families managing
dementia care. It does not require, pair with, or depend on any external hardware —
everything runs on this iPhone/iPad. (A previous version referenced optional smart-glasses
features; those have been fully removed from this build.)

DEMO ACCOUNT (caregiver — this role has the subscriptions):
  Email:    [CAREGIVER_DEMO_EMAIL]
  Password: [CAREGIVER_DEMO_PASSWORD]

HOW TO LOCATE THE IN-APP PURCHASES (Starter / Unlimited subscriptions):
  1. Launch the app and sign in with the caregiver demo account above.
  2. If an onboarding wizard appears, tap "Skip" / "Maybe later" to reach the dashboard.
  3. Tap the menu icon in the top-left corner to open the side menu.
  4. Tap "Subscription."
  5. The paywall opens showing both auto-renewable subscriptions:
       • Vela Vision Starter — $9.99/month (you + 1 sibling)
       • Vela Vision Unlimited — $14.99/month (unlimited care team seats)
     Each begins with a 7-day free trial. The screen also shows the renewal
     terms and functional Privacy Policy and Terms of Use (EULA) links.

NOTES:
  • In-App Purchases are configured for the Apple sandbox and submitted with this build.
  • The Paid Applications agreement is active under Business / Agreements, Tax, and Banking.
  • There are two roles (caregiver and patient) chosen at signup. Subscriptions live on the
    caregiver side; the demo account above is a caregiver.

CONTACT: [YOUR_SUPPORT_EMAIL]

---

## Before you submit — confirm all three are true
- [ ] Paid Applications agreement shows **Active** (Business section)
- [ ] Both subscriptions ticked to submit **with this build** on the version page
- [ ] New EAS build uploaded (the IAP case-sensitivity fix only ships in a fresh build)
