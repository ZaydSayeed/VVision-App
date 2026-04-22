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
    const key = Platform.OS === "ios" ? RC_API_KEY_IOS : RC_API_KEY_ANDROID;
    Purchases.configure({ apiKey: key, appUserID: user?.id });
    Purchases.addCustomerInfoUpdateListener(setCustomerInfo);
    Purchases.getCustomerInfo().then(setCustomerInfo).finally(() => setReady(true));
  }, [user?.id]);

  const refresh = async () => {
    const info = await Purchases.getCustomerInfo();
    setCustomerInfo(info);
  };

  return <PurchasesContext.Provider value={{ customerInfo, refresh, ready }}>{children}</PurchasesContext.Provider>;
}

export const usePurchases = () => useContext(PurchasesContext);
