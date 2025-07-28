import { expect } from "chai";
import { ethers } from "hardhat";
import { SwapSageHTLC } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("SwapSageHTLC Smoke Tests", function () {
  let htlc: SwapSageHTLC;
  let deployer: HardhatEthersSigner;
  let beneficiary: HardhatEthersSigner;
  let originator: HardhatEthersSigner;

  // Use a 32-byte preimage (bytes32)
  const SECRET_PREIMAGE = "0x" + "a".repeat(64); // 32 bytes hex string
  const HASH_LOCK = ethers.sha256(SECRET_PREIMAGE);
  const LOCK_AMOUNT = ethers.parseEther("0.01");
  
  beforeEach(async function () {
    // Get signers
    [deployer, beneficiary, originator] = await ethers.getSigners();

    // Deploy fresh contract for each test
    const SwapSageHTLC = await ethers.getContractFactory("SwapSageHTLC");
    htlc = await SwapSageHTLC.deploy();
    await htlc.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should deploy successfully and have correct initial state", async function () {
      const contractAddress = await htlc.getAddress();
      expect(contractAddress).to.properAddress;
      
      // Verify contract has code
      const code = await ethers.provider.getCode(contractAddress);
      expect(code).to.not.equal("0x");
    });

    it("Should have working time function", async function () {
      const currentTime = await htlc.getCurrentTime();
      expect(currentTime).to.be.gt(0);
    });
  });

  describe("ETH HTLC Flow", function () {
    let contractId: string;
    let timelock: number;

    beforeEach(async function () {
      // Generate unique contract ID
      contractId = ethers.keccak256(ethers.toUtf8Bytes(`contract_${Date.now()}_${Math.random()}`));
      
      // Set timelock 1 hour in the future
      const currentTime = await htlc.getCurrentTime();
      timelock = Number(currentTime) + 3600;
    });

    it("Should complete full lock → claim flow with ETH", async function () {
      // 1. Fund the HTLC
      const fundTx = await htlc.connect(originator).fund(
        contractId,
        ethers.ZeroAddress, // ETH
        beneficiary.address,
        HASH_LOCK,
        timelock,
        LOCK_AMOUNT,
        { value: LOCK_AMOUNT }
      );

      await expect(fundTx)
        .to.emit(htlc, "Funded")
        .withArgs(
          contractId,
          originator.address,
          beneficiary.address,
          ethers.ZeroAddress,
          LOCK_AMOUNT,
          HASH_LOCK,
          timelock
        );

      // 2. Verify contract state
      const details = await htlc.getDetails(contractId);
      expect(details.token).to.equal(ethers.ZeroAddress);
      expect(details.beneficiary).to.equal(beneficiary.address);
      expect(details.originator).to.equal(originator.address);
      expect(details.value).to.equal(LOCK_AMOUNT);
      expect(details.state).to.equal(1); // OPEN

      // 3. Verify claimable
      expect(await htlc.isClaimable(contractId)).to.be.true;
      expect(await htlc.isRefundable(contractId)).to.be.false;

      // 4. Record balances before claim
      const beneficiaryBalanceBefore = await ethers.provider.getBalance(beneficiary.address);
      const contractBalanceBefore = await ethers.provider.getBalance(await htlc.getAddress());
      
      expect(contractBalanceBefore).to.equal(LOCK_AMOUNT);

      // 5. Claim with correct preimage
      const preimage = SECRET_PREIMAGE;
      const claimTx = await htlc.connect(beneficiary).claim(contractId, preimage);

      await expect(claimTx)
        .to.emit(htlc, "Claimed")
        .withArgs(contractId, beneficiary.address, preimage, LOCK_AMOUNT);

      // 6. Verify balances after claim
      const beneficiaryBalanceAfter = await ethers.provider.getBalance(beneficiary.address);
      const contractBalanceAfter = await ethers.provider.getBalance(await htlc.getAddress());

      expect(contractBalanceAfter).to.equal(0);
      
      // Account for gas costs (should be close to LOCK_AMOUNT increase)
      const balanceIncrease = beneficiaryBalanceAfter - beneficiaryBalanceBefore;
      expect(balanceIncrease).to.be.gt(ethers.parseEther("0.009")); // Account for gas
      expect(balanceIncrease).to.be.lte(LOCK_AMOUNT);

      // 7. Verify final state
      const finalDetails = await htlc.getDetails(contractId);
      expect(finalDetails.state).to.equal(2); // CLAIMED
      expect(await htlc.isClaimable(contractId)).to.be.false;
      expect(await htlc.isRefundable(contractId)).to.be.false;
    });

    it("Should prevent claim with wrong preimage", async function () {
      // Fund the HTLC
      await htlc.connect(originator).fund(
        contractId,
        ethers.ZeroAddress,
        beneficiary.address,
        HASH_LOCK,
        timelock,
        LOCK_AMOUNT,
        { value: LOCK_AMOUNT }
      );

      // Try to claim with wrong preimage
      const wrongPreimage = "0x" + "b".repeat(64); // Different 32-byte value
      
      await expect(
        htlc.connect(beneficiary).claim(contractId, wrongPreimage)
      ).to.be.revertedWith("Invalid preimage");
    });

    it("Should allow refund after timelock expires", async function () {
      // Fund the HTLC with short timelock
      const currentTime = Number(await htlc.getCurrentTime());
      const shortTimelock = currentTime + 10; // 10 seconds in future
      
      await htlc.connect(originator).fund(
        contractId,
        ethers.ZeroAddress,
        beneficiary.address,
        HASH_LOCK,
        shortTimelock,
        LOCK_AMOUNT,
        { value: LOCK_AMOUNT }
      );

      // Fast forward time by mining blocks (Hardhat specific)
      await ethers.provider.send("evm_increaseTime", [15]);
      await ethers.provider.send("evm_mine", []);

      // Record balances
      const originatorBalanceBefore = await ethers.provider.getBalance(originator.address);

      // Refund
      const refundTx = await htlc.connect(originator).refund(contractId);

      await expect(refundTx)
        .to.emit(htlc, "Refunded")
        .withArgs(contractId, originator.address, LOCK_AMOUNT);

      // Verify balance increase (accounting for gas)
      const originatorBalanceAfter = await ethers.provider.getBalance(originator.address);
      const balanceIncrease = originatorBalanceAfter - originatorBalanceBefore;
      expect(balanceIncrease).to.be.gt(ethers.parseEther("0.009")); // Account for gas
    });

    it("Should prevent double funding same contract ID", async function () {
      // Fund once
      await htlc.connect(originator).fund(
        contractId,
        ethers.ZeroAddress,
        beneficiary.address,
        HASH_LOCK,
        timelock,
        LOCK_AMOUNT,
        { value: LOCK_AMOUNT }
      );

      // Try to fund again with same ID
      await expect(
        htlc.connect(originator).fund(
          contractId,
          ethers.ZeroAddress,
          beneficiary.address,
          HASH_LOCK,
          timelock,
          LOCK_AMOUNT,
          { value: LOCK_AMOUNT }
        )
      ).to.be.revertedWith("Swap already exists");
    });
  });

  describe("Security & Access Control", function () {
    let contractId: string;
    let timelock: number;

    beforeEach(async function () {
      contractId = ethers.keccak256(ethers.toUtf8Bytes(`security_test_${Date.now()}`));
      timelock = Number(await htlc.getCurrentTime()) + 3600;

      // Fund the contract
      await htlc.connect(originator).fund(
        contractId,
        ethers.ZeroAddress,
        beneficiary.address,
        HASH_LOCK,
        timelock,
        LOCK_AMOUNT,
        { value: LOCK_AMOUNT }
      );
    });

    it("Should only allow beneficiary to claim", async function () {
      const preimage = SECRET_PREIMAGE;
      
      // Wrong person tries to claim
      await expect(
        htlc.connect(originator).claim(contractId, preimage)
      ).to.be.revertedWith("Only beneficiary can claim");
    });

    it("Should only allow originator to refund", async function () {
      // Fast forward past timelock
      await ethers.provider.send("evm_increaseTime", [3601]);
      await ethers.provider.send("evm_mine", []);

      // Wrong person tries to refund
      await expect(
        htlc.connect(beneficiary).refund(contractId)
      ).to.be.revertedWith("Only originator can refund");
    });

    it("Should prevent claim after timelock expires", async function () {
      // Fast forward past timelock
      await ethers.provider.send("evm_increaseTime", [3601]);
      await ethers.provider.send("evm_mine", []);

      const preimage = SECRET_PREIMAGE;
      
      await expect(
        htlc.connect(beneficiary).claim(contractId, preimage)
      ).to.be.revertedWith("Timelock has expired");
    });

    it("Should prevent refund before timelock expires", async function () {
      await expect(
        htlc.connect(originator).refund(contractId)
      ).to.be.revertedWith("Timelock has not expired");
    });
  });
});