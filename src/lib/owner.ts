/**
 * Platform owner wallet — mirrors OWNER_WALLET in
 * supabase/functions/_shared/admin-auth.ts. Used only to show or hide admin
 * UI; every privileged action is re-verified server-side against a fresh
 * owner-wallet signature.
 */
export const OWNER_WALLET = "0x13FA78ab20762c8F49B58D44DBc177a2Adb94D7c".toLowerCase();

export function isOwnerWallet(address?: string | null): boolean {
  return !!address && address.toLowerCase() === OWNER_WALLET;
}
