import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { verifyMessage, getAddress } from "npm:viem@2.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const WALLET_EMAIL_DOMAIN = "wallet.monast.io";

// Only these hosts may request a monast.io wallet sign-in.
const ALLOWED_HOSTS = new Set([
  "monast.io",
  "www.monast.io",
  "monast-secure-swap.lovable.app",
  "localhost",
  "localhost:8080",
  "127.0.0.1:8080",
]);

function hostAllowed(host: string): boolean {
  const h = host.toLowerCase();
  if (ALLOWED_HOSTS.has(h)) return true;
  const bare = h.split(":")[0];
  if (ALLOWED_HOSTS.has(bare)) return true;
  // Lovable preview/sandbox hosts for this project
  return /^[a-z0-9-]*--[a-z0-9-]+\.lovable\.app$/.test(bare) ||
    bare.endsWith(".lovableproject.com");
}

function parseSiwe(message: string) {
  // Minimal EIP-4361 parsing - pulls out the fields we need to validate.
  const addressMatch = message.match(/\n([0-9a-fA-FxX]{42})\n\n/);
  const nonceMatch = message.match(/\nNonce: ([A-Za-z0-9]+)/);
  const issuedAtMatch = message.match(/\nIssued At: (\S+)/);
  const domainMatch = message.match(/^(\S+) wants you to sign in/);
  const uriMatch = message.match(/\nURI: (\S+)/);
  if (!addressMatch || !nonceMatch || !issuedAtMatch || !domainMatch || !uriMatch) {
    throw new Error("Malformed SIWE message");
  }
  const domain = domainMatch[1];
  let uriHost: string;
  try {
    uriHost = new URL(uriMatch[1]).host;
  } catch {
    throw new Error("Malformed SIWE URI");
  }
  // Domain binding: the signed domain must be one of ours and match the URI host.
  if (!hostAllowed(domain) || domain.toLowerCase() !== uriHost.toLowerCase()) {
    throw new Error("SIWE domain not allowed");
  }
  return {
    address: getAddress(addressMatch[1]),
    nonce: nonceMatch[1],
    issuedAt: new Date(issuedAtMatch[1]),
    domain,
  };
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { message, signature } = await req.json();
    if (typeof message !== "string" || typeof signature !== "string") {
      return new Response(JSON.stringify({ error: "Invalid body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { address, nonce, issuedAt } = parseSiwe(message);

    // Issued-at must be within the last 10 minutes
    if (Date.now() - issuedAt.getTime() > 10 * 60 * 1000) {
      throw new Error("SIWE message expired");
    }

    // Verify signature
    const ok = await verifyMessage({
      address: address as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    });
    if (!ok) throw new Error("Bad signature");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Consume nonce atomically (must exist and not be used)
    const { data: consumed, error: consumeErr } = await supabase
      .from("siwe_nonces")
      .update({ used_at: new Date().toISOString(), address })
      .eq("nonce", nonce)
      .is("used_at", null)
      .select("nonce")
      .maybeSingle();
    if (consumeErr) throw consumeErr;
    if (!consumed) throw new Error("Invalid or already-used nonce");

    // Deterministic placeholder email keyed by address
    const email = `${address.toLowerCase()}@${WALLET_EMAIL_DOMAIN}`;

    // Strong password (used internally only)
    const pwBytes = new Uint8Array(32);
    crypto.getRandomValues(pwBytes);
    const password = Array.from(pwBytes, (b) => b.toString(16).padStart(2, "0")).join("");

    // Find an existing wallet user.
    // Fast path: profiles mirrors wallet_address, so one indexed read usually
    // answers it. Fallback: page through the admin user list (listUsers is
    // paginated - a single page would miss users once the project grows).
    let userId: string | null = null;
    {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .ilike("wallet_address", address)
        .maybeSingle();
      if (profile?.id) userId = profile.id;
    }

    if (!userId) {
      const perPage = 200;
      for (let page = 1; page <= 50; page++) {
        const { data: list, error: listErr } = await supabase.auth.admin.listUsers({
          page,
          perPage,
        });
        if (listErr) throw listErr;
        const users = list?.users ?? [];
        const existing = users.find((u) => u.email?.toLowerCase() === email);
        if (existing) {
          userId = existing.id;
          break;
        }
        if (users.length < perPage) break;
      }
    }


    if (!userId) {
      const { data: created, error: createErr } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { wallet_address: address, display_name: `${address.slice(0, 6)}…${address.slice(-4)}` },
      });
      if (createErr) throw createErr;
      userId = created.user!.id;
    } else {
      // Reset password so we can sign in deterministically
      const { error: updErr } = await supabase.auth.admin.updateUserById(userId, { password });
      if (updErr) throw updErr;
    }

    // Make sure wallet_address is mirrored on profile
    await supabase
      .from("profiles")
      .update({ wallet_address: address })
      .eq("id", userId);

    // Mint a session by signing in with the just-set password
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );
    const { data: signIn, error: signInErr } = await anonClient.auth.signInWithPassword({
      email,
      password,
    });
    if (signInErr) throw signInErr;

    return new Response(
      JSON.stringify({
        access_token: signIn.session!.access_token,
        refresh_token: signIn.session!.refresh_token,
        address,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
