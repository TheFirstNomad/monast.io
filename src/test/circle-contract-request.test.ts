import { describe, expect, it } from "vitest";
import { contractExecutionBody, correlatedTransactionId } from "../../supabase/functions/_shared/circle-contract-request";

describe("Circle contract API requests", () => {
  it("uses walletId without the mutually exclusive blockchain field", () => {
    const body = contractExecutionBody({ id: "request", wallet_id: "existing-wallet", contract_address: "contract", call_data: "0x1234" });
    expect(body.walletId).toBe("existing-wallet");
    expect(body).not.toHaveProperty("blockchain");
    expect(body).not.toHaveProperty("walletAddress");
    expect(body.callData).toBe("0x1234");
    expect(body.idempotencyKey).toBe("request");
  });
  it("recovers only a transaction correlated by Circle or already persisted", () => {
    expect(correlatedTransactionId({}, {})).toBeUndefined();
    expect(correlatedTransactionId({}, { correlationIds: ["correlated"] })).toBe("correlated");
    expect(correlatedTransactionId({ transaction_id: "persisted" }, { correlationIds: ["other"] })).toBe("persisted");
  });
});