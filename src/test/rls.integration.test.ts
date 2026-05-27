/**
 * Integration tests for RLS policies & DB triggers.
 *
 * Spins up two ephemeral auth users via the service-role admin API, exercises
 * featured-flag, offer-immutables, and payment-insert checks, then cleans up.
 *
 * Skipped automatically when SUPABASE_SERVICE_ROLE_KEY is not present.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!;
const ANON = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

const suite = SERVICE ? describe : describe.skip;

suite("RLS policies & triggers", () => {
  const admin = createClient(URL, SERVICE ?? "", { auth: { persistSession: false } });

  let sellerId = "";
  let buyerId = "";
  let strangerId = "";
  let sellerClient: SupabaseClient;
  let buyerClient: SupabaseClient;
  let strangerClient: SupabaseClient;
  let adId = "";

  const mkUser = async (label: string) => {
    const email = `${label}-${crypto.randomUUID()}@test.monast.local`;
    const password = crypto.randomUUID();
    const { data, error } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
    });
    if (error) throw error;
    const client = createClient(URL, ANON, { auth: { persistSession: false } });
    const { error: signInErr } = await client.auth.signInWithPassword({ email, password });
    if (signInErr) throw signInErr;
    return { id: data.user!.id, client };
  };

  beforeAll(async () => {
    const seller = await mkUser("seller");
    const buyer = await mkUser("buyer");
    const stranger = await mkUser("stranger");
    sellerId = seller.id; sellerClient = seller.client;
    buyerId = buyer.id; buyerClient = buyer.client;
    strangerId = stranger.id; strangerClient = stranger.client;

    // Seed an ad as the seller (service-role bypasses RLS but trigger still fires).
    const { data, error } = await admin
      .from("ads")
      .insert({
        seller_id: sellerId,
        title: "Test Item",
        description: "Test",
        category: "other",
        condition: "New",
        location: "Internet",
        price_usdc: 100,
      })
      .select("id")
      .single();
    if (error) throw error;
    adId = data!.id;
  }, 30_000);

  afterAll(async () => {
    if (adId) await admin.from("ads").delete().eq("id", adId);
    for (const id of [sellerId, buyerId, strangerId]) {
      if (id) await admin.auth.admin.deleteUser(id);
    }
  }, 30_000);

  describe("ads.featured guard", () => {
    it("blocks the seller from setting their own ad as featured", async () => {
      const { error } = await sellerClient
        .from("ads").update({ featured: true }).eq("id", adId);
      expect(error).toBeTruthy();
      expect(String(error?.message)).toMatch(/featured|admin/i);
    });

    it("lets the service role (admin path) set featured", async () => {
      const { error } = await admin
        .from("ads").update({ featured: true }).eq("id", adId);
      expect(error).toBeNull();
      // revert
      await admin.from("ads").update({ featured: false }).eq("id", adId);
    });
  });

  describe("offers immutables & status guard", () => {
    let offerId = "";

    it("buyer can create a pending offer", async () => {
      const { data, error } = await buyerClient
        .from("offers")
        .insert({ ad_id: adId, buyer_id: buyerId, amount_usdc: 50 })
        .select("id").single();
      expect(error).toBeNull();
      offerId = data!.id;
    });

    it("blocks the seller from raising the offer amount", async () => {
      const { error } = await sellerClient
        .from("offers").update({ amount_usdc: 999 }).eq("id", offerId);
      expect(error).toBeTruthy();
      expect(String(error?.message)).toMatch(/amount_usdc/i);
    });

    it("blocks the buyer from changing their own offer amount", async () => {
      const { error } = await buyerClient
        .from("offers").update({ amount_usdc: 1 }).eq("id", offerId);
      expect(error).toBeTruthy();
      expect(String(error?.message)).toMatch(/amount_usdc/i);
    });

    it("blocks the seller from reassigning buyer_id", async () => {
      const { error } = await sellerClient
        .from("offers").update({ buyer_id: strangerId }).eq("id", offerId);
      expect(error).toBeTruthy();
      expect(String(error?.message)).toMatch(/buyer_id/i);
    });

    it("blocks a stranger from accepting the offer", async () => {
      // Stranger isn't buyer or seller — RLS UPDATE policy rejects them.
      const { data, error } = await strangerClient
        .from("offers").update({ status: "accepted" }).eq("id", offerId).select();
      // Either explicit error or just zero rows updated.
      if (!error) expect(data ?? []).toHaveLength(0);
    });

    it("blocks the buyer from self-accepting their own offer", async () => {
      const { error } = await buyerClient
        .from("offers").update({ status: "accepted" }).eq("id", offerId);
      expect(error).toBeTruthy();
      expect(String(error?.message)).toMatch(/cancel|status/i);
    });

    it("lets the seller accept a pending offer", async () => {
      const { error } = await sellerClient
        .from("offers").update({ status: "accepted" }).eq("id", offerId);
      expect(error).toBeNull();
    });

    it("blocks further status changes once accepted", async () => {
      const { error } = await sellerClient
        .from("offers").update({ status: "rejected" }).eq("id", offerId);
      expect(error).toBeTruthy();
    });
  });

  describe("payments insert policy", () => {
    it("blocks payment with mismatched seller_id", async () => {
      const { error } = await buyerClient.from("payments").insert({
        ad_id: adId, buyer_id: buyerId, seller_id: strangerId,
        amount_usdc: 100, tx_hash: "0x" + "a".repeat(64), chain_id: 5042002,
      });
      expect(error).toBeTruthy();
    });

    it("blocks payment when buyer_id is spoofed to another user", async () => {
      const { error } = await buyerClient.from("payments").insert({
        ad_id: adId, buyer_id: strangerId, seller_id: sellerId,
        amount_usdc: 100, tx_hash: "0x" + "b".repeat(64), chain_id: 5042002,
      });
      expect(error).toBeTruthy();
    });

    it("allows a correct payment from the real buyer", async () => {
      const { error } = await buyerClient.from("payments").insert({
        ad_id: adId, buyer_id: buyerId, seller_id: sellerId,
        amount_usdc: 100, tx_hash: "0x" + "c".repeat(64), chain_id: 5042002,
      });
      expect(error).toBeNull();
    });

  });
});
