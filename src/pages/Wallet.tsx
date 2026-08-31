import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useReadContract } from "wagmi";
import { Layout } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ReceiveCard } from "@/components/wallet/ReceiveCard";
import { SendUsdcCard } from "@/components/wallet/SendUsdcCard";
import { ActivityList } from "@/components/wallet/ActivityList";
import { supabase } from "@/integrations/supabase/client";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { AuthResolving } from "@/components/AuthResolving";
import { useSeo } from "@/hooks/useSeo";
import { CHAINS } from "@/lib/chains";
import { ERC20_BALANCE_ABI, USDC_ADDRESS, USDC_DECIMALS } from "@/lib/usdc";
import { fetchCircleActivity, fetchCircleBalance, type WalletActivityItem } from "@/lib/wallet/api";
import { Check, RefreshCw, Wallet as WalletIcon } from "lucide-react";

const ARC = CHAINS["arc-testnet"];

const Wallet = () => {
  useSeo({
    title: "monast.io | Your USDC wallet",
    description: "Check your USDC balance on Arc, receive funds and withdraw to any wallet.",
    noindex: true,
  });

  const { user, resolving } = useRequireAuth();
  const [address, setAddress] = useState<string | null>(null);
  const [isCircleWallet, setIsCircleWallet] = useState(false);
  const [loadingWallet, setLoadingWallet] = useState(true);

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("wallet_address, circle_wallet_address")
        .eq("id", user.id)
        .maybeSingle();
      if (!active) return;
      if (data?.wallet_address) {
        setAddress(data.wallet_address);
        setIsCircleWallet(false);
      } else if (data?.circle_wallet_address) {
        setAddress(data.circle_wallet_address);
        setIsCircleWallet(true);
      } else {
        setAddress(null);
      }
      setLoadingWallet(false);
    })();
    return () => {
      active = false;
    };
  }, [user]);

  // Live sync: poll fast while the tab is visible, pause when hidden so we
  // never burn Circle calls in a background tab, and refetch on focus.
  const [tabVisible, setTabVisible] = useState(
    typeof document === "undefined" ? true : document.visibilityState === "visible",
  );
  useEffect(() => {
    const onVisibility = () => setTabVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // Circle wallets: balance and activity come from the backend in parallel.
  const circleBalance = useQuery({
    queryKey: ["circle-balance", user?.id],
    queryFn: fetchCircleBalance,
    enabled: !!user && isCircleWallet,
    refetchInterval: tabVisible ? 5_000 : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });
  const circleActivity = useQuery({
    queryKey: ["circle-activity", user?.id],
    queryFn: fetchCircleActivity,
    enabled: !!user && isCircleWallet,
    refetchInterval: tabVisible ? 10_000 : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  // Self-custody wallets: read USDC straight from Arc.
  const onChain = useReadContract({
    address: USDC_ADDRESS,
    abi: ERC20_BALANCE_ABI,
    functionName: "balanceOf",
    args: address && !isCircleWallet ? [address as `0x${string}`] : undefined,
    chainId: ARC.id,
    query: {
      enabled: !!address && !isCircleWallet,
      refetchInterval: tabVisible ? 5_000 : false,
      refetchOnWindowFocus: true,
      staleTime: 0,
    },
  });

  const balance: number | null = isCircleWallet
    ? circleBalance.data?.balanceUsdc ?? null
    : typeof onChain.data === "bigint"
      ? Number(onChain.data) / 10 ** USDC_DECIMALS
      : null;

  const loadingBalance = isCircleWallet ? circleBalance.isLoading : onChain.isLoading;

  const refresh = useCallback(() => {
    if (isCircleWallet) {
      circleBalance.refetch();
      circleActivity.refetch();
    } else {
      onChain.refetch();
    }
  }, [isCircleWallet, circleBalance, circleActivity, onChain]);

  const activity: WalletActivityItem[] = isCircleWallet ? circleActivity.data ?? [] : [];

  if (resolving) return <AuthResolving label="Opening your wallet..." />;
  if (!user) return null;

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Your wallet</h1>
          <p className="text-sm text-muted-foreground">
            USDC on {ARC.label}. Receive payments, and withdraw to any wallet you own.
          </p>
        </div>

        {/* Balance */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                <WalletIcon className="w-3.5 h-3.5" />
                {isCircleWallet ? "monast wallet (created with Google)" : "Connected wallet"}
              </div>
              {loadingBalance || loadingWallet ? (
                <Skeleton className="h-9 w-40 mt-2" />
              ) : (
                <div className="text-3xl font-bold text-foreground mt-1">
                  {(balance ?? 0).toLocaleString(undefined, { maximumFractionDigits: 6 })}{" "}
                  <span className="text-base font-semibold text-muted-foreground">USDC</span>
                </div>
              )}
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              <Badge variant="secondary" className="gap-1">
                <Check className="w-3 h-3" /> {ARC.label}
              </Badge>
              <Button size="sm" variant="ghost" className="gap-1.5 h-7 px-2" onClick={refresh}>
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} /> Refresh
              </Button>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span
              className={`inline-block w-1.5 h-1.5 rounded-full ${
                tabVisible ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground"
              }`}
            />
            {tabVisible ? "Live - updates automatically" : "Paused while this tab is in the background"}
            {lastUpdatedLabel && <span>· updated {lastUpdatedLabel}</span>}
          </div>
          {!hasBalance && (isCircleWallet ? circleBalance.error : onChain.error) && (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-secondary px-3 py-2">
              <p className="text-xs text-muted-foreground">
                Balance is taking a moment to load. Your funds are safe.
              </p>
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs shrink-0" onClick={refresh}>
                Try again
              </Button>
            </div>
          )}
        </div>

        {loadingWallet ? (
          <Skeleton className="h-40 w-full" />
        ) : !address ? (
          <div className="bg-card border border-border rounded-xl p-5 text-sm text-muted-foreground">
            No wallet on this account yet. Connect a self-custody wallet from the top-right menu, or open
            profile settings to finish setting up your monast wallet.
          </div>

        ) : (
          <>
            <ReceiveCard address={address} />
            <SendUsdcCard isCircleWallet={isCircleWallet} balance={balance} onSent={refresh} />
            {isCircleWallet && (
              <ActivityList items={activity} loading={circleActivity.isLoading} />
            )}
          </>
        )}
      </div>
    </Layout>
  );
};

export default Wallet;
