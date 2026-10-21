import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ invoke: vi.fn(), challenge: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: mocks.invoke } } }));
vi.mock("./client", () => ({ runCircleChallenge: mocks.challenge }));
import { signCircleContract } from "./contractSigning";

describe("Circle contract recovery", () => {
  beforeEach(() => vi.clearAllMocks());
  it("does not treat a failed transaction hash as success", async () => {
    mocks.invoke.mockResolvedValue({ data: { txHash: "0xfailed", status: "FAILED" } });
    await expect(signCircleContract({ operation: "fundEscrow", referenceId: "escrow", phase: "execute" }, vi.fn())).rejects.toThrow(/did not complete/);
    expect(mocks.challenge).not.toHaveBeenCalled();
  });
  it("recovers the original hash without asking for another approval", async () => {
    mocks.invoke.mockResolvedValue({ data: { txHash: "0xoriginal", status: "COMPLETE" } });
    await expect(signCircleContract({ operation: "withdraw", referenceId: "escrow", phase: "execute" }, vi.fn())).resolves.toBe("0xoriginal");
    expect(mocks.challenge).not.toHaveBeenCalled();
  });
});