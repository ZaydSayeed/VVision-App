// App Review demo account.
//
// The App Store reviewer signs in with this account. We deterministically place
// it in the post-trial ("free") subscription state so the reviewer can reach the
// In-App Purchase paywall (Guideline 2.1(b)) without any RevenueCat/StoreKit
// sandbox setup. The matching Supabase account must exist with a demo patient
// linked so voice check-ins also function for the reviewer (Guideline 2.1(a)).
//
// Keep this email in sync with the credentials entered in App Store Connect →
// App Review Information.
export const REVIEWER_EMAIL = "appreview@velavision.org";

export const isReviewer = (email?: string | null): boolean =>
  !!email && email.trim().toLowerCase() === REVIEWER_EMAIL;
