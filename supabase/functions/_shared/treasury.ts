// Treasury resolution - the single place a treasury address comes from.
//
// Hard rule: there is no fallback address. If the treasury for a chain is not
// provisioned, money operations fail loudly rather than sending USDC to an
// address nobody controls.

export type TreasuryPurpose = "escrow" | "revenue";

export interface TreasuryWallet {
  id: string;
  purpose: TreasuryPurpose;
  chain_id: number;
  circle_blockchain: string;
  circle_wallet_id: string | null;
  circle_wallet_set_id: string | null;
  address: string;
  is_active: boolean;
}

export class TreasuryNotConfigured extends Error {
  constructor(purpose: TreasuryPurpose, chainId: number) {
    super(
      `No active ${purpose} treasury wallet for chain ${chainId}. ` +
        `Provision the treasury from the admin screen before accepting payments.`,
    );
    this.name = "TreasuryNotConfigured";
  }
}

export async function getTreasury(
  admin: any,
  purpose: TreasuryPurpose,
  chainId: number,
): Promise<TreasuryWallet> {
  const { data, error } = await admin
    .from("treasury_wallets")
    .select("*")
    .eq("purpose", purpose)
    .eq("chain_id", chainId)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  if (!data?.address) throw new TreasuryNotConfigured(purpose, chainId);
  return data as TreasuryWallet;
}

/** Address only - for "where should the buyer send funds" style questions. */
export async function getTreasuryAddress(
  admin: any,
  purpose: TreasuryPurpose,
  chainId: number,
): Promise<string> {
  return (await getTreasury(admin, purpose, chainId)).address;
}

export function isTreasuryMissing(e: unknown): boolean {
  return e instanceof Error && e.name === "TreasuryNotConfigured";
}
