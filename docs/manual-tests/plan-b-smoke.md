# Plan B Smoke Tests

Run on iOS simulator or physical device (Expo dev client required — Expo Go will not load).

1. **First-run sign-in** — Sign in as a new caregiver. Confirm onboarding routes to CaregiverHome (not Paywall).
2. **Paywall entry** — Open Family tab, tap "Start your 7-day trial" banner. Paywall loads both tiers.
3. **Trial purchase** — Buy Starter via sandbox account. Returns to CaregiverHome; Family tab no longer shows banner.
4. **Invite sibling** — From Family tab, tap + Invite, enter email, tap Send invite. Share sheet opens with invite link.
5. **Second seat** — Use another sandbox user to accept via deep link `velavision://invite/<token>`. AcceptInviteScreen shows success.
6. **Cap enforcement** — With Starter + 2 seats, try a 3rd invite. Backend returns 402 → app routes to Paywall.
7. **Upgrade to Unlimited** — Purchase Unlimited from Paywall. Try 3rd invite again — succeeds.
8. **Restore purchases** — Log out, log back in on same RC sandbox account, tap Restore on Paywall. Subscription reappears.
9. **Webhook sanity** — Trigger a test webhook event in RevenueCat dashboard. Confirm `subscriptions` collection updates in MongoDB Atlas.
