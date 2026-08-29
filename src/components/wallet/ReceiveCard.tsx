import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Check, Copy, ExternalLink } from "lucide-react";
import { CHAINS } from "@/lib/chains";
import { toast } from "sonner";

const ARC = CHAINS["arc-testnet"];

export const ReceiveCard = ({ address }: { address: string }) => {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy the address");
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Receive USDC</h2>
        <p className="text-xs text-muted-foreground">
          Only send USDC on {ARC.label} to this address. Anything else can be lost.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="bg-background p-3 rounded-lg border border-border shrink-0">
          <QRCodeSVG value={address} size={116} bgColor="transparent" fgColor="currentColor" />
        </div>
        <div className="min-w-0 w-full space-y-2">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Your address</div>
          <div className="font-mono text-xs break-all text-foreground">{address}</div>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" className="gap-2" onClick={copy}>
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copied" : "Copy address"}
            </Button>
            <a href={`${ARC.explorer}/address/${address}`} target="_blank" rel="noreferrer noopener">
              <Button size="sm" variant="outline" className="gap-2">
                <ExternalLink className="w-3.5 h-3.5" /> Explorer
              </Button>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
