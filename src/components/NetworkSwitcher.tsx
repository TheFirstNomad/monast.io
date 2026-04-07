import { useWallet } from "@/hooks/useWallet";
import { Button } from "@/components/ui/button";

export const NetworkSwitcher = () => {
  const { network, setNetwork } = useWallet();

  return (
    <div className="flex items-center bg-muted rounded-lg p-0.5">
      <Button
        variant={network === "arc-testnet" ? "default" : "ghost"}
        size="sm"
        onClick={() => setNetwork("arc-testnet")}
        className="text-xs h-7 px-3"
      >
        Arc Testnet
      </Button>
      <Button
        variant={network === "base" ? "default" : "ghost"}
        size="sm"
        onClick={() => setNetwork("base")}
        className="text-xs h-7 px-3"
      >
        Base
      </Button>
    </div>
  );
};
