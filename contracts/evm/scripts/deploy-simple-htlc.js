const { ethers } = require("hardhat");

async function main() {
  console.log("\n🔧 DEPLOYING SIMPLE HTLC CONTRACT\n");
  
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)));

  // Deploy Simple HTLC
  console.log("\n📦 Deploying SimpleHTLC...");
  const SimpleHTLC = await ethers.getContractFactory("SimpleHTLC");
  const htlc = await SimpleHTLC.deploy();
  await htlc.waitForDeployment();
  const htlcAddress = await htlc.getAddress();
  console.log("SimpleHTLC deployed to:", htlcAddress);

  // Test basic functionality
  console.log("\n🧪 Testing basic functionality...");
  
  try {
    const currentTime = await htlc.getCurrentTime();
    console.log("✅ getCurrentTime() works:", Number(currentTime));
    
    const testContractId = ethers.hexlify(ethers.randomBytes(32));
    const testBeneficiary = "0x5417D2a6026fB21509FDc9C7fE6e4Cf6794767E0";
    const testHashLock = ethers.hexlify(ethers.randomBytes(32));
    const testTimelock = Number(currentTime) + 3600; // 1 hour from now
    const testAmount = ethers.parseEther("0.001");
    
    console.log("Testing with parameters:");
    console.log("  Contract ID:", testContractId);
    console.log("  Beneficiary:", testBeneficiary);
    console.log("  Timelock:", testTimelock, "→", new Date(testTimelock * 1000).toISOString());
    console.log("  Amount:", ethers.formatEther(testAmount), "ETH");
    
    // Test gas estimation
    const gasEstimate = await htlc.fundETH.estimateGas(
      testContractId,
      testBeneficiary,
      testHashLock,
      testTimelock,
      { value: testAmount }
    );
    console.log("✅ Gas estimation successful:", gasEstimate.toString());
    
    // Test actual transaction
    console.log("🚀 Creating test HTLC...");
    const tx = await htlc.fundETH(
      testContractId,
      testBeneficiary,
      testHashLock,
      testTimelock,
      { value: testAmount }
    );
    
    const receipt = await tx.wait();
    console.log("✅ Test HTLC created successfully! Block:", receipt.blockNumber);
    
    // Check HTLC details
    const details = await htlc.getDetails(testContractId);
    console.log("📊 HTLC Details:");
    console.log("  State:", Number(details.state), "(1 = PENDING)");
    console.log("  Timelock:", Number(details.timelock));
    console.log("  Value:", ethers.formatEther(details.value));
    
    const [isClaimable, isRefundable] = await Promise.all([
      htlc.isClaimable(testContractId),
      htlc.isRefundable(testContractId)
    ]);
    
    console.log("  Is Claimable:", isClaimable);
    console.log("  Is Refundable:", isRefundable);
    
    const timeRemaining = Number(details.timelock) - Number(currentTime);
    console.log("  Time Remaining:", timeRemaining, "seconds");
    
    if (isClaimable && !isRefundable && timeRemaining > 0) {
      console.log("🎉 HTLC CONTRACT WORKS PERFECTLY!");
    } else {
      console.log("❌ HTLC has unexpected state");
    }
    
  } catch (testError) {
    console.log("❌ Test failed:", testError.message);
  }

  console.log("\n🎉 DEPLOYMENT COMPLETE!");
  console.log("═".repeat(50));
  console.log("SimpleHTLC Address:", htlcAddress);
  console.log("═".repeat(50));
  
  // Save deployment info
  const deploymentInfo = {
    network: "monadTestnet",
    chainId: 10143,
    deploymentTime: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      SimpleHTLC: {
        address: htlcAddress,
        txHash: htlc.deploymentTransaction()?.hash
      }
    }
  };
  
  console.log("\n📄 Deployment Info:", JSON.stringify(deploymentInfo, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });