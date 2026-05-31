/**
 * Transaction model — CRUD operations for SQLite
 * Type-safe queries with better-sqlite3
 */
import { randomUUID } from "crypto";
import { getDatabase } from "./database.js";
import type { Transaction, TransactionStatus } from "../types/bank.js";

/**
 * Create a new transaction
 */
export function createTransaction(params: {
  fromAccount: string;
  toAccount: string;
  amount: number;
  currency: "IDR";
  idempotencyKey: string;
  webhookUrl?: string;
}): Transaction {
  const db = getDatabase();
  const id = randomUUID();
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO transactions (id, from_account, to_account, amount, currency, status, idempotency_key, webhook_url, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    params.fromAccount,
    params.toAccount,
    params.amount,
    params.currency,
    params.idempotencyKey,
    params.webhookUrl ?? null,
    now,
    now
  );

  return getTransactionById(id)!;
}

/**
 * Get transaction by ID
 */
export function getTransactionById(id: string): Transaction | null {
  const db = getDatabase();
  const row = db.prepare("SELECT * FROM transactions WHERE id = ?").get(id) as Record<string, unknown> | undefined;

  if (!row) return null;
  return mapRowToTransaction(row);
}

/**
 * Get transaction by idempotency key
 */
export function getTransactionByIdempotencyKey(key: string): Transaction | null {
  const db = getDatabase();
  const row = db.prepare("SELECT * FROM transactions WHERE idempotency_key = ?").get(key) as Record<string, unknown> | undefined;

  if (!row) return null;
  return mapRowToTransaction(row);
}

/**
 * Update transaction status
 */
export function updateTransactionStatus(
  id: string,
  status: TransactionStatus,
  extras?: {
    txHash?: string;
    failureReason?: string;
    nonce?: number;
  }
): Transaction | null {
  const db = getDatabase();
  const now = new Date().toISOString();

  const sets: string[] = ["status = ?", "updated_at = ?"];
  const values: unknown[] = [status, now];

  if (extras?.txHash !== undefined) {
    sets.push("tx_hash = ?");
    values.push(extras.txHash);
  }
  if (extras?.failureReason !== undefined) {
    sets.push("failure_reason = ?");
    values.push(extras.failureReason);
  }
  if (extras?.nonce !== undefined) {
    sets.push("nonce = ?");
    values.push(extras.nonce);
  }

  values.push(id);

  db.prepare(`UPDATE transactions SET ${sets.join(", ")} WHERE id = ?`).run(...values);

  return getTransactionById(id);
}

/**
 * Get all transactions with optional status filter
 */
export function getTransactions(status?: TransactionStatus): Transaction[] {
  const db = getDatabase();

  const rows = status
    ? db.prepare("SELECT * FROM transactions WHERE status = ? ORDER BY created_at DESC").all(status)
    : db.prepare("SELECT * FROM transactions ORDER BY created_at DESC").all();

  return (rows as Record<string, unknown>[]).map(mapRowToTransaction);
}

/**
 * Get pending transactions that need processing
 */
export function getPendingTransactions(): Transaction[] {
  const db = getDatabase();
  const rows = db.prepare(
    "SELECT * FROM transactions WHERE status = 'pending' ORDER BY created_at ASC"
  ).all();

  return (rows as Record<string, unknown>[]).map(mapRowToTransaction);
}

/**
 * Get next nonce for on-chain transactions (atomic increment)
 */
export function getNextNonce(): number {
  const db = getDatabase();
  const row = db.prepare("SELECT MAX(nonce) as max_nonce FROM transactions WHERE nonce IS NOT NULL").get() as { max_nonce: number | null } | undefined;

  const currentMax = row?.max_nonce ?? -1;
  return currentMax + 1;
}

function mapRowToTransaction(row: Record<string, unknown>): Transaction {
  return {
    id: row.id as string,
    fromAccount: row.from_account as string,
    toAccount: row.to_account as string,
    amount: row.amount as number,
    currency: row.currency as "IDR",
    status: row.status as TransactionStatus,
    idempotencyKey: row.idempotency_key as string,
    nonce: row.nonce as number | null,
    txHash: row.tx_hash as string | null,
    failureReason: row.failure_reason as string | null,
    webhookUrl: row.webhook_url as string | null,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}
