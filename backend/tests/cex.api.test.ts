/**
 * CEX API tests using Supertest
 * Tests: GET /rates, POST /swap, GET /wallet/:address/balance
 */
import request from "supertest";
import { createApp } from "../src/index.js";
import { closeDatabase, resetDatabase } from "../src/models/database.js";
import { clearWalletBalances, setWalletBalance } from "../src/services/cex.service.js";
import type { Application } from "express";

describe("CEX API", () => {
  let app: Application;

  beforeAll(() => {
    app = createApp(true);
  });

  afterAll(() => {
    closeDatabase();
  });

  beforeEach(() => {
    resetDatabase();
    clearWalletBalances();
  });

  describe("GET /api/v1/rates", () => {
    it("should return IDR/USDC rates (FR11)", async () => {
      const res = await request(app)
        .get("/api/v1/rates")
        .expect(200);

      expect(res.body.data).toHaveProperty("bid");
      expect(res.body.data).toHaveProperty("ask");
      expect(res.body.data).toHaveProperty("spread");
      expect(res.body.data).toHaveProperty("timestamp");
      expect(res.body.data.bid).toBeLessThan(res.body.data.ask);
    });
  });

  describe("POST /api/v1/swap", () => {
    it("should execute IDR_to_USDC swap (FR12)", async () => {
      const res = await request(app)
        .post("/api/v1/swap")
        .send({ direction: "IDR_to_USDC", amount: 15000000 })
        .expect(201);

      expect(res.body.data).toHaveProperty("swapId");
      expect(res.body.data.direction).toBe("IDR_to_USDC");
      expect(res.body.data.inputAmount).toBe(15000000);
      expect(res.body.data.outputAmount).toBeGreaterThan(0);
      expect(res.body.data.status).toBe("completed");
    });

    it("should execute USDC_to_IDR swap", async () => {
      const res = await request(app)
        .post("/api/v1/swap")
        .send({ direction: "USDC_to_IDR", amount: 100 })
        .expect(201);

      expect(res.body.data.direction).toBe("USDC_to_IDR");
      expect(res.body.data.outputAmount).toBeGreaterThan(0);
    });

    it("should reject invalid direction", async () => {
      await request(app)
        .post("/api/v1/swap")
        .send({ direction: "INVALID", amount: 100 })
        .expect(422);
    });

    it("should reject zero amount", async () => {
      await request(app)
        .post("/api/v1/swap")
        .send({ direction: "IDR_to_USDC", amount: 0 })
        .expect(422);
    });
  });

  describe("GET /api/v1/wallet/:address/balance", () => {
    it("should return wallet balance (FR13)", async () => {
      const address = "0x" + "a".repeat(40);
      setWalletBalance(address, "1000.50");

      const res = await request(app)
        .get(`/api/v1/wallet/${address}/balance`)
        .expect(200);

      expect(res.body.data.address).toBe(address);
      expect(res.body.data.balance).toBe("1000.50");
      expect(res.body.data.chain).toBe("ethereum");
    });

    it("should return zero for unknown wallet", async () => {
      const address = "0x" + "b".repeat(40);

      const res = await request(app)
        .get(`/api/v1/wallet/${address}/balance`)
        .expect(200);

      expect(res.body.data.balance).toBe("0");
    });

    it("should reject invalid Ethereum address", async () => {
      await request(app)
        .get("/api/v1/wallet/invalid-address/balance")
        .expect(422);
    });
  });
});
