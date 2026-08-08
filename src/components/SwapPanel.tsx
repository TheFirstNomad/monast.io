import { useMemo, useState } from "react";
import { useAccount, useBalance } from "wagmi";
import { useAppKitProvider } from "@reown/appkit/react";
import { Button } from "@/components/ui/button";
import { ArrowDownUp, Loader2, ExternalLink, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useWallet } from "@/hooks/useWallet";
import { useAuth } from "@/hooks/useAuth";
import { SignInChoiceDialog } from "@/components/SignInChoice";
import { ARC_TESTNET_TOKENS, findToken } from "@/lib/swapTokens";
import {
  createViemAdapterFromWallet,
  swapViaKit,
  getExplorerUrl,
  getChainLabel,
  type PaymentChainId,
} from "@/lib/arcAppKit";

const CHAIN_ID: PaymentChainId = 5042002;

/**
 * Real on-chain swap panel powered by Circle App Kit (`kit.swap`).
 * No monast.io DEX contracts or liquidity pools — routing is Circle's.
 */
export const SwapPanel = ({ compact = false }: { compact?: boolean }) => {
  const { address, connecting } = useWallet();
  const { user } = useAuth();
  const { address: wagmiAddress } = useAccount();
  const { walletProvider } = useAppKitProvider("eip155");

  const [fromSymbol, setFromSymbol] = useState("USDC");
  const [toSymbol, setToSymbol] = useState("EURC");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [signInOpen, setSignInOpen] = useState(false);

  // Signed in by email (Circle wallet) but no EIP-1193 signer available.
  const circleOnly = Boolean(user) && !address;


  const fromToken = findToken(fromSymbol);

  const { data: balance } = useBalance({
    address: wagmiAddress,
    token: fromToken?.address,
    query: { enabled: Boolean(wagmiAddress) },
  });

  const balanceLabel = useMemo(() => {
    if (!balance) return null;
    const n = Number(balance.formatted);
    return `${n.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${fromSymbol}`;
  }, [balance, fromSymbol]);

  const flip = () => {
    setFromSymbol(toSymbol);
    setToSymbol(fromSymbol);
    setAmount("");
    setTxHash(null);
  };

  const parsed = Number(amount);
  const canSwap =
    Boolean(address) && fromSymbol !== toSymbol && Number.isFinite(parsed) && parsed > 0 && !busy;

  const runSwap = async () => {
    if (!address) {
      setSignInOpen(true);
      return;
    }

    setBusy(true);
    setTxHash(null);
    try {
      const adapter = await createViemAdapterFromWallet(walletProvider);
      const { txHash: hash } = await swapViaKit(adapter, CHAIN_ID, fromSymbol, toSymbol, amount);
      setTxHash(hash);
      toast.success(`Swapped ${amount} ${fromSymbol} → ${toSymbol}`);
    } catch (e: any) {
      toast.error(e?.message || "Swap failed");
    } finally {
      setBusy(false);
    }
  };

  const TokenSelect = ({
    value,
    onChange,
    exclude,
  }: {
    value: string;
    onChange: (v: string) => void;
    exclude?: string;
  }) => (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-10 px-3 rounded-lg bg-secondary border border-border text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
    >
      {ARC_TESTNET_TOKENS.filter((t) => t.symbol !== exclude).map((t) => (
        <option key={t.symbol} value={t.symbol}>
          {t.symbol}
        </option>
      ))}
    </select>
  );

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>You pay</span>
          {balanceLabel && (
            <button
              type="button"
              onClick={() => balance && setAmount(balance.formatted)}
              className="hover:text-foreground transition-colors"
            >
              Balance: {balanceLabel}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            placeholder="0.00"
            className="flex-1 min-w-0 bg-transparent text-2xl font-bold text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <TokenSelect value={fromSymbol} onChange={setFromSymbol} exclude={toSymbol} />
        </div>
      </div>

      <div className="flex justify-center -my-1">
        <button
          type="button"
          onClick={flip}
          className="w-9 h-9 rounded-full border border-border bg-secondary flex items-center justify-center hover:bg-accent transition-colors"
          aria-label="Flip tokens"
        >
          <ArrowDownUp className="w-4 h-4 text-primary" />
        </button>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="text-xs text-muted-foreground">You receive</div>
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0 text-2xl font-bold text-muted-foreground truncate">
            {amount ? "≈ quoted at execution" : "0.00"}
          </div>
          <TokenSelect value={toSymbol} onChange={setToSymbol} exclude={fromSymbol} />
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span>Network</span>
        <span className="font-medium text-foreground">{getChainLabel(CHAIN_ID)}</span>
      </div>

      <Button
        onClick={runSwap}
        disabled={busy || (Boolean(address) && !canSwap)}
        className="w-full py-6 font-bold gap-2"
      >
        {busy ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" /> Swapping…
          </>
        ) : !address ? (
          <>
            <Wallet className="w-4 h-4" />{" "}
            {connecting ? "Signing in…" : circleOnly ? "Connect a wallet to swap" : "Sign in to swap"}
          </>
        ) : (
          `Swap ${fromSymbol} → ${toSymbol}`
        )}
      </Button>

      {circleOnly && (
        <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
          Your email (Circle) wallet works for buying, selling and escrow. Swapping on Arc Testnet
          needs a self-custody wallet signer — connect one above to trade.
        </p>
      )}

      <SignInChoiceDialog open={signInOpen} onOpenChange={setSignInOpen} />


      {txHash && (
        <a
          href={getExplorerUrl(CHAIN_ID, txHash)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 text-sm text-primary hover:underline"
        >
          View on ArcScan <ExternalLink className="w-3.5 h-3.5" />
        </a>
      )}

      <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
        Swaps route through Circle App Kit on Arc. monast.io holds no liquidity and takes no swap
        fee — you only pay Arc network costs and the route's own spread.
      </p>
    </div>
  );
};
