import { useCallback, useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWallet } from "@/hooks/useWallet";
import { getAdminAuthHeaders } from "@/lib/adminAuth";
import { useSeo } from "@/hooks/useSeo";
import { ARC_CHAIN_ID } from "@/lib/usdc";
import { toast } from "sonner";
import { useSignMessage } from "wagmi";
import { AlertTriangle, Banknote, Loader2, RefreshCw, ShieldCheck, Wallet } from "lucide-react";

const FUNCTIONS_BASE = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1`;

interface TreasuryWallet {
  id: string;
  purpose: "escrow" | "revenue";
  chain_id: number;
  address: string;
  circle_wallet_id: string | null;
  usdc_balance: number | null;
  balance_error: string | null;
}

interface Status {
  wallets: TreasuryWallet[];
  provisioned: boolean;
  escrow_liability_usdc: number;
  revenue: {
    platform_fee: number;
    listing_fee: number;
    promotion_fee: number;
    revenue_withdrawal: number;
  };
}

/**
 * Owner-only treasury console. Every call is authorised by a fresh wallet
 * signature from the owner address — there is no password and no client-side
 * admin flag to tamper with.
 */
const AdminTreasury = () => {
  const { address, connect } = useWallet();
  const { signMessageAsync } = useSignMessage();
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [provisioning, setProvisioning] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [dest, setDest] = useState("");
  const [amount, setAmount] = useState("");
  const [ciphertext, setCiphertext] = useState<string | null>(null);
  const [gettingCipher, setGettingCipher] = useState(false);


  useSeo({
    title: "Treasury console | monast.io",
    description: "Owner-only treasury overview for monast.io.",
    noindex: true,
  });

  const callAdmin = useCallback(
    async (fn: string, body: Record<string, unknown> = {}) => {
      if (!address) throw new Error("Connect the owner wallet first");
      const headers = await getAdminAuthHeaders(address, signMessageAsync as any);
      const res = await fetch(`${FUNCTIONS_BASE}/${fn}`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 403) {
        throw new Error(
          `This wallet (${address.slice(0, 6)}…${address.slice(-4)}) is not the owner wallet. Switch to the owner wallet to use the treasury console.`,
        );
      }
      if (!res.ok) throw new Error(data?.error ?? `${fn} failed (${res.status})`);
      return data;
    },
    [address, signMessageAsync],
  );

  const load = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    setError(null);
    try {
      setStatus(await callAdmin("treasury-status"));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [address, callAdmin]);

  useEffect(() => { load(); }, [load]);

  const provision = async () => {
    setProvisioning(true);
    try {
      await callAdmin("treasury-provision", { chain_ids: [ARC_CHAIN_ID] });
      toast.success("Treasury wallets created");
      await load();
    } catch (e: any) {
      if (/entity secret has not been set/i.test(e.message ?? "")) {
        toast.error("Register your entity secret in the Circle console first. See the box below.");
        await getCiphertext();
      } else {
        toast.error(e.message);
      }
    } finally {
      setProvisioning(false);
    }
  };

  const getCiphertext = async () => {
    setGettingCipher(true);
    try {
      const data = await callAdmin("treasury-entity-ciphertext");
      setCiphertext(data.ciphertext);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setGettingCipher(false);
    }
  };


  const withdraw = async () => {
    const value = Number(amount);
    if (!/^0x[0-9a-fA-F]{40}$/.test(dest)) return toast.error("Enter a valid destination address");
    if (!Number.isFinite(value) || value <= 0) return toast.error("Enter an amount greater than zero");
    setWithdrawing(true);
    try {
      // One id per button press: a network retry of this same attempt reuses it
      // so the backend and Circle both treat it as a duplicate, not a new payout.
      await callAdmin("treasury-withdraw", {
        chain_id: ARC_CHAIN_ID,
        destination_address: dest,
        amount_usdc: value,
        client_request_id: crypto.randomUUID(),
      });
      toast.success("Withdrawal submitted");
      setAmount("");
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setWithdrawing(false);
    }
  };

  if (!address) {
    return (
      <Layout>
        <div className="max-w-lg mx-auto px-4 py-20 text-center space-y-4">
          <ShieldCheck className="w-10 h-10 mx-auto text-primary" />
          <h1 className="text-2xl font-bold">Treasury console</h1>
          <p className="text-muted-foreground">
            Connect the owner wallet to sign in. Every action is authorised by a wallet signature.
          </p>
          <Button onClick={connect} className="gap-2"><Wallet className="w-4 h-4" /> Connect wallet</Button>
        </div>
      </Layout>
    );
  }

  const escrowWallet = status?.wallets.find((w) => w.purpose === "escrow");
  const revenueWallet = status?.wallets.find((w) => w.purpose === "revenue");
  const rev = status?.revenue;
  const earned = rev ? rev.platform_fee + rev.listing_fee + rev.promotion_fee : 0;

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Treasury console</h1>
            <p className="text-sm text-muted-foreground">
              User escrow funds and platform revenue are held in two separate wallets.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2 shrink-0">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Refresh
          </Button>
        </div>

        {error && (
          <div className="flex gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {status && !status.provisioned && (
          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <h2 className="font-semibold">Treasury not set up yet</h2>
            <p className="text-sm text-muted-foreground">
              Create the escrow and revenue wallets on Arc Testnet. Until this is done, payments and
              escrow funding stay disabled; no funds can be sent anywhere unsafe.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={provision} disabled={provisioning} className="gap-2">
                {provisioning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
                Create treasury wallets
              </Button>
              <Button variant="outline" onClick={getCiphertext} disabled={gettingCipher} className="gap-2">
                {gettingCipher ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                Get entity secret ciphertext
              </Button>
            </div>
            {ciphertext && (
              <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-2">
                <p className="text-sm font-medium">One-time Circle setup</p>
                <ol className="text-xs text-muted-foreground list-decimal pl-4 space-y-1">
                  <li>Copy the ciphertext below.</li>
                  <li>In the Circle console open Wallets → Configurator → Register entity secret.</li>
                  <li>Paste the ciphertext, confirm, then come back and click “Create treasury wallets”.</li>
                </ol>
                <textarea
                  readOnly
                  value={ciphertext}
                  onFocus={(e) => e.currentTarget.select()}
                  className="w-full h-24 rounded-md border border-border bg-background p-2 text-xs font-mono"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    navigator.clipboard.writeText(ciphertext);
                    toast.success("Ciphertext copied");
                  }}
                >
                  Copy
                </Button>
              </div>
            )}
          </div>

        )}

        {status?.provisioned && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <WalletCard
                title="Escrow wallet"
                subtitle="Holds buyer funds. Not withdrawable."
                wallet={escrowWallet}
              />
              <WalletCard
                title="Revenue wallet"
                subtitle="Fees you have earned."
                wallet={revenueWallet}
              />
            </div>

            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <h2 className="font-semibold">Money owed to users</h2>
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">Held in open escrows</span>
                <span className="text-xl font-bold">
                  {status.escrow_liability_usdc.toLocaleString()} USDC
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                The escrow wallet balance should never drop below this figure.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-5 space-y-2">
              <h2 className="font-semibold mb-2">Revenue earned (lifetime)</h2>
              <Row label="Sale fees" value={rev?.platform_fee ?? 0} />
              <Row label="Listing fees" value={rev?.listing_fee ?? 0} />
              <Row label="Featured listings" value={rev?.promotion_fee ?? 0} />
              <div className="border-t border-border pt-2 mt-2">
                <Row label="Total earned" value={earned} bold />
                <Row label="Already withdrawn" value={rev?.revenue_withdrawal ?? 0} />
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <div>
                <h2 className="font-semibold">Withdraw revenue</h2>
                <p className="text-sm text-muted-foreground">
                  Sends USDC from the revenue wallet only. The escrow wallet has no withdrawal path.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dest">Destination address</Label>
                <Input
                  id="dest"
                  placeholder="0x…"
                  value={dest}
                  onChange={(e) => setDest(e.target.value.trim())}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Amount (USDC)</Label>
                <Input
                  id="amount"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <Button onClick={withdraw} disabled={withdrawing} className="gap-2">
                {withdrawing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Banknote className="w-4 h-4" />}
                Withdraw
              </Button>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
};

const Row = ({ label, value, bold }: { label: string; value: number; bold?: boolean }) => (
  <div className="flex items-baseline justify-between text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span className={bold ? "font-bold text-foreground" : "text-foreground"}>
      {value.toLocaleString()} USDC
    </span>
  </div>
);

const WalletCard = ({
  title,
  subtitle,
  wallet,
}: {
  title: string;
  subtitle: string;
  wallet?: TreasuryWallet;
}) => (
  <div className="rounded-xl border border-border bg-card p-5 space-y-2">
    <h2 className="font-semibold">{title}</h2>
    <p className="text-xs text-muted-foreground">{subtitle}</p>
    {wallet ? (
      <>
        <p className="text-2xl font-bold">
          {wallet.balance_error
            ? "-"
            : `${(wallet.usdc_balance ?? 0).toLocaleString()} USDC`}
        </p>
        <p className="text-xs font-mono break-all text-muted-foreground">{wallet.address}</p>
        {wallet.balance_error && (
          <p className="text-xs text-destructive">Balance unavailable: {wallet.balance_error}</p>
        )}
      </>
    ) : (
      <p className="text-sm text-muted-foreground">Not created yet.</p>
    )}
  </div>
);

export default AdminTreasury;
