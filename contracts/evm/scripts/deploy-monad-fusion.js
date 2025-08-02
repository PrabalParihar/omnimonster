const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Deploying Fusion Swap to Monad Testnet");
  console.log("==========================================");

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  
  console.log("👤 Deployer:", deployer.address);
  console.log("💰 Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");
  console.log("🌐 Network:", network.name, `(Chain ID: ${network.chainId})`);
  console.log();

  const deploymentResult = {
    network: 'monadTestnet',
    chainId: Number(network.chainId),
    contracts: {},
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
  };

  try {
    // Deploy FusionHTLC
    console.log("📦 Deploying FusionHTLC...");
    const FusionHTLC = await ethers.getContractFactory("FusionHTLC");
    const htlc = await FusionHTLC.deploy();
    await htlc.waitForDeployment();
    const htlcAddress = await htlc.getAddress();
    
    deploymentResult.contracts.FusionHTLC = {
      address: htlcAddress,
      txHash: htlc.deploymentTransaction()?.hash || "",
    };
    console.log("✅ FusionHTLC deployed at:", htlcAddress);

    // Deploy FusionForwarder
    console.log("📦 Deploying FusionForwarder...");
    const FusionForwarder = await ethers.getContractFactory("FusionForwarder");
    const forwarder = await FusionForwarder.deploy("FusionForwarder");
    await forwarder.waitForDeployment();
    const forwarderAddress = await forwarder.getAddress();
    
    deploymentResult.contracts.FusionForwarder = {
      address: forwarderAddress,
      txHash: forwarder.deploymentTransaction()?.hash || "",
    };
    console.log("✅ FusionForwarder deployed at:", forwarderAddress);

    // Deploy FusionPoolManager
    console.log("📦 Deploying FusionPoolManager...");
    const FusionPoolManager = await ethers.getContractFactory("FusionPoolManager");
    const poolManager = await FusionPoolManager.deploy(htlcAddress);
    await poolManager.waitForDeployment();
    const poolManagerAddress = await poolManager.getAddress();
    
    deploymentResult.contracts.FusionPoolManager = {
      address: poolManagerAddress,
      txHash: poolManager.deploymentTransaction()?.hash || "",
    };
    console.log("✅ FusionPoolManager deployed at:", poolManagerAddress);

    // Deploy SwapSageHTLCForwarder
    console.log("📦 Deploying SwapSageHTLCForwarder...");
    const SwapSageHTLCForwarder = await ethers.getContractFactory("SwapSageHTLCForwarder");
    const htlcForwarder = await SwapSageHTLCForwarder.deploy(htlcAddress, forwarderAddress);
    await htlcForwarder.waitForDeployment();
    const htlcForwarderAddress = await htlcForwarder.getAddress();
    
    deploymentResult.contracts.SwapSageHTLCForwarder = {
      address: htlcForwarderAddress,
      txHash: htlcForwarder.deploymentTransaction()?.hash || "",
    };
    console.log("✅ SwapSageHTLCForwarder deployed at:", htlcForwarderAddress);

    // Deploy OMNI token for Monad
    console.log("📦 Deploying OMNI Token...");
    const SimpleMonsterToken = await ethers.getContractFactory("SimpleMonsterToken");
    const omniToken = await SimpleMonsterToken.deploy("Omni Token", "OMNI");
    await omniToken.waitForDeployment();
    const omniTokenAddress = await omniToken.getAddress();
    
    deploymentResult.contracts.OmniToken = {
      address: omniTokenAddress,
      txHash: omniToken.deploymentTransaction()?.hash || "",
      symbol: "OMNI",
      name: "Omni Token"
    };
    console.log("✅ OMNI Token deployed at:", omniTokenAddress);

    // Mint OMNI tokens
    console.log("🪙 Minting OMNI tokens...");
    const mintAmount = ethers.parseEther("1000000"); // 1M tokens
    await omniToken.mint(deployer.address, mintAmount);
    console.log("✅ Minted", ethers.formatEther(mintAmount), "OMNI tokens to deployer");

    // Set up pool manager
    console.log("🏊 Setting up pool manager...");
    const minThreshold = ethers.parseEther("1000"); // 1K tokens minimum
    await poolManager.addToken(omniTokenAddress, minThreshold);
    console.log("✅ Added OMNI token to pool manager");

    // Add initial liquidity
    console.log("💧 Adding initial liquidity...");
    const liquidityAmount = ethers.parseEther("100000"); // 100K tokens
    await omniToken.approve(poolManagerAddress, liquidityAmount);
    await poolManager.addLiquidity(omniTokenAddress, liquidityAmount);
    console.log("✅ Added", ethers.formatEther(liquidityAmount), "OMNI tokens liquidity");

    // Save deployment info
    const deploymentsDir = path.join(__dirname, "..", "deployments");
    if (!fs.existsSync(deploymentsDir)) {
      fs.mkdirSync(deploymentsDir, { recursive: true });
    }

    const deploymentFile = path.join(deploymentsDir, `fusion-monad-${deploymentResult.chainId}.json`);
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentResult, null, 2));
    console.log("💾 Deployment info saved to:", deploymentFile);

    // Display summary
    console.log("\n🎉 Monad Testnet Deployment Complete!");
    console.log("📋 Contract Addresses:");
    console.log("   FusionHTLC:", htlcAddress);
    console.log("   FusionPoolManager:", poolManagerAddress);
    console.log("   FusionForwarder:", forwarderAddress);  
    console.log("   SwapSageHTLCForwarder:", htlcForwarderAddress);
    console.log("   OmniToken (OMNI):", omniTokenAddress);

    // Save addresses to environment file
    const envContent = [
      '# MONAD TESTNET DEPLOYMENT',
      `MONAD_FUSION_HTLC=${htlcAddress}`,
      `MONAD_FUSION_POOL_MANAGER=${poolManagerAddress}`,
      `MONAD_FUSION_FORWARDER=${forwarderAddress}`,
      `MONAD_HTLC_FORWARDER=${htlcForwarderAddress}`,
      `MONAD_OMNI_TOKEN=${omniTokenAddress}`,
      ''
    ].join('\n');
    
    const envFile = path.join(__dirname, "../.env.monad");
    fs.writeFileSync(envFile, envContent);
    console.log("💾 Environment variables saved to:", envFile);

    return deploymentResult;

  } catch (error) {
    console.error("❌ Deployment failed:", error);
    throw error;
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exitCode = 1;
  });
}

module.exports = { main };