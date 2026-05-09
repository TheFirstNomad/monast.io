import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Arc blockchain (Circle Arc) — testnet chainId 421614 placeholder; using mainnet 1 if unknown
const ARC_CHAIN_ID_HEX = "0xa4b1"; // adjust as needed
const ARC_PARAMS = {
  chainId: ARC_CHAIN_ID_HEX,
  chainName: "Arc",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: ["https://arc-mainnet.g.alchemy.com/public"],
  blockExplorerUrls: ["https://explorer.arc.network"],
};

interface WalletCtx {
  address: string | null;
  connecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const Ctx = createContext<WalletCtx>({ address: null, connecting: false, connect: async () => {}, disconnect: () => {} });

declare global {
  interface Window { ethereum?: any }
}

export const WalletProvider = ({ children }: { children: ReactNode }) => {
  const [address, setAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("wallet_address");
    if (stored) setAddress(stored);
    if (!window.ethereum) return;
    const handler = (accounts: string[]) => {
      const a = accounts[0] ?? null;
      setAddress(a);
      if (a) localStorage.setItem("wallet_address", a);
      else localStorage.removeItem("wallet_address");
    };
    window.ethereum.on?.("accountsChanged", handler);
    return () => window.ethereum.removeListener?.("accountsChanged", handler);
  }, []);

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      toast.error("No wallet detected. Install MetaMask.");
      return;
    }
    setConnecting(true);
    try {
      const accounts: string[] = await window.ethereum.request({ method: "eth_requestAccounts" });
      const addr = accounts[0];
      setAddress(addr);
      localStorage.setItem("wallet_address", addr);
      try {
        await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: ARC_CHAIN_ID_HEX }] });
      } catch (e: any) {
        if (e.code === 4902) {
          await window.ethereum.request({ method: "wallet_addEthereumChain", params: [ARC_PARAMS] });
        }
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (user) await supabase.from("profiles").update({ wallet_address: addr }).eq("id", user.id);
      toast.success("Wallet connected");
    } catch (e: any) {
      toast.error(e.message || "Connection failed");
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    localStorage.removeItem("wallet_address");
  }, []);

  return <Ctx.Provider value={{ address, connecting, connect, disconnect }}>{children}</Ctx.Provider>;
};

export const useWallet = () => useContext(Ctx);
