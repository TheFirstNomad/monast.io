import { useWallet } from "@/hooks/useWallet";
import { CheckCircle, RefreshCw, AlertTriangle, X } from "lucide-react";
import { useCallback, useState } from "react";

export const RehydrationBanner = () => {
  const { rehydrationStatus, rehydrationError, address } = useWallet();
  const [dismissed, setDismissed] = useState(false);

  const dismiss = useCallback(() => setDismissed(true), []);

  if (dismissed) return null;
  if (rehydrationStatus === "idle" || rehydrationStatus === "checking") return null;

  const short = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "";

  const configs = {
    rehydrated: {
      icon: <CheckCircle className="w-4 h-4" />,
      text: `Session restored for ${short}`,
      className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    },
    "re-signed": {
      icon: <RefreshCw className="w-4 h-4" />,
      text: `Signed in as ${short}`,
      className: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    },
    failed: {
      icon: <AlertTriangle className="w-4 h-4" />,
      text: rehydrationError || "Session recovery failed. Please try again.",
      className: "bg-red-500/15 text-red-400 border-red-500/30",
    },
  };

  const cfg = configs[rehydrationStatus];

  return (
    <div className={`flex items-center gap-2 px-4 py-2 text-sm border-b backdrop-blur-sm ${cfg.className}`}>
      {cfg.icon}
      <span className="flex-1">{cfg.text}</span>
      <button
        onClick={dismiss}
        className="opacity-70 hover:opacity-100 transition-opacity"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
