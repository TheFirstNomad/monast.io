import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { useAccount, useDisconnect, useSignMessage } from "wagmi";
import { useAppKit } from "@reown/appkit/react";
import { getAddress, isAddress } from "viem";
import { supabase } from "@/integrations/supabase/client";
import { ARC_CHAIN_ID } from "@/lib/usdc";
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

type RehydrationStatus =
  | "idle"
  | "checking"
  | "rehydrated"
  | "re-signed"
  | "failed";

interface WalletCtx {
  address: string | null;
  connecting: boolean;
  rehydrationStatus: RehydrationStatus;
  rehydrationError: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  /** Restore or complete the Supabase session for the connected wallet. */
  ensureSession: () => Promise<void>;
}

const Ctx = createContext<WalletCtx>({
  address: null,
  connecting: false,
  rehydrationStatus: "idle",
  rehydrationError: null,
  connect: async () => {},
  disconnect: async () => {},
  ensureSession: async () => {},
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
    `Chain ID: ${ARC_CHAIN_ID}\n` +
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
  const [rehydrationStatus, setRehydrationStatus] = useState<RehydrationStatus>("idle");
  const [rehydrationError, setRehydrationError] = useState<string | null>(null);
  const handledAddress = useRef<string | null>(null);
  const syncing = useRef(false);


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

  // Core sync: reuse the existing session when it belongs to this wallet,
  // otherwise run SIWE so a connected wallet always ends up authenticated.
  const syncSession = useCallback(
    async (normalizedAddress: string) => {
      if (syncing.current) return;
      syncing.current = true;
      setRehydrationStatus("checking");
      setRehydrationError(null);

      try {
        const { data } = await supabase.auth.getSession();
        const sessionWallet = (data.session?.user?.user_metadata as any)?.wallet_address as
          | string
          | undefined;

        if (data.session && addressesEqual(sessionWallet, normalizedAddress)) {
          await supabase
            .from("profiles")
            .update({ wallet_address: normalizedAddress })
            .eq("id", data.session.user.id);
          setRehydrationStatus("rehydrated");
          return;
        }

        if (data.session) {
          await supabase.auth.signOut();
        }

        setRehydrationStatus("re-signed");
        await doSiwe(normalizedAddress);
      } catch (err: any) {
        console.error("[Wallet] Rehydration failed:", err?.message || err);
        setRehydrationStatus("failed");
        setRehydrationError(err?.message || "Session recovery failed");
      } finally {
        syncing.current = false;
      }
    },
    [doSiwe],
  );

  // When a wallet connects, rehydrate session if it matches, otherwise run SIWE
  useEffect(() => {
    if (!isConnected || !address) {
      handledAddress.current = null;
      setRehydrationStatus("idle");
      setRehydrationError(null);
      return;
    }
    const normalizedAddress = normalizeAddress(address);
    if (!normalizedAddress) return;
    if (handledAddress.current && addressesEqual(handledAddress.current, normalizedAddress)) return;
    handledAddress.current = normalizedAddress;
    void syncSession(normalizedAddress);
  }, [isConnected, address, syncSession]);

  /**
   * Called by route guards: a wallet is connected but there is still no
   * session (expired token, earlier rejected signature, fresh tab). Retry the
   * sync instead of bouncing the visitor to the sign-in page.
   */
  const ensureSession = useCallback(async () => {
    const normalizedAddress = normalizeAddress(address);
    if (!isConnected || !normalizedAddress || syncing.current) return;
    handledAddress.current = normalizedAddress;
    await syncSession(normalizedAddress);
  }, [address, isConnected, syncSession]);


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

  const resetRehydration = useCallback(() => {
    setRehydrationStatus("idle");
    setRehydrationError(null);
  }, []);

  // Auto-clear transient success banners after 6s
  useEffect(() => {
    if (rehydrationStatus === "rehydrated" || rehydrationStatus === "re-signed") {
      const t = setTimeout(resetRehydration, 6000);
      return () => clearTimeout(t);
    }
  }, [rehydrationStatus, resetRehydration]);

  return (
    <Ctx.Provider
      value={{
        address: normalizeAddress(address),
        connecting: signingIn,
        rehydrationStatus,
        rehydrationError,
        connect,
        disconnect,
        ensureSession,

      }}
    >
      {children}
    </Ctx.Provider>
  );
};

export const useWallet = () => useContext(Ctx);
