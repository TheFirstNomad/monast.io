// Arc network registry for edge functions - the single place that decides
// whether monast.io is settling on Arc Testnet or Arc Public Mainnet.
//
// Arc Public Mainnet goes live on 16 September 2026. Until Circle publishes the
// mainnet USDC contract and issues a mainnet USDC token id, mainnet stays OFF:
// every money path keeps using Arc Testnet rather than sending funds to an
// address nobody controls. Flipping to mainnet is configuration only - no code
// change - by setting these secrets:
//
//   ARC_MAINNET_USDC_ADDRESS          0x… USDC contract on Arc mainnet
//   CIRCLE_USDC_TOKEN_ID_ARC_MAINNET  Circle token id for USDC on ARC
//   ARC_DEFAULT_CHAIN_ID              5042001 to make mainnet the default
//   ARC_MAINNET_RPC_URL               optional RPC override
//   CIRCLE_ARC_MAINNET_BLOCKCHAIN     optional Circle blockchain id override

export const ARC_TESTNET_CHAIN_ID = 5042002;
export const ARC_MAINNET_CHAIN_ID = 5042001;

export const ARC_TESTNET_USDC = "0x3600000000000000000000000000000000000000";
export const ARC_TESTNET_RPC = "https://rpc.testnet.arc.network";

function env(name: string): string {
  return ((globalThis as any).Deno?.env?.get(name) ?? "").trim();
}

function isRealAddress(a: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(a) && !/^0x0+$/.test(a);
}

export function arcMainnetUsdc(): string {
  return env("ARC_MAINNET_USDC_ADDRESS").toLowerCase();
}

export function arcMainnetRpc(): string {
  return env("ARC_MAINNET_RPC_URL") || "https://rpc.arc.network";
}

/** Mainnet is only usable once BOTH the USDC contract and Circle token id exist. */
export function isArcMainnetLive(): boolean {
  return isRealAddress(arcMainnetUsdc()) && env("CIRCLE_USDC_TOKEN_ID_ARC_MAINNET") !== "";
}

/** Chain used when a record carries no chain of its own (listing fees, etc.). */
export function defaultArcChainId(): number {
  return env("ARC_DEFAULT_CHAIN_ID") === String(ARC_MAINNET_CHAIN_ID) && isArcMainnetLive()
    ? ARC_MAINNET_CHAIN_ID
    : ARC_TESTNET_CHAIN_ID;
}

export function arcRpc(chainId: number): string {
  if (chainId === ARC_MAINNET_CHAIN_ID) return arcMainnetRpc();
  return ARC_TESTNET_RPC;
}

export function arcUsdcAddress(chainId: number): string {
  if (chainId === ARC_MAINNET_CHAIN_ID) {
    const a = arcMainnetUsdc();
    if (!isRealAddress(a)) {
      throw new Error(
        "Arc mainnet USDC contract is not configured yet (ARC_MAINNET_USDC_ADDRESS).",
      );
    }
    return a;
  }
  if (chainId === ARC_TESTNET_CHAIN_ID) return ARC_TESTNET_USDC;
  throw new Error(`Unsupported chain ${chainId} - monast.io settles on Arc only`);
}

export function circleBlockchainId(chainId: number): string {
  return chainId === ARC_MAINNET_CHAIN_ID
    ? env("CIRCLE_ARC_MAINNET_BLOCKCHAIN") || "ARC"
    : env("CIRCLE_ARC_TESTNET_BLOCKCHAIN") || "ARC-TESTNET";
}

/** Circle token id for USDC on the given Arc chain. */
export function circleUsdcTokenId(chainId: number): string {
  return chainId === ARC_MAINNET_CHAIN_ID
    ? env("CIRCLE_USDC_TOKEN_ID_ARC_MAINNET")
    : env("CIRCLE_USDC_TOKEN_ID_ARC_TESTNET");
}
