import { useEffect, useMemo, useState } from "react";
import { usePurchases } from "../providers/PurchasesProvider";
import { RC_ENTITLEMENT_STARTER, RC_ENTITLEMENT_UNLIMITED } from "../config/revenuecat";
import { useCurrentProfile } from "./useCurrentProfile";
import { useAuth } from "../context/AuthContext";
import { getMySeatRole, getProfileTier } from "../api/seats";

export type Tier = "free" | "starter" | "unlimited";

export function useSubscription(): { tier: Tier; ready: boolean; trialActive: boolean; isInvitedMember: boolean } {
  const { customerInfo, ready: rcReady } = usePurchases();
  const { patientId } = useCurrentProfile();
  const { user } = useAuth();
  const [seatRole, setSeatRole] = useState<string | null>(null);
  const [profileTier, setProfileTier] = useState<Tier | null>(null);
  const [profileReady, setProfileReady] = useState(false);

  useEffect(() => {
    if (!patientId || user?.role === "patient") {
      setProfileReady(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const role = await getMySeatRole(patientId);
        if (cancelled) return;
        setSeatRole(role);
        if (role && role !== "primary_caregiver") {
          const tier = await getProfileTier(patientId);
          if (!cancelled) setProfileTier(tier);
        }
      } catch {
        // fallback: treat as primary caregiver, use own RC entitlement
      } finally {
        if (!cancelled) setProfileReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, [patientId, user?.role]);

  return useMemo(() => {
    const isInvitedMember = !!seatRole && seatRole !== "primary_caregiver";

    if (isInvitedMember) {
      return {
        tier: profileTier ?? "free",
        ready: profileReady,
        trialActive: false,
        isInvitedMember: true,
      };
    }

    // Primary caregiver or patient: use own RC entitlement
    if (!customerInfo) return { tier: "free", ready: rcReady && profileReady, trialActive: false, isInvitedMember: false };
    const ent = customerInfo.entitlements.active;
    const unlimited = ent[RC_ENTITLEMENT_UNLIMITED];
    const starter = ent[RC_ENTITLEMENT_STARTER];
    const active = unlimited || starter;
    const tier: Tier = unlimited ? "unlimited" : starter ? "starter" : "free";
    const trialActive = active?.periodType === "trial";
    return { tier, ready: rcReady && profileReady, trialActive, isInvitedMember: false };
  }, [customerInfo, rcReady, seatRole, profileTier, profileReady]);
}
