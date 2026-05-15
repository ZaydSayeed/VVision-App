import React, { createContext, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";
import Purchases, { CustomerInfo } from "react-native-purchases";
import { RC_API_KEY_IOS, RC_API_KEY_ANDROID } from "../config/revenuecat";
import { useAuth } from "../context/AuthContext";

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
    if (Platform.OS === "web") {
      setReady(true);
      return;
    }
    const key = Platform.OS === "ios" ? RC_API_KEY_IOS : RC_API_KEY_ANDROID;
    // Real RevenueCat keys: iOS -> "appl_...", Android -> "goog_...".
    // A non-matching value (placeholder/test key) makes the native SDK
    // fire a Swift Task on launch that can assert and kill the process.
    const isRealKey =
      (Platform.OS === "ios" && key.startsWith("appl_")) ||
      (Platform.OS === "android" && key.startsWith("goog_"));
    if (!isRealKey) {
      setReady(true);
      return;
    }
    Purchases.configure({ apiKey: key, appUserID: user?.id });
    Purchases.addCustomerInfoUpdateListener(setCustomerInfo);
    Purchases.getCustomerInfo().then(setCustomerInfo).finally(() => setReady(true));
  }, [user?.id]);

  const refresh = async () => {
    if (Platform.OS === "web") return;
    const info = await Purchases.getCustomerInfo();
    setCustomerInfo(info);
  };

  return <PurchasesContext.Provider value={{ customerInfo, refresh, ready }}>{children}</PurchasesContext.Provider>;
}

export const usePurchases = () => useContext(PurchasesContext);
