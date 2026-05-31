/** On-chain transfer result */
export interface OnChainTransferResult {
  txHash: string;
  from: string;
  to: string;
  amount: bigint;
  blockNumber: number;
  nonce: number;
}

/** Gas estimation result */
export interface GasEstimate {
  gasLimit: bigint;
  gasPrice: bigint;
  estimatedCost: bigint;
}

/** Settlement result — discriminated union for type-safe error handling */
export type SettlementResult<T> =
  | { success: true; data: T; txHash: string }
  | { success: false; error: string; code: string };

/** Blockchain listener event */
export interface TransferEvent {
  from: string;
  to: string;
  amount: bigint;
  txHash: string;
  blockNumber: number;
}

/** Retry configuration */
export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  timeoutMs: number;
}
