/**
 * SQLite database setup using better-sqlite3
 * In-memory for testing, file-based for development
 */
import Database from "better-sqlite3";

let db: Database.Database | null = null;

/**
 * Get or create SQLite database instance
 * @param inMemory - Use in-memory database (for tests)
 */
export function getDatabase(inMemory: boolean = false): Database.Database {
  if (db) return db;

  db = inMemory
    ? new Database(":memory:")
    : new Database("./hybrid-bank.db");

  // Enable WAL mode for better concurrency
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  // Create tables
  initializeSchema(db);

  return db;
}

/**
 * Close database connection
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

/**
 * Reset database (for tests)
 */
export function resetDatabase(): void {
  if (db) {
    db.exec("DELETE FROM transactions");
    db.exec("DELETE FROM swap_orders");
    db.exec("DELETE FROM webhooks");
  }
}

function initializeSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      from_account TEXT NOT NULL,
      to_account TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'IDR',
      status TEXT NOT NULL DEFAULT 'pending',
      idempotency_key TEXT NOT NULL UNIQUE,
      nonce INTEGER,
      tx_hash TEXT,
      failure_reason TEXT,
      webhook_url TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
    CREATE INDEX IF NOT EXISTS idx_transactions_idempotency ON transactions(idempotency_key);
    CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions(created_at);

    CREATE TABLE IF NOT EXISTS swap_orders (
      id TEXT PRIMARY KEY,
      transaction_id TEXT,
      direction TEXT NOT NULL,
      input_amount REAL NOT NULL,
      output_amount REAL NOT NULL,
      rate REAL NOT NULL,
      wallet_address TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (transaction_id) REFERENCES transactions(id)
    );

    CREATE TABLE IF NOT EXISTS webhooks (
      id TEXT PRIMARY KEY,
      transaction_id TEXT NOT NULL,
      url TEXT NOT NULL,
      events TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (transaction_id) REFERENCES transactions(id)
    );
  `);
}
