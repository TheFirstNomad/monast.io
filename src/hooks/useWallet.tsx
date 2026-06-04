import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { useAccount, useDisconnect, useSignMessage } from "wagmi";
import { useAppKit } from "@reown/appkit/react";
import { getAddress, isAddress } from "viem";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Normalize an EVM address for comparison.
 * - Validates the address shape.
 * - Returns the EIP-55 checksummed form when possible.
 * - Falls back to lowercase for anything non-standard so comparisons stay safe.
 */
function normalizeAddress(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    if (isAddress(trimmed)) return getAddress(trimmed);
  } catch {
    // fall through
  }
  return trimmed.toLowerCase();
}

function addressesEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizeAddress(a);
  const nb = normalizeAddress(b);
  if (!na || !nb) return false;
  return na.toLowerCase() === nb.toLowerCase();
}

interface WalletCtx {
  address: string | null;
  connecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

const Ctx = createContext<WalletCtx>({
  address: null,
  connecting: false,
  connect: async () => {},
  disconnect: async () => {},
});

function buildSiweMessage(address: string, nonce: string) {
  const domain = window.location.host;
  const uri = window.location.origin;
  const issuedAt = new Date().toISOString();
  return (
    `${domain} wants you to sign in with your Ethereum account:\n` +
    `${address}\n\n` +
    `Sign in to monast.io\n\n` +
    `URI: ${uri}\n` +
    `Version: 1\n` +
    `Chain ID: 1\n` +
    `Nonce: ${nonce}\n` +
    `Issued At: ${issuedAt}`
  );
}

export const WalletProvider = ({ children }: { children: ReactNode }) => {
  const { address, isConnected } = useAccount();
  const { disconnectAsync } = useDisconnect();
  const { open } = useAppKit();
  const { signMessageAsync } = useSignMessage();
  const [signingIn, setSigningIn] = useState(false);
  const handledAddress = useRef<string | null>(null);

  const doSiwe = useCallback(
    async (addr: string) => {
      setSigningIn(true);
      try {
        // 1. Get a fresh nonce
        const { data: nonceData, error: nonceErr } = await supabase.functions.invoke("siwe-nonce", {
          body: {},
        });
        if (nonceErr || !nonceData?.nonce) throw new Error(nonceErr?.message || "Could not get nonce");

        // 2. Ask the wallet to sign the SIWE message
        const message = buildSiweMessage(addr, nonceData.nonce);
        const signature = await signMessageAsync({ account: addr as `0x${string}`, message });

        // 3. Verify on server, get a session
        const { data: verifyData, error: verifyErr } = await supabase.functions.invoke("siwe-verify", {
          body: { message, signature },
        });
        if (verifyErr) throw new Error(verifyErr.message);
        if (!verifyData?.access_token) throw new Error(verifyData?.error || "Sign-in failed");

        await supabase.auth.setSession({
          access_token: verifyData.access_token,
          refresh_token: verifyData.refresh_token,
        });

        toast.success("Signed in");
      } catch (e: any) {
        toast.error(e?.message || "Wallet sign-in failed");
        // If the user rejected the signature, disconnect so they can retry cleanly
        try {
          await disconnectAsync();
        } catch {}
        handledAddress.current = null;
      } finally {
        setSigningIn(false);
      }
    },
    [signMessageAsync, disconnectAsync],
  );

  // When a wallet connects, rehydrate session if it matches, otherwise run SIWE
  useEffect(() => {
    if (!isConnected || !address) {
      handledAddress.current = null;
      return;
    }
    if (handledAddress.current === address) return;
    handledAddress.current = address;

    (async () => {
      const { data } = await supabase.auth.getSession();
      const sessionWallet = (data.session?.user?.user_metadata as any)?.wallet_address as
        | string
        | undefined;

      if (data.session && sessionWallet?.toLowerCase() === address.toLowerCase()) {
        // Same wallet — rehydrate existing session, just mirror to profile.
        await supabase
          .from("profiles")
          .update({ wallet_address: address })
          .eq("id", data.session.user.id);
        return;
      }

      if (data.session) {
        // Different wallet than the active session — sign out before re-authenticating.
        await supabase.auth.signOut();
      }

      await doSiwe(address);
    })();
  }, [isConnected, address, doSiwe]);

  const connect = useCallback(async () => {
    try {
      await open();
    } catch (e: any) {
      toast.error(e?.message || "Could not open wallet picker");
    }
  }, [open]);

  const disconnect = useCallback(async () => {
    try {
      await disconnectAsync();
    } catch {}
    await supabase.auth.signOut();
    handledAddress.current = null;
  }, [disconnectAsync]);

  return (
    <Ctx.Provider
      value={{
        address: address ?? null,
        connecting: signingIn,
        connect,
        disconnect,
      }}
    >
      {children}
    </Ctx.Provider>
  );
};

export const useWallet = () => useContext(Ctx);
