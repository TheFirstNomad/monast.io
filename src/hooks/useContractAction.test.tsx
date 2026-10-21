import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
const mocks = vi.hoisted(() => ({ sign: vi.fn(), receipt: vi.fn(), invoke: vi.fn(), write: vi.fn() }));
vi.mock("wagmi", () => ({
  useChainId: () => 5042,
  useSwitchChain: () => ({ switchChainAsync: vi.fn() }),
  useWriteContract: () => ({ writeContractAsync: mocks.write }),
  usePublicClient: () => ({ waitForTransactionReceipt: mocks.receipt }),
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "google-user", email: "buyer@example.com" } }) }));
vi.mock("@/lib/circle/contractSigning", () => ({ signCircleContract: mocks.sign }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: mocks.invoke } } }));
import { useContractAction } from "./useContractAction";

describe("Google-wallet contract flow (simulated approvals)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sign.mockResolvedValue("0xconfirmed");
    mocks.receipt.mockResolvedValue({ status: "success" });
    mocks.invoke.mockResolvedValue({ data: { applied: ["event"] } });
  });
  it("publishes, funds, releases, and withdraws through Circle rather than browser or treasury transfers", async () => {
    const { result } = renderHook(() => useContractAction());
    await act(async () => {
      await result.current.run({ functionName: "createListing", args: [100000n, 1n], approveMicros: 150000n, sync: { ad_id: "ad" } });
      await result.current.run({ functionName: "fundEscrow", args: ["listing"], approveMicros: 100000n, sync: { escrow_id: "escrow" } });
      await result.current.run({ functionName: "confirmDelivery", args: ["onchain"], sync: { escrow_id: "escrow" } });
      await result.current.run({ functionName: "withdraw", args: [], sync: { escrow_id: "escrow" } });
    });
    expect(mocks.sign.mock.calls.map(([input]) => [input.operation, input.phase])).toEqual([
      ["createListing", "approve"], ["createListing", "execute"], ["fundEscrow", "approve"],
      ["fundEscrow", "execute"], ["confirmDelivery", "execute"], ["withdraw", "execute"],
    ]);
    expect(mocks.write).not.toHaveBeenCalled();
    expect(mocks.receipt).toHaveBeenCalledTimes(6);
    expect(mocks.invoke.mock.calls.map(([name]) => name)).toEqual(["escrow-contract-sync", "escrow-contract-sync", "escrow-contract-sync"]);
  });
  it("does not execute payment after an on-chain approval failure", async () => {
    mocks.receipt.mockResolvedValue({ status: "reverted" });
    const { result } = renderHook(() => useContractAction());
    await act(async () => {
      await expect(result.current.run({ functionName: "fundEscrow", args: ["listing"], approveMicros: 100000n, sync: { escrow_id: "escrow" } })).rejects.toThrow(/approval failed/);
    });
    expect(mocks.sign).toHaveBeenCalledTimes(1);
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
});