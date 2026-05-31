import { ethers } from "ethers";
import { BlockchainError } from "../utils/errors.js";
import type { GasEstimate, SettlementResult } from "../types/blockchain.js";

const MOCK_USDC_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function mint(address to, uint256 amount)",
  "function balanceOf(address account) view returns (uint256)",
  "function nonces(address account) view returns (uint256)",
  "function paused() view returns (bool)",
  "event Transfer(address indexed from, address indexed to, uint256 amount)",
] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let contract: any = null;
let wallet: ethers.Wallet | null = null;

/** Initialize blockchain connection */
export function initBlockchain(
  rpcUrl: string = process.env.RPC_URL ?? "http://127.0.0.1:8545",
  privateKey: string = process.env.BANK_PRIVATE_KEY ?? ethers.Wallet.createRandom().privateKey,
  contractAddress: string = process.env.MOCK_USDC_ADDRESS ?? ""
): void {
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  wallet = new ethers.Wallet(privateKey, provider);

  if (contractAddress) {
    contract = new ethers.Contract(contractAddress, MOCK_USDC_ABI, wallet);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getContract(): any {
  if (!contract) throw new Error("Blockchain not initialized");
  return contract;
}

export function getWallet(): ethers.Wallet {
  if (!wallet) throw new Error("Blockchain not initialized");
  return wallet;
}

/** Estimate gas for a transfer */
export async function estimateGas(to: string, amount: bigint): Promise<GasEstimate> {
  const c = getContract();

  try {
    const gasLimit: bigint = await c.transfer.estimateGas(to, amount);
    const feeData = await c.runner?.provider?.getFeeData();
    const gasPrice: bigint = feeData?.gasPrice ?? 0n;

    return {
      gasLimit,
      gasPrice,
      estimatedCost: gasLimit * gasPrice,
    };
  } catch (error) {
    throw new BlockchainError("Gas estimation failed", "GAS_ESTIMATION_ERROR", 500);
  }
}

/** Submit USDC transfer on-chain */
export async function submitTransfer(
  to: string,
  amount: bigint,
  bankNonce: number
): Promise<SettlementResult<{ txHash: string; blockNumber: number; nonce: number }>> {
  const c = getContract();

  try {
    await estimateGas(to, amount);

    const tx = await c.transfer(to, amount, { nonce: bankNonce });
    const receipt = await tx.wait();

    return {
      success: true,
      data: { txHash: receipt.hash, blockNumber: receipt.blockNumber, nonce: bankNonce },
      txHash: receipt.hash,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    if (message.includes("Timeout")) {
      return { success: false, error: "RPC timeout", code: "RPC_TIMEOUT" };
    }
    if (message.includes("paused")) {
      return { success: false, error: "Contract is paused", code: "GAS_ESTIMATION_ERROR" };
    }

    return { success: false, error: message, code: "BLOCKCHAIN_ERROR" };
  }
}

/** Get USDC balance for an address */
export async function getBalance(address: string): Promise<bigint> {
  return getContract().balanceOf(address);
}

/** Mint USDC (owner only) */
export async function mint(to: string, amount: bigint): Promise<string> {
  const tx = await getContract().mint(to, amount);
  const receipt = await tx.wait();
  return receipt.hash;
}

/** Pause contract */
export async function pauseContract(): Promise<void> {
  const tx = await getContract().pause();
  await tx.wait();
}

/** Unpause contract */
export async function unpauseContract(): Promise<void> {
  const tx = await getContract().unpause();
  await tx.wait();
}
