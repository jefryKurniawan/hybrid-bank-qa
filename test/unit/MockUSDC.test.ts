/**
 * Unit tests for MockUSDC smart contract
 * Tests: ERC20 functions, mint/burn (owner-only), nonce tracking, events
 */
import { expect } from "chai";
import { ethers } from "hardhat";
import { MockUSDC } from "../../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("MockUSDC", function () {
  let mockUSDC: MockUSDC;
  let owner: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;

  const MINT_AMOUNT = ethers.parseUnits("1000000", 6); // 1M USDC
  const TRANSFER_AMOUNT = ethers.parseUnits("100000", 6); // 100K USDC

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    const MockUSDCFactory = await ethers.getContractFactory("MockUSDC");
    mockUSDC = await MockUSDCFactory.deploy();
    await mockUSDC.waitForDeployment();
  });

  describe("Deployment", function () {
    it("should set correct name and symbol", async function () {
      expect(await mockUSDC.name()).to.equal("Mock USDC");
      expect(await mockUSDC.symbol()).to.equal("USDC");
    });

    it("should set 6 decimals (same as real USDC)", async function () {
      expect(await mockUSDC.decimals()).to.equal(6);
    });

    it("should set deployer as owner", async function () {
      expect(await mockUSDC.owner()).to.equal(owner.address);
    });

    it("should start with zero total supply", async function () {
      expect(await mockUSDC.totalSupply()).to.equal(0);
    });
  });

  describe("Mint (FR8)", function () {
    it("should allow owner to mint tokens", async function () {
      await mockUSDC.mint(user1.address, MINT_AMOUNT);

      expect(await mockUSDC.balanceOf(user1.address)).to.equal(MINT_AMOUNT);
      expect(await mockUSDC.totalSupply()).to.equal(MINT_AMOUNT);
    });

    it("should emit Transfer event on mint (from zero address)", async function () {
      await expect(mockUSDC.mint(user1.address, MINT_AMOUNT))
        .to.emit(mockUSDC, "Transfer")
        .withArgs(ethers.ZeroAddress, user1.address, MINT_AMOUNT);
    });

    it("should emit Mint event", async function () {
      await expect(mockUSDC.mint(user1.address, MINT_AMOUNT))
        .to.emit(mockUSDC, "Mint")
        .withArgs(user1.address, MINT_AMOUNT);
    });

    it("should revert if non-owner tries to mint", async function () {
      await expect(
        mockUSDC.connect(user1).mint(user1.address, MINT_AMOUNT)
      ).to.be.revertedWithCustomError(mockUSDC, "OwnableUnauthorizedAccount");
    });

    it("should revert if minting to zero address", async function () {
      await expect(
        mockUSDC.mint(ethers.ZeroAddress, MINT_AMOUNT)
      ).to.be.revertedWithCustomError(mockUSDC, "InvalidAddress");
    });

    it("should revert if minting zero amount", async function () {
      await expect(
        mockUSDC.mint(user1.address, 0)
      ).to.be.revertedWithCustomError(mockUSDC, "ZeroAmount");
    });
  });

  describe("Transfer (FR6, FR7)", function () {
    beforeEach(async function () {
      await mockUSDC.mint(user1.address, MINT_AMOUNT);
    });

    it("should transfer tokens between accounts", async function () {
      await mockUSDC.connect(user1).transfer(user2.address, TRANSFER_AMOUNT);

      expect(await mockUSDC.balanceOf(user1.address)).to.equal(MINT_AMOUNT - TRANSFER_AMOUNT);
      expect(await mockUSDC.balanceOf(user2.address)).to.equal(TRANSFER_AMOUNT);
    });

    it("should emit Transfer event (FR7)", async function () {
      await expect(mockUSDC.connect(user1).transfer(user2.address, TRANSFER_AMOUNT))
        .to.emit(mockUSDC, "Transfer")
        .withArgs(user1.address, user2.address, TRANSFER_AMOUNT);
    });

    it("should revert if insufficient balance", async function () {
      const tooMuch = MINT_AMOUNT + 1n;
      await expect(
        mockUSDC.connect(user1).transfer(user2.address, tooMuch)
      ).to.be.revertedWithCustomError(mockUSDC, "InsufficientBalance");
    });

    it("should revert if transferring to zero address", async function () {
      await expect(
        mockUSDC.connect(user1).transfer(ethers.ZeroAddress, TRANSFER_AMOUNT)
      ).to.be.revertedWithCustomError(mockUSDC, "InvalidAddress");
    });

    it("should revert if transferring zero amount", async function () {
      await expect(
        mockUSDC.connect(user1).transfer(user2.address, 0)
      ).to.be.revertedWithCustomError(mockUSDC, "ZeroAmount");
    });
  });

  describe("Approve & TransferFrom (FR6)", function () {
    beforeEach(async function () {
      await mockUSDC.mint(user1.address, MINT_AMOUNT);
    });

    it("should set allowance correctly", async function () {
      await mockUSDC.connect(user1).approve(user2.address, TRANSFER_AMOUNT);
      expect(await mockUSDC.allowance(user1.address, user2.address)).to.equal(TRANSFER_AMOUNT);
    });

    it("should emit Approval event", async function () {
      await expect(mockUSDC.connect(user1).approve(user2.address, TRANSFER_AMOUNT))
        .to.emit(mockUSDC, "Approval")
        .withArgs(user1.address, user2.address, TRANSFER_AMOUNT);
    });

    it("should allow transferFrom with sufficient allowance", async function () {
      await mockUSDC.connect(user1).approve(user2.address, TRANSFER_AMOUNT);
      await mockUSDC.connect(user2).transferFrom(user1.address, user2.address, TRANSFER_AMOUNT);

      expect(await mockUSDC.balanceOf(user2.address)).to.equal(TRANSFER_AMOUNT);
      expect(await mockUSDC.allowance(user1.address, user2.address)).to.equal(0);
    });

    it("should revert transferFrom with insufficient allowance", async function () {
      await mockUSDC.connect(user1).approve(user2.address, TRANSFER_AMOUNT / 2n);
      await expect(
        mockUSDC.connect(user2).transferFrom(user1.address, user2.address, TRANSFER_AMOUNT)
      ).to.be.revertedWithCustomError(mockUSDC, "InsufficientAllowance");
    });
  });

  describe("Burn", function () {
    beforeEach(async function () {
      await mockUSDC.mint(user1.address, MINT_AMOUNT);
    });

    it("should allow owner to burn tokens", async function () {
      await mockUSDC.burn(user1.address, TRANSFER_AMOUNT);

      expect(await mockUSDC.balanceOf(user1.address)).to.equal(MINT_AMOUNT - TRANSFER_AMOUNT);
      expect(await mockUSDC.totalSupply()).to.equal(MINT_AMOUNT - TRANSFER_AMOUNT);
    });

    it("should emit Burn and Transfer events", async function () {
      await expect(mockUSDC.burn(user1.address, TRANSFER_AMOUNT))
        .to.emit(mockUSDC, "Burn")
        .withArgs(user1.address, TRANSFER_AMOUNT);
    });

    it("should revert if non-owner tries to burn", async function () {
      await expect(
        mockUSDC.connect(user1).burn(user1.address, TRANSFER_AMOUNT)
      ).to.be.revertedWithCustomError(mockUSDC, "OwnableUnauthorizedAccount");
    });

    it("should revert if burning more than balance", async function () {
      const tooMuch = MINT_AMOUNT + 1n;
      await expect(
        mockUSDC.burn(user1.address, tooMuch)
      ).to.be.revertedWithCustomError(mockUSDC, "InsufficientBalance");
    });
  });

  describe("Nonce Tracking (FR10)", function () {
    it("should start with nonce 0", async function () {
      expect(await mockUSDC.getNonce(user1.address)).to.equal(0);
    });

    it("should increment nonce correctly", async function () {
      await mockUSDC.incrementNonce(user1.address);
      expect(await mockUSDC.getNonce(user1.address)).to.equal(1);

      await mockUSDC.incrementNonce(user1.address);
      expect(await mockUSDC.getNonce(user1.address)).to.equal(2);
    });

    it("should track nonces independently per address", async function () {
      await mockUSDC.incrementNonce(user1.address);
      await mockUSDC.incrementNonce(user1.address);
      await mockUSDC.incrementNonce(user2.address);

      expect(await mockUSDC.getNonce(user1.address)).to.equal(2);
      expect(await mockUSDC.getNonce(user2.address)).to.equal(1);
    });
  });

  describe("Balance Accuracy (FR9)", function () {
    it("should be accurate after multiple operations", async function () {
      // Mint
      await mockUSDC.mint(user1.address, MINT_AMOUNT);
      expect(await mockUSDC.balanceOf(user1.address)).to.equal(MINT_AMOUNT);

      // Transfer
      await mockUSDC.connect(user1).transfer(user2.address, TRANSFER_AMOUNT);
      expect(await mockUSDC.balanceOf(user1.address)).to.equal(MINT_AMOUNT - TRANSFER_AMOUNT);
      expect(await mockUSDC.balanceOf(user2.address)).to.equal(TRANSFER_AMOUNT);

      // Approve + TransferFrom
      await mockUSDC.connect(user2).approve(user1.address, TRANSFER_AMOUNT / 2n);
      await mockUSDC.connect(user1).transferFrom(user2.address, user1.address, TRANSFER_AMOUNT / 2n);

      expect(await mockUSDC.balanceOf(user1.address)).to.equal(MINT_AMOUNT - TRANSFER_AMOUNT / 2n);
      expect(await mockUSDC.balanceOf(user2.address)).to.equal(TRANSFER_AMOUNT / 2n);

      // Burn
      await mockUSDC.burn(user1.address, TRANSFER_AMOUNT / 4n);
      expect(await mockUSDC.balanceOf(user1.address)).to.equal(MINT_AMOUNT - TRANSFER_AMOUNT / 2n - TRANSFER_AMOUNT / 4n);
    });
  });
});
