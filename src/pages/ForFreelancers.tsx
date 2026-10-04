import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useSeo } from "@/hooks/useSeo";
import { serializeJsonLdSafe } from "@/lib/jsonLdSafe";
import { Shield, Zap, Globe, DollarSign, CheckCircle2, ArrowRight } from "lucide-react";

const WHY = [
  { icon: Shield, title: "Guaranteed payment", body: "Buyers lock USDC in escrow before you start. Funds release the moment they confirm delivery — no chargeback risk, no invoice chasing." },
  { icon: Zap, title: "Instant settlement", body: "USDC settles in under 1 second on Arc. No 14-day bank transfer delays. No PayPal holds. You get paid when the job is done." },
  { icon: Globe, title: "Work with anyone, anywhere", body: "Clients in Tokyo, Lagos, São Paulo. USDC is the same everywhere. No FX fees, no blocked countries." },
  { icon: DollarSign, title: "Keep more of what you earn", body: "Monast takes 2.5% on release — the seller fee. Buyers pay zero extra. That is far less than most freelance platforms." },
];

const HOW = [
  { step: "1", title: "Post your service", body: "Describe what you offer, set your price in USDC. Pay a one-time 0.15 USDC listing fee to publish." },
  { step: "2", title: "Buyer pays into escrow", body: "When a buyer hires you, their USDC locks in escrow. You start work knowing payment is secured." },
  { step: "3", title: "Deliver and get paid", body: "Submit your work. The buyer confirms delivery and the escrow releases instantly to your wallet." },
];

const ForFreelancers = () => {
  useSeo({
    title: "Freelance Services Marketplace | Get Paid in USDC | monast.io",
    description: "Sell your skills globally and get paid in USDC with escrow protection. No chargebacks, instant settlement. Join monast.io — the freelance marketplace built on Arc.",
    canonicalPath: "/for-freelancers",
  });

  const jsonLd = serializeJsonLdSafe({
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Freelance Services on monast.io",
    description: "Sell services globally and get paid in USDC with smart contract escrow.",
    url: "https://monast.io/for-freelancers",
  });

  return (
    <Layout>
      <div dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <div className="max-w-4xl mx-auto px-4 py-14 md:py-20 space-y-16">
        {/* Hero */}
        <div className="text-center space-y-5">
          <div className="inline-flex items-center gap-2 text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-full font-medium">
            For Freelancers
          </div>
          <h1 className="font-display text-5xl md:text-6xl text-foreground">Get paid for your work.<br />Every time.</h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Sell any skill — design, development, writing, consulting — and receive USDC the moment your client confirms delivery. Escrow-protected, instant, global.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Button asChild size="lg">
              <Link to="/post-ad">Post your service <ArrowRight className="w-4 h-4 ml-1" /></Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/browse?category=Services">Browse services</Link>
            </Button>
          </div>
        </div>

        {/* Why monast */}
        <div className="space-y-4">
          <h2 className="font-display text-3xl text-foreground text-center">Why freelancers choose monast</h2>
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

        {/* How it works */}
        <div className="space-y-4">
          <h2 className="font-display text-3xl text-foreground text-center">How it works</h2>
          <div className="grid md:grid-cols-3 gap-4 mt-6">
            {HOW.map(({ step, title, body }) => (
              <div key={step} className="bg-card border border-border rounded-xl p-5 space-y-2">
                <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">{step}</div>
                <p className="font-semibold text-foreground">{title}</p>
                <p className="text-sm text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Categories */}
        <div className="bg-card border border-border rounded-xl p-6 space-y-3">
          <h2 className="font-semibold text-foreground">Popular service categories</h2>
          <div className="flex flex-wrap gap-2">
            {["Web Development", "Design & Branding", "Content Writing", "SEO & Marketing", "Video & Animation", "Smart Contracts", "AI Prompts", "Translation"].map((c) => (
              <Link key={c} to={`/browse?category=Services&q=${encodeURIComponent(c)}`} className="text-sm bg-muted hover:bg-primary/10 hover:text-primary text-foreground px-3 py-1.5 rounded-full transition-colors flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> {c}
              </Link>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center space-y-4">
          <h2 className="font-display text-3xl text-foreground">Ready to sell your skills?</h2>
          <p className="text-muted-foreground">Join thousands of freelancers getting paid in USDC.</p>
          <Button asChild size="lg">
            <Link to="/post-ad">Post your first service <ArrowRight className="w-4 h-4 ml-1" /></Link>
          </Button>
        </div>
      </div>
    </Layout>
  );
};

export default ForFreelancers;
