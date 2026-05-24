import { useState, useCallback } from "react";
import { useSendTransaction, useReadContract, usePublicClient } from "wagmi";
import { parseUnits, encodeFunctionData } from "viem";
import {
  UNISWAP_V3_ROUTER, SWAP_ROUTER_ABI, ERC20_ABI,
} from "./contracts";
import type { TokenInfo } from "./tokens";
import { WETH_ADDRESS, getPoolFee } from "./tokens";
import { createViemAdapterFromWallet, swapViaKit, type PaymentChainId } from "@/lib/arcAppKit";
import { withAttribution, DATA_SUFFIX } from "@/lib/builderCode";

export type SwapState = "idle" | "approving" | "swapping" | "success" | "error";

export type CalldataDebug = {
  kind: "approve" | "swap";
  to: `0x${string}`;
  raw: `0x${string}`;
  attributed: `0x${string}`;
  suffix: `0x${string}`;
  timestamp: number;
};

const normalizeErrorMessage = (message: string) =>
  message.replace(/^execution reverted:?\s*/i, "")
    .replace(/^The contract function "[^"]+" reverted with the following reason:\s*/i, "").trim();

const getReadableSwapError = (error: unknown) => {
  const err = error as Record<string, unknown> | null;
  const cause = err?.cause as Record<string, unknown> | undefined;
  const combined = [cause?.reason, err?.shortMessage, err?.message, err?.details, cause?.shortMessage, cause?.message, cause?.details]
    .filter(Boolean).join(" | ");
  const normalizedMessage = normalizeErrorMessage(combined);
  const n = normalizedMessage.toLowerCase();
  if (n.includes("user rejected") || n.includes("rejected the request") || n.includes("user denied")) return "Transaction cancelled in wallet.";
  if (n.includes("insufficient funds")) return "Insufficient balance for the swap and network fees.";
  if (n.includes("network fee unavailable") || n.includes("estimate gas") || n.includes("gas estimation") || n.includes("unpredictable gas"))
    return "Swap could not be simulated. Recheck the amount, route, and slippage, then try again.";
  if (n.includes("failed to fetch") || n.includes("networkerror") || n.includes("cors"))
    return "Swap service unavailable — please try again later.";
  if (n.includes("createswap failed")) return "Swap request failed. Check network and try again.";
  if (n.includes("reverted") || n.includes("execution reverted"))
    return normalizedMessage || "Swap reverted on-chain.";
  return normalizedMessage || (err?.shortMessage as string) || (err?.message as string) || "Swap failed";
};

export function useSwap({
  tokenIn, tokenOut, amountIn, amountOutMin, chainId, userAddress, walletProvider,
}: {
  tokenIn: TokenInfo | null;
  tokenOut: TokenInfo | null;
  amountIn: string;
  amountOutMin: bigint | null;
  chainId: number;
  userAddress: `0x${string}` | undefined;
  slippage: number;
  walletProvider?: unknown;
}) {
  const [swapState, setSwapState] = useState<SwapState>("idle");
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [errorMessage, setErrorMessage] = useState("");
  const [lastCalldata, setLastCalldata] = useState<CalldataDebug | null>(null);
  const [calldataHistory, setCalldataHistory] = useState<CalldataDebug[]>([]);

  const recordCalldata = useCallback((entry: CalldataDebug) => {
    setLastCalldata(entry);
    setCalldataHistory((prev) => [entry, ...prev].slice(0, 5));
  }, []);

  const publicClient = usePublicClient({ chainId });
  const { sendTransactionAsync } = useSendTransaction();

  const isBase = chainId === 8453;
  const isArc = chainId === 5042002;
  const isNativeIn = tokenIn?.address === "native";
  const isNativeOut = tokenOut?.address === "native";

  const routerAddress = UNISWAP_V3_ROUTER;
  const actualTokenIn = isNativeIn ? WETH_ADDRESS : (tokenIn?.address as `0x${string}`);

  const amountInParsed = (() => {
    try {
      if (!tokenIn || !amountIn) return 0n;
      return parseUnits(amountIn, tokenIn.decimals);
    } catch { return 0n; }
  })();

  const { data: allowance } = useReadContract({
    address: actualTokenIn,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: userAddress ? [userAddress, routerAddress as `0x${string}`] : undefined,
    query: { enabled: !isNativeIn && !!userAddress && isBase },
    chainId,
  });

  const needsApproval =
    isBase && !isNativeIn && amountInParsed > 0n && ((allowance as bigint) ?? 0n) < amountInParsed;

  const approve = useCallback(async () => {
    if (!tokenIn || isNativeIn || !userAddress) return;
    setSwapState("approving");
    setErrorMessage("");
    try {
      const approveData = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: "approve",
        args: [routerAddress as `0x${string}`, amountInParsed],
      });
      const attributedApprove = withAttribution(approveData);
      recordCalldata({ kind: "approve", to: actualTokenIn, raw: approveData, attributed: attributedApprove, suffix: DATA_SUFFIX, timestamp: Date.now() });
      const hash = await sendTransactionAsync({
        to: actualTokenIn, data: attributedApprove, account: userAddress, chainId,
      } as any);
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash });
      setSwapState("idle");
    } catch (err) {
      setSwapState("error");
      setErrorMessage(getReadableSwapError(err));
    }
  }, [tokenIn, isNativeIn, userAddress, actualTokenIn, amountInParsed, sendTransactionAsync, publicClient, routerAddress, chainId, recordCalldata]);

  const swap = useCallback(async () => {
    if (!tokenIn || !tokenOut || !userAddress || amountInParsed <= 0n) return;
    setSwapState("swapping");
    setErrorMessage("");
    try {
      if (isArc) {
        const adapter = await createViemAdapterFromWallet(walletProvider);
        const result = await swapViaKit(adapter, chainId as PaymentChainId, tokenIn.symbol, tokenOut.symbol, amountIn);
        setTxHash(result.txHash as `0x${string}`);
        setSwapState("success");
      } else {
        if (!amountOutMin) return;
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800);
        const poolFee = getPoolFee(tokenIn.symbol, tokenOut.symbol);
        const actualOut = isNativeOut ? WETH_ADDRESS : (tokenOut.address as `0x${string}`);

        const swapCalldata = encodeFunctionData({
          abi: SWAP_ROUTER_ABI, functionName: "exactInputSingle",
          args: [{
            tokenIn: isNativeIn ? WETH_ADDRESS : (tokenIn.address as `0x${string}`),
            tokenOut: actualOut, fee: poolFee,
            recipient: isNativeOut ? (UNISWAP_V3_ROUTER as `0x${string}`) : userAddress,
            amountIn: amountInParsed, amountOutMinimum: amountOutMin, sqrtPriceLimitX96: 0n,
          }],
        });

        const calls: `0x${string}`[] = [swapCalldata];
        if (isNativeIn) calls.push(encodeFunctionData({ abi: SWAP_ROUTER_ABI, functionName: "refundETH", args: [] }));
        if (isNativeOut) calls.push(encodeFunctionData({ abi: SWAP_ROUTER_ABI, functionName: "unwrapWETH9", args: [amountOutMin, userAddress] }));

        const multicallData = encodeFunctionData({
          abi: SWAP_ROUTER_ABI, functionName: "multicall", args: [deadline, calls],
        });

        const attributedMulticall = withAttribution(multicallData);
        recordCalldata({ kind: "swap", to: UNISWAP_V3_ROUTER as `0x${string}`, raw: multicallData, attributed: attributedMulticall, suffix: DATA_SUFFIX, timestamp: Date.now() });

        const hash = await sendTransactionAsync({
          to: UNISWAP_V3_ROUTER as `0x${string}`,
          data: attributedMulticall,
          value: isNativeIn ? amountInParsed : 0n,
          account: userAddress, chainId: 8453,
        } as any);

        setTxHash(hash);
        if (publicClient) await publicClient.waitForTransactionReceipt({ hash });
        setSwapState("success");
      }
    } catch (err) {
      console.error("Swap error:", err);
      setSwapState("error");
      setErrorMessage(getReadableSwapError(err));
      throw err;
    }
  }, [tokenIn, tokenOut, userAddress, amountInParsed, amountOutMin, amountIn, isNativeIn, isNativeOut, isArc, chainId, sendTransactionAsync, publicClient, walletProvider, recordCalldata]);

  const reset = useCallback(() => {
    setSwapState("idle"); setTxHash(undefined); setErrorMessage("");
  }, []);

  return { swapState, txHash, errorMessage, needsApproval, approve, swap, reset, lastCalldata, calldataHistory };
}
