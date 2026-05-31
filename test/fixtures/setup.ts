/**
 * Test fixtures — Shared setup for Hardhat tests
 */
import { ethers } from "hardhat";
import { MockUSDC } from "../../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

export interface TestContext {
  mockUSDC: MockUSDC;
  owner: HardhatEthersSigner;
  user1: HardhatEthersSigner;
  user2: HardhatEthersSigner;
  bank: HardhatEthersSigner;
}

/**
 * Deploy MockUSDC and return test context
 */
export async function deployMockUSDC(): Promise<TestContext> {
  const [owner, user1, user2, bank] = await ethers.getSigners();

  const MockUSDCFactory = await ethers.getContractFactory("MockUSDC");
  const mockUSDC = await MockUSDCFactory.deploy();
  await mockUSDC.waitForDeployment();

  return { mockUSDC, owner, user1, user2, bank };
}

/**
 * Mint tokens to an address
 */
export async function mintTokens(
  mockUSDC: MockUSDC,
  to: string,
  amount: bigint
): Promise<void> {
  const tx = await mockUSDC.mint(to, amount);
  await tx.wait();
}
