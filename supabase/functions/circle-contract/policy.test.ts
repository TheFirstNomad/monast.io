import { describe, expect, it } from "vitest";
import { authorizeContractAction, exactApproval, ESCROW_CONTRACT, ARC_USDC, CONTRACT_CHAIN_ID } from "../_shared/contract-policy";

const funded = { buyer_id: "buyer", seller_id: "seller", settlement: "contract", status: "funded" };
describe("Circle contract signing safeguards", () => {
  it("pins calls to V3 on Arc Mainnet 5042", () => {
    expect(CONTRACT_CHAIN_ID).toBe(5042);
    expect(ESCROW_CONTRACT).toBe("0xca19df99563fe93c6172463e4b66a3dcf2cf1eba");
  });
  it("approves exactly 0.15 USDC to V3, never unlimited allowance", () => {
    expect(exactApproval(150000n, "approve")).toEqual({ target: ARC_USDC, spender: ESCROW_CONTRACT, amount: 150000n });
    expect(() => exactApproval(0n, "approve")).toThrow();
  });
  it("does not migrate older treasury escrows", () => {
    expect(() => authorizeContractAction("confirmDelivery", { ...funded, settlement: "treasury" }, "buyer")).toThrow(/older escrow/);
  });
  it("only the buyer confirms delivery", () => {
    expect(() => authorizeContractAction("confirmDelivery", funded, "seller")).toThrow(/Only the buyer/);
    expect(() => authorizeContractAction("confirmDelivery", funded, "buyer")).not.toThrow();
  });
  it("only the seller refunds", () => {
    expect(() => authorizeContractAction("refundBuyer", funded, "buyer")).toThrow(/Only the seller/);
    expect(() => authorizeContractAction("refundBuyer", funded, "seller")).not.toThrow();
  });
  it("outsiders and administrative calls are refused", () => {
    expect(() => authorizeContractAction("openDispute", funded, "outsider")).toThrow(/Not your/);
    expect(() => authorizeContractAction("arbitrate", funded, "buyer")).toThrow(/Unsupported/);
  });
});