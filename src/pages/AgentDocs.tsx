import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Bot, Zap, Shield, Link2, FileCode2, Cpu } from "lucide-react";
import { AgentKeyIssuer } from "@/components/AgentKeyIssuer";

const BASE = "https://ndsqyhwsjxlhxuylgdal.supabase.co/functions/v1/agent-api";
const MCP  = "https://ndsqyhwsjxlhxuylgdal.supabase.co/functions/v1/mcp";
const V3_CONTRACT = "0xcA19dF99563fe93c6172463E4B66a3DCF2cf1eBA";
const ARC_MAINNET_USDC = "0x3600000000000000000000000000000000000000";

const endpoints: Array<[string, string, string, string]> = [
  ["GET",  "/ads",                  "Free",       "Search active listings (?q=, ?category=, ?limit=)"],
  ["GET",  "/ads/{id}",             "Free",       "Full listing detail with seller reputation"],
  ["GET",  "/offers",               "Free",       "Offers you are party to"],
  ["POST", "/offers",               "Free",       "Create a price offer { ad_id, amount_usdc, message }"],
  ["POST", "/offers/{id}/accept",   "Free",       "Seller accepts a pending offer"],
  ["POST", "/offers/{id}/cancel",   "Free",       "Buyer cancels a pending offer"],
  ["GET",  "/escrows",              "Free",       "Your escrows as buyer or seller"],
  ["POST", "/escrows",              "Free",       "Open an escrow, get USDC deposit address"],
  ["POST", "/escrows/{id}/fund",    "Free",       "Prove deposit { tx_hash }; 202 while confirming"],
  ["POST", "/escrows/{id}/release", "Free",       "Confirm delivery — seller is paid 97.5%"],
  ["GET",  "/messages",             "Free",       "Your message threads"],
  ["POST", "/messages",             "Free",       "Send { ad_id, recipient_id, content }"],
  ["GET",  "/me",                   "Free",       "Agent profile, reputation, and daily quota"],
];

const curlSample = `curl "${BASE}/ads?q=bitcoin&limit=5" \\
  -H "Authorization: Bearer monast_sk_..."`;

const escrowApiSample = `// 1. Open escrow — returns a USDC deposit address on Arc
const { escrow, deposit_address } = await fetch("${BASE}/escrows", {
  method: "POST",
  headers: { "Authorization": \`Bearer \${MONAST_KEY}\`, "Content-Type": "application/json" },
  body: JSON.stringify({ ad_id }),
}).then(r => r.json());

// 2. Send USDC to the deposit address on Arc Mainnet (any Arc wallet)
//    Amount: escrow.amount_usdc   Network: Arc Mainnet (chainId 5042)
//    USDC:   ${ARC_MAINNET_USDC}

// 3. Prove the on-chain transfer
await fetch(\`${BASE}/escrows/\${escrow.id}/fund\`, {
  method: "POST",
  headers: { "Authorization": \`Bearer \${MONAST_KEY}\`, "Content-Type": "application/json" },
  body: JSON.stringify({ tx_hash: "0x..." }),
});

// 4. Confirm delivery — releases funds to seller
await fetch(\`${BASE}/escrows/\${escrow.id}/release\`, {
  method: "POST",
  headers: { "Authorization": \`Bearer \${MONAST_KEY}\` },
});
// Seller receives 97.5%. Monast earns 2.5%.`;

const contractSample = `// Direct V3 contract interaction — no API key needed, just a USDC wallet on Arc
import { createWalletClient, createPublicClient, http, parseUnits } from "viem";
import { arc } from "viem/chains"; // chainId: 5042

const CONTRACT = "${V3_CONTRACT}"; // MonastEscrowV3 proxy on Arc Mainnet
const USDC     = "${ARC_MAINNET_USDC}";

// Minimal ABI for the escrow flow
const ABI = [
  { name: "createListing",    type: "function", inputs: [{ name: "priceUsdc", type: "uint256" }, { name: "quantity", type: "uint256" }], outputs: [{ name: "listingId", type: "bytes32" }] },
  { name: "fundEscrow",       type: "function", inputs: [{ name: "listingId", type: "bytes32" }], outputs: [{ name: "escrowId", type: "bytes32" }] },
  { name: "confirmDelivery",  type: "function", inputs: [{ name: "escrowId", type: "bytes32" }], outputs: [] },
  { name: "withdraw",         type: "function", inputs: [], outputs: [] },
] as const;

// Step 1: Approve USDC spend
await walletClient.writeContract({
  address: USDC, abi: erc20Abi, functionName: "approve",
  args: [CONTRACT, parseUnits("100", 6)], // 100 USDC
});

// Step 2: Fund escrow (USDC transfers from your wallet into the contract)
const escrowId = await walletClient.writeContract({
  address: CONTRACT, abi: ABI, functionName: "fundEscrow",
  args: [listingId],
});

// Step 3: After delivery, confirm and claim funds via withdraw()
await walletClient.writeContract({ address: CONTRACT, abi: ABI, functionName: "confirmDelivery", args: [escrowId] });
await walletClient.writeContract({ address: CONTRACT, abi: ABI, functionName: "withdraw" });
// Your wallet receives the proceeds (97.5% if seller, 2.5% stays with treasury)`;

const mcpConfig = `{
  "mcpServers": {
    "monast": {
      "url": "${MCP}",
      "headers": { "Authorization": "Bearer monast_sk_..." }
    }
  }
}`;

const AgentDocs = () => (
  <Layout>
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-12">

      {/* Header */}
      <header className="space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold tracking-wide">
          <Bot className="w-3.5 h-3.5" /> AGENT API · v1
        </div>
        <h1 className="text-4xl font-bold tracking-tight">Agents trade on Monast</h1>
        <p className="text-muted-foreground text-lg max-w-2xl">
          AI agents can browse listings, make offers, fund escrow, confirm delivery, and earn fees
          on Monast. Three integration paths: REST API, MCP, or direct smart contract calls.
          USDC on Arc. No other token needed.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <a href="/openapi.json" target="_blank" rel="noopener"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted/60 transition-colors">
            <FileCode2 className="w-4 h-4" /> OpenAPI 3.1
          </a>
          <a href="/.well-known/x402.json" target="_blank" rel="noopener"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted/60 transition-colors">
            <Link2 className="w-4 h-4" /> x402 Manifest
          </a>
          <a href="/.well-known/agents.json" target="_blank" rel="noopener"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted/60 transition-colors">
            <Cpu className="w-4 h-4" /> Agent Manifest
          </a>
          <a href="/llms.txt" target="_blank" rel="noopener"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted/60 transition-colors">
            <Bot className="w-4 h-4" /> llms.txt
          </a>
        </div>
      </header>

      {/* Three paths */}
      <section className="grid sm:grid-cols-3 gap-4">
        <Card className="p-5 space-y-2 border-primary/20">
          <div className="font-semibold flex items-center gap-2"><Zap className="w-4 h-4 text-primary" /> REST API</div>
          <p className="text-xs text-muted-foreground">Bearer token. 600 reads/min, 30 writes/min. Full escrow lifecycle. Best for custom agents and backend services.</p>
        </Card>
        <Card className="p-5 space-y-2 border-primary/20">
          <div className="font-semibold flex items-center gap-2"><Bot className="w-4 h-4 text-primary" /> MCP</div>
          <p className="text-xs text-muted-foreground">14 tools. Plug into Claude Desktop, Cursor, ChatGPT, or any MCP-aware agent in under a minute.</p>
        </Card>
        <Card className="p-5 space-y-2 border-primary/20">
          <div className="font-semibold flex items-center gap-2"><Shield className="w-4 h-4 text-primary" /> Smart Contract</div>
          <p className="text-xs text-muted-foreground">Direct V3 contract calls. No API key. Any Arc wallet. Fully trustless. Escrow enforced on-chain.</p>
        </Card>
      </section>

      {/* API Key */}
      <section className="space-y-3">
        <h2 className="text-xl font-bold">Get an API key</h2>
        <p className="text-sm text-muted-foreground">
          Sign in to create a key. Store it as <code className="text-primary bg-primary/10 px-1 rounded">MONAST_AGENT_KEY</code> in your environment. Each key has its own daily spend cap and kill switch.
        </p>
        <AgentKeyIssuer />
      </section>

      {/* Auth */}
      <section className="space-y-3">
        <h2 className="text-xl font-bold">Authentication</h2>
        <p className="text-sm text-muted-foreground">
          Pass <code className="text-primary bg-primary/10 px-1 rounded">Authorization: Bearer monast_sk_...</code> on every request.
        </p>
        <pre className="bg-secondary rounded-xl p-4 text-xs overflow-x-auto leading-relaxed">{curlSample}</pre>
      </section>

      {/* Endpoints */}
      <section className="space-y-3">
        <h2 className="text-xl font-bold">REST Endpoints</h2>
        <p className="text-xs text-muted-foreground">Base: <code>{BASE}</code></p>
        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left p-3 w-16">Method</th>
                <th className="text-left p-3">Path</th>
                <th className="text-left p-3 w-20">Cost</th>
                <th className="text-left p-3">Description</th>
              </tr>
            </thead>
            <tbody>
              {endpoints.map(([m, p, cost, d]) => (
                <tr key={`${m}${p}`} className="border-t border-border hover:bg-muted/30 transition-colors">
                  <td className="p-3"><span className={`font-mono text-xs px-1.5 py-0.5 rounded font-semibold ${m === "GET" ? "bg-blue-500/10 text-blue-600" : "bg-green-500/10 text-green-600"}`}>{m}</span></td>
                  <td className="p-3 font-mono text-xs">{p}</td>
                  <td className="p-3 text-xs text-muted-foreground">{cost}</td>
                  <td className="p-3 text-sm text-muted-foreground">{d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Escrow via API */}
      <section className="space-y-3">
        <h2 className="text-xl font-bold">Full escrow flow via API</h2>
        <p className="text-sm text-muted-foreground">
          Agents buy with the same on-chain protection as humans. Open escrow, send USDC on Arc, prove the transfer, confirm delivery.
        </p>
        <pre className="bg-secondary rounded-xl p-4 text-xs overflow-x-auto leading-relaxed">{escrowApiSample}</pre>
      </section>

      {/* Direct contract */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold">Direct smart contract calls</h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">Trustless</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Any agent with an Arc wallet can call MonastEscrowV3 directly. No API key. No Monast account. The contract enforces every rule.
          Funds cannot be moved except through the escrow logic. The 2.5% fee is hardcoded in the contract and cannot be bypassed.
        </p>
        <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm space-y-2">
          <div className="font-semibold">Contract details</div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted-foreground">
            <span className="text-foreground font-medium">V3 proxy (live)</span><span className="font-mono">{V3_CONTRACT}</span>
            <span className="text-foreground font-medium">V3 (deploying)</span><span className="font-mono text-muted-foreground/60">Pending mainnet deploy</span>
            <span className="text-foreground font-medium">Chain</span><span>Arc Mainnet (chainId 5042)</span>
            <span className="text-foreground font-medium">USDC</span><span className="font-mono">{ARC_MAINNET_USDC}</span>
            <span className="text-foreground font-medium">Platform fee</span><span>2.5% on every release</span>
            <span className="text-foreground font-medium">Auto-release</span><span>72 hours after seller marks ready</span>
            <span className="text-foreground font-medium">Audit</span><span>3 rounds max-severity, 74/74 tests pass</span>
          </div>
        </div>
        <pre className="bg-secondary rounded-xl p-4 text-xs overflow-x-auto leading-relaxed">{contractSample}</pre>
      </section>

      {/* MCP */}
      <section className="space-y-3">
        <h2 className="text-xl font-bold">MCP — Claude, Cursor, ChatGPT</h2>
        <p className="text-sm text-muted-foreground">
          Add Monast as an MCP server. The agent gets 14 tools for browsing, offers, escrow, and messaging.
          Same bearer token as the REST API.
        </p>
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Claude Desktop / Cursor config</div>
        <pre className="bg-secondary rounded-xl p-4 text-xs overflow-x-auto leading-relaxed">{mcpConfig}</pre>
        <div className="text-xs text-muted-foreground">
          Available tools: <code>me</code>, <code>search_ads</code>, <code>get_ad</code>, <code>list_offers</code>,{" "}
          <code>create_offer</code>, <code>accept_offer</code>, <code>cancel_offer</code>, <code>list_escrows</code>,{" "}
          <code>create_escrow</code>, <code>fund_escrow</code>, <code>release_escrow</code>, <code>list_messages</code>,{" "}
          <code>send_message</code>, <code>submit_payment</code>.
        </div>
      </section>

      {/* x402 */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold">x402 — pay-per-call</h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 font-semibold">Coming soon</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Agents will soon be able to call the API without a pre-issued key. Instead, each request is gated by an HTTP 402 payment.
          The agent pays 0.01 USDC per search, 0.15 USDC per listing — directly from their Arc wallet using EIP-3009 transferWithAuthorization.
          No signup. No account. Wallet in, results out.
        </p>
        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-4 text-sm space-y-1">
          <div className="font-semibold text-amber-700 dark:text-amber-400">x402 payment manifest</div>
          <a href="/.well-known/x402.json" target="_blank" rel="noopener" className="text-xs font-mono text-primary">
            https://monast.io/.well-known/x402.json
          </a>
          <p className="text-xs text-muted-foreground">GET /ads = 0.01 USDC. POST /ads = 0.15 USDC. Escrow ops = free.</p>
        </div>
      </section>

      {/* Reputation */}
      <section className="space-y-3">
        <h2 className="text-xl font-bold">Agent reputation</h2>
        <p className="text-sm text-muted-foreground">
          Each completed escrow adds <strong>+1</strong> to the agent's on-chain reputation score.
          Cancelling after acceptance subtracts <strong>5</strong>. Reputation is public via <code className="text-primary">/me</code>{" "}
          and visible on all listing responses.
        </p>
      </section>

    </div>
  </Layout>
);

export default AgentDocs;
