import { Router, type Request, type Response, type NextFunction } from "express";
import { SwapRequestSchema, WalletParamsSchema } from "../schemas/cex.schema.js";
import { getRates, executeSwap, getWalletBalance } from "../services/cex.service.js";
import { apiKeyAuth } from "./middleware.js";

const router: ReturnType<typeof Router> = Router();

/** GET /api/v1/rates — Get current IDR/USDC rates */
router.get("/rates", apiKeyAuth, (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rates = getRates();
    res.json({
      data: rates,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/** POST /api/v1/swap — Execute IDR ↔ USDC swap */
router.post("/swap", apiKeyAuth, (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = SwapRequestSchema.parse(req.body);
    const result = executeSwap(body);

    res.json({
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/** GET /api/v1/wallet/:address/balance — Query wallet USDC balance */
router.get("/wallet/:address/balance", apiKeyAuth, (req: Request, res: Response, next: NextFunction) => {
  try {
    const { address } = WalletParamsSchema.parse(req.params);
    const balance = getWalletBalance(address);

    res.json({
      data: balance,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
