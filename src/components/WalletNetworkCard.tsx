import { useState } from "react";
import { useChainId, useSwitchChain } from "wagmi";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wallet, Check, Copy, Loader2, Link2, AlertTriangle, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWallet } from "@/hooks/useWallet";
import { CHAINS } from "@/lib/chains";
import { USDC_DECIMALS } from "@/lib/usdc";
import { toast } from "sonner";

const ARC = CHAINS["arc-testnet"];

interface Props {
  userId: string;
  payoutWallet: string | null;
  onPayoutWalletChange: (address: string) => void;
}

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

const Row = ({ label, value, href }: { label: string; value: string; href?: string }) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy");
    }
  };
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-border/60 last:border-0">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <div className="flex items-center gap-1 min-w-0">
        <span className="text-xs font-mono text-foreground truncate">{value}</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={copy}
          aria-label={`Copy ${label}`}
        >
          {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
        </Button>
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noreferrer noopener"
            className="text-muted-foreground hover:text-foreground shrink-0"
            aria-label={`Open ${label} in a new tab`}
          >
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </div>
  );
};

export const WalletNetworkCard = ({ userId, payoutWallet, onPayoutWalletChange }: Props) => {
  const { address, connect } = useWallet();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const [saving, setSaving] = useState(false);
  const [switching, setSwitching] = useState(false);

  const onArc = chainId === ARC.id;
  const linked = !!address && !!payoutWallet && address.toLowerCase() === payoutWallet.toLowerCase();

  const useConnectedWallet = async () => {
    if (!address) {
      await connect();
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ wallet_address: address })
      .eq("id", userId);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    onPayoutWalletChange(address);
    toast.success("Payout wallet updated");
  };

  const switchToArc = async () => {
    setSwitching(true);
    try {
      await switchChainAsync({ chainId: ARC.id });
      toast.success(`Switched to ${ARC.label}`);
    } catch {
      toast.error(`Add ${ARC.label} to your wallet, then switch to it`);
    } finally {
      setSwitching(false);
    }
  };

  const addArcToWallet = async () => {
    const provider = (window as any).ethereum;
    if (!provider?.request) {
      toast.error("No browser wallet detected. Add the network manually with the details below.");
      return;
    }
    try {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: `0x${ARC.id.toString(16)}`,
            chainName: ARC.label,
            nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
            rpcUrls: [ARC.rpc],
            blockExplorerUrls: [ARC.explorer],
          },
        ],
      });
      toast.success(`${ARC.label} added to your wallet`);
    } catch (e: any) {
      toast.error(e?.message || "Could not add the network");
    }
  };

  const addUsdcToken = async () => {
    const provider = (window as any).ethereum;
    if (!provider?.request) {
      toast.error("No browser wallet detected. Import the token manually with the address below.");
      return;
    }
    try {
      await provider.request({
        method: "wallet_watchAsset",
        params: {
          type: "ERC20",
          options: { address: ARC.usdc, symbol: "USDC", decimals: USDC_DECIMALS },
        },
      });
    } catch (e: any) {
      toast.error(e?.message || "Could not add USDC");
    }
  };

  return (
    <div className="space-y-4">
      {/* Payout wallet */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-start gap-3">
          <Wallet className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <div className="text-xs text-muted-foreground">Payout wallet</div>
            <div className="text-sm font-medium text-foreground truncate">
              {payoutWallet ?? "Not set. Link a wallet to receive USDC."}
            </div>
            {address && (
              <div className="text-xs text-muted-foreground mt-1">
                Connected wallet: <span className="font-mono">{short(address)}</span>
              </div>
            )}
          </div>
          {linked && (
            <Badge variant="secondary" className="gap-1 shrink-0">
              <Check className="w-3 h-3" /> Linked
            </Badge>
          )}
        </div>

        {!linked && (
          <Button onClick={useConnectedWallet} disabled={saving} size="sm" className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
            {address ? "Use connected wallet for payouts" : "Connect a wallet"}
          </Button>
        )}
        <p className="text-xs text-muted-foreground">
          Escrow releases and refunds are sent to this address. Keep it the wallet you sign in with.
        </p>
      </div>

      {/* Network / RPC */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-foreground">Network</div>
            <div className="text-xs text-muted-foreground">
              USDC payments settle on {ARC.label}.
            </div>
          </div>
          <Badge variant={onArc ? "secondary" : "destructive"} className="gap-1 shrink-0">
            {onArc ? <Check className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
            {onArc ? ARC.label : "Wrong network"}
          </Badge>
        </div>

        <div className="flex flex-wrap gap-2">
          {!onArc && (
            <Button onClick={switchToArc} disabled={switching} size="sm" variant="secondary" className="gap-2">
              {switching && <Loader2 className="w-4 h-4 animate-spin" />}
              Switch to {ARC.label}
            </Button>
          )}
          <Button onClick={addArcToWallet} size="sm" variant="outline">
            Add network to wallet
          </Button>
          <Button onClick={addUsdcToken} size="sm" variant="outline">
            Add USDC token
          </Button>
        </div>

        <div className="pt-1">
          <Row label="Chain ID" value={String(ARC.id)} />
          <Row label="RPC URL" value={ARC.rpc} />
          <Row label="USDC contract" value={ARC.usdc} href={`${ARC.explorer}/address/${ARC.usdc}`} />
          <Row label="Explorer" value={ARC.explorer} href={ARC.explorer} />
          {payoutWallet && (
            <Row
              label="Your balance"
              value={`${ARC.explorer}/address/${payoutWallet}`}
              href={`${ARC.explorer}/address/${payoutWallet}`}
            />
          )}
        </div>
      </div>
    </div>
  );
};
