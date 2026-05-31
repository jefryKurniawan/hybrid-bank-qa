import { randomUUID } from "crypto";
import { CexError } from "../utils/errors.js";
import type { RateQuote, SwapResult, WalletBalance } from "../types/cex.js";

const SPREAD_THRESHOLD = 0.02;
const LIQUIDITY_POOL_USDC = 100_000;

const walletBalances = new Map<string, string>();

/** Get current IDR/USDC rate quote */
export function getRates(): RateQuote {
  return {
    bid: 14800,
    ask: 15000,
    spread: (15000 - 14800) / 14800,
    timestamp: new Date(),
  };
}

/** Execute a swap from IDR to USDC */
export function executeSwap(params: {
  direction: "IDR_to_USDC" | "USDC_to_IDR";
  amount: number;
}): SwapResult {
  const rate = getRates();

  if (rate.spread > SPREAD_THRESHOLD) {
    throw new CexError("Spread exceeds threshold", "SWAP_SPREAD_EXCEEDED", 500);
  }

  let outputAmount: number;
  let walletAddress: string;

  if (params.direction === "IDR_to_USDC") {
    outputAmount = params.amount / rate.ask;
    walletAddress = "0x" + randomUUID().replace(/-/g, "").slice(0, 40);
  } else {
    outputAmount = params.amount * rate.bid;
    walletAddress = "bank_reserve";
  }

  if (outputAmount > LIQUIDITY_POOL_USDC) {
    throw new CexError("Insufficient liquidity", "INSUFFICIENT_LIQUIDITY", 500);
  }

  // Update mock wallet balance
  const currentBalance = parseFloat(walletBalances.get(walletAddress) ?? "0");
  walletBalances.set(
    walletAddress,
    (currentBalance + (params.direction === "IDR_to_USDC" ? outputAmount : 0)).toFixed(6)
  );

  return {
    swapId: randomUUID(),
    direction: params.direction,
    inputAmount: params.amount,
    outputAmount: Math.round(outputAmount * 100) / 100,
    rate: params.direction === "IDR_to_USDC" ? rate.ask : rate.bid,
    walletAddress,
    status: "completed",
    createdAt: new Date(),
  };
}

/** Get wallet USDC balance */
export function getWalletBalance(address: string): WalletBalance {
  const balance = walletBalances.get(address) ?? "0";
  return {
    address,
    balance,
    chain: "ethereum",
  };
}

/** Set wallet balance (for testing) */
export function setWalletBalance(address: string, balance: string): void {
  walletBalances.set(address, balance);
}
