# PRD & QA Test Plan: Hybrid Banking QA
**Repository:** `hybrid-bank-qa`  
**Versi:** `v2.0` | **Status:** `Ready for Implementation`

---

## 1. Latar Belakang & Konteks Bisnis
Sistem pembayaran lintas batas tradisional (SWIFT, SKN/RTGS) lambat, mahal, dan tidak transparan. Bank Indonesia mulai mengeksplorasi stablecoin (USDC) untuk settlement cross-border, namun regulasi mewajibkan pemrosesan awal melalui sistem perbankan domestik (BI-FAST) sebelum dana dipindahkan ke blockchain atau CEX/wallet.

Proyek ini mensimulasikan **hybrid banking system** yang menggabungkan:
- Core Banking API domestik (Web2)
- Settlement on-chain USDC (Web3)
- Integrasi mock CEX/Wallet (konversi IDR ↔ USDC)

Tujuannya adalah membangun **test suite otomatis end-to-end** yang validasi alur hybrid, sekaligus menjadi portofolio QA industri perbankan/fintek/Web3.

---

## 2. Tujuan & Persona
| Persona | Kebutuhan Utama |
|---------|----------------|
| **Recruiter / Hiring Manager** | Melihat struktur test, coverage, dokumentasi, pemahaman domain banking + crypto |
| **Peer QA / Developer** | `git clone` → `npm install` → `npm test` berjalan tanpa konfigurasi manual |
| **Penilai Portofolio** | Kelengkapan skenario, pipeline CI/CD, traceability requirement → test case |

---

## 3. Ruang Lingkup
### In Scope
- Mock API Bank (Express.js) + SQLite in-memory
- Mock Smart Contract USDC (ERC20) + Hardhat local fork / Tenderly
- Mock CEX API (rates, swap, balance)
- Blockchain event listener (WebSocket/HTTP fallback) + retry logic
- E2E simulation via Playwright + programmatic wallet (`ethers.Wallet`)
- Coverage ≥90% Solidity, ≥85% TypeScript
- CI/CD GitHub Actions (unit, integration, E2E, lint, Slither, gas report)

### Out of Scope
- Frontend produksi (cukup HTML sederhana untuk demo)
- Integrasi BI-FAST / banking API nyata
- Load/Stress testing
- Smart contract production-grade (hanya mock untuk testing)
- Deployment mainnet

---

## 4. Functional Requirements (Enhanced)

### 4.1 Web2 – Mock Core Banking
| ID | Requirement | Detail Teknis |
|----|-------------|---------------|
| FR1 | `POST /api/v1/transfer` | Header wajib: `X-API-Key: test-key-mock`, `Idempotency-Key: <UUIDv4>`. Validasi: `currency === "IDR"`, `amount >= 10000`. Reject `400` jika format invalid. |
| FR2 | `GET /api/v1/transfer/:id` | Response: `{ transactionId, status, createdAt, updatedAt, metadata? }` |
| FR3 | SQLite Storage | Tabel: `transactions(id UUID PK, idempotency_key UNIQUE, from_acc, to_acc, amount, status, created_at, updated_at)` |
| FR4 | Webhook Notifikasi | Dipanggil saat status `success`/`failed`. Payload & signature lihat §6.2 |
| FR5 | Simulasi BI-FAST Cut-off | Transaksi setelah `16:00 WIB` → status `pending`. Scheduler `node-cron`: `0 16 * * 1-5` (Senin-Jumat). Timezone eksplisit: `Asia/Jakarta`. |

### 4.2 Web3 – Mock USDC Contract
| ID | Requirement | Detail Teknis |
|----|-------------|---------------|
| FR6 | ERC20 Standard | Fungsi: `transfer`, `transferFrom`, `approve`, `mint`, `burn`, `balanceOf` |
| FR7 | Event Emit | `event Transfer(address from, address to, uint256 amount);` wajib diemit |
| FR8 | Mint Access Control | `onlyOwner` modifier. Owner = deployer address |
| FR9 | Balance Accuracy | `balanceOf` harus konsisten setelah setiap state change |
| FR10 | Nonce Mapping | `mapping(address => uint256) public nonces;` increment atomik setelah setiap valid `transfer`. Mencegah replay/double-spend |

### 4.3 CEX / Wallet Mock
| ID | Requirement | Detail Teknis |
|----|-------------|---------------|
| FR11 | `GET /api/v1/rates` | Response: `{ bid: 14800, ask: 15000, timestamp: ISO8601 }` |
| FR12 | `POST /api/v1/swap` | Input: `{ direction: "IDR_to_USDC", amount: number }`. Output: `{ swapId, estimatedUSDC, targetWallet, status: "completed" \| "failed" }` |
| FR13 | `GET /api/v1/wallet/:address/balance` | Query on-chain `balanceOf` atau cache DB. Validasi EIP-55 checksum |
| FR14 | Swap Failure Conditions | Return `500` jika spread >2% atau likuiditas < amount. Error schema lihat §6.1 |

### 4.4 Hybrid Integration
| ID | Requirement | Detail Teknis |
|----|-------------|---------------|
| FR15 | Event Listener | Subscribe `Transfer` via `ethers.WSProvider`. Fallback ke `pollLogs` jika WS disconnect |
| FR16 | Status Update | Saat event terdeteksi → update DB status `success`. Pakai DB transaction/idempotent query |
| FR17 | Retry Mechanism | Max 3 retry. Backoff: `delay = 1000ms * 2^attempt`. Timeout: `5000ms/request`. Setelah 3 gagal → status `failed` |
| FR18 | Bank Nonce | Nonce global per transaksi hybrid, increment atomik sebelum `sendTransaction`. Simpan di DB `next_bank_nonce` |
| FR19 | Gas Estimation | `estimateGas()` gagal → transaksi dibatalkan, status `failed` dengan reason `gas_estimation_error`. Tidak ada fallback manual |

---

## 5. Non-Functional Requirements
| NFR | Target |
|-----|--------|
| Coverage | Solidity ≥90% (`solidity-coverage`), TypeScript ≥85% (`jest --coverage`) |
| Gas Report | Dihasilkan via `hardhat-gas-reporter`, disimpan di `gas-report.txt` |
| CI/CD | GitHub Actions trigger pada `push main` & `PR`. Jalankan: lint, unit, integration, E2E, Slither, coverage |
| Reproducibility | `npm run setup` → `npm test` berjalan tanpa konfigurasi manual. Support macOS/Linux/Windows(WSL) |
| Security | Tidak ada secret di-commit. `.env.example` provided. Slither clean dari critical/high issue |
| EVM Constraint | `hardhat.config.ts`: `evmVersion: "paris"` untuk hindari `PUSH0` opcode di chain non-Shanghai |

---

## 6. API & Data Specifications

### 6.1 Standard Error Response
```json
{
  "error": {
    "code": "STRING_CODE",
    "message": "Human readable message",
    "details": {}
  }
}
```
Contoh error codes: `INSUFFICIENT_BALANCE`, `IDEMPOTENCY_KEY_USED`, `SWAP_SPREAD_EXCEEDED`, `RPC_TIMEOUT`, `INVALID_ADDRESS_CHECKSUM`, `GAS_ESTIMATION_ERROR`

### 6.2 Webhook Payload & Signature
```json
{
  "event": "transfer.finalized",
  "data": {
    "transactionId": "uuid-v4",
    "status": "success|failed",
    "blockchainTxHash": "0x...|null",
    "timestamp": "2025-01-01T00:00:00Z"
  },
  "signature": "hmac-sha256=..."
}
```
- **Signature Verification:** `HMAC-SHA256(payload, webhookSecret)` dibandingkan dengan header `X-Webhook-Signature`
- **Retry Policy:** 3x dengan backoff linear (5s, 10s, 20s). Log kegagalan di DB `webhook_attempts`

### 6.3 Idempotency & Nonce Rules
| Komponen | Spesifikasi |
|----------|-------------|
| Idempotency Key | Format UUID v4 (`crypto.randomUUID()`). Unique constraint di DB. Expired 24 jam (opsional untuk mock). Return `409` jika duplicate |
| Bank Nonce | Global counter di DB. Increment sebelum submit TX. Simpan di tabel `bank_nonce(value INT PK)` |
| Contract Nonce | `mapping(address => uint256)` di Solidity. Validasi di awal `transfer()`, throw `INVALID_NONCE` jika mismatch |

---

## 7. Test Strategy & QA Plan

### 7.1 Entry & Exit Criteria
| Kriteria | Status |
|----------|--------|
| **Entry** | Mock API port 3000 ready, Hardhat node port 8545 running, `.env` configured, Seed data & whale address prepared |
| **Exit** | 9/9 TC lulus lokal & CI, Coverage ≥90% Solidity ≥85% TS, 0 critical/high bug terbuka, Slither & ESLint clean |

### 7.2 Risk Assessment
| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| RPC fork tidak stabil di CI | Medium | High | Fallback ke Hardhat local node + snapshot reset |
| Timezone mismatch scheduler | Low | Medium | Force `TZ=Asia/Jakarta` di GitHub Actions & test env |
| Idempotency race condition | Low | High | Gunakan DB transaction + `BEGIN IMMEDIATE` (SQLite) |
| Webhook delivery timeout | Medium | Low | Retry policy + logging. Mock webhook server menerima async |

### 7.3 Regression Suite Structure
| Suite | Coverage | Trigger | Duration |
|-------|----------|---------|----------|
| Smoke | TC01, TC02, TC07 | Setiap PR | ~5 min |
| Hybrid Critical | TC01, TC04, TC05, TC06 | Pre-merge | ~15 min |
| Full Regression | TC01–TC09 | Nightly / Release | ~30 min |

---

## 8. Test Cases (Detailed)

| ID | Skenario | Priority | Preconditions | Test Steps | Expected Result |
|----|----------|----------|---------------|------------|-----------------|
| **TC01** | Happy path: IDR → Swap → On-chain → Success | P0 | DB clean, whale minted 1000 USDC, rate valid | 1. POST transfer 2. POST swap 3. Listener detect event 4. GET status | Status `success`, balance +USDC, webhook `200`, 1 on-chain TX |
| **TC02** | Saldo IDR tidak cukup | P0 | Account balance < amount | 1. POST transfer dengan amount > balance | API `400`, code `INSUFFICIENT_BALANCE`, DB no record |
| **TC03** | Spread CEX > 2% | P1 | Rate ask/bid gap >2% | 1. POST swap | API `500`, code `SWAP_SPREAD_EXCEEDED`, DB status `failed` |
| **TC04** | RPC timeout saat submit | P1 | Mock RPC reject/delay >5s | 1. POST transfer → trigger listener submit | Retry 3x → DB status `failed`, code `RPC_TIMEOUT`, no TX on-chain |
| **TC05** | Double-spend prevention | P0 | Valid account, same idempotency key | 1. POST transfer twice with same key | 1st `202`, 2nd `409 Conflict`. Hanya 1 TX on-chain, nonce +1 |
| **TC06** | WebSocket disconnect & reconnect | P1 | WS killed 10s post-TX | 1. Submit TX 2. Kill WS 3. Restart listener | Listener fetch historical logs, DB status `success` |
| **TC07** | Invalid address checksum | P0 | Address valid format but wrong EIP-55 | 1. POST transfer with bad checksum | API `422`, code `INVALID_ADDRESS_CHECKSUM`, no TX |
| **TC08** | Gas estimation fails | P1 | Contract `pause()` active | 1. Submit TX → call `estimateGas()` | Fails → DB `failed`, code `GAS_ESTIMATION_ERROR` |
| **TC09** | BI-FAST cut-off (after 16:00 WIB) | P2 | Time mocked to 16:05 WIB | 1. POST transfer 2. Wait scheduler | Status `pending` → next weekday 16:00 → processed normally |

**Test Data Strategy:**
- Seed DB via SQL script
- Whale address: hardhat `accounts[0]` dengan `mockUSDC.mint()`
- Reset DB sebelum tiap suite: `DELETE FROM transactions; DELETE FROM webhook_attempts;`

---

## 9. Tech Stack & Environment
| Komponen | Teknologi | Versi/Notes |
|----------|-----------|-------------|
| Language | TypeScript (strict, ESM) | 5.9+ |
| Runtime | Node.js | 22 LTS |
| Backend | Express.js | 5.x |
| DB | SQLite (`better-sqlite3`) | In-memory untuk test, file untuk dev |
| Smart Contract | Solidity `^0.8.20` | `evmVersion: "paris"` di hardhat config |
| Blockchain Tooling | Hardhat + Ethers.js v6 | Local fork (no API key) |
| API Testing | Jest + Supertest | `--runInBand` untuk serial DB access |
| Contract Testing | Hardhat test + Chai | Event, revert, balance matchers |
| E2E | Playwright + `ethers.Wallet` | Mock wallet programmatic, no MetaMask ext |
| Validation | Zod | 3.x |
| Scheduling | `node-cron` | BI-FAST cut-off simulation |
| Coverage | `solidity-coverage`, `jest --coverage` | Combined report di CI |
| Static Analysis | Slither, ESLint, Prettier | CI fail on critical/high Slither |
| Package Manager | pnpm | 9.x |
| CI/CD | GitHub Actions | Matrix: ubuntu-latest, Node 22 |

---

## 10. Security & Compliance
- Tidak ada private key/API key di-commit. Gunakan `.env.example`
- Validasi alamat via `ethers.getAddress()` (EIP-55)
- Idempotency key wajib UUID v4, validasi di middleware
- Webhook signature wajib diverifikasi sebelum proses payload
- Slither dijalankan di CI, blocking pada `High`/`Critical`
- Nonce & balance update menggunakan DB transaction atomik

---

## 11. Deliverables & Definition of Done
- [ ] Semua TC01–TC09 lulus di lokal & GitHub Actions
- [ ] Coverage report tersedia (`coverage/`, `gas-report.txt`)
- [ ] `README.md` lengkap: arsitektur, setup, run test, interpretasi hasil
- [ ] Pipeline CI hijau (lint, test, coverage, Slither)
- [ ] Repo publik, tanpa credential ter-commit
- [ ] Bug report template & test execution tracking tersedia di `docs/`

---

## 12. Setup & Reproducibility (One-Command)
```bash
# 1. Clone & Install
git clone https://github.com/jefryKurniawan/hybrid-bank-qa.git
cd hybrid-bank-qa
pnpm install

# 2. Environment
cp .env.example .env

# 3. Setup DB + Compile Contracts + Seed Data
pnpm run setup

# 4. Run Tests
pnpm test              # Jest (unit + integration)
pnpm test:e2e          # Playwright (E2E)

# 5. Coverage & Reports
pnpm coverage:typescript
pnpm coverage:solidity
```

---

## 13. Struktur Folder

```
hybrid-bank-qa/
├── contracts/
│   └── MockUSDC.sol
├── backend/
│   ├── src/
│   │   ├── api/
│   │   │   ├── bank.routes.ts
│   │   │   ├── cex.routes.ts
│   │   │   └── middleware.ts
│   │   ├── services/
│   │   │   ├── bank.service.ts
│   │   │   ├── cex.service.ts
│   │   │   ├── blockchain.service.ts
│   │   │   └── listener.service.ts
│   │   ├── models/
│   │   │   ├── database.ts
│   │   │   └── transaction.ts
│   │   ├── schemas/
│   │   │   ├── bank.schema.ts
│   │   │   └── cex.schema.ts
│   │   ├── types/
│   │   │   ├── bank.ts
│   │   │   ├── cex.ts
│   │   │   └── blockchain.ts
│   │   ├── utils/
│   │   │   ├── errors.ts
│   │   │   └── retry.ts
│   │   └── index.ts
│   └── tests/
│       ├── bank.api.test.ts
│       ├── cex.api.test.ts
│       └── hybrid.integration.test.ts
├── test/
│   ├── unit/
│   │   └── MockUSDC.test.ts
│   ├── integration/
│   │   └── hybrid-flow.test.ts
│   └── fixtures/
│       └── setup.ts
├── e2e/
│   ├── specs/
│   │   └── full-flow.spec.ts
│   └── helpers/
│       └── mock-wallet.ts
├── scripts/
│   ├── deploy.ts
│   └── seed.ts
├── docs/
│   └── test-plan.md
├── .github/
│   └── workflows/
│       └── ci.yml
├── hardhat.config.ts
├── tsconfig.json
├── eslint.config.js
├── jest.config.ts
├── playwright.config.ts
├── package.json
├── .env.example
└── README.md
```
