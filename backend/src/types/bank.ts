/**
 * Bank domain types for Hybrid Banking QA
 */

/** Transaction status lifecycle — discriminated union pattern */
export type TransactionStatus =
  | "pending"
  | "processed_by_bank"
  | "swapped_to_usdc"
  | "submitted_onchain"
  | "success"
  | "failed";

/** Bank transfer request payload */
export interface BankTransferRequest {
  fromAccount: string;
  toAccount: string;
  amount: number;
  currency: "IDR";
  idempotencyKey: string;
}

/** Transaction record stored in database */
export interface Transaction {
  id: string;
  fromAccount: string;
  toAccount: string;
  amount: number;
  currency: "IDR";
  status: TransactionStatus;
  idempotencyKey: string;
  nonce: number | null;
  txHash: string | null;
  failureReason: string | null;
  webhookUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** API response wrapper — generic pattern */
export interface ApiResponse<T> {
  data: T;
  status: number;
  timestamp: Date;
}

/** Webhook payload sent on transaction finality */
export interface WebhookPayload {
  transactionId: string;
  status: "success" | "failed";
  txHash: string | null;
  failureReason: string | null;
  timestamp: Date;
}
