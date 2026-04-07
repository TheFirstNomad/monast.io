import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowDownUp, ChevronDown } from "lucide-react";
import { useWallet } from "@/hooks/useWallet";

const TOKENS = [
  { symbol: "ETH", name: "Ethereum", icon: "/tokens/eth.png" },
  { symbol: "USDC", name: "USD Coin", icon: "/tokens/usdc.png" },
  { symbol: "USDT", name: "Tether", icon: "/tokens/usdt.png" },
  { symbol: "DAI", name: "Dai", icon: "/tokens/dai.png" },
  { symbol: "WBTC", name: "Wrapped Bitcoin", icon: "/tokens/wbtc.png" },
];

interface TokenSelectorProps {
  selected: typeof TOKENS[0];
  onSelect: (t: typeof TOKENS[0]) => void;
  open: boolean;
  setOpen: (v: boolean) => void;
}

const TokenSelector = ({ selected, onSelect, open, setOpen }: TokenSelectorProps) => (
  <div className="relative">
    <button
      onClick={() => setOpen(!open)}
      className="flex items-center gap-2 bg-muted hover:bg-muted/80 rounded-lg px-3 py-2 transition-colors"
    >
      <img src={selected.icon} alt={selected.symbol} className="w-6 h-6 rounded-full" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      <span className="font-semibold text-foreground">{selected.symbol}</span>
      <ChevronDown className="w-4 h-4 text-muted-foreground" />
    </button>
    {open && (
      <div className="absolute top-full mt-1 right-0 bg-card border border-border rounded-xl shadow-lg z-10 w-48 py-1">
        {TOKENS.map((t) => (
          <button
            key={t.symbol}
            onClick={() => { onSelect(t); setOpen(false); }}
            className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-muted text-left transition-colors"
          >
            <img src={t.icon} alt={t.symbol} className="w-5 h-5 rounded-full" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            <div>
              <div className="text-sm font-medium text-foreground">{t.symbol}</div>
              <div className="text-xs text-muted-foreground">{t.name}</div>
            </div>
          </button>
        ))}
      </div>
    )}
  </div>
);

const Swap = () => {
  const { isConnected, connect, network } = useWallet();
  const [payAmount, setPayAmount] = useState("");
  const [receiveAmount, setReceiveAmount] = useState("");
  const [payToken, setPayToken] = useState(TOKENS[0]);
  const [receiveToken, setReceiveToken] = useState(TOKENS[1]);
  const [payOpen, setPayOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);

  const switchTokens = () => {
    setPayToken(receiveToken);
    setReceiveToken(payToken);
    setPayAmount(receiveAmount);
    setReceiveAmount(payAmount);
  };

  const setMax = () => {
    setPayAmount("0.00");
  };

  return (
    <Layout>
      <div className="max-w-md mx-auto px-4 py-12">
        <h1 className="text-2xl font-bold text-foreground text-center mb-2">Swap</h1>
        <p className="text-sm text-muted-foreground text-center mb-8">
          Trade tokens on {network === "base" ? "Base" : "Arc Testnet"}
        </p>

        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          {/* You Pay */}
          <div className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">You Pay</span>
              <button onClick={setMax} className="text-xs text-primary font-medium hover:underline">MAX</button>
            </div>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                placeholder="0.00"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                className="border-0 bg-transparent text-2xl font-semibold p-0 h-auto focus-visible:ring-0 flex-1"
              />
              <TokenSelector selected={payToken} onSelect={setPayToken} open={payOpen} setOpen={setPayOpen} />
            </div>
          </div>

          {/* Switch */}
          <div className="flex justify-center -my-3 relative z-10">
            <button
              onClick={switchTokens}
              className="w-10 h-10 rounded-xl bg-card border-2 border-border flex items-center justify-center hover:bg-muted transition-colors"
            >
              <ArrowDownUp className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {/* You Receive */}
          <div className="p-4 bg-muted/30">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">You Receive</span>
            </div>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                placeholder="0.00"
                value={receiveAmount}
                onChange={(e) => setReceiveAmount(e.target.value)}
                className="border-0 bg-transparent text-2xl font-semibold p-0 h-auto focus-visible:ring-0 flex-1"
                readOnly
              />
              <TokenSelector selected={receiveToken} onSelect={setReceiveToken} open={receiveOpen} setOpen={setReceiveOpen} />
            </div>
          </div>
        </div>

        <div className="mt-4">
          {isConnected ? (
            <Button className="w-full py-6 text-base font-semibold" disabled={!payAmount || payAmount === "0"}>
              {!payAmount ? "Enter an amount" : "Swap"}
            </Button>
          ) : (
            <Button className="w-full py-6 text-base font-semibold" onClick={connect}>
              Connect Wallet
            </Button>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Swap;
