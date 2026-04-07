import { useWallet } from "@/hooks/useWallet";
import { AlertTriangle } from "lucide-react";

export const TestnetBanner = () => {
  const { network } = useWallet();

  if (network !== "arc-testnet") return null;

  return (
    <div className="testnet-banner text-warning-foreground text-center py-2 px-4 text-sm font-medium flex items-center justify-center gap-2">
      <AlertTriangle className="w-4 h-4" />
      You are on Arc Testnet — tokens have no real value
    </div>
  );
};
