/**
 * Zod schemas for Bank API endpoints
 * Pattern: Schema → Type inference → Runtime validation
 */
import { z } from "zod";

/** POST /api/v1/transfer request schema (FR1) */
export const TransferRequestSchema = z.object({
  fromAccount: z.string().min(1, "fromAccount is required"),
  toAccount: z.string().min(1, "toAccount is required"),
  amount: z.number().positive("Amount must be positive"),
  currency: z.literal("IDR"),
  idempotencyKey: z.string().uuid("idempotencyKey must be a valid UUID"),
});

export type TransferRequestInput = z.infer<typeof TransferRequestSchema>;

/** GET /api/v1/transfer/:id params */
export const TransferParamsSchema = z.object({
  id: z.string().uuid("Transaction ID must be a valid UUID"),
});

export type TransferParams = z.infer<typeof TransferParamsSchema>;

/** Webhook registration schema */
export const WebhookConfigSchema = z.object({
  url: z.string().url("Webhook URL must be valid"),
  events: z.array(z.enum(["success", "failed"])),
});

export type WebhookConfig = z.infer<typeof WebhookConfigSchema>;
