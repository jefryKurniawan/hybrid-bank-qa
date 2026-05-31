/**
 * Zod schemas for CEX API endpoints
 * Pattern: Schema → Type inference → Runtime validation
 */
import { z } from "zod";

/** POST /api/v1/swap request schema (FR12) */
export const SwapRequestSchema = z.object({
  direction: z.enum(["IDR_to_USDC", "USDC_to_IDR"]),
  amount: z.number().positive("Amount must be positive"),
});

export type SwapRequestInput = z.infer<typeof SwapRequestSchema>;

/** GET /api/v1/wallet/:address/balance params */
export const WalletParamsSchema = z.object({
  address: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address"),
});

export type WalletParams = z.infer<typeof WalletParamsSchema>;

/** GET /api/v1/rates query params (optional filters) */
export const RatesQuerySchema = z.object({
  pair: z.literal("IDR/USDC").optional(),
});

export type RatesQuery = z.infer<typeof RatesQuerySchema>;
