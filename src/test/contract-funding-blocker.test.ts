import { describe, expect, it } from "vitest";
import { contractFundingBlocker } from "@/lib/monastEscrow";

describe("contract escrow funding", () => {
  it("blocks when the contract price differs from the escrow amount", () => {
    expect(contractFundingBlocker({ priceUsdc: 1_400_000_000n, status: 0, remaining: 1n }, 1_000_000n)).toMatch(/1,400 USDC/);
  });
  it("allows funding at the exact contract price", () => {
    expect(contractFundingBlocker({ priceUsdc: 1_000_000n, status: 0, remaining: 1n }, 1_000_000n)).toBeNull();
  });
  it("blocks closed listings", () => {
    expect(contractFundingBlocker({ priceUsdc: 1_000_000n, status: 1, remaining: 1n }, 1_000_000n)).not.toBeNull();
  });
});
