import { createContext, useCallback, useContext, useEffect, ReactNode } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { useAppKit } from "@reown/appkit/react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface WalletCtx {
  address: string | null;
  connecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const Ctx = createContext<WalletCtx>({
  address: null,
  connecting: false,
  connect: async () => {},
  disconnect: () => {},
});

export const WalletProvider = ({ children }: { children: ReactNode }) => {
  const { address, isConnected } = useAccount();
  const { isPending: connectPending } = useConnect();
  const { disconnect: wagmiDisconnect } = useDisconnect();
  const { open } = useAppKit();

  // Sync wallet address into the user's profile once connected.
  useEffect(() => {
    if (!isConnected || !address) return;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("profiles").update({ wallet_address: address }).eq("id", user.id);
    })();
  }, [isConnected, address]);

  const connect = useCallback(async () => {
    try {
      await open();
    } catch (e: any) {
      toast.error(e?.message || "Could not open wallet picker");
    }
  }, [open]);

  const disconnect = useCallback(() => {
    wagmiDisconnect();
  }, [wagmiDisconnect]);

  return (
    <Ctx.Provider
      value={{
        address: address ?? null,
        connecting: connectPending,
        connect,
        disconnect,
      }}
    >
      {children}
    </Ctx.Provider>
  );
};

export const useWallet = () => useContext(Ctx);
