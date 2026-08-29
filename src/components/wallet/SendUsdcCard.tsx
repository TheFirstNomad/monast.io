import { useMemo, useState } from "react";
import { useAccount, useChainId, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Send } from "lucide-react";
import { CHAINS } from "@/lib/chains";
import { ERC20_TRANSFER_ABI, USDC_ADDRESS, toUsdcUnits } from "@/lib/usdc";
import { withdrawFromCircleWallet } from "@/lib/wallet/api";
import { toast } from "sonner";

const ARC = CHAINS["arc-testnet"];

interface Props {
  isCircleWallet: boolean;
  balance: number | null;
  onSent: () => void;
}

type Phase = "idle" | "signing" | "settling";

export const SendUsdcCard = ({ isCircleWallet, balance, onSent }: Props) => {
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const busy = phase !== "idle";

  const { address } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient({ chainId: ARC.id });

  const parsed = Number(amount);
  const validAddress = /^0x[0-9a-fA-F]{40}$/.test(to.trim());
  const validAmount = Number.isFinite(parsed) && parsed > 0 && (balance === null || parsed <= balance);
  const canSend = validAddress && validAmount && !busy;

  const hint = useMemo(() => {
    if (to && !validAddress) return "That does not look like an Arc address.";
    if (amount && !Number.isFinite(parsed)) return "Enter a number.";
    if (balance !== null && parsed > balance) return "That is more than your balance.";
    return null;
  }, [to, amount, validAddress, parsed, balance]);

  const send = async () => {
    const destination = to.trim();
    setPhase("signing");
    try {
      if (isCircleWallet) {
        const { txHash } = await withdrawFromCircleWallet({
          destinationAddress: destination,
          amountUsdc: parsed,
          clientRequestId: `${Date.now()}`,
          onPhase: setPhase,
        });
        toast.success("USDC sent", {
          description: `View it on ArcScan`,
          action: {
            label: "Open",
            onClick: () => window.open(`${ARC.explorer}/tx/${txHash}`, "_blank", "noopener"),
          },
        });
      } else {
        if (!address) throw new Error("Connect your wallet first");
        if (chainId !== ARC.id) await switchChainAsync({ chainId: ARC.id });
        const hash = await writeContractAsync({
          address: USDC_ADDRESS,
          abi: ERC20_TRANSFER_ABI,
          functionName: "transfer",
          args: [destination as `0x${string}`, toUsdcUnits(parsed)],
          chainId: ARC.id,
        } as any);
        setPhase("settling");
        await publicClient?.waitForTransactionReceipt({ hash });
        toast.success("USDC sent", {
          action: {
            label: "Open",
            onClick: () => window.open(`${ARC.explorer}/tx/${hash}`, "_blank", "noopener"),
          },
        });
      }
      setTo("");
      setAmount("");
      onSent();
    } catch (e: any) {
      toast.error(e?.shortMessage || e?.message || "The transfer did not go through");
    } finally {
      setPhase("idle");
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Send USDC</h2>
        <p className="text-xs text-muted-foreground">
          Withdraw to any wallet or exchange address on {ARC.label}.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="sendTo">Destination address</Label>
        <Input
          id="sendTo"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="0x…"
          spellCheck={false}
          autoComplete="off"
          className="font-mono text-xs"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="sendAmount">Amount (USDC)</Label>
          {balance !== null && (
            <button
              type="button"
              className="text-xs text-primary hover:underline"
              onClick={() => setAmount(String(balance))}
            >
              Max {balance.toLocaleString()}
            </button>
          )}
        </div>
        <Input
          id="sendAmount"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
          placeholder="0.00"
          inputMode="decimal"
        />
        {hint && <p className="text-xs text-destructive">{hint}</p>}
      </div>

      <Button onClick={send} disabled={!canSend} className="w-full gap-2">
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        {phase === "signing"
          ? isCircleWallet
            ? "Confirm in the Circle window…"
            : "Confirm in your wallet…"
          : phase === "settling"
            ? "Settling on Arc…"
            : "Send USDC"}
      </Button>
      <p className="text-xs text-muted-foreground">
        Network fees are paid in USDC on Arc. Double-check the address: transfers cannot be reversed.
      </p>
    </div>
  );
};
