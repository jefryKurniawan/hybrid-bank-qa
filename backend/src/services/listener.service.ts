import { ethers } from "ethers";
import { markSuccess, markFailed, markSubmittedOnchain, getBankNonce } from "./bank.service.js";
import { submitTransfer } from "./blockchain.service.js";

const MOCK_USDC_ABI = [
  "event Transfer(address indexed from, address indexed to, uint256 amount)",
] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let listener: any = null;
let isListening = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 3;

/** Start listening for Transfer events */
export function startListener(
  rpcUrl: string = process.env.RPC_URL ?? "http://127.0.0.1:8545",
  contractAddress: string = process.env.MOCK_USDC_ADDRESS ?? ""
): void {
  if (isListening) return;

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  listener = new ethers.Contract(contractAddress, MOCK_USDC_ABI, provider);

  listener.on("Transfer", (from: string, to: string, amount: bigint, event: any) => {
    console.log(`Transfer event: ${from} → ${to}, amount: ${amount}`);
  });

  isListening = true;
  console.log("Blockchain listener started");
}

/** Stop listening */
export function stopListener(): void {
  if (listener) {
    listener.removeAllListeners();
    listener = null;
  }
  isListening = false;
  reconnectAttempts = 0;
  console.log("Blockchain listener stopped");
}

/** Check if listener is active */
export function isListenerActive(): boolean {
  return isListening;
}

/** Fetch historical Transfer events */
export async function fetchHistoricalEvents(
  fromBlock: number,
  toBlock: number | string = "latest",
  contractAddress: string = process.env.MOCK_USDC_ADDRESS ?? "",
  rpcUrl: string = process.env.RPC_URL ?? "http://127.0.0.1:8545"
): Promise<Array<{ from: string; to: string; amount: bigint; txHash: string; blockNumber: number }>> {
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const contract = new ethers.Contract(contractAddress, MOCK_USDC_ABI, provider);

  const filter = contract.filters.Transfer?.();
  if (!filter) throw new Error("Transfer event not found in contract");
  const events = await contract.queryFilter(filter, fromBlock, toBlock);

  return events.map((event: any) => ({
    from: event.args?.[0] ?? "",
    to: event.args?.[1] ?? "",
    amount: event.args?.[2] ?? 0n,
    txHash: event.transactionHash,
    blockNumber: event.blockNumber,
  }));
}

/** Submit a hybrid transfer (bank → on-chain) */
export async function executeHybridTransfer(params: {
  transactionId: string;
  toAddress: string;
  amountUSDC: bigint;
}): Promise<void> {
  const bankNonce = getBankNonce();

  markSubmittedOnchain(params.transactionId, "pending");

  const result = await submitTransfer(params.toAddress, params.amountUSDC, bankNonce);

  if (result.success) {
    markSuccess(params.transactionId, result.txHash);
  } else {
    markFailed(params.transactionId, result.error);
  }
}
