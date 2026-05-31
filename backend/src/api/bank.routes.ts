import { Router, type Request, type Response, type NextFunction } from "express";
import { TransferRequestSchema, TransferParamsSchema } from "../schemas/bank.schema.js";
import { processTransfer, getTransferStatus } from "../services/bank.service.js";
import { apiKeyAuth } from "./middleware.js";

const router: ReturnType<typeof Router> = Router();

/** POST /api/v1/transfer — Initiate IDR transfer (FR1) */
router.post("/transfer", apiKeyAuth, (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = TransferRequestSchema.parse(req.body);

    const txn = processTransfer({
      fromAccount: body.fromAccount,
      toAccount: body.toAccount,
      amount: body.amount,
      idempotencyKey: body.idempotencyKey,
    });

    res.status(202).json({
      data: {
        transactionId: txn.id,
        status: txn.status,
        createdAt: txn.createdAt,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/** GET /api/v1/transfer/:id — Query transaction status (FR2) */
router.get("/transfer/:id", apiKeyAuth, (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = TransferParamsSchema.parse(req.params);
    const txn = getTransferStatus(id);

    res.json({
      data: {
        transactionId: txn.id,
        status: txn.status,
        fromAccount: txn.fromAccount,
        toAccount: txn.toAccount,
        amount: txn.amount,
        currency: txn.currency,
        txHash: txn.txHash,
        failureReason: txn.failureReason,
        createdAt: txn.createdAt,
        updatedAt: txn.updatedAt,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
