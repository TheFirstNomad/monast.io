import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

/**
 * UI guard tests for the escrow detail screen: the status timeline must reflect
 * the escrow's real state, and money-moving actions must be hidden whenever the
 * current viewer / status combination does not allow them.
 */

const BUYER = "11111111-1111-1111-1111-111111111111";
const SELLER = "22222222-2222-2222-2222-222222222222";
const OTHER = "33333333-3333-3333-3333-333333333333";

let currentUser: { id: string } | null = { id: BUYER };
let escrowRow: Record<string, unknown> | null = null;

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: currentUser, session: null, loading: false, signOut: async () => {} }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () =>
            table === "escrows"
              ? { data: escrowRow, error: null }
              : { data: { title: "Toyota Hilux 2016" }, error: null },
        }),
      }),
    }),
    functions: { invoke: vi.fn(async () => ({ data: {}, error: null })) },
  },
}));

vi.mock("@/components/Layout", () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/EscrowFundButton", () => ({
  EscrowFundButton: () => <button type="button">Pay into escrow</button>,
}));
vi.mock("@/components/ChatDialog", () => ({ ChatDialog: () => null }));

import EscrowDetail from "./EscrowDetail";

const baseEscrow = {
  id: "e1",
  ad_id: "a1",
  buyer_id: BUYER,
  seller_id: SELLER,
  amount_usdc: 250,
  status: "funded",
  chain_id: 5771,
  deposit_tx_hash: null,
  release_tx_hash: null,
  refund_tx_hash: null,
  platform_fee_usdc: null,
  seller_net_usdc: null,
  payout_status: null,
  cancel_requested_by: null,
  cancel_requested_at: null,
  cancel_reason: null,
  delivery_marked_at: null,
  auto_release_at: null,
  funded_at: null,
  released_at: null,
  refunded_at: null,
  created_at: "2026-08-01T10:00:00.000Z",
};

const renderPage = async (escrow: Record<string, unknown>, userId: string | null) => {
  escrowRow = escrow;
  currentUser = userId ? { id: userId } : null;
  render(
    <MemoryRouter initialEntries={["/escrow/e1"]}>
      <Routes>
        <Route path="/escrow/:id" element={<EscrowDetail />} />
      </Routes>
    </MemoryRouter>,
  );
  await waitFor(() => expect(screen.getByRole("heading", { name: "Escrow" })).toBeInTheDocument());
};

const btn = (re: RegExp) => screen.queryByRole("button", { name: re });

beforeEach(() => {
  escrowRow = null;
  currentUser = null;
});

describe("EscrowDetail status timeline", () => {
  it("awaiting payment shows only the funding step for the buyer", async () => {
    await renderPage({ ...baseEscrow, status: "created" }, BUYER);
    expect(screen.getByText("Awaiting payment")).toBeInTheDocument();
    expect(screen.queryByText("Funded")).not.toBeInTheDocument();
    expect(screen.queryByText("Released")).not.toBeInTheDocument();
    expect(btn(/Pay into escrow/i)).toBeInTheDocument();
  });

  it("funded shows the funding timestamp and the held-in-escrow status", async () => {
    await renderPage(
      { ...baseEscrow, funded_at: "2026-08-02T10:00:00.000Z", deposit_tx_hash: "0xdead" },
      BUYER,
    );
    expect(screen.getByText("Held in escrow")).toBeInTheDocument();
    expect(screen.getByText("Funded")).toBeInTheDocument();
    expect(screen.getByText("Deposit tx")).toBeInTheDocument();
    expect(screen.queryByText("Released")).not.toBeInTheDocument();
    expect(screen.queryByText("Refunded")).not.toBeInTheDocument();
  });

  it("delivery marked adds the delivery step", async () => {
    await renderPage(
      {
        ...baseEscrow,
        funded_at: "2026-08-02T10:00:00.000Z",
        delivery_marked_at: "2026-08-03T10:00:00.000Z",
      },
      SELLER,
    );
    expect(screen.getByText("Marked delivered")).toBeInTheDocument();
  });

  it("released shows the release step, payout tx and no refund step", async () => {
    await renderPage(
      {
        ...baseEscrow,
        status: "released",
        funded_at: "2026-08-02T10:00:00.000Z",
        released_at: "2026-08-04T10:00:00.000Z",
        release_tx_hash: "0xbeef",
      },
      BUYER,
    );
    expect(screen.getByText("Released to seller")).toBeInTheDocument();
    expect(screen.getByText("Released")).toBeInTheDocument();
    expect(screen.getByText("Payout tx")).toBeInTheDocument();
    expect(screen.queryByText("Refund tx")).not.toBeInTheDocument();
  });

  it("refunded shows the refund step and refund tx", async () => {
    await renderPage(
      {
        ...baseEscrow,
        status: "refunded",
        funded_at: "2026-08-02T10:00:00.000Z",
        refunded_at: "2026-08-04T10:00:00.000Z",
        refund_tx_hash: "0xcafe",
      },
      BUYER,
    );
    expect(screen.getByText("Refunded to buyer")).toBeInTheDocument();
    expect(screen.getByText("Refunded")).toBeInTheDocument();
    expect(screen.getByText("Refund tx")).toBeInTheDocument();
  });

  it("disputed shows the dispute status", async () => {
    await renderPage({ ...baseEscrow, status: "disputed", funded_at: "2026-08-02T10:00:00.000Z" }, BUYER);
    expect(screen.getByText("Under dispute")).toBeInTheDocument();
  });

  it("cancelled shows the cancelled status", async () => {
    await renderPage({ ...baseEscrow, status: "cancelled" }, BUYER);
    expect(screen.getByText("Cancelled")).toBeInTheDocument();
  });

  it("a pending payout tells the viewer the transfer is in flight", async () => {
    await renderPage({ ...baseEscrow, status: "released", payout_status: "pending" }, SELLER);
    expect(screen.getByText(/on-chain transfer is in progress/i)).toBeInTheDocument();
  });
});

describe("EscrowDetail action gating", () => {
  it("buyer on a funded escrow can release, cancel and dispute but never refund", async () => {
    await renderPage(baseEscrow, BUYER);
    expect(btn(/release to seller/i)).toBeInTheDocument();
    expect(btn(/Request a cancellation/i)).toBeInTheDocument();
    expect(btn(/Item not as promised/i)).toBeInTheDocument();
    expect(btn(/Refund the buyer/i)).toBeNull();
    expect(btn(/Mark as delivered/i)).toBeNull();
  });

  it("seller on a funded escrow can refund, mark delivered and dispute but never release or cancel", async () => {
    await renderPage(baseEscrow, SELLER);
    expect(btn(/Refund the buyer/i)).toBeInTheDocument();
    expect(btn(/Mark as delivered/i)).toBeInTheDocument();
    expect(btn(/Buyer not cooperating/i)).toBeInTheDocument();
    expect(btn(/release to seller/i)).toBeNull();
    expect(btn(/cancellation/i)).toBeNull();
  });

  it("released escrows hide every money-moving action for both sides", async () => {
    await renderPage({ ...baseEscrow, status: "released" }, BUYER);
    expect(btn(/release to seller/i)).toBeNull();
    expect(btn(/Open a dispute/i)).toBeNull();
    expect(btn(/cancellation/i)).toBeNull();
    expect(btn(/Cancel this order/i)).toBeNull();

    screen.unmount?.();
  });

  it("refunded escrows hide refund, release and dispute for the seller", async () => {
    await renderPage({ ...baseEscrow, status: "refunded" }, SELLER);
    expect(btn(/Refund the buyer/i)).toBeNull();
    expect(btn(/Open a dispute/i)).toBeNull();
    expect(btn(/Mark as delivered/i)).toBeNull();
  });

  it("cancelled escrows expose no actions at all", async () => {
    await renderPage({ ...baseEscrow, status: "cancelled" }, BUYER);
    expect(btn(/release to seller/i)).toBeNull();
    expect(btn(/Pay into escrow/i)).toBeNull();
    expect(btn(/Open a dispute/i)).toBeNull();
    expect(btn(/Cancel this order/i)).toBeNull();
  });

  it("a disputed escrow can no longer be disputed again, but can still be resolved", async () => {
    await renderPage({ ...baseEscrow, status: "disputed" }, BUYER);
    expect(btn(/Open a dispute/i)).toBeNull();
    expect(btn(/release to seller/i)).toBeInTheDocument();
  });

  it("an open cancellation request replaces the seller's refund button with approve/decline", async () => {
    await renderPage(
      { ...baseEscrow, cancel_requested_by: BUYER, cancel_requested_at: "2026-08-03T10:00:00.000Z" },
      SELLER,
    );
    expect(btn(/Approve & refund buyer/i)).toBeInTheDocument();
    expect(btn(/Decline/i)).toBeInTheDocument();
    expect(btn(/Refund the buyer/i)).toBeNull();
  });

  it("a buyer who already requested cancellation cannot request it twice", async () => {
    await renderPage(
      { ...baseEscrow, cancel_requested_by: BUYER, cancel_requested_at: "2026-08-03T10:00:00.000Z" },
      BUYER,
    );
    expect(btn(/Request a cancellation/i)).toBeNull();
    expect(screen.getByText(/request is with the seller/i)).toBeInTheDocument();
  });

  it("an unrelated viewer sees the timeline but no actions and no chat", async () => {
    await renderPage(baseEscrow, OTHER);
    expect(screen.getByText("Held in escrow")).toBeInTheDocument();
    expect(screen.getByText("Observer")).toBeInTheDocument();
    expect(btn(/release to seller/i)).toBeNull();
    expect(btn(/Refund the buyer/i)).toBeNull();
    expect(btn(/Open a dispute/i)).toBeNull();
    expect(btn(/Open chat/i)).toBeNull();
  });

  it("a signed-out viewer gets no actions", async () => {
    await renderPage(baseEscrow, null);
    expect(btn(/release to seller/i)).toBeNull();
    expect(btn(/Refund the buyer/i)).toBeNull();
    expect(btn(/Open a dispute/i)).toBeNull();
  });
});
