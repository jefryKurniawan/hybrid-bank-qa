/**
 * Bank API tests using Supertest
 * Tests: POST /transfer, GET /transfer/:id
 */
import request from "supertest";
import { createApp } from "../src/index.js";
import { closeDatabase, resetDatabase } from "../src/models/database.js";
import type { Application } from "express";

describe("Bank API", () => {
  let app: Application;

  beforeAll(() => {
    app = createApp(true); // in-memory DB
  });

  afterAll(() => {
    closeDatabase();
  });

  beforeEach(() => {
    resetDatabase();
  });

  describe("POST /api/v1/transfer", () => {
    const validTransfer = {
      fromAccount: "ACC-001",
      toAccount: "ACC-002",
      amount: 15000000,
      currency: "IDR",
      idempotencyKey: "550e8400-e29b-41d4-a716-446655440000",
    };

    it("should create a transfer successfully", async () => {
      const res = await request(app)
        .post("/api/v1/transfer")
        .send(validTransfer)
        .expect(201);

      expect(res.body.data).toHaveProperty("id");
      expect(res.body.data.fromAccount).toBe("ACC-001");
      expect(res.body.data.toAccount).toBe("ACC-002");
      expect(res.body.data.amount).toBe(15000000);
      expect(res.body.data.currency).toBe("IDR");
    });

    it("should reject duplicate idempotency key (TC05)", async () => {
      await request(app)
        .post("/api/v1/transfer")
        .send(validTransfer)
        .expect(201);

      const res = await request(app)
        .post("/api/v1/transfer")
        .send(validTransfer)
        .expect(409);

      expect(res.body.code).toBe("IDEMPOTENCY_CONFLICT");
    });

    it("should reject non-IDR currency", async () => {
      const res = await request(app)
        .post("/api/v1/transfer")
        .send({ ...validTransfer, currency: "USD" })
        .expect(422);

      expect(res.body.error).toBe("Validation failed");
    });

    it("should reject negative amount", async () => {
      const res = await request(app)
        .post("/api/v1/transfer")
        .send({ ...validTransfer, amount: -100 })
        .expect(422);

      expect(res.body.error).toBe("Validation failed");
    });

    it("should reject invalid idempotency key format", async () => {
      const res = await request(app)
        .post("/api/v1/transfer")
        .send({ ...validTransfer, idempotencyKey: "not-a-uuid" })
        .expect(422);

      expect(res.body.error).toBe("Validation failed");
    });

    it("should reject missing required fields", async () => {
      const res = await request(app)
        .post("/api/v1/transfer")
        .send({ fromAccount: "ACC-001" })
        .expect(422);

      expect(res.body.error).toBe("Validation failed");
    });
  });

  describe("GET /api/v1/transfer/:id", () => {
    it("should return transaction status", async () => {
      const createRes = await request(app)
        .post("/api/v1/transfer")
        .send({
          fromAccount: "ACC-001",
          toAccount: "ACC-002",
          amount: 1000000,
          currency: "IDR",
          idempotencyKey: "550e8400-e29b-41d4-a716-446655440000",
        });

      const txId = createRes.body.data.id;

      const res = await request(app)
        .get(`/api/v1/transfer/${txId}`)
        .expect(200);

      expect(res.body.data.id).toBe(txId);
      expect(res.body.data).toHaveProperty("status");
      expect(res.body.data).toHaveProperty("createdAt");
    });

    it("should return 404 for non-existent transaction", async () => {
      const res = await request(app)
        .get("/api/v1/transfer/550e8400-e29b-41d4-a716-446655440000")
        .expect(404);

      expect(res.body.code).toBe("NOT_FOUND");
    });

    it("should return 422 for invalid UUID", async () => {
      await request(app)
        .get("/api/v1/transfer/not-a-uuid")
        .expect(422);
    });
  });
});
