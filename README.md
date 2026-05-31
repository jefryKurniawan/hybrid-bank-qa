# Hybrid Banking QA

**QA Portfolio Project** — Automated test suite for a hybrid Indonesian banking system integrating Web2 (Bank Indonesia) + Web3 (USDC on-chain) + CEX/Wallet.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Hybrid Banking System                   │
├──────────────┬──────────────────┬────────────────────────────┤
│   Bank API   │    CEX Mock API  │   Blockchain (Hardhat)     │
│  (Express)   │    (Express)     │   MockUSDC (ERC20)         │
│              │                  │                            │
│ • Transfer   │ • Rates          │ • Transfer                 │
│ • Status     │ • Swap           │ • Mint/Burn                │
│ • Webhook    │ • Balance        │ • Events                   │
├──────────────┴──────────────────┴────────────────────────────┤
│                    SQLite (In-Memory)                         │
│              transactions │ webhook_attempts                 │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

```bash
# 1. Clone & install
git clone https://github.com/jefryKurniawan/hybrid-bank-qa.git
cd hybrid-bank-qa
pnpm install

# 2. Setup environment
cp .env.example .env

# 3. Compile contracts & seed database
pnpm run setup

# 4. Run tests
pnpm test              # Unit + Integration (Jest)
pnpm hardhat:test      # Contract tests (Hardhat)
```

## Test Commands

| Command | Description |
|---------|-------------|
| `pnpm test` | Run all Jest tests (unit + integration) |
| `pnpm test:integration` | Run integration tests only |
| `pnpm test:coverage` | Run tests with coverage report |
| `pnpm hardhat:test` | Run Solidity unit tests |
| `pnpm coverage:solidity` | Solidity coverage report |
| `pnpm coverage:typescript` | TypeScript coverage report |
| `pnpm lint` | ESLint check |
| `pnpm build` | TypeScript compilation |

## Test Cases

| ID | Scenario | Priority |
|----|----------|----------|
| TC01 | Happy path: IDR → Swap → On-chain → Success | P0 |
| TC02 | Insufficient IDR balance | P0 |
| TC03 | Spread > 2% (CEX rejects) | P1 |
| TC04 | RPC timeout (3 retries) | P1 |
| TC05 | Duplicate idempotency key (double-spend prevention) | P0 |
| TC06 | WebSocket disconnect & reconnect | P1 |
| TC07 | Invalid address checksum | P0 |
| TC08 | Gas estimation fails (contract paused) | P1 |
| TC09 | BI-FAST cut-off (after 16:00 WIB) | P2 |

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Language | TypeScript 6.x (strict, ESM) |
| Backend | Express.js 5.x |
| Database | SQLite (better-sqlite3) |
| Smart Contract | Solidity 0.8.20 |
| Blockchain | Hardhat + Ethers.js v6 |
| Testing | Jest 30 + Supertest |
| Validation | Zod 4.x |
| CI/CD | GitHub Actions |

## Project Structure

```
hybrid-bank-qa/
├── contracts/          # Solidity smart contracts
├── backend/src/        # Express API source
│   ├── api/            # Routes & middleware
│   ├── services/       # Business logic
│   ├── models/         # Database layer
│   ├── schemas/        # Zod validation
│   ├── types/          # TypeScript types
│   └── utils/          # Error handling, retry
├── test/unit/          # Contract unit tests
├── backend/tests/      # API integration tests
├── e2e/                # Playwright E2E tests
├── scripts/            # Deploy & seed scripts
└── docs/               # Test plan & documentation
```

## Coverage Targets

- Solidity: ≥90%
- TypeScript: ≥85%

## License

MIT
