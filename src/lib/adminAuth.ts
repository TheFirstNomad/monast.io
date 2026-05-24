/**
 * Admin authentication via cryptographic wallet signature.
 * The client signs a fresh timestamped message for every admin request; the
 * server verifies it recovers to the owner wallet and records it in
 * admin_sig_nonces to reject replays.
 */

export function buildAdminMessage(timestamp: number): string {
  return `monast.io Admin\nTimestamp: ${timestamp}`;
}

export async function getAdminAuthHeaders(
  address: string,
  signMessage: (args: any) => Promise<string>
): Promise<Record<string, string>> {
  const timestamp = Date.now();
  const message = buildAdminMessage(timestamp);
  const signature = await signMessage({ message });

  return {
    "Content-Type": "application/json",
    "x-admin-address": address,
    "x-admin-timestamp": String(timestamp),
    "x-admin-signature": signature,
  };
}

export function clearAdminAuth() {
  /* no cache to clear */
}
