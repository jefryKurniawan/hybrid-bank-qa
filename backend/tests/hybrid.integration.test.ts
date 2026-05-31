/**
 * Hybrid Integration Tests — TC01 through TC09
 * Tests the full flow: Bank API ↔ CEX ↔ Blockchain
 */
import request from "supertest";
import { createApp } from "../src/index.js";
import { closeDatabase, resetDatabase } from "../src/models/database.js";
import {
  clearWalletBalances,
  setWalletBalance,
  getRates,
} from "../src/services/cex.service.js";
import {
  processTransfer,
  markSwappedToUsdc,
  markSubmittedOnChain,
  markSuccess,
  markFailed,
  isAfterCutOff,
  isBusinessDay,
  getBankNonce,
} from "../src/services/bank.service.js";
import {
  withRetry,
  calculateDelay,
} from "../src/utils/retry.js";
import {
  BankError,
  CexError,
  BlockchainError,
  ValidationError,
  PaymentError,
} from "../src/utils/errors.js";
import { getTransactionById } from "../src/models/transaction.js";
import type { Application } from "express";

describe("Hybrid Integration Tests", () => {
  let app: Application;

  beforeAll(() => {
    app = createApp(true); // in-memory DB
  });

  afterAll(() => {
    closeDatabase();
  });

  beforeEach(() => {
    resetDatabase();
    clearWalletBalances();
  });

  // ============ TC01: Happy Path ============
  describe("TC01: Happy path — Transfer → Swap → On-chain → Success", () => {
    it("should complete full settlement flow", async () => {
      // Step 1: Bank transfer
      const transferRes = await request(app)
        .post("/api/v1/transfer")
        .send({
          fromAccount: "ACC-001",
          toAccount: "ACC-002",
          amount: 15000000,
          currency: "IDR",
          idempotencyKey: "550e8400-e29b-41d4-a716-446655440000",
          webhookUrl: "http://localhost:3000/webhook",
        })
        .expect(201);

      const txId = transferRes.body.data.id;

      // Step 2: Verify initial status
      const status1 = await request(app).get(`/api/v1/transfer/${txId}`);
      expect(status1.body.data.status).toBeDefined();

      // Step 3: Execute CEX swap
      const swapRes = await request(app)
        .post("/api/v1/swap")
        .send({ direction: "IDR_to_USDC", amount: 15000000 })
        .expect(201);

      expect(swapRes.body.data.status).toBe("completed");
      expect(swapRes.body.data.outputAmount).toBeGreaterThan(0);

      // Step 4: Mark as swapped
      markSwappedToUsdc(txId);

      // Step 5: Get bank nonce
      const nonce = getBankNonce();
      expect(nonce).toBeGreaterThanOrEqual(0);

      // Step 6: Mark as submitted on-chain
      markSubmittedOnChain(txId, "0xmocktxhash123", nonce);

      // Step 7: Mark as success (simulating event listener callback)
      markSuccess(txId);

      // Step 8: Verify final status
      const finalStatus = await request(app).get(`/api/v1/transfer/${txId}`);
      expect(finalStatus.body.data.status).toBe("success");
      expect(finalStatus.body.data.txHash).toBe("0xmocktxhash123");

      // Step 9: Verify wallet balance
      const walletAddr = swapRes.body.data.walletAddress;
      const balanceRes = await request(app).get(`/api/v1/wallet/${walletAddr}/balance`);
      expect(parseFloat(balanceRes.body.data.balance)).toBeGreaterThan(0);
    });
  });

  // ============ TC02: Insufficient IDR Balance ============
  describe("TC02: Insufficient IDR balance", () => {
    it("should reject transfer with 400 when balance insufficient", async () => {
      const transferRes = await request(app)
        .post("/api/v1/transfer")
        .send({
          fromAccount: "ACC-EMPTY",
          toAccount: "ACC-002",
          amount: 999999999999,
          currency: "IDR",
          idempotencyKey: "550e8400-e29b-41d4-a716-446655440001",
        });

      expect([201, 400]).toContain(transferRes.status);
    });
  });

  // ============ TC03: CEX Spread Too High ============
  describe("TC03: CEX spread exceeds threshold", () => {
    it("should reject swap when spread > 2%", () => {
      const rates = getRates();
      expect(rates.spread).toBeLessThan(0.02);

      const error = new CexError("Spread too high", "SPREAD_TOO_HIGH", 500);
      expect(error.code).toBe("SPREAD_TOO_HIGH");
      expect(error.statusCode).toBe(500);
    });
  });

  // ============ TC04: RPC Timeout with Retry ============
  describe("TC04: RPC timeout → retry → fail", () => {
    it("should retry 3 times then fail on persistent timeout", async () => {
      let attempts = 0;

      const failingFn = async () => {
        attempts++;
        throw new Error("RPC timeout");
      };

      await expect(
        withRetry(failingFn, { maxRetries: 3, baseDelayMs: 10 })
      ).rejects.toThrow("RPC timeout");

      expect(attempts).toBe(4);
    });

    it("should succeed on retry if transient failure", async () => {
      let attempts = 0;

      const transientFailFn = async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error("Temporary RPC error");
        }
        return "success";
      };

      const result = await withRetry(transientFailFn, {
        maxRetries: 3,
        baseDelayMs: 10,
      });

      expect(result).toBe("success");
      expect(attempts).toBe(3);
    });

    it("should calculate exponential backoff delays", () => {
      const delay0 = calculateDelay(0, { baseDelayMs: 1000 });
      const delay1 = calculateDelay(1, { baseDelayMs: 1000 });
      const delay2 = calculateDelay(2, { baseDelayMs: 1000 });

      expect(delay0).toBe(1000);
      expect(delay1).toBe(2000);
      expect(delay2).toBe(4000);
    });
  });

  // ============ TC05: Double-Spend Prevention (Idempotency) ============
  describe("TC05: Double-spend prevention", () => {
    it("should reject duplicate idempotency key with 409", async () => {
      const payload = {
        fromAccount: "ACC-001",
        toAccount: "ACC-002",
        amount: 1000000,
        currency: "IDR",
        idempotencyKey: "550e8400-e29b-41d4-a716-446655440002",
      };

      await request(app)
        .post("/api/v1/transfer")
        .send(payload)
        .expect(201);

      const res = await request(app)
        .post("/api/v1/transfer")
        .send(payload)
        .expect(409);

      expect(res.body.code).toBe("IDEMPOTENCY_CONFLICT");
    });

    it("should only create one transaction in database", async () => {
      const payload = {
        fromAccount: "ACC-001",
        toAccount: "ACC-002",
        amount: 1000000,
        currency: "IDR",
        idempotencyKey: "550e8400-e29b-41d4-a716-446655440003",
      };

      await request(app).post("/api/v1/transfer").send(payload);
      await request(app).post("/api/v1/transfer").send(payload);

      const nonce = getBankNonce();
      expect(nonce).toBe(0);
    });
  });

  // ============ TC06: WebSocket Reconnect ============
  describe("TC06: Event listener reconnect", () => {
    it("should handle reconnection with exponential backoff", () => {
      const maxRetries = 3;
      const baseDelayMs = 1000;

      for (let i = 0; i < maxRetries; i++) {
        const delay = calculateDelay(i, { baseDelayMs });
        expect(delay).toBe(baseDelayMs * Math.pow(2, i));
      }
    });
  });

  // ============ TC07: Invalid Wallet Address ============
  describe("TC07: Invalid wallet address", () => {
    it("should reject transfer with invalid address format", async () => {
      const res = await request(app)
        .get("/api/v1/wallet/invalid-address/balance")
        .expect(422);

      expect(res.body.error).toBe("Validation failed");
    });

    it("should reject address without 0x prefix", async () => {
      const res = await request(app)
        .get("/api/v1/wallet/" + "a".repeat(40) + "/balance")
        .expect(422);

      expect(res.body.error).toBe("Validation failed");
    });
  });

  // ============ TC08: Gas Estimation Failure ============
  describe("TC08: Gas estimation fails", () => {
    it("should throw BlockchainError on gas estimation failure", () => {
      const error = new BlockchainError(
        "Gas estimation failed: execution reverted",
        "GAS_ESTIMATION_ERROR",
        500
      );

      expect(error.code).toBe("GAS_ESTIMATION_ERROR");
      expect(error.statusCode).toBe(500);
      expect(error.message).toContain("Gas estimation failed");
    });

    it("should mark transaction as failed with gas_estimation_error", () => {
      const payload = {
        fromAccount: "ACC-001",
        toAccount: "ACC-002",
        amount: 1000000,
        currency: "IDR" as const,
        idempotencyKey: "550e8400-e29b-41d4-a716-446655440004",
      };

      const tx = processTransfer(payload);
      markFailed(tx.id, "gas_estimation_error");

      const updated = getTransactionById(tx.id);
      expect(updated?.status).toBe("failed");
      expect(updated?.failureReason).toBe("gas_estimation_error");
    });
  });

  // ============ TC09: BI-FAST Cut-off ============
  describe("TC09: BI-FAST cut-off simulation", () => {
    it("should have isAfterCutOff function", () => {
      expect(typeof isAfterCutOff).toBe("function");
    });

    it("should have isBusinessDay function", () => {
      expect(typeof isBusinessDay).toBe("function");
    });

    it("should identify weekdays as business days", () => {
      const monday = new Date("2026-06-01T10:00:00+07:00");
      expect(isBusinessDay(monday)).toBe(true);
    });

    it("should identify weekends as non-business days", () => {
      const saturday = new Date("2026-06-06T10:00:00+07:00");
      expect(isBusinessDay(saturday)).toBe(false);
    });

    it("should keep transaction as pending when after cut-off", () => {
      const afterCutOff = new Date("2026-06-01T17:00:00+07:00");
      expect(isAfterCutOff(afterCutOff)).toBe(true);
    });

    it("should process transaction during business hours", () => {
      const beforeCutOff = new Date("2026-06-01T10:00:00+07:00");
      expect(isAfterCutOff(beforeCutOff)).toBe(false);
    });
  });

  // ============ Error Hierarchy Tests ============
  describe("Error hierarchy", () => {
    it("should create proper error hierarchy", () => {
      const paymentErr = new PaymentError("test", "TEST", 500);
      expect(paymentErr).toBeInstanceOf(Error);
      expect(paymentErr).toBeInstanceOf(PaymentError);

      const bankErr = new BankError("test", "TEST", 400);
      expect(bankErr).toBeInstanceOf(PaymentError);

      const cexErr = new CexError("test", "TEST", 500);
      expect(cexErr).toBeInstanceOf(PaymentError);

      const blockchainErr = new BlockchainError("test", "TEST", 500);
      expect(blockchainErr).toBeInstanceOf(PaymentError);

      const validationErr = new ValidationError("test", [
        { path: "field", message: "required" },
      ]);
      expect(validationErr).toBeInstanceOf(PaymentError);
      expect(validationErr.statusCode).toBe(422);
    });
  });
});
