import { getDatabase, resetDatabase } from "../backend/src/models/database.js";

function main() {
  console.log("Seeding database...");

  const db = getDatabase();

  // Reset and re-seed
  resetDatabase();

  // Insert seed bank nonce
  db.prepare("INSERT OR IGNORE INTO bank_nonce (value) VALUES (0)").run();

  console.log("Database seeded successfully.");
  console.log("- transactions table: empty (ready for tests)");
  console.log("- bank_nonce: initialized to 0");
  console.log("- webhook_attempts: empty");
}

main();
