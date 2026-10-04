import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useSeo } from "@/hooks/useSeo";
import { serializeJsonLdSafe } from "@/lib/jsonLdSafe";
import { ShieldCheck, Zap, Lock, BarChart2, ArrowRight } from "lucide-react";

const WHY = [
  { icon: ShieldCheck, title: "No CEX required", body: "Trade directly peer-to-peer. No KYC for buyers, no account freezes, no withdrawal limits. Your keys, your trade." },
  { icon: Lock, title: "Escrow-protected OTC", body: "Send crypto assets — tokens, NFTs, wallets — and receive USDC via escrow. Funds lock before the seller releases the asset." },
  { icon: Zap, title: "Sub-second finality", body: "Arc settles in under a second. By the time you double-check the transaction, it is already confirmed." },
  { icon: BarChart2, title: "Price in USDC", body: "USDC is stable. Quote your trade in dollars without worrying about volatility eating your margin before settlement." },
];

const ForCryptoTraders = () => {
  useSeo({
    title: "OTC Crypto Trading Marketplace | Trade in USDC | monast.io",
    description: "Buy and sell crypto assets, tokens, and wallets peer-to-peer with USDC escrow on Arc. No CEX, no KYC, instant settlement. monast.io — the OTC desk built onchain.",
    canonicalPath: "/for-crypto-traders",
  });

  const jsonLd = serializeJsonLdSafe({
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "OTC Crypto Trading on monast.io",
    description: "Trade crypto assets peer-to-peer with USDC escrow on Arc. No CEX needed.",
    url: "https://monast.io/for-crypto-traders",
  });

  return (
    <Layout>
      <div dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <div className="max-w-4xl mx-auto px-4 py-14 md:py-20 space-y-16">
        <div className="text-center space-y-5">
          <div className="inline-flex items-center gap-2 text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-full font-medium">
            For Crypto Traders
          </div>
          <h1 className="font-display text-5xl md:text-6xl text-foreground">OTC trading.<br />Without the middleman.</h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Buy and sell crypto assets — tokens, wallets, NFTs, mining contracts — directly P2P. USDC escrow protects both sides. No CEX, no KYC, no withdrawal limits.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Button asChild size="lg">
              <Link to="/post-ad">List a crypto asset <ArrowRight className="w-4 h-4 ml-1" /></Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/browse?category=Crypto+%26+Coins">Browse crypto listings</Link>
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="font-display text-3xl text-foreground text-center">Why traders choose monast</h2>
          <div className="grid md:grid-cols-2 gap-4 mt-6">
            {WHY.map(({ icon: Icon, title, body }) => (
              <div key={title} className="bg-card border border-border rounded-xl p-5 flex gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">{title}</p>
                  <p className="text-sm text-muted-foreground mt-1">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 space-y-3">
          <h2 className="font-semibold text-foreground">Categories for traders</h2>
          <div className="flex flex-wrap gap-2">
            {["Crypto & Coins", "NFTs", "Apps", "Websites", "Digital Products"].map((c) => (
              <Link key={c} to={`/browse?category=${encodeURIComponent(c)}`} className="text-sm bg-muted hover:bg-primary/10 hover:text-primary text-foreground px-3 py-1.5 rounded-full transition-colors">
                {c}
              </Link>
            ))}
          </div>
        </div>

        <div className="text-center space-y-4">
          <h2 className="font-display text-3xl text-foreground">List your first asset</h2>
          <p className="text-muted-foreground">USDC escrow. No CEX. Your trade, your rules.</p>
          <Button asChild size="lg">
            <Link to="/post-ad">List now <ArrowRight className="w-4 h-4 ml-1" /></Link>
          </Button>
        </div>
      </div>
    </Layout>
  );
};

export default ForCryptoTraders;
