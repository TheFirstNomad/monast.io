export type EscrowStatus = "open" | "funded" | "released" | "disputed" | "cancelled";
export type EscrowRole = "buyer" | "seller";

export interface Escrow {
  id: string;
  title: string;
  description: string;
  amount: number;
  token: string;
  status: EscrowStatus;
  role: EscrowRole;
  creator: string;
  counterparty: string;
  conditions: string;
  deadline: string;
  created_at: string;
}

export const MOCK_ESCROWS: Escrow[] = [
  {
    id: "1",
    title: "NFT Art Commission",
    description: "Custom digital artwork - 3 pieces",
    amount: 500,
    token: "USDC",
    status: "open",
    role: "buyer",
    creator: "0x1a2B...eF12",
    counterparty: "0xABCD...5678",
    conditions: "Deliver 3 high-res artworks in PNG format",
    deadline: "2026-05-01",
    created_at: "2026-04-05",
  },
  {
    id: "2",
    title: "Smart Contract Audit",
    description: "Full audit of DeFi protocol contracts",
    amount: 2000,
    token: "USDC",
    status: "funded",
    role: "seller",
    creator: "0xABCD...5678",
    counterparty: "0x1a2B...eF12",
    conditions: "Complete audit report with severity ratings",
    deadline: "2026-04-20",
    created_at: "2026-04-02",
  },
  {
    id: "3",
    title: "Domain Name Sale",
    description: "Transfer of premium .io domain",
    amount: 1500,
    token: "ETH",
    status: "released",
    role: "buyer",
    creator: "0x1a2B...eF12",
    counterparty: "0x9999...1111",
    conditions: "Domain transferred to buyer's registrar account",
    deadline: "2026-04-10",
    created_at: "2026-03-28",
  },
];
