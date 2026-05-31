# Test Plan: Hybrid Banking QA

## 1. Test Strategy

### 1.1 Overview
This test suite validates a hybrid banking system that integrates:
- **Web2**: Indonesian bank core API (domestic IDR transfers)
- **Web3**: USDC on-chain settlement (ERC20 on Ethereum/Polygon)
- **CEX/Wallet**: Fiat-crypto conversion and wallet management

### 1.2 Test Levels

| Level | Tool | Coverage | Trigger |
|-------|------|----------|---------|
| Unit | Hardhat + Chai | Smart contracts (≥90%) | Every commit |
| Integration | Jest + Supertest | Bank API, CEX API, Hybrid flow (≥85%) | Every PR |
| E2E | Playwright | Full user journey | Pre-merge |
| Static | Slither + ESLint | Security + code quality | CI pipeline |

### 1.3 Entry Criteria
- Hardhat node running on port 8545
- Mock API server running on port 3000
- `.env` configured with test values
- Seed data loaded (whale address minted USDC)

### 1.4 Exit Criteria
- All 9 test cases (TC01-TC09) pass
- Solidity coverage ≥90%
- TypeScript coverage ≥85%
- Zero critical/high Slither findings
- ESLint clean (zero errors)

---

## 2. Test Case Matrix

| ID | Scenario | Priority | Web2 | Web3 | Expected |
|----|----------|----------|------|------|----------|
| TC01 | Happy path: IDR → Swap → On-chain | P0 | ✅ | ✅ | Status `success`, balance updated |
| TC02 | Insufficient IDR balance | P0 | ✅ | — | 400, no TX |
| TC03 | Spread > 2% (CEX rejects) | P1 | ✅ | — | 500, status `failed` |
| TC04 | RPC timeout (3 retries) | P1 | ✅ | ✅ | Status `failed` |
| TC05 | Duplicate idempotency key | P0 | ✅ | ✅ | 409, nonce +1 only |
| TC06 | WebSocket disconnect/reconnect | P1 | — | ✅ | Listener reconnects |
| TC07 | Invalid address checksum | P0 | ✅ | — | 422, no TX |
| TC08 | Gas estimation fails | P1 | — | ✅ | Status `failed` |
| TC09 | BI-FAST cut-off (16:00 WIB) | P2 | ✅ | — | Status `pending` |

---

## 3. Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| RPC fork instability in CI | Medium | High | Use Hardhat local node + snapshot reset |
| Timezone mismatch | Low | Medium | Force `TZ=Asia/Jakarta` in CI |
| Idempotency race condition | Low | High | SQLite `BEGIN IMMEDIATE` |
| Webhook delivery failure | Medium | Low | Retry policy + logging |

---

## 4. Test Data

### 4.1 Seed Data
- **Accounts**: ACC-001 (sender), ACC-002 (recipient)
- **Amount**: 15,000,000 IDR (1,000 USDC at 15,000 IDR/USDC)
- **Whale address**: Hardhat `accounts[0]` with 1,000,000 USDC minted

### 4.2 Reset Strategy
```sql
DELETE FROM transactions;
DELETE FROM webhook_attempts;
UPDATE bank_nonce SET value = 0;
```

---

## 5. Regression Suites

### Smoke (Every PR, ~5 min)
- TC01: Happy path
- TC02: Insufficient balance
- TC07: Invalid address

### Hybrid Critical (Pre-merge, ~15 min)
- TC01, TC04, TC05, TC06

### Full Regression (Nightly, ~30 min)
- TC01 through TC09

---

## 6. Coverage Targets

| Component | Tool | Target |
|-----------|------|--------|
| Solidity contracts | solidity-coverage | ≥90% |
| TypeScript backend | jest --coverage | ≥85% |
| API endpoints | Supertest | 100% of routes |
| Error paths | Jest | All error codes tested |

---

## 7. CI/CD Pipeline

```
push/PR → lint → unit-tests → integration-tests → e2e-tests → coverage
                                                           → static-analysis (Slither)
```

All jobs must pass for merge to `main`.
