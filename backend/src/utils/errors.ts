/**
 * Custom error hierarchy for Hybrid Banking QA
 * Pattern: Base PaymentError → domain-specific errors
 */

/** Base error for all payment-related errors */
export class PaymentError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(message: string, code: string, statusCode: number = 500) {
    super(message);
    this.name = "PaymentError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

/** Bank-specific errors (insufficient balance, idempotency conflict) */
export class BankError extends PaymentError {
  constructor(message: string, code: string, statusCode: number = 400) {
    super(message, code, statusCode);
    this.name = "BankError";
  }
}

/** CEX-specific errors (spread too high, insufficient liquidity) */
export class CexError extends PaymentError {
  constructor(message: string, code: string, statusCode: number = 500) {
    super(message, code, statusCode);
    this.name = "CexError";
  }
}

/** Blockchain-specific errors (RPC failure, gas estimation, nonce) */
export class BlockchainError extends PaymentError {
  constructor(message: string, code: string, statusCode: number = 500) {
    super(message, code, statusCode);
    this.name = "BlockchainError";
  }
}

/** Settlement errors (cross-system failure) */
export class SettlementError extends PaymentError {
  constructor(message: string, code: string, statusCode: number = 500) {
    super(message, code, statusCode);
    this.name = "SettlementError";
  }
}

/** Validation error (Zod schema failure) */
export class ValidationError extends PaymentError {
  public readonly issues: Array<{ path: string; message: string }>;

  constructor(
    message: string,
    issues: Array<{ path: string; message: string }>
  ) {
    super(message, "VALIDATION_ERROR", 422);
    this.name = "ValidationError";
    this.issues = issues;
  }
}

/** Pre-defined error factories for common scenarios */
export const Errors = {
  insufficientBalance: (available: number, requested: number) =>
    new BankError("Insufficient balance", "INSUFFICIENT_BALANCE", 400),

  idempotencyKeyUsed: (key: string) =>
    new BankError("Idempotency key already used", "IDEMPOTENCY_KEY_USED", 409),

  invalidAddress: (address: string) =>
    new BankError("Invalid address checksum", "INVALID_ADDRESS_CHECKSUM", 422),

  invalidCurrency: (currency: string) =>
    new BankError("Only IDR currency is supported", "INVALID_CURRENCY", 400),

  amountTooSmall: (amount: number, minimum: number) =>
    new BankError("Amount below minimum", "AMOUNT_TOO_SMALL", 400),

  swapSpreadExceeded: (spread: number, threshold: number) =>
    new CexError("Spread exceeds threshold", "SWAP_SPREAD_EXCEEDED", 500),

  insufficientLiquidity: (available: number, requested: number) =>
    new CexError("Insufficient liquidity", "INSUFFICIENT_LIQUIDITY", 500),

  rpcTimeout: (attempt: number, maxRetries: number) =>
    new BlockchainError("RPC request timed out", "RPC_TIMEOUT", 500),

  gasEstimationFailed: (reason: string) =>
    new BlockchainError("Gas estimation failed", "GAS_ESTIMATION_ERROR", 500),

  transactionNotFound: (id: string) =>
    new BankError("Transaction not found", "TRANSACTION_NOT_FOUND", 404),
};
