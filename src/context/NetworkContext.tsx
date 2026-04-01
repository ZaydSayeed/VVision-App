import React, { createContext, useContext, useState, useCallback } from "react";

interface NetworkContextValue {
  isOffline: boolean;
  setOffline: (offline: boolean) => void;
}

const NetworkContext = createContext<NetworkContextValue>({
  isOffline: false,
  setOffline: () => {},
});

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [isOffline, setOffline] = useState(false);

  const handleSetOffline = useCallback((offline: boolean) => {
    setOffline(offline);
  }, []);

  return (
    <NetworkContext.Provider value={{ isOffline, setOffline: handleSetOffline }}>
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork() {
  return useContext(NetworkContext);
}
