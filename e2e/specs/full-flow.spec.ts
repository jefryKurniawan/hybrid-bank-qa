/**
 * E2E Test — Full hybrid banking flow
 * Simulates: Customer → Bank API → CEX Swap → On-chain → Verify Balance
 *
 * Uses mock wallet (ethers.Wallet) for programmatic signing
 * No MetaMask extension needed
 */
import request from "supertest";
import { ethers } from "ethers";
import { createApp } from "../../backend/src/index.js";
import { closeDatabase, resetDatabase } from "../../backend/src/models/database.js";
import { clearWalletBalances, setWalletBalance } from "../../backend/src/services/cex.service.js";
import { createMockWallet, type MockWallet } from "../helpers/mock-wallet.js";
import type { Application } from "express";

describe("E2E: Full Hybrid Banking Flow", () => {
  let app: Application;
  let bankWallet: MockWallet;
  let customerWallet: MockWallet;
  let recipientWallet: MockWallet;

  beforeAll(() => {
    app = createApp(true);
    bankWallet = createMockWallet(0);
    customerWallet = createMockWallet(1);
    recipientWallet = createMockWallet(2);
  });

  afterAll(() => {
    closeDatabase();
  });

  beforeEach(() => {
    resetDatabase();
    clearWalletBalances();
  });

  describe("End-to-end settlement flow", () => {
    it("should complete transfer → swap → on-chain settlement", async () => {
      // Step 1: Customer initiates IDR transfer
      const transferRes = await request(app)
        .post("/api/v1/transfer")
        .send({
          fromAccount: customerWallet.address,
          toAccount: recipientWallet.address,
          amount: 15000000, // 15M IDR
          currency: "IDR",
          idempotencyKey: ethers.id("unique-tx-1").slice(0, 36),
          webhookUrl: "http://localhost:3000/webhook",
        })
        .expect(201);

      const txId = transferRes.body.data.id;
      expect(txId).toBeDefined();

      // Step 2: Check transfer status
      const statusRes = await request(app)
        .get(`/api/v1/transfer/${txId}`)
        .expect(200);

      expect(statusRes.body.data.status).toBeDefined();
      expect(statusRes.body.data.amount).toBe(15000000);

      // Step 3: Execute CEX swap (IDR → USDC)
      const swapRes = await request(app)
        .post("/api/v1/swap")
        .send({
          direction: "IDR_to_USDC",
          amount: 15000000,
        })
        .expect(201);

      const usdcAmount = swapRes.body.data.outputAmount;
      const walletAddr = swapRes.body.data.walletAddress;

      expect(usdcAmount).toBeGreaterThan(0);
      expect(walletAddr).toMatch(/^0x[a-fA-F0-9]{40}$/);

      // Step 4: Verify wallet received USDC
      const balanceRes = await request(app)
        .get(`/api/v1/wallet/${walletAddr}/balance`)
        .expect(200);

      expect(parseFloat(balanceRes.body.data.balance)).toBe(usdcAmount);

      // Step 5: Verify rates are reasonable
      const ratesRes = await request(app)
        .get("/api/v1/rates")
        .expect(200);

      expect(ratesRes.body.data.bid).toBeLessThan(ratesRes.body.data.ask);
      expect(ratesRes.body.data.spread).toBeLessThan(0.05); // <5% spread
    });

    it("should handle wallet address verification", async () => {
      // Verify mock wallet has valid Ethereum address
      expect(customerWallet.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(recipientWallet.address).toMatch(/^0x[a-fA-F0-9]{40}$/);

      // Verify wallets can sign messages
      const message = "Verify ownership of wallet";
      const signature = await customerWallet.signMessage(message);
      expect(signature).toBeDefined();

      // Recover address from signature
      const recovered = ethers.verifyMessage(message, signature);
      expect(recovered).toBe(customerWallet.address);
    });
  });

  describe("Error scenarios", () => {
    it("should reject invalid transfer requests", async () => {
      const res = await request(app)
        .post("/api/v1/transfer")
        .send({
          fromAccount: customerWallet.address,
          toAccount: recipientWallet.address,
          amount: -100, // Invalid negative amount
          currency: "IDR",
          idempotencyKey: ethers.id("invalid-tx").slice(0, 36),
        })
        .expect(422);

      expect(res.body.error).toBe("Validation failed");
    });

    it("should reject invalid wallet address in balance query", async () => {
      await request(app)
        .get("/api/v1/wallet/not-an-address/balance")
        .expect(422);
    });
  });
});
