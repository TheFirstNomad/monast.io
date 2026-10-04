import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useSeo } from "@/hooks/useSeo";
import { serializeJsonLdSafe } from "@/lib/jsonLdSafe";
import { Globe, Shield, Zap, Coins, ArrowRight } from "lucide-react";

const WHY = [
  { icon: Globe, title: "Global domain buyers", body: "List once, reach buyers in every country. USDC removes the friction of cross-border payments for high-value domain deals." },
  { icon: Shield, title: "Safe domain escrow", body: "Buyer locks USDC in escrow. You transfer the domain. Buyer confirms receipt. Funds release. Neither side can be scammed." },
  { icon: Zap, title: "Fast settlement", body: "No wire transfer delays or platform holds. USDC on Arc settles in under a second when the buyer confirms the domain transfer." },
  { icon: Coins, title: "No hidden fees", body: "2.5% on release — taken from the seller. Buyers pay nothing beyond the domain price. Far cheaper than domain broker commissions." },
];

const ForDomainSellers = () => {
  useSeo({
    title: "Sell Domains for USDC | Domain Escrow Marketplace | monast.io",
    description: "Buy and sell domain names with USDC escrow on Arc. Instant settlement, global buyers, no broker fees. monast.io — the safest place to trade domains.",
    canonicalPath: "/for-domain-sellers",
  });

  const jsonLd = serializeJsonLdSafe({
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Domain Sales on monast.io",
    description: "Buy and sell domain names peer-to-peer with USDC escrow. Instant settlement on Arc.",
    url: "https://monast.io/for-domain-sellers",
  });

  return (
    <Layout>
      <div dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <div className="max-w-4xl mx-auto px-4 py-14 md:py-20 space-y-16">
        <div className="text-center space-y-5">
          <div className="inline-flex items-center gap-2 text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-full font-medium">
            For Domain Sellers
          </div>
          <h1 className="font-display text-5xl md:text-6xl text-foreground">Sell your domain.<br />Get paid instantly.</h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            List your domains on a global marketplace and receive USDC the moment the buyer confirms the transfer. No broker, no escrow service, no delay.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Button asChild size="lg">
              <Link to="/post-ad">List your domain <ArrowRight className="w-4 h-4 ml-1" /></Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/browse?category=Domains">Browse domains for sale</Link>
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="font-display text-3xl text-foreground text-center">Why domain traders choose monast</h2>
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

        <div className="text-center space-y-4">
          <h2 className="font-display text-3xl text-foreground">List your first domain</h2>
          <p className="text-muted-foreground">0.15 USDC to publish. 2.5% on sale. That is it.</p>
          <Button asChild size="lg">
            <Link to="/post-ad">List a domain <ArrowRight className="w-4 h-4 ml-1" /></Link>
          </Button>
        </div>
      </div>
    </Layout>
  );
};

export default ForDomainSellers;
