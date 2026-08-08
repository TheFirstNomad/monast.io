import { Layout } from "@/components/Layout";
import { SwapPanel } from "@/components/SwapPanel";
import { useSeo } from "@/hooks/useSeo";
import { ShieldCheck, Zap, Coins } from "lucide-react";

const Swap = () => {
  useSeo({
    title: "Swap USDC & EURC on Arc — monast.io",
    description:
      "Swap stablecoins on Arc directly from your wallet. Powered by Circle App Kit routing — no pools, no custody, no swap fee from monast.io.",
    canonicalPath: "/swap",
  });

  return (
    <Layout>
      <section className="px-4 py-12 md:py-16">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">Swap</h1>
            <p className="text-sm text-muted-foreground">
              Trade stablecoins on Arc straight from your connected wallet.
            </p>
          </div>
          <SwapPanel />
        </div>

        <div className="max-w-3xl mx-auto mt-12 grid sm:grid-cols-3 gap-4">
          {[
            { Icon: ShieldCheck, title: "Non-custodial", body: "Your wallet signs every swap. monast.io never holds your funds." },
            { Icon: Zap, title: "Arc-native", body: "Settles on Arc with USDC as the native gas token." },
            { Icon: Coins, title: "No platform fee", body: "We add nothing on top of the route's own pricing." },
          ].map(({ Icon, title, body }) => (
            <div key={title} className="rounded-xl border border-border bg-card p-4">
              <Icon className="w-5 h-5 text-primary mb-2" />
              <h2 className="text-sm font-semibold text-foreground mb-1">{title}</h2>
              <p className="text-xs text-muted-foreground leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>
    </Layout>
  );
};

export default Swap;
