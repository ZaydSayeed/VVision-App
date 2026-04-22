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
