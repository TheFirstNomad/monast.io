import { useSeo } from "@/hooks/useSeo";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { Code2, Zap, Shield, Globe, Copy, Check, ArrowRight, Terminal, Package } from "lucide-react";
import { useState } from "react";

const BASE = "https://ndsqyhwsjxlhxuylgdal.supabase.co/functions/v1";

const installSnippet = `npm install @monast/escrow-sdk
# or
bun add @monast/escrow-sdk`;

const initSnippet = `import { MonastEscrow } from "@monast/escrow-sdk";

const escrow = new MonastEscrow({
  apiKey: process.env.MONAST_API_KEY,   // your monast_sk_... key
  network: "arc-testnet",               // "arc-mainnet" for production
});`;

const createSnippet = `// 1. Create an escrow for a listing
const { escrowId, depositAddress, amount } = await escrow.create({
  listingId: "your-listing-id",
  buyerAddress: "0xBuyer...",
});

// 2. Buyer approves USDC and funds the escrow
await escrow.fund({ escrowId, txHash: "0x..." });

// 3. Buyer confirms delivery — seller is paid, platform fee deducted
await escrow.release({ escrowId });`;

const webhookSnippet = `// Receive real-time escrow events in your backend
escrow.on("funded",   (e) => console.log("Buyer funded",  e.escrowId));
escrow.on("released", (e) => console.log("Seller paid",   e.escrowId));
escrow.on("disputed", (e) => console.log("Dispute opened", e.escrowId));`;

const curlSnippet = `# Create an escrow
curl -X POST ${BASE}/escrow-create \\
  -H "Authorization: Bearer monast_sk_..." \\
  -H "Content-Type: application/json" \\
  -d '{"ad_id":"your-listing-id"}'

# Release to seller
curl -X POST ${BASE}/escrow-release \\
  -H "Authorization: Bearer monast_sk_..." \\
  -d '{"escrow_id":"esc_..."}'`;

function CopyBlock({ code, label }: { code: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <div className="relative group">
      <pre className="bg-[#0d1117] border border-border rounded-lg p-4 text-xs text-foreground/90 overflow-x-auto leading-relaxed">
        <code>{code}</code>
      </pre>
      <button
        onClick={copy}
        aria-label={`Copy ${label}`}
        className="absolute top-2 right-2 p-1.5 rounded-md bg-secondary border border-border opacity-0 group-hover:opacity-100 transition-opacity"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
      </button>
    </div>
  );
}

const EscrowApi = () => {
  useSeo({
    title: "monast.io | Escrow API — embed USDC escrow in any app",
    description:
      "Use the Monast Escrow API to add trustless USDC escrow to your marketplace, gig platform, or AI agent in minutes. REST + TypeScript SDK.",
    canonicalPath: "/escrow-api",
  });

  const features = [
    { icon: Shield, title: "Trustless", body: "Funds held in smart contract escrow on Arc — not a custodial wallet. Neither party can move money without the correct condition." },
    { icon: Zap, title: "Sub-second finality", body: "Arc settles in under one second. Buyers confirm, sellers get paid, disputes resolve — all in the same block window." },
    { icon: Globe, title: "Any language", body: "REST API works from any stack. TypeScript SDK wraps the full lifecycle so you ship in minutes, not days." },
    { icon: Code2, title: "Webhook events", body: "Receive real-time notifications for funded, released, disputed, and refunded escrows. Keep your backend in sync without polling." },
    { icon: Package, title: "White-label ready", body: "Your brand, your flow. The escrow runs on Monast infrastructure. Your users never need to know." },
    { icon: Terminal, title: "Agent-native", body: "MCP-compatible — AI agents can create, fund, and release escrows programmatically with zero additional integration." },
  ];

  const pricing = [
    { tier: "Starter", price: "Free", txFee: "2.5% per release", limit: "100 escrows/month", cta: "Start building", href: "/agents" },
    { tier: "Growth", price: "20 USDC/mo", txFee: "2.0% per release", limit: "Unlimited escrows", cta: "Go to Pro", href: "/pro", highlight: true },
    { tier: "Enterprise", price: "Custom", txFee: "Negotiable", limit: "SLA + dedicated support", cta: "Contact us", href: "mailto:hello@monast.io" },
  ];

  return (
    <Layout>
      {/* Hero */}
      <section className="border-b border-border px-4 pt-20 pb-16">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-semibold text-primary mb-4 tracking-wide uppercase">Escrow as a Service</p>
          <h1 className="font-display text-5xl md:text-7xl font-medium leading-[1.02] mb-6 max-w-4xl">
            Add USDC escrow to any app in 5 minutes.
          </h1>
          <p className="text-base md:text-lg text-muted-foreground max-w-2xl mb-8 leading-relaxed">
            Embed trustless USDC escrow into your marketplace, gig platform, or AI agent workflow with a single API call.
            No smart contract deployment. No custody risk. 2.5% fee only on successful releases.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg"><Link to="/agents">Get an API key <ArrowRight className="w-4 h-4 ml-2" /></Link></Button>
            <Button asChild size="lg" variant="outline">
              <a href={`${BASE.replace("functions/v1", "functions/v1/agent-openapi")}`} target="_blank" rel="noopener">OpenAPI spec</a>
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-4 py-16 border-b border-border">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-display text-3xl md:text-4xl mb-10">Why Monast Escrow</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map(({ icon: Icon, title, body }) => (
              <Card key={title} className="p-5 space-y-2 bg-card border-border">
                <Icon className="w-5 h-5 text-primary" />
                <div className="font-semibold text-foreground">{title}</div>
                <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Code walkthrough */}
      <section className="px-4 py-16 border-b border-border">
        <div className="max-w-5xl mx-auto space-y-12">
          <h2 className="font-display text-3xl md:text-4xl">From zero to escrow in 3 steps</h2>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Step 1 — Install</p>
            <CopyBlock code={installSnippet} label="install" />
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Step 2 — Initialise</p>
            <CopyBlock code={initSnippet} label="init" />
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Step 3 — Run the escrow lifecycle</p>
            <CopyBlock code={createSnippet} label="escrow lifecycle" />
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Optional — Webhooks</p>
            <CopyBlock code={webhookSnippet} label="webhooks" />
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Or use the REST API directly</p>
            <CopyBlock code={curlSnippet} label="curl" />
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="px-4 py-16 border-b border-border">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-display text-3xl md:text-4xl mb-10">Pricing</h2>
          <div className="grid sm:grid-cols-3 gap-5">
            {pricing.map((p) => (
              <Card
                key={p.tier}
                className={`p-6 flex flex-col gap-4 ${p.highlight ? "border-primary/40 bg-card" : "border-border bg-background"}`}
              >
                {p.highlight && <span className="text-[10px] font-semibold text-primary uppercase tracking-wide">Most popular</span>}
                <div>
                  <div className="text-sm font-semibold text-muted-foreground mb-1">{p.tier}</div>
                  <div className="text-3xl font-display price-nums text-foreground">{p.price}</div>
                </div>
                <ul className="space-y-1.5 text-sm text-muted-foreground flex-1">
                  <li className="text-foreground font-medium">{p.txFee}</li>
                  <li>{p.limit}</li>
                </ul>
                <Button asChild variant={p.highlight ? "default" : "outline"} className="w-full">
                  {p.href.startsWith("mailto") ? (
                    <a href={p.href}>{p.cta}</a>
                  ) : (
                    <Link to={p.href}>{p.cta} <ArrowRight className="w-3.5 h-3.5 ml-1" /></Link>
                  )}
                </Button>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section className="px-4 py-16">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-display text-3xl md:text-4xl mb-8">Who uses the Escrow API</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { title: "Freelance platforms", body: "Replace Stripe or PayPal with onchain USDC escrow. No chargebacks, instant finality, global by default." },
              { title: "AI agent marketplaces", body: "Let agents buy and sell services autonomously. The MCP integration means no custom code — just point your agent at the MCP endpoint." },
              { title: "Digital asset sales", body: "Domains, apps, social accounts, NFTs. Buyer pays into escrow, seller transfers the asset, buyer confirms — seller gets paid. Simple." },
              { title: "P2P trading apps", body: "Ship your own marketplace without building escrow from scratch. Focus on your niche; Monast handles custody, fee collection, and dispute resolution." },
            ].map(({ title, body }) => (
              <Card key={title} className="p-5 border-border bg-card">
                <div className="font-semibold text-foreground mb-1">{title}</div>
                <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
              </Card>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Button asChild size="lg"><Link to="/agents">Get your API key — it takes 30 seconds <ArrowRight className="w-4 h-4 ml-2" /></Link></Button>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default EscrowApi;
