import hre from "hardhat";

async function main() {
  const signers = await hre.ethers.getSigners();
  const deployer = signers[0];
  if (!deployer) throw new Error("No deployer account found");

  console.log("Deploying MockUSDC with account:", deployer.address);

  const MockUSDC = await hre.ethers.getContractFactory("MockUSDC");
  const usdc = await MockUSDC.deploy();
  await usdc.waitForDeployment();

  const address = await usdc.getAddress();
  console.log("MockUSDC deployed to:", address);

  // Mint initial supply for testing (1,000,000 USDC)
  const mintAmount = 1_000_000n * 10n ** 6n;
  const mintFn = usdc.mint as ((to: string, amount: bigint) => Promise<any>) | undefined;
  if (!mintFn) throw new Error("mint function not found on contract");
  const tx = await mintFn(deployer.address, mintAmount);
  await tx.wait();
  console.log(`Minted 1,000,000 mUSDC to ${deployer.address}`);

  console.log("\nDeployment Summary:");
  console.log("===================");
  console.log(`Contract: ${address}`);
  console.log(`Owner: ${deployer.address}`);
  console.log(`\nAdd to .env: MOCK_USDC_ADDRESS=${address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
