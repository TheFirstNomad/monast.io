import { createContext, useContext, useState, ReactNode } from "react";

type Network = "arc-testnet" | "base";

interface WalletContextType {
  address: string | null;
  isConnected: boolean;
  network: Network;
  connect: () => void;
  disconnect: () => void;
  setNetwork: (n: Network) => void;
}

const WalletContext = createContext<WalletContextType | null>(null);

export const WalletProvider = ({ children }: { children: ReactNode }) => {
  const [address, setAddress] = useState<string | null>(null);
  const [network, setNetwork] = useState<Network>("base");

  const connect = () => {
    // Mock wallet connection
    setAddress("0x1a2B3c4D5e6F7890AbCdEf1234567890aBcDeF12");
  };

  const disconnect = () => {
    setAddress(null);
  };

  return (
    <WalletContext.Provider
      value={{
        address,
        isConnected: !!address,
        network,
        connect,
        disconnect,
        setNetwork,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
};
