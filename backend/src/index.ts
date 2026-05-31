/**
 * Express application entry point
 * Hybrid Banking QA — Mock Bank + CEX + Blockchain API
 */
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { getDatabase, closeDatabase } from "./models/database.js";
import { errorHandler } from "./api/middleware.js";
import bankRoutes from "./api/bank.routes.js";
import cexRoutes from "./api/cex.routes.js";

const PORT = parseInt(process.env.PORT ?? "3000");

export function createApp(inMemoryDb: boolean = false): express.Application {
  // Initialize database
  getDatabase(inMemoryDb);

  const app = express();

  // Middleware
  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  app.use(morgan("dev"));

  // Routes
  app.use("/api/v1", bankRoutes);
  app.use("/api/v1", cexRoutes);

  // Health check
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date() });
  });

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}

/**
 * Start server (only when run directly)
 */
export function startServer(port: number = PORT): Promise<express.Application> {
  return new Promise((resolve) => {
    const app = createApp();
    const server = app.listen(port, () => {
      console.log(`Hybrid Bank QA server running on port ${port}`);
      resolve(app);
    });

    // Graceful shutdown
    process.on("SIGTERM", () => {
      console.log("SIGTERM received, shutting down...");
      server.close(() => {
        closeDatabase();
        process.exit(0);
      });
    });
  });
}

// Start if run directly
if (process.argv[1]?.endsWith("index.ts") || process.argv[1]?.endsWith("index.js")) {
  startServer().catch(console.error);
}
