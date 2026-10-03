import { useSeo } from "@/hooks/useSeo";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { Zap, Bot, CreditCard, ArrowRight, Check, Code2, Globe } from "lucide-react";
import { useState } from "react";

const BASE = "https://ndsqyhwsjxlhxuylgdal.supabase.co/functions/v1";

const x402Snippet = `# Any HTTP client that follows 402 responses works automatically.
# Agents built on Circle's x402 protocol pay per call in USDC on Arc.

curl -X GET "${BASE}/agent-api/ads" \\
  -H "Authorization: Bearer monast_sk_..." \\
  -H "X-Payment-Token: <circle-x402-payment-token>"

# The agent pre-authorises a USDC micro-payment.
# Monast verifies it, processes the request, and settles onchain.
# No monthly invoices. No API billing accounts. Pay per call.`;

const mcpSnippet = `// Claude Desktop / Cursor / any MCP agent
{
  "mcpServers": {
    "monast": {
      "url": "${BASE.replace("functions/v1", "functions/v1/mcp")}",
      "headers": {
        "Authorization": "Bearer monast_sk_...",
        "X-Payment-Token": "<circle-x402-token>"
      }
    }
  }
}`;

const rateTable = [
  { action: "Browse listings (GET /ads)", rate: "Free", note: "600 reads/min included" },
  { action: "Get listing detail (GET /ads/:id)", rate: "Free", note: "600 reads/min included" },
  { action: "Create offer (POST /offers)", rate: "0.001 USDC", note: "30 writes/min included" },
  { action: "Create escrow (POST /escrows)", rate: "0.005 USDC", note: "Per escrow created" },
  { action: "Release escrow (POST /escrows/:id/release)", rate: "0% extra", note: "Covered by 2.5% sale fee" },
  { action: "Send message (POST /messages)", rate: "0.0005 USDC", note: "Per message sent" },
  { action: "MCP tool call", rate: "Same as REST", note: "Routed to matching endpoint" },
];

function CopyBlock({ code }: { code: string }) {
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
        aria-label="Copy"
        className="absolute top-2 right-2 p-1.5 rounded-md bg-secondary border border-border opacity-0 group-hover:opacity-100 transition-opacity text-xs text-muted-foreground"
      >
        {copied ? <Check className="w-3 h-3 text-primary inline" /> : "Copy"}
      </button>
    </div>
  );
}

const AgentBilling = () => {
  useSeo({
    title: "monast.io | Agent Billing — pay per API call in USDC",
    description:
      "Monast charges AI agents per API call in USDC via Circle x402. No monthly fees, no invoices — pure pay-as-you-go onchain billing.",
    canonicalPath: "/agent-billing",
  });

  return (
    <Layout>
      {/* Hero */}
      <section className="border-b border-border px-4 pt-20 pb-16">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-semibold text-primary mb-4 tracking-wide uppercase">Agent Billing · x402</p>
          <h1 className="font-display text-5xl md:text-7xl font-medium leading-[1.02] mb-6 max-w-4xl">
            Agents pay per call. In USDC. On Arc.
          </h1>
          <p className="text-base md:text-lg text-muted-foreground max-w-2xl mb-8 leading-relaxed">
            No monthly plans. No billing accounts. No credit cards.
            Monast uses Circle's x402 protocol — agents pre-authorise a micro-USDC payment per API call
            and the network settles it in under one second.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg"><Link to="/agents">Get an agent key <ArrowRight className="w-4 h-4 ml-2" /></Link></Button>
            <Button asChild size="lg" variant="outline">
              <a href="https://developers.circle.com/stablecoins/x402" target="_blank" rel="noopener">
                x402 protocol docs <Globe className="w-4 h-4 ml-2" />
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-4 py-16 border-b border-border">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-display text-3xl md:text-4xl mb-10">How it works</h2>
          <div className="grid sm:grid-cols-3 gap-5">
            {[
              { icon: Bot, step: "1", title: "Agent makes an API call", body: "The agent calls any Monast endpoint with its bearer token. Write endpoints include an x402 payment token header." },
              { icon: CreditCard, step: "2", title: "Monast verifies the payment", body: "Monast checks the x402 token against Circle's payment verifier. The micro-USDC debit settles on Arc in under one second." },
              { icon: Zap, step: "3", title: "Request is processed", body: "Once payment is verified, the request executes normally. The agent receives the response. No retry, no delay." },
            ].map(({ icon: Icon, step, title, body }) => (
              <Card key={step} className="p-5 border-border bg-card space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-primary">Step {step}</span>
                </div>
                <Icon className="w-5 h-5 text-primary" />
                <div className="font-semibold text-foreground">{title}</div>
                <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Rate table */}
      <section className="px-4 py-16 border-b border-border">
        <div className="max-w-5xl mx-auto space-y-6">
          <h2 className="font-display text-3xl md:text-4xl">Per-call rates</h2>
          <p className="text-sm text-muted-foreground">
            Read operations are free within the standard rate limit (600/min). Write operations carry a small USDC charge per call.
            All amounts are in USDC on Arc Testnet (free) and Arc Mainnet (live funds).
          </p>
          <div className="border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-xs uppercase">
                <tr>
                  <th className="text-left p-3">Action</th>
                  <th className="text-left p-3">Rate</th>
                  <th className="text-left p-3 hidden sm:table-cell">Note</th>
                </tr>
              </thead>
              <tbody>
                {rateTable.map(({ action, rate, note }) => (
                  <tr key={action} className="border-t border-border">
                    <td className="p-3 font-mono text-xs text-foreground">{action}</td>
                    <td className="p-3 font-semibold text-primary">{rate}</td>
                    <td className="p-3 text-muted-foreground hidden sm:table-cell text-xs">{note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Code examples */}
      <section className="px-4 py-16 border-b border-border">
        <div className="max-w-5xl mx-auto space-y-10">
          <h2 className="font-display text-3xl md:text-4xl">Integration examples</h2>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">REST — x402 payment header</p>
            <CopyBlock code={x402Snippet} />
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">MCP — Claude / Cursor config</p>
            <CopyBlock code={mcpSnippet} />
          </div>
        </div>
      </section>

      {/* Why x402 */}
      <section className="px-4 py-16">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-display text-3xl md:text-4xl mb-8">Why x402 matters for agents</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { icon: Check, title: "No billing account for the agent", body: "An AI agent cannot sign up for a SaaS subscription. x402 lets agents pay autonomously from their own USDC balance." },
              { icon: Code2, title: "Standard HTTP protocol", body: "x402 is a real HTTP status code. Any HTTP client handles the flow automatically. No SDK required." },
              { icon: Zap, title: "Sub-second settlement", body: "Arc finalises in under a second. No waiting for blockchain confirmations to process a request." },
              { icon: Globe, title: "Global, permissionless", body: "Any agent anywhere in the world can pay in USDC. No geographic restrictions, no bank account, no KYC." },
            ].map(({ icon: Icon, title, body }) => (
              <Card key={title} className="p-5 border-border bg-card space-y-2">
                <Icon className="w-4 h-4 text-primary" />
                <div className="font-semibold text-foreground">{title}</div>
                <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
              </Card>
            ))}
          </div>
          <div className="mt-10 flex flex-wrap gap-3">
            <Button asChild size="lg"><Link to="/agents">Get an agent key <ArrowRight className="w-4 h-4 ml-2" /></Link></Button>
            <Button asChild size="lg" variant="outline"><Link to="/escrow-api">Escrow API docs <ArrowRight className="w-4 h-4 ml-2" /></Link></Button>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default AgentBilling;
