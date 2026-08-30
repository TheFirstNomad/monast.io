import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { pickTransfer, type CircleTx } from "./pickTransfer.ts";

const DEST = "0x064d44a684f41239bcb6425b1d7441343afbf837";

Deno.test("prefers a completed transfer with a txHash", () => {
  const txs: CircleTx[] = [
    { id: "pending", state: "INITIATED", amounts: ["0.15"], destinationAddress: DEST },
    { id: "done", state: "COMPLETE", txHash: "0xabc", amounts: ["0.15"], destinationAddress: DEST },
  ];
  assertEquals(pickTransfer(txs, DEST, 0.15)?.id, "done");
});

Deno.test("matches amounts written with different precision", () => {
  const txs: CircleTx[] = [
    { id: "done", state: "COMPLETE", txHash: "0xabc", amounts: ["0.150000"], destinationAddress: DEST.toUpperCase() },
  ];
  assertEquals(pickTransfer(txs, DEST, 0.15)?.id, "done");
});

Deno.test("ignores transfers to another destination or amount", () => {
  const txs: CircleTx[] = [
    { id: "other-dest", state: "COMPLETE", txHash: "0x1", amounts: ["0.15"], destinationAddress: "0xdead" },
    { id: "other-amount", state: "COMPLETE", txHash: "0x2", amounts: ["5"], destinationAddress: DEST },
  ];
  assertEquals(pickTransfer(txs, DEST, 0.15), null);
});

Deno.test("returns a pending transfer so the caller can keep polling", () => {
  const txs: CircleTx[] = [
    { id: "pending", state: "PENDING_RISK_SCREENING", amounts: ["0.15"], destinationAddress: DEST },
  ];
  const found = pickTransfer(txs, DEST, 0.15);
  assertEquals(found?.id, "pending");
  assertEquals(found?.txHash ?? null, null);
});

Deno.test("prefers a live transfer over a failed one", () => {
  const txs: CircleTx[] = [
    { id: "failed", state: "FAILED", amounts: ["0.15"], destinationAddress: DEST },
    { id: "live", state: "SENT", amounts: ["0.15"], destinationAddress: DEST },
  ];
  assertEquals(pickTransfer(txs, DEST, 0.15)?.id, "live");
});

// Withdrawal recovery: a challenge that returns no transaction id must still
// find the user's own completed 10 USDC send.
Deno.test("recovers a withdrawal by destination and amount", () => {
  const txs: CircleTx[] = [
    { id: "fee", state: "COMPLETE", txHash: "0xfee", amounts: ["0.15"], destinationAddress: DEST },
    { id: "withdrawal", state: "COMPLETE", txHash: "0xwd", amounts: ["10.000000"], destinationAddress: DEST },
  ];
  const found = pickTransfer(txs, DEST, 10);
  assertEquals(found?.id, "withdrawal");
  assertEquals(found?.txHash, "0xwd");
});

Deno.test("does not recover a withdrawal of a different amount", () => {
  const txs: CircleTx[] = [
    { id: "withdrawal", state: "COMPLETE", txHash: "0xwd", amounts: ["10"], destinationAddress: DEST },
  ];
  assertEquals(pickTransfer(txs, DEST, 10.000001), null);
});

