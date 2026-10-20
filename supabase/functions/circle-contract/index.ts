import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createPublicClient, http, encodeFunctionData, parseAbi } from "npm:viem@2.21.0";
import { z } from "npm:zod@3";
import abi from "../_shared/monastEscrowAbi.json" with { type: "json" };
import { circle, getFreshUserSession } from "../_shared/circle-session.ts";
import { ESCROW_CONTRACT, ARC_USDC, authorizeContractAction, exactApproval } from "../_shared/contract-policy.ts";
import { arcMainnetRpc } from "../_shared/arc-chains.ts";
import { toBaseUnits, loadFeeSettings } from "../_shared/fees.ts";
import { checkUserRateLimit, rateLimitBody } from "../_shared/user-rate-limit.ts";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), operation: z.enum(["createListing", "fundEscrow", "confirmDelivery", "refundBuyer", "markReadyForRelease", "claimAutoRelease", "openDispute", "withdraw"]), referenceId: z.string().uuid(), phase: z.enum(["approve", "execute"]) }).strict(),
  z.object({ action: z.literal("status"), requestId: z.string().uuid() }).strict(),
]);
const erc20 = parseAbi(["function approve(address spender, uint256 amount) returns (bool)"]);
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const lower = (s: unknown) => String(s ?? "").toLowerCase();

async function stateOf(admin: any, request: any, session: any) {
  if (!request.challenge_id) return { status: "CREATING", txHash: null, submitted: false };
  const challenge = (await circle(`/user/challenges/${request.challenge_id}`, { headers: { "X-User-Token": session.userToken } }))?.data?.challenge;
  const id = request.transaction_id ?? challenge?.correlationIds?.[0];
  const complete = String(challenge?.status ?? "").toUpperCase() === "COMPLETE";
  if (!id || !complete) return { status: challenge?.status ?? "PENDING", txHash: request.tx_hash, submitted: complete };
  const payload = await circle(`/transactions/${id}`, { headers: { "X-User-Token": session.userToken } });
  const tx = payload?.data?.transaction ?? payload?.data;
  if (tx?.walletId !== request.wallet_id || lower(tx?.contractAddress) !== lower(request.contract_address) || lower(tx?.callData) !== lower(request.call_data)) {
    throw new Error("The wallet transaction did not match the approved request.");
  }
  const { error } = await admin.from("circle_contract_requests").update({ transaction_id: id, tx_hash: tx?.txHash ?? null }).eq("id", request.id);
  if (error) throw error;
  return { status: tx?.state ?? "PENDING", txHash: tx?.txHash ?? null, submitted: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const asUser = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: identity, error: authError } = await asUser.auth.getUser();
    if (authError || !identity.user) return json({ error: "Unauthorized" }, 401);
    const userId = identity.user.id;
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return json({ error: "Invalid contract signing request" }, 400);
    const body = parsed.data;
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const limit = await checkUserRateLimit(admin, userId, body.action === "status" ? "circle-transfer-read" : "circle-transfer");
    if (!limit.ok) return json(rateLimitBody(limit), 429);
    if (body.action === "status") {
      const { data: request } = await admin.from("circle_contract_requests").select("*").eq("id", body.requestId).eq("user_id", userId).maybeSingle();
      if (!request) return json({ error: "Request not found" }, 404);
      return json(await stateOf(admin, request, await getFreshUserSession(admin, userId)));
    }
    const { data: profile } = await admin.from("profiles").select("circle_wallet_id, circle_wallet_address").eq("id", userId).maybeSingle();
    if (!profile?.circle_wallet_id || !profile.circle_wallet_address) return json({ error: "Sign in with Google again to unlock your existing wallet." }, 409);
    const session = await getFreshUserSession(admin, userId, true);
    const wallet = (await circle(`/wallets/${profile.circle_wallet_id}`, { headers: { "X-User-Token": session.userToken } }))?.data?.wallet;
    if (!wallet || wallet.blockchain !== "ARC" || lower(wallet.address) !== lower(profile.circle_wallet_address)) return json({ error: "This signing request requires your existing Arc Mainnet wallet." }, 409);

    // Recover an exact existing request BEFORE checking state: its successful
    // transaction may already have changed the escrow or listing.
    const { data: old } = await admin.from("circle_contract_requests").select("*").eq("user_id", userId).eq("operation", body.operation).eq("reference_id", body.referenceId).eq("phase", body.phase).maybeSingle();
    if (old?.challenge_id) {
      if (old.wallet_id !== profile.circle_wallet_id) return json({ error: "Use the wallet that originally approved this request." }, 409);
      return json({ requestId: old.id, challengeId: old.challenge_id, userToken: session.userToken, encryptionKey: session.encryptionKey, ...await stateOf(admin, old, session) });
    }

    const client = createPublicClient({ transport: http(arcMainnetRpc()) });
    let args: any[] = [];
    let approval = 0n;
    if (body.operation === "createListing") {
      const { data: ad } = await admin.from("ads").select("seller_id, price_usdc, status, onchain_listing_id, listing_fee_paid_at, deleted_by_owner").eq("id", body.referenceId).maybeSingle();
      if (!ad || ad.seller_id !== userId || ad.status !== "pending_fee" || ad.onchain_listing_id || ad.deleted_by_owner) return json({ error: "Listing is not awaiting publication." }, 409);
      if (ad.listing_fee_paid_at) return json({ error: "This listing fee was already paid. Reopen the listing to finish publication." }, 409);
      approval = toBaseUnits((await loadFeeSettings(admin)).listingFeeUsdc);
      args = [toBaseUnits(ad.price_usdc), 1n];
    } else if (body.operation === "fundEscrow") {
      const { data: escrow } = await admin.from("escrows").select("*").eq("id", body.referenceId).maybeSingle();
      if (!escrow || escrow.buyer_id !== userId || escrow.status !== "created" || Number(escrow.chain_id) !== 5042) return json({ error: "Escrow is not payable." }, 409);
      const { data: ad } = await admin.from("ads").select("onchain_listing_id, status, seller_id").eq("id", escrow.ad_id).maybeSingle();
      if (!ad?.onchain_listing_id || ad.status !== "active" || ad.seller_id === userId) return json({ error: "This listing is not available for contract escrow." }, 409);
      const listing: any = await client.readContract({ address: ESCROW_CONTRACT, abi, functionName: "getListing", args: [ad.onchain_listing_id] });
      const { data: seller } = await admin.from("profiles").select("circle_wallet_address, wallet_address").eq("id", ad.seller_id).maybeSingle();
      if (![seller?.wallet_address, seller?.circle_wallet_address].some((a) => a && lower(a) === lower(listing.seller))) return json({ error: "The listing seller’s wallet does not match the contract." }, 409);
      approval = toBaseUnits(escrow.amount_usdc);
      if (BigInt(listing.priceUsdc) !== approval || BigInt(listing.remaining) < 1n) return json({ error: "Contract escrow requires the current listed price. Ask the seller to publish the agreed price first." }, 409);
      args = [ad.onchain_listing_id];
    } else {
      const { data: escrow } = await admin.from("escrows").select("*").eq("id", body.referenceId).maybeSingle();
      if (!escrow || ![escrow.buyer_id, escrow.seller_id].includes(userId) || escrow.settlement !== "contract" || Number(escrow.chain_id) !== 5042 || !escrow.onchain_escrow_id) return json({ error: "Not your contract escrow." }, 403);
      const onchain: any = await client.readContract({ address: ESCROW_CONTRACT, abi, functionName: "getEscrow", args: [escrow.onchain_escrow_id] });
      const party = escrow.buyer_id === userId ? onchain.buyer : onchain.seller;
      if (lower(party) !== lower(profile.circle_wallet_address)) return json({ error: "Use the wallet that funded or created this escrow." }, 403);
      if (body.operation === "withdraw") {
        if (body.phase !== "execute") return json({ error: "Withdrawal requires no token approval." }, 400);
      } else {
        authorizeContractAction(body.operation, escrow, userId);
        args = [escrow.onchain_escrow_id];
      }
    }
    const approved = body.phase === "approve" ? exactApproval(approval, body.phase) : null;
    const target = approved?.target ?? ESCROW_CONTRACT;
    const name = approved ? "approve" : body.operation;
    const callArgs = approved ? [approved.spender, approved.amount] : args;
    const callAbi = approved ? erc20 : abi;
    const callData = encodeFunctionData({ abi: callAbi, functionName: name, args: callArgs });
    // Dry run from the actual Circle wallet. In particular, execute must wait
    // for the exact USDC approval to be mined before it can pass simulation.
    await client.simulateContract({ account: profile.circle_wallet_address, address: target, abi: callAbi, functionName: name, args: callArgs });
    const { data: request, error: reserveError } = await admin.from("circle_contract_requests").upsert({
      user_id: userId, wallet_id: profile.circle_wallet_id, operation: body.operation, reference_id: body.referenceId, phase: body.phase, contract_address: target, call_data: callData,
    }, { onConflict: "user_id,operation,reference_id,phase", ignoreDuplicates: true }).select("*").maybeSingle();
    if (reserveError) throw reserveError;
    const reserved = request ?? old ?? (await admin.from("circle_contract_requests").select("*").eq("user_id", userId).eq("operation", body.operation).eq("reference_id", body.referenceId).eq("phase", body.phase).single()).data;
    if (!reserved || reserved.call_data !== callData || reserved.wallet_id !== profile.circle_wallet_id) return json({ error: "A different request is already awaiting approval. Finish that request first." }, 409);
    const response = await circle("/user/transactions/contractExecution", {
      method: "POST", headers: { "X-User-Token": session.userToken }, body: JSON.stringify({
        idempotencyKey: reserved.id, walletId: reserved.wallet_id, blockchain: "ARC", contractAddress: target, callData, feeLevel: "MEDIUM", refId: reserved.id,
      }),
    });
    const challengeId = response?.data?.challengeId;
    if (!challengeId) return json({ error: "Circle did not return an authorization challenge." }, 502);
    const { error: saveError } = await admin.from("circle_contract_requests").update({ challenge_id: challengeId }).eq("id", reserved.id);
    if (saveError) throw saveError;
    return json({ requestId: reserved.id, challengeId, userToken: session.userToken, encryptionKey: session.encryptionKey });
  } catch (e) {
    // Never log raw Circle payloads, JWTs, SDK tokens, or encryption material.
    const message = (e as Error).message ?? "";
    const friendly = message.startsWith("Circle ") ? "Circle could not authorize this transaction. Try signing in with Google again; your existing wallet stays unchanged." : message.includes("reverted") ? "The contract refused this action. Check your balance and the escrow’s current status." : message;
    return json({ error: friendly || "Could not authorize the escrow transaction." }, 400);
  }
});