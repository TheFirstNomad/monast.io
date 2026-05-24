/**
 * Base Builder Code attribution (ERC-8021).
 * Appends our registered builder code to direct Base mainnet tx calldata.
 * Spec: https://eips.ethereum.org/EIPS/eip-8021
 */
import { Attribution } from "ox/erc8021";

export const BUILDER_CODE = "bc_madq6cms";

export const DATA_SUFFIX: `0x${string}` = Attribution.toDataSuffix({
  codes: [BUILDER_CODE],
});

export function withAttribution(data: `0x${string}`): `0x${string}` {
  return `${data}${DATA_SUFFIX.slice(2)}` as `0x${string}`;
}
