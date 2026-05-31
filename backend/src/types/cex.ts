/**
 * CEX/Wallet domain types for Hybrid Banking QA
 */

/** IDR/USDC rate quote */
export interface RateQuote {
  bid: number;
  ask: number;
  spread: number;
  timestamp: Date;
}

/** Swap direction */
export type SwapDirection = "IDR_to_USDC" | "USDC_to_IDR";

/** Swap request payload */
export interface SwapRequest {
  direction: SwapDirection;
  amount: number;
}

/** Swap result */
export interface SwapResult {
  swapId: string;
  direction: SwapDirection;
  inputAmount: number;
  outputAmount: number;
  rate: number;
  walletAddress: string;
  status: "pending" | "completed" | "failed";
  createdAt: Date;
}

/** Wallet balance query result */
export interface WalletBalance {
  address: string;
  balance: string; // USDC has 6 decimals, use string for precision
  chain: string;
}
