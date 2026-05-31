# PRD: Hybrid Banking QA – Simulasi Bank Indonesia dengan Integrasi USDC & CEX/Wallet

**Nama Repo:** `hybrid-bank-qa`

---

## 1. Latar Belakang & Konteks Bisnis

Sistem pembayaran lintas batas tradisional (seperti SWIFT atau SKN/RTGS di Indonesia) lambat, mahal, dan tidak transparan. Sementara itu, banyak bank di Indonesia mulai menjajaki aset digital dan stablecoin (USDC) untuk transfer internasional yang lebih efisien. Namun, regulasi Bank Indonesia mewajibkan bank tetap memproses transaksi melalui sistem perbankan domestik (contoh: BI‑FAST) sebelum dana dapat dipindahkan ke/dari blockchain. Di sisi lain, nasabah membutuhkan akses mudah ke bursa kripto (CEX) atau wallet self‑custody untuk menukar Rupiah ke USDC.

Proyek ini mensimulasikan **hybrid system** sebuah bank Indonesia yang:
- Memiliki core banking API standar (seperti endpoint transfer domestic).
- Terhubung ke blockchain (USDC di Ethereum/Polygon) untuk settlement cross‑border.
- Terintegrasi dengan CEX/wallet untuk konversi IDR ↔ USDC dan penyimpanan.

Tujuannya adalah membangun **test suite otomatis** yang memvalidasi alur end‑to‑end dari sistem hibrida tersebut, sehingga dapat menjadi portofolio QA yang kuat di industri perbankan, fintech, atau exchange.

---

## 2. Tujuan Proyek

- Menunjukkan kemampuan QA dalam menguji integrasi Web2 (bank Indonesia) ↔ Web3 (blockchain & CEX/wallet).
- Membangun portofolio siap‑tayang untuk peran QA di bank digital, fintech, atau CEX.
- Menguji skenario kritis: idempotensi, kegagalan RPC, double‑spend, koneksi wallet, konversi fiat‑crypto, dan kepatuhan regulasi (simulasi BI‑FAST cut‑off, dll.).

---

## 3. Ruang Lingkup

**Di dalam (In Scope):**

- Mock API bank (Web2) yang menyerupai core banking Indonesia: transfer domestik, inquiry rekening, webhook notifikasi, simulasi jadwal kliring BI‑FAST.
- Mock smart contract USDC (ERC20) dengan fungsi transfer, approve, event, mint (untuk simulasi likuiditas).
- Mock integrasi CEX/wallet: API untuk mendapatkan kurs IDR/USDC, swap fiat→crypto, query balance wallet.
- Jaringan blockchain lokal: **Tenderly Virtual TestNet (fork Mainnet USDC)** atau **Anvil (Foundry) fork**.
- Test cases: happy path, insufficient balance, RPC timeout, nonce error, event listener reconnect, swap gagal, double‑spend dengan idempotency key, verifikasi kepemilikan wallet (proof of address).
- E2E test menggunakan Playwright + **WalletQA** (atau mock wallet berbasis `ethers.Wallet`) untuk mensimulasikan interaksi nasabah.
- Validasi gas report & static analysis pada kontrak.

**Di luar (Out of Scope):**

- Frontend produksi (cukup halaman HTML sederhana untuk demo E2E).
- Deployment ke mainnet.
- Uji beban skala besar (load/stress testing).
- Smart contract production‑grade (hanya mock untuk testing).
- Integrasi nyata dengan BI‑FAST/API perbankan asli.

---

## 4. Persona Pengguna

| Persona | Kebutuhan |
|---------|-----------|
| **Recruiter / Hiring Manager** | Melihat kemampuan QA engineer: struktur test, coverage, dokumentasi, pemahaman domain banking + crypto. |
| **Peer QA / Developer** | Clone repo, `npm install` & `forge install`, jalankan test dalam 1 perintah, memahami skenario bisnis. |
| **Penilai portofolio** | Menilai kelengkapan test scenario, pemanfaatan tools modern, pipeline CI/CD, dan kejelasan repositori. |

---

## 5. Functional Requirements (Sistem yang Diuji)

### 5.1 Web2 – Mock Core Banking (Bank Indonesia)

| ID | Requirement |
|----|-------------|
| FR1 | Endpoint `POST /api/v1/transfer` menerima `{fromAccount, toAccount, amount, currency: "IDR", idempotencyKey}`. Hanya menerima mata uang IDR (sesuai aturan bank domestik). |
| FR2 | Endpoint `GET /api/v1/transfer/:id` mengembalikan status transaksi: `pending`, `processed_by_bank`, `swapped_to_usdc`, `submitted_onchain`, `success`, `failed`. |
| FR3 | Database in‑memory (SQLite) menyimpan seluruh log transaksi dan status terakhir. |
| FR4 | Webhook dipanggil ketika transaksi sudah final (`success`/`failed`) ke URL yang didaftarkan (simulasi notifikasi ke CEX/wallet). |
| FR5 | Simulasi jadwal kliring: transaksi yang masuk setelah jam 16:00 WIB otomatis berstatus `pending` hingga hari kerja berikutnya (untuk uji cut‑off BI‑FAST). |

### 5.2 Web3 – Smart Contract USDC (Mock)

| ID | Requirement |
|----|-------------|
| FR6 | Kontrak `MockUSDC` mengimplementasikan ERC20 (fungsi `transfer`, `transferFrom`, `approve`, `mint`, `burn`). |
| FR7 | Event `Transfer(from, to, amount)` wajib diemit pada setiap perubahan saldo. |
| FR8 | Fungsi `mint(address, amount)` hanya dapat dipanggil oleh owner (bank) untuk mensimulasikan penerbitan USDC. |
| FR9 | Fungsi `balanceOf(address)` harus akurat setelah setiap operasi. |
| FR10 | Internal mapping `_nonces` untuk mencegah double‑spend dengan nonce (mirip EIP‑2612 tetapi lebih sederhana). |

### 5.3 Integrasi CEX / Wallet (Web2 API Mock)

| ID | Requirement |
|----|-------------|
| FR11 | Endpoint `GET /api/v1/rates` mengembalikan kurs IDR/USDC terkini (contoh: `{bid: 14800, ask: 15000}`). |
| FR12 | Endpoint `POST /api/v1/swap` menerima `{direction: "IDR_to_USDC", amount: 15000000}` dan mengembalikan transaksi swap dengan ID, estimasi USDC yang diterima, dan alamat wallet. |
| FR13 | Endpoint `GET /api/v1/wallet/:address/balance` mengembalikan saldo USDC (bisa dari mock kontrak atau database tersendiri). |
| FR14 | Swap gagal jika spread terlalu tinggi (>2%) atau likuiditas tidak mencukupi; akan mengembalikan error `500` dengan pesan yang sesuai. |

### 5.4 Integrasi Hybrid (Bank ↔ Blockchain ↔ CEX)

| ID | Requirement |
|----|-------------|
| FR15 | Backend membaca event `Transfer` dari blockchain via WebSocket (menggunakan Ethers.js). |
| FR16 | Setelah event `Transfer` terdeteksi, status transaksi di banking DB diubah menjadi `success`. |
| FR17 | Retry mechanism: jika koneksi RPC putus, backend akan mencoba ulang hingga 3 kali dengan exponential backoff, lalu set status `failed`. |
| FR18 | Setiap transaksi on‑chain dilengkapi `nonce` bank yang bertambah secara atomik (untuk mencegah double‑spend). |
| FR19 | Sebelum melakukan transfer on‑chain, backend melakukan estimasi gas; jika estimasi gagal (misal kontrak paused), transaksi dibatalkan dan status `failed`. |

---

## 6. Non‑Functional Requirements

| NFR | Target |
|-----|--------|
| **Test coverage** | ≥ 90% pada kontrak Solidity (menggunakan `solidity-coverage`), ≥ 85% pada kode TypeScript (backend mock) dengan `c8`/`nyc`. |
| **Gas efficiency** | Tidak dioptimasi khusus, tetapi laporan gas wajib dihasilkan (`hardhat-gas-reporter`). |
| **CI/CD** | Setiap push ke `main` dan pull request menjalankan semua test di GitHub Actions. Pipeline juga menjalankan linting dan static analysis. |
| **Dokumentasi** | `README.md` berisi: ikhtisar proyek, arsitektur, cara setup & menjalankan test, struktur folder, contoh output coverage. |
| **Reproducibility** | Dua perintah: `npm install` (backend + e2e) dan `forge install` (opsional) harus langsung bisa menjalankan seluruh test tanpa konfigurasi tambahan. |
| **Keamanan** | Tidak ada private key/API key yang ter‑commit. Slither dijalankan di CI untuk analisis statis kontrak. |
| **Portabilitas** | Dapat dijalankan di macOS/Linux/Windows (dengan WSL). |

---

## 7. Skenario Test Cases (Wajib)

| ID | Skenario | Web2 (Bank/CEX) | Web3 (Blockchain) | Expected Outcome |
|----|----------|-----------------|-------------------|------------------|
| TC01 | Happy path – Transfer domestik → Swap IDR/USDC → Transfer on‑chain | Bank menerima transfer IDR, CEX swap sukses, bank submit TX | Event `Transfer` teremit, saldo wallet bertambah | Status transaksi bank menjadi `success`, saldo USDC sesuai, webhook terpanggil |
| TC02 | Saldo IDR tidak cukup | API transfer bank mengembalikan 400 | Tidak ada TX on‑chain | Transaksi gagal di tahap bank, balance tidak berubah, tidak ada event |
| TC03 | Kurs spread melebihi batas (CEX gagal) | CEX swap gagal (500) | Tidak ada TX | Bank mencatat status `failed` dengan alasan `swap_rejected`, webhook gagal |
| TC04 | RPC node timeout saat submit TX | Bank retry 3x | Simulasi node tidak merespons | Setelah 3 retry gagal, status transaksi `failed`, event listener tidak mendeteksi apa‑apa |
| TC05 | Double‑spend prevention (idempotency key + nonce) | Bank mengirim 2 request transfer dengan idempotency key sama | Nonce on‑chain hanya naik 1 | Request kedua ditolak (409 Conflict), hanya 1 TX on‑chain tereksekusi |
| TC06 | Event listener reconnect (WebSocket putus) | WebSocket bank ke node disconnect selama 10 detik | Transaksi tetap terekam di blockchain | Listener reconnect dan mengambil event yang terlewat (historical block fetch), status jadi `success` |
| TC07 | Transfer ke alamat tidak valid (invalid checksum) | Bank melakukan validasi alamat | Kontrak tidak di‑call | API bank mengembalikan error 422, tidak ada TX on‑chain |
| TC08 | Gas estimation gagal (misal kontrak paused) | Backend panggil `estimateGas` gagal | TX tidak dikirim | Bank mencatat `failed` dengan alasan `gas_estimation_error`, fallback ke batas gas manual tidak dilakukan (sesuai spesifikasi) |
| TC09 | Simulasi cut‑off BI‑FAST (transaksi setelah jam 16:00) | Bank menunda pemrosesan hingga hari kerja berikutnya | Tidak ada TX sampai jadwal | Status `pending` selama masa tunggu, setelah scheduler: swap dan TX diproses normal |

---

## 8. Tech Stack & Pemilihan Framework

| Komponen | Pilihan Teknologi | Alasan |
|----------|------------------|--------|
| **Bahasa Backend** | TypeScript (Node.js) | Populer di QA, statically typed, mendukung ekosistem testing yang matang. |
| **Framework Mock API** | Express.js | Sederhana, dokumentasi lengkap, mudah di‑test dengan Supertest. |
| **Database** | SQLite (via `better-sqlite3`) | Ringan, tanpa instalasi server, cukup untuk simulasi. |
| **Smart Contract** | Solidity (^0.8.20) | Standar industri. |
| **Blockchain Tooling** | Hardhat (utama) + Ethers.js v6 | Testing & deployment kontrak yang familiar, bisa fork mainnet via `hardhat`. |
| **Alternatif Blockchain** | Foundry (opsional) | Digunakan untuk fuzz testing dan analisis gas yang lebih dalam. |
| **Web3 Environment** | Tenderly Virtual TestNet (fork Ethereum Mainnet USDC) **atau** Hardhat local fork | Keduanya memungkinkan simulasi USDC riil dengan saldo awal. |
| **Web2 Testing** | Jest + Supertest | Matchers yang kuat, mocking, snapshot, cocok untuk API test. |
| **Smart Contract Testing** | Hardhat + Ethers.js + Chai matchers | Testing event, revert, dan balance. |
| **E2E Wallet Interaction** | Playwright + WalletQA (atau mock wallet custom dengan `ethers.Wallet`) | Playwright multi‑browser, WalletQA menyediakan helper siap‑pakai untuk MetaMask mock. |
| **CI/CD** | GitHub Actions | Gratis, integrasi langsung dengan repo. |
| **Coverage** | `solidity-coverage` (kontrak), `c8` (TypeScript) | Menghasilkan laporan gabungan atau terpisah. |
| **Static Analysis** | Slither (kontrak), ESLint + Prettier (TS) | Mendeteksi kerentanan dasar. |
| **Laporan Gas** | `hardhat-gas-reporter` | Output file teks atau badge. |

**Catatan:** Wallet automation menggunakan **mock wallet** berbasis private key lokal; tidak membutuhkan ekstensi MetaMask sungguhan. Cukup dengan `ethers.Wallet` yang menandatangani transaksi secara programatis.

---

## 9. Struktur Deliverables (Portofolio)

```
hybrid-bank-qa/
├── contracts/                 # Smart contract Solidity (MockUSDC)
│   └── MockUSDC.sol
├── scripts/                   # Deploy script & utilitas
│   └── deploy.ts
├── test/                      # Unit + integration test (Hardhat + Jest)
│   ├── unit/                  # Unit test kontrak
│   ├── integration/           # Integration test (bank API + kontrak + listener)
│   └── fixtures/              # Helper setup fork
├── backend/                   # Mock Bank API & CEX
│   ├── src/
│   │   ├── api/               # Express router, controller
│   │   ├── services/          # BankService, CexService, BlockchainListener
│   │   ├── models/            # Database schema (SQLite)
│   │   └── index.ts           # Entry point
│   └── tests/                 # Supertest API tests
├── e2e/                       # E2E Playwright tests
│   ├── specs/
│   └── wallets/               # Mock wallet helpers
├── .github/workflows/ci.yml   # CI pipeline
├── coverage/                  # Output laporan coverage (tidak di-commit, di CI diunggah sebagai artifact)
├── gas-report.txt
├── README.md
├── docs/
│   └── test-plan.md           # Strategi pengujian & daftar test case
├── hardhat.config.ts
├── package.json
└── .env.example               # Contoh environment (tidak ada nilai rahasia)
```

---

## 10. Kriteria Sukses (Definition of Done)

- [ ] Semua test cases (TC01–TC09) lulus di lingkungan lokal (`npm test`).
- [ ] GitHub Actions pipeline hijau (passing semua unit, integration, E2E).
- [ ] Coverage Solidity ≥90% dan TypeScript ≥85%.
- [ ] `README.md` jelas: cara setup, arsitektur sistem, cara menjalankan test, interpretasi hasil.
- [ ] Repositori bersifat publik, tanpa kredensial atau private key yang ter-commit.
- [ ] Laporan gas dan static analysis (Slither) tersedia dan bersih dari isu kritis.

---

## 11. Estimasi Waktu Pengerjaan

| Aktivitas | Durasi (hari kerja) |
|-----------|---------------------|
| Setup proyek, inisialisasi Hardhat + Express | 1 |
| Mock USDC contract + deploy ke fork | 2 |
| Mock bank API + CEX integration (Express) | 2 |
| Blockchain listener & retry logic | 1 |
| Unit test kontrak + integration test (Hybrid) | 3 |
| E2E Playwright scenario (mock wallet) | 2 |
| CI/CD + badge coverage + static analysis | 1 |
| Dokumentasi lengkap (`README`, `test-plan.md`) | 1 |
| **Total** | **13 hari** |

---

## 12. Catatan Tambahan

- Jaringan blockchain bisa dijalankan dengan **Hardhat node** yang me‑fork Mainnet atau Polygon, sehingga saldo USDC dapat di‑mint melalui alamat whale. Konfigurasi ada di `hardhat.config.ts`.
- Untuk mensimulasikan CEX, gunakan mock API sederhana yang menyimpan order book statis dan mengembalikan kurs tetap; tidak perlu engine matching sungguhan.
- Jika ingin memperkaya, bisa tambahkan test case terkait **proof of reserve** atau **audit trail** sederhana pada smart contract.
- Semua nama endpoint, struktur respons, dan skenario di atas sudah disesuaikan dengan konteks bank Indonesia yang harus memproses IDR terlebih dahulu sebelum berinteraksi dengan crypto.

