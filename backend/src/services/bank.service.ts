import {
  createTransaction,
  getTransactionById,
  getTransactionByIdempotencyKey,
  updateTransactionStatus,
  getNextNonce,
} from "../models/transaction.js";
import { BankError } from "../utils/errors.js";
import type { Transaction, WebhookPayload } from "../types/bank.js";

/** Process a bank transfer request with idempotency check */
export function processTransfer(params: {
  fromAccount: string;
  toAccount: string;
  amount: number;
  idempotencyKey: string;
  webhookUrl?: string;
}): Transaction {
  // Check idempotency
  const existing = getTransactionByIdempotencyKey(params.idempotencyKey);
  if (existing) {
    throw new BankError("Idempotency key already used", "IDEMPOTENCY_KEY_USED", 409);
  }

  // Create new transaction
  const txn = createTransaction({
    fromAccount: params.fromAccount,
    toAccount: params.toAccount,
    amount: params.amount,
    currency: "IDR",
    idempotencyKey: params.idempotencyKey,
    ...(params.webhookUrl !== undefined && { webhookUrl: params.webhookUrl }),
  });

  // Check BI-FAST cut-off
  if (isAfterCutOff()) {
    return txn; // stays pending
  }

  // Mark as processed by bank
  return updateTransactionStatus(txn.id, "processed_by_bank")!;
}

/** Get transaction by ID */
export function getTransferStatus(id: string): Transaction {
  const txn = getTransactionById(id);
  if (!txn) {
    throw new BankError("Transaction not found", "TRANSACTION_NOT_FOUND", 404);
  }
  return txn;
}

/** Advance transaction to swapped_to_usdc status */
export function markSwappedToUsdc(id: string): Transaction | null {
  return updateTransactionStatus(id, "swapped_to_usdc");
}

/** Advance transaction to submitted_onchain status */
export function markSubmittedOnchain(id: string, txHash: string): Transaction | null {
  return updateTransactionStatus(id, "submitted_onchain", { txHash });
}

/** Mark transaction as successful */
export function markSuccess(id: string, txHash: string): Transaction | null {
  const txn = updateTransactionStatus(id, "success", { txHash });
  if (txn) sendWebhook(txn);
  return txn;
}

/** Mark transaction as failed */
export function markFailed(id: string, reason: string): Transaction | null {
  const txn = updateTransactionStatus(id, "failed", { failureReason: reason });
  if (txn) sendWebhook(txn);
  return txn;
}

/** Get next bank nonce for on-chain submission */
export function getBankNonce(): number {
  return getNextNonce();
}

/** Check if current time is after BI-FAST cut-off (16:00 WIB) */
export function isAfterCutOff(): boolean {
  const now = new Date();
  const wibHour = (now.getUTCHours() + 7) % 24;
  const wibDay = now.getUTCDay();

  if (wibDay === 0 || wibDay === 6) return true;
  if (wibHour >= 16) return true;

  return false;
}

/** Send webhook notification */
async function sendWebhook(txn: Transaction): Promise<void> {
  if (!txn.webhookUrl) return;

  const payload: WebhookPayload = {
    transactionId: txn.id,
    status: txn.status === "success" ? "success" : "failed",
    txHash: txn.txHash,
    failureReason: txn.failureReason,
    timestamp: new Date(),
  };

  try {
    await fetch(txn.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    console.error(`Webhook failed for transaction ${txn.id}`);
  }
}
