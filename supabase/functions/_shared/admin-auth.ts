// Shared admin signature verifier - used by all admin-* edge functions.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { recoverMessageAddress } from "https://esm.sh/viem@2.21.55";

export const OWNER_WALLET = "0x13FA78ab20762c8F49B58D44DBc177a2Adb94D7c".toLowerCase();
const MAX_AGE_MS = 5 * 60 * 1000;

export async function verifyAdmin(req: Request, supabase: ReturnType<typeof createClient>): Promise<boolean> {
  const address = req.headers.get("x-admin-address")?.toLowerCase();
  const timestamp = req.headers.get("x-admin-timestamp");
  const signature = req.headers.get("x-admin-signature");

  if (!address || !timestamp || !signature || address !== OWNER_WALLET) return false;

  const ts = Number(timestamp);
  if (isNaN(ts) || Math.abs(Date.now() - ts) > MAX_AGE_MS) return false;

  let recovered: string;
  try {
    recovered = (await recoverMessageAddress({
      message: `monast.io Admin\nTimestamp: ${ts}`,
      signature: signature as `0x${string}`,
    })).toLowerCase();
  } catch {
    return false;
  }
  if (recovered !== OWNER_WALLET) return false;

  const { error } = await supabase
    .from("admin_sig_nonces")
    .insert({ signature, admin_address: address });
  if (error) return false; // unique violation = replay
  return true;
}
