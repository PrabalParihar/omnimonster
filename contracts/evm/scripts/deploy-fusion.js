const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  
  console.log("🚀 Deploying Fusion Swap contracts...");
  console.log("📍 Network:", network.name, `(Chain ID: ${network.chainId})`);
  console.log("👤 Deployer:", deployer.address);
  console.log("💰 Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");
  console.log();

  // Deploy FusionHTLC
  console.log("📦 Deploying FusionHTLC...");
  const FusionHTLC = await ethers.getContractFactory("FusionHTLC");
  const htlc = await FusionHTLC.deploy();
  await htlc.waitForDeployment();
  const htlcAddress = await htlc.getAddress();
  console.log("✅ FusionHTLC deployed at:", htlcAddress);

  // Deploy FusionForwarder
  console.log("📦 Deploying FusionForwarder...");
  const FusionForwarder = await ethers.getContractFactory("FusionForwarder");
  const forwarder = await FusionForwarder.deploy("FusionForwarder");
  await forwarder.waitForDeployment();
  const forwarderAddress = await forwarder.getAddress();
  console.log("✅ FusionForwarder deployed at:", forwarderAddress);

  // Deploy FusionPoolManager
  console.log("📦 Deploying FusionPoolManager...");
  const FusionPoolManager = await ethers.getContractFactory("FusionPoolManager");
  const poolManager = await FusionPoolManager.deploy(htlcAddress);
  await poolManager.waitForDeployment();
  const poolManagerAddress = await poolManager.getAddress();
  console.log("✅ FusionPoolManager deployed at:", poolManagerAddress);

  // Deploy SwapSageHTLCForwarder
  console.log("📦 Deploying SwapSageHTLCForwarder...");
  const SwapSageHTLCForwarder = await ethers.getContractFactory("SwapSageHTLCForwarder");
  const htlcForwarder = await SwapSageHTLCForwarder.deploy(htlcAddress, forwarderAddress);
  await htlcForwarder.waitForDeployment();
  const htlcForwarderAddress = await htlcForwarder.getAddress();
  console.log("✅ SwapSageHTLCForwarder deployed at:", htlcForwarderAddress);

  // Deploy test token
  console.log("📦 Deploying SimpleMonsterToken (for testing)...");
  const SimpleMonsterToken = await ethers.getContractFactory("SimpleMonsterToken");
  const testToken = await SimpleMonsterToken.deploy("Monster Token", "MONSTER");
  await testToken.waitForDeployment();
  const testTokenAddress = await testToken.getAddress();
  console.log("✅ SimpleMonsterToken deployed at:", testTokenAddress);

  // Mint some test tokens to deployer
  console.log("🪙 Minting test tokens...");
  const mintAmount = ethers.parseEther("1000000"); // 1M tokens
  await testToken.mint(deployer.address, mintAmount);
  console.log("✅ Minted", ethers.formatEther(mintAmount), "MONSTER tokens to deployer");

  // Add test token to pool manager
  console.log("🏊 Adding test token to pool manager...");
  const minThreshold = ethers.parseEther("1000"); // 1K tokens minimum
  await poolManager.addToken(testTokenAddress, minThreshold);
  console.log("✅ Added MONSTER token to pool manager");

  // Add initial liquidity
  console.log("💧 Adding initial liquidity...");
  const liquidityAmount = ethers.parseEther("100000"); // 100K tokens
  await testToken.approve(poolManagerAddress, liquidityAmount);
  await poolManager.addLiquidity(testTokenAddress, liquidityAmount);
  console.log("✅ Added", ethers.formatEther(liquidityAmount), "MONSTER tokens liquidity");

  console.log();
  console.log("🎉 Deployment completed successfully!");
  console.log();
  console.log("📋 Contract Addresses:");
  console.log("   FusionHTLC:", htlcAddress);
  console.log("   FusionPoolManager:", poolManagerAddress);
  console.log("   FusionForwarder:", forwarderAddress);
  console.log("   SwapSageHTLCForwarder:", htlcForwarderAddress);
  console.log("   SimpleMonsterToken:", testTokenAddress);
  console.log();

  // Create deployment result
  const deploymentResult = {
    network: network.name,
    chainId: Number(network.chainId),
    contracts: {
      FusionHTLC: {
        address: htlcAddress,
        txHash: htlc.deploymentTransaction()?.hash || "",
      },
      FusionPoolManager: {
        address: poolManagerAddress,
        txHash: poolManager.deploymentTransaction()?.hash || "",
      },
      FusionForwarder: {
        address: forwarderAddress,
        txHash: forwarder.deploymentTransaction()?.hash || "",
      },
      SwapSageHTLCForwarder: {
        address: htlcForwarderAddress,
        txHash: htlcForwarder.deploymentTransaction()?.hash || "",
      },
      SimpleMonsterToken: {
        address: testTokenAddress,
        txHash: testToken.deploymentTransaction()?.hash || "",
      },
    },
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
  };

  // Save deployment info
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const deploymentFile = path.join(deploymentsDir, `fusion-${network.name}-${network.chainId}.json`);
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentResult, null, 2));
  console.log("💾 Deployment info saved to:", deploymentFile);

  // Verify contracts if on a testnet/mainnet
  if (network.chainId !== 31337n) {
    console.log();
    console.log("🔍 To verify contracts on Etherscan, run:");
    console.log(`npx hardhat verify --network ${network.name} ${htlcAddress}`);
    console.log(`npx hardhat verify --network ${network.name} ${forwarderAddress} "FusionForwarder"`);
    console.log(`npx hardhat verify --network ${network.name} ${poolManagerAddress} ${htlcAddress}`);
    console.log(`npx hardhat verify --network ${network.name} ${htlcForwarderAddress} ${htlcAddress} ${forwarderAddress}`);
    console.log(`npx hardhat verify --network ${network.name} ${testTokenAddress} "Monster Token" "MONSTER"`);
  }

  return deploymentResult;
}

if (require.main === module) {
  main().catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exitCode = 1;
  });
}

module.exports = { main };