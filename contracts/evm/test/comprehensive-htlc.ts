import { expect } from "chai";
import { ethers } from "hardhat";
import { SwapSageHTLC } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("SwapSageHTLC Comprehensive Tests", function () {
  async function deployHTLCFixture() {
    const [deployer, alice, bob, charlie, attacker] = await ethers.getSigners();
    
    const SwapSageHTLC = await ethers.getContractFactory("SwapSageHTLC");
    const htlc = await SwapSageHTLC.deploy();
    await htlc.waitForDeployment();
    
    // Deploy a mock ERC20 token for testing
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const token = await MockERC20.deploy("Test Token", "TEST", ethers.parseEther("1000000"));
    await token.waitForDeployment();
    
    // Transfer tokens to test accounts
    await token.transfer(alice.address, ethers.parseEther("1000"));
    await token.transfer(bob.address, ethers.parseEther("1000"));
    
    return { htlc, token, deployer, alice, bob, charlie, attacker };
  }

  describe("Advanced HTLC Scenarios", function () {
    const SECRET_32_BYTES = "0x" + "a".repeat(64);
    const HASH_LOCK = ethers.sha256(SECRET_32_BYTES);
    const AMOUNT = ethers.parseEther("1");

    it("Should handle multiple concurrent HTLCs", async function () {
      const { htlc, alice, bob, charlie } = await loadFixture(deployHTLCFixture);
      
      const currentTime = Number(await htlc.getCurrentTime());
      const timelock = currentTime + 3600;
      
      // Create multiple HTLCs with different contract IDs
      const contracts = [];
      for (let i = 0; i < 5; i++) {
        const contractId = ethers.keccak256(ethers.toUtf8Bytes(`contract_${i}_${Date.now()}`));
        contracts.push(contractId);
        
        await htlc.connect(alice).fund(
          contractId,
          ethers.ZeroAddress,
          i % 2 === 0 ? bob.address : charlie.address,
          HASH_LOCK,
          timelock,
          AMOUNT,
          { value: AMOUNT }
        );
      }
      
      // Verify all contracts are open
      for (const contractId of contracts) {
        const details = await htlc.getDetails(contractId);
        expect(details.state).to.equal(1); // OPEN
        expect(await htlc.isClaimable(contractId)).to.be.true;
      }
      
      // Claim some and refund others
      for (let i = 0; i < contracts.length; i++) {
        if (i < 3) {
          // Claim first 3
          const beneficiary = i % 2 === 0 ? bob : charlie;
          await htlc.connect(beneficiary).claim(contracts[i], SECRET_32_BYTES);
          
          const details = await htlc.getDetails(contracts[i]);
          expect(details.state).to.equal(2); // CLAIMED
        } else {
          // Let last 2 expire for refund test later
          continue;
        }
      }
    });

    it("Should handle very large amounts", async function () {
      const { htlc, alice, bob } = await loadFixture(deployHTLCFixture);
      
      const largeAmount = ethers.parseEther("100"); // 100 ETH
      const contractId = ethers.keccak256(ethers.toUtf8Bytes(`large_${Date.now()}`));
      const timelock = Number(await htlc.getCurrentTime()) + 3600;
      
      // Fund with large amount
      await htlc.connect(alice).fund(
        contractId,
        ethers.ZeroAddress,
        bob.address,
        HASH_LOCK,
        timelock,
        largeAmount,
        { value: largeAmount }
      );
      
      const balanceBefore = await ethers.provider.getBalance(bob.address);
      
      await htlc.connect(bob).claim(contractId, SECRET_32_BYTES);
      
      const balanceAfter = await ethers.provider.getBalance(bob.address);
      const increase = balanceAfter - balanceBefore;
      
      // Should be close to largeAmount (minus gas costs)
      expect(increase).to.be.gt(ethers.parseEther("99.9"));
      expect(increase).to.be.lte(largeAmount);
    });

    it("Should handle minimum viable amounts", async function () {
      const { htlc, alice, bob } = await loadFixture(deployHTLCFixture);
      
      const minAmount = 1n; // 1 wei
      const contractId = ethers.keccak256(ethers.toUtf8Bytes(`min_${Date.now()}`));
      const timelock = Number(await htlc.getCurrentTime()) + 3600;
      
      await htlc.connect(alice).fund(
        contractId,
        ethers.ZeroAddress,
        bob.address,
        HASH_LOCK,
        timelock,
        minAmount,
        { value: minAmount }
      );
      
      await htlc.connect(bob).claim(contractId, SECRET_32_BYTES);
      
      const details = await htlc.getDetails(contractId);
      expect(details.state).to.equal(2); // CLAIMED
      expect(details.value).to.equal(minAmount);
    });

    it("Should handle timelock edge cases", async function () {
      const { htlc, alice, bob } = await loadFixture(deployHTLCFixture);
      
      const currentTime = Number(await htlc.getCurrentTime());
      
      // Test with timelock 1 second in the future
      const nearFutureTimelock = currentTime + 1;
      const contractId1 = ethers.keccak256(ethers.toUtf8Bytes(`near_future_${Date.now()}`));
      
      await htlc.connect(alice).fund(
        contractId1,
        ethers.ZeroAddress,
        bob.address,
        HASH_LOCK,
        nearFutureTimelock,
        AMOUNT,
        { value: AMOUNT }
      );
      
      // Should be claimable immediately
      expect(await htlc.isClaimable(contractId1)).to.be.true;
      
      // Test with very far future timelock
      const farFutureTimelock = currentTime + 365 * 24 * 3600; // 1 year
      const contractId2 = ethers.keccak256(ethers.toUtf8Bytes(`far_future_${Date.now()}`));
      
      await htlc.connect(alice).fund(
        contractId2,
        ethers.ZeroAddress,
        bob.address,
        HASH_LOCK,
        farFutureTimelock,
        AMOUNT,
        { value: AMOUNT }
      );
      
      expect(await htlc.isClaimable(contractId2)).to.be.true;
      expect(await htlc.isRefundable(contractId2)).to.be.false;
    });
  });

  describe("ERC20 Token Support", function () {
    const SECRET = "0x" + "b".repeat(64);
    const HASH = ethers.sha256(SECRET);
    const TOKEN_AMOUNT = ethers.parseEther("10");

    it("Should handle ERC20 token HTLCs", async function () {
      const { htlc, token, alice, bob } = await loadFixture(deployHTLCFixture);
      
      const contractId = ethers.keccak256(ethers.toUtf8Bytes(`erc20_${Date.now()}`));
      const timelock = Number(await htlc.getCurrentTime()) + 3600;
      
      // Approve and fund with ERC20
      await token.connect(alice).approve(await htlc.getAddress(), TOKEN_AMOUNT);
      
      await htlc.connect(alice).fund(
        contractId,
        await token.getAddress(),
        bob.address,
        HASH,
        timelock,
        TOKEN_AMOUNT
      );
      
      // Verify token transfer
      const htlcBalance = await token.balanceOf(await htlc.getAddress());
      expect(htlcBalance).to.equal(TOKEN_AMOUNT);
      
      // Claim tokens
      const bobBalanceBefore = await token.balanceOf(bob.address);
      await htlc.connect(bob).claim(contractId, SECRET);
      const bobBalanceAfter = await token.balanceOf(bob.address);
      
      expect(bobBalanceAfter - bobBalanceBefore).to.equal(TOKEN_AMOUNT);
    });

    it("Should handle ERC20 refunds", async function () {
      const { htlc, token, alice, bob } = await loadFixture(deployHTLCFixture);
      
      const contractId = ethers.keccak256(ethers.toUtf8Bytes(`erc20_refund_${Date.now()}`));
      const shortTimelock = Number(await htlc.getCurrentTime()) + 5;
      
      await token.connect(alice).approve(await htlc.getAddress(), TOKEN_AMOUNT);
      
      await htlc.connect(alice).fund(
        contractId,
        await token.getAddress(),
        bob.address,
        HASH,
        shortTimelock,
        TOKEN_AMOUNT
      );
      
      // Wait for timelock to expire
      await ethers.provider.send("evm_increaseTime", [10]);
      await ethers.provider.send("evm_mine", []);
      
      const aliceBalanceBefore = await token.balanceOf(alice.address);
      await htlc.connect(alice).refund(contractId);
      const aliceBalanceAfter = await token.balanceOf(alice.address);
      
      expect(aliceBalanceAfter - aliceBalanceBefore).to.equal(TOKEN_AMOUNT);
    });

    it("Should reject ETH sent with ERC20 HTLCs", async function () {
      const { htlc, token, alice, bob } = await loadFixture(deployHTLCFixture);
      
      const contractId = ethers.keccak256(ethers.toUtf8Bytes(`mixed_${Date.now()}`));
      const timelock = Number(await htlc.getCurrentTime()) + 3600;
      
      await token.connect(alice).approve(await htlc.getAddress(), TOKEN_AMOUNT);
      
      await expect(
        htlc.connect(alice).fund(
          contractId,
          await token.getAddress(),
          bob.address,
          HASH,
          timelock,
          TOKEN_AMOUNT,
          { value: ethers.parseEther("1") } // Should not send ETH with ERC20
        )
      ).to.be.revertedWith("ETH not accepted for token swaps");
    });
  });

  describe("Security and Attack Resistance", function () {
    const SECRET = "0x" + "c".repeat(64);
    const HASH = ethers.sha256(SECRET);
    const AMOUNT = ethers.parseEther("1");

    it("Should prevent reentrancy attacks", async function () {
      const { htlc, alice, bob } = await loadFixture(deployHTLCFixture);
      
      // Deploy a malicious contract that tries to reenter
      const MaliciousContract = await ethers.getContractFactory("MaliciousReentrancy");
      const malicious = await MaliciousContract.deploy(await htlc.getAddress());
      
      const contractId = ethers.keccak256(ethers.toUtf8Bytes(`reentrancy_${Date.now()}`));
      const timelock = Number(await htlc.getCurrentTime()) + 3600;
      
      // Fund HTLC with malicious contract as beneficiary
      await htlc.connect(alice).fund(
        contractId,
        ethers.ZeroAddress,
        await malicious.getAddress(),
        HASH,
        timelock,
        AMOUNT,
        { value: AMOUNT }
      );
      
      // Try to claim - should fail due to reentrancy guard
      await expect(
        malicious.attemptReentrancy(contractId, SECRET)
      ).to.be.revertedWith("ReentrancyGuard: reentrant call");
    });

    it("Should resist front-running attacks", async function () {
      const { htlc, alice, bob, attacker } = await loadFixture(deployHTLCFixture);
      
      const contractId = ethers.keccak256(ethers.toUtf8Bytes(`frontrun_${Date.now()}`));
      const timelock = Number(await htlc.getCurrentTime()) + 3600;
      
      await htlc.connect(alice).fund(
        contractId,
        ethers.ZeroAddress,
        bob.address,
        HASH,
        timelock,
        AMOUNT,
        { value: AMOUNT }
      );
      
      // Attacker tries to claim but they're not the beneficiary
      await expect(
        htlc.connect(attacker).claim(contractId, SECRET)
      ).to.be.revertedWith("Only beneficiary can claim");
      
      // Legitimate claim should still work
      await htlc.connect(bob).claim(contractId, SECRET);
      
      const details = await htlc.getDetails(contractId);
      expect(details.state).to.equal(2); // CLAIMED
    });

    it("Should handle contract with same preimage but different hash", async function () {
      const { htlc, alice, bob } = await loadFixture(deployHTLCFixture);
      
      const preimage = "test_secret";
      const correctHash = ethers.sha256(ethers.toUtf8Bytes(preimage));
      const wrongHash = ethers.keccak256(ethers.toUtf8Bytes(preimage)); // Wrong hash function
      
      const contractId = ethers.keccak256(ethers.toUtf8Bytes(`hash_test_${Date.now()}`));
      const timelock = Number(await htlc.getCurrentTime()) + 3600;
      
      // Fund with correct SHA256 hash
      await htlc.connect(alice).fund(
        contractId,
        ethers.ZeroAddress,
        bob.address,
        correctHash,
        timelock,
        AMOUNT,
        { value: AMOUNT }
      );
      
      // Try to claim with preimage that produces wrong hash when hashed with SHA256
      await expect(
        htlc.connect(bob).claim(contractId, wrongHash)
      ).to.be.revertedWith("Invalid preimage");
    });

    it("Should handle gas limit attacks", async function () {
      const { htlc, alice, bob } = await loadFixture(deployHTLCFixture);
      
      const contractId = ethers.keccak256(ethers.toUtf8Bytes(`gas_test_${Date.now()}`));
      const timelock = Number(await htlc.getCurrentTime()) + 3600;
      
      await htlc.connect(alice).fund(
        contractId,
        ethers.ZeroAddress,
        bob.address,
        HASH,
        timelock,
        AMOUNT,
        { value: AMOUNT }
      );
      
      // Try to claim with very low gas limit - should still work or fail gracefully
      try {
        await htlc.connect(bob).claim(contractId, SECRET, { gasLimit: 50000 });
      } catch (error) {
        // If it fails due to gas, that's expected behavior
        expect(error.message).to.include("gas");
      }
      
      // Normal claim should work
      await htlc.connect(bob).claim(contractId, SECRET);
      
      const details = await htlc.getDetails(contractId);
      expect(details.state).to.equal(2); // CLAIMED
    });
  });

  describe("Edge Cases and Error Handling", function () {
    const SECRET = "0x" + "d".repeat(64);
    const HASH = ethers.sha256(SECRET);
    const AMOUNT = ethers.parseEther("1");

    it("Should handle zero address scenarios", async function () {
      const { htlc, alice } = await loadFixture(deployHTLCFixture);
      
      const contractId = ethers.keccak256(ethers.toUtf8Bytes(`zero_addr_${Date.now()}`));
      const timelock = Number(await htlc.getCurrentTime()) + 3600;
      
      // Should reject zero address as beneficiary
      await expect(
        htlc.connect(alice).fund(
          contractId,
          ethers.ZeroAddress,
          ethers.ZeroAddress,
          HASH,
          timelock,
          AMOUNT,
          { value: AMOUNT }
        )
      ).to.be.revertedWith("Invalid beneficiary address");
    });

    it("Should handle zero hash lock", async function () {
      const { htlc, alice, bob } = await loadFixture(deployHTLCFixture);
      
      const contractId = ethers.keccak256(ethers.toUtf8Bytes(`zero_hash_${Date.now()}`));
      const timelock = Number(await htlc.getCurrentTime()) + 3600;
      
      await expect(
        htlc.connect(alice).fund(
          contractId,
          ethers.ZeroAddress,
          bob.address,
          ethers.ZeroHash,
          timelock,
          AMOUNT,
          { value: AMOUNT }
        )
      ).to.be.revertedWith("Invalid hash lock");
    });

    it("Should handle past timelock", async function () {
      const { htlc, alice, bob } = await loadFixture(deployHTLCFixture);
      
      const contractId = ethers.keccak256(ethers.toUtf8Bytes(`past_time_${Date.now()}`));
      const pastTime = Number(await htlc.getCurrentTime()) - 3600; // 1 hour ago
      
      await expect(
        htlc.connect(alice).fund(
          contractId,
          ethers.ZeroAddress,
          bob.address,
          HASH,
          pastTime,
          AMOUNT,
          { value: AMOUNT }
        )
      ).to.be.revertedWith("Timelock must be in the future");
    });

    it("Should handle zero value", async function () {
      const { htlc, alice, bob } = await loadFixture(deployHTLCFixture);
      
      const contractId = ethers.keccak256(ethers.toUtf8Bytes(`zero_value_${Date.now()}`));
      const timelock = Number(await htlc.getCurrentTime()) + 3600;
      
      await expect(
        htlc.connect(alice).fund(
          contractId,
          ethers.ZeroAddress,
          bob.address,
          HASH,
          timelock,
          0, // Zero value
          { value: 0 }
        )
      ).to.be.revertedWith("Value must be greater than 0");
    });

    it("Should handle mismatched ETH value", async function () {
      const { htlc, alice, bob } = await loadFixture(deployHTLCFixture);
      
      const contractId = ethers.keccak256(ethers.toUtf8Bytes(`mismatch_${Date.now()}`));
      const timelock = Number(await htlc.getCurrentTime()) + 3600;
      
      await expect(
        htlc.connect(alice).fund(
          contractId,
          ethers.ZeroAddress,
          bob.address,
          HASH,
          timelock,
          AMOUNT,
          { value: AMOUNT / 2n } // Mismatched value
        )
      ).to.be.revertedWith("ETH value mismatch");
    });

    it("Should handle operations on non-existent contracts", async function () {
      const { htlc, alice, bob } = await loadFixture(deployHTLCFixture);
      
      const nonExistentId = ethers.keccak256(ethers.toUtf8Bytes(`non_existent_${Date.now()}`));
      
      // Try to claim non-existent contract
      await expect(
        htlc.connect(bob).claim(nonExistentId, SECRET)
      ).to.be.revertedWith("Swap does not exist or is not open");
      
      // Try to refund non-existent contract
      await expect(
        htlc.connect(alice).refund(nonExistentId)
      ).to.be.revertedWith("Swap does not exist or is not open");
      
      // Check details of non-existent contract
      const details = await htlc.getDetails(nonExistentId);
      expect(details.state).to.equal(0); // INVALID
    });

    it("Should handle double operations", async function () {
      const { htlc, alice, bob } = await loadFixture(deployHTLCFixture);
      
      const contractId = ethers.keccak256(ethers.toUtf8Bytes(`double_op_${Date.now()}`));
      const timelock = Number(await htlc.getCurrentTime()) + 3600;
      
      await htlc.connect(alice).fund(
        contractId,
        ethers.ZeroAddress,
        bob.address,
        HASH,
        timelock,
        AMOUNT,
        { value: AMOUNT }
      );
      
      // First claim
      await htlc.connect(bob).claim(contractId, SECRET);
      
      // Try to claim again
      await expect(
        htlc.connect(bob).claim(contractId, SECRET)
      ).to.be.revertedWith("Swap does not exist or is not open");
      
      // Try to refund after claim
      await expect(
        htlc.connect(alice).refund(contractId)
      ).to.be.revertedWith("Swap does not exist or is not open");
    });
  });

  describe("Gas Optimization Tests", function () {
    it("Should report gas usage for common operations", async function () {
      const { htlc, alice, bob } = await loadFixture(deployHTLCFixture);
      
      const SECRET = "0x" + "e".repeat(64);
      const HASH = ethers.sha256(SECRET);
      const AMOUNT = ethers.parseEther("1");
      const contractId = ethers.keccak256(ethers.toUtf8Bytes(`gas_test_${Date.now()}`));
      const timelock = Number(await htlc.getCurrentTime()) + 3600;
      
      // Measure fund gas
      const fundTx = await htlc.connect(alice).fund(
        contractId,
        ethers.ZeroAddress,
        bob.address,
        HASH,
        timelock,
        AMOUNT,
        { value: AMOUNT }
      );
      const fundReceipt = await fundTx.wait();
      console.log(`Gas used for fund: ${fundReceipt?.gasUsed.toString()}`);
      
      // Measure claim gas
      const claimTx = await htlc.connect(bob).claim(contractId, SECRET);
      const claimReceipt = await claimTx.wait();
      console.log(`Gas used for claim: ${claimReceipt?.gasUsed.toString()}`);
      
      // Verify reasonable gas usage (adjust thresholds as needed)
      expect(Number(fundReceipt?.gasUsed)).to.be.lessThan(200000);
      expect(Number(claimReceipt?.gasUsed)).to.be.lessThan(150000);
    });
  });
});

// Mock contracts would be separate Solidity files in a real project
// For testing purposes, we'll create them programmatically