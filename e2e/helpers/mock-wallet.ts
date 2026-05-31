/**
 * Mock Wallet Helper — Programmatic wallet for E2E tests
 * Uses ethers.Wallet for signing without MetaMask
 */
import { ethers } from "ethers";

export interface MockWallet {
  address: string;
  privateKey: string;
  signer: ethers.Wallet;
  signMessage(message: string): Promise<string>;
  signTransaction(tx: ethers.TransactionRequest): Promise<string>;
}

/**
 * Create a mock wallet with deterministic keys for testing
 */
export function createMockWallet(index: number = 0): MockWallet {
  // Deterministic mnemonic for reproducible tests
  const mnemonic = ethers.Mnemonic.fromPhrase(
    "test test test test test test test test test test test junk"
  );
  const hdNode = ethers.HDNodeWallet.fromMnemonic(mnemonic, `m/44'/60'/0'/0/${index}`);

  return {
    address: hdNode.address,
    privateKey: hdNode.privateKey,
    signer: hdNode,
    async signMessage(message: string): Promise<string> {
      return hdNode.signMessage(message);
    },
    async signTransaction(tx: ethers.TransactionRequest): Promise<string> {
      return hdNode.signTransaction(tx);
    },
  };
}

/**
 * Create multiple mock wallets for multi-party scenarios
 */
export function createMockWallets(count: number): MockWallet[] {
  return Array.from({ length: count }, (_, i) => createMockWallet(i));
}

/**
 * Generate a random wallet (non-deterministic)
 */
export function createRandomWallet(): MockWallet {
  const wallet = ethers.Wallet.createRandom();
  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
    signer: wallet,
    async signMessage(message: string): Promise<string> {
      return wallet.signMessage(message);
    },
    async signTransaction(tx: ethers.TransactionRequest): Promise<string> {
      return wallet.signTransaction(tx);
    },
  };
}
