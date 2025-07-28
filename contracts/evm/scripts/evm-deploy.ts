import { ethers } from "hardhat";
import { writeFileSync, existsSync, readFileSync } from "fs";
import { join } from "path";

async function main() {
  console.log("🚀 Starting EVM HTLC deployment...");

  // Get network info
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);
  console.log(`📡 Network: ${network.name || "Unknown"} (Chain ID: ${chainId})`);

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  const balance = await ethers.provider.getBalance(deployerAddress);
  
  console.log(`👤 Deployer: ${deployerAddress}`);
  console.log(`💰 Balance: ${ethers.formatEther(balance)} ETH`);

  // Check if we have enough balance for deployment
  if (balance < ethers.parseEther("0.001")) {
    console.warn("⚠️  Warning: Low balance, deployment might fail");
  }

  // Deploy SwapSageHTLC
  console.log("\n📄 Deploying SwapSageHTLC contract...");
  const SwapSageHTLC = await ethers.getContractFactory("SwapSageHTLC");
  
  const htlc = await SwapSageHTLC.deploy();
  await htlc.waitForDeployment();
  
  const htlcAddress = await htlc.getAddress();
  console.log(`✅ SwapSageHTLC deployed to: ${htlcAddress}`);

  // Verify deployment
  const code = await ethers.provider.getCode(htlcAddress);
  if (code === "0x") {
    throw new Error("❌ Contract deployment failed - no code at address");
  }

  // Test basic functionality
  console.log("\n🧪 Testing contract functionality...");
  const currentTime = await htlc.getCurrentTime();
  console.log(`⏰ Contract time: ${new Date(Number(currentTime) * 1000).toISOString()}`);

  // Save deployment info
  const deploymentInfo = {
    chainId,
    network: network.name || "unknown",
    address: htlcAddress,
    deployer: deployerAddress,
    deploymentTime: new Date().toISOString(),
    blockNumber: await ethers.provider.getBlockNumber(),
    transactionHash: htlc.deploymentTransaction()?.hash,
  };

  // Save to deployment file
  const deploymentsDir = join(__dirname, "../deployments");
  const deploymentFile = join(deploymentsDir, `htlc-${chainId}.json`);
  
  if (!existsSync(deploymentsDir)) {
    const { mkdirSync } = require("fs");
    mkdirSync(deploymentsDir, { recursive: true });
  }

  writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
  console.log(`📝 Deployment info saved to: ${deploymentFile}`);

  // Update .env.local at root level
  const rootDir = join(__dirname, "../../../");
  const envPath = join(rootDir, ".env.local");
  
  let envContent = "";
  if (existsSync(envPath)) {
    envContent = readFileSync(envPath, "utf8");
  }

  // Update or add EVM_HTLC_ADDRESS
  const addressLine = `EVM_HTLC_ADDRESS=${htlcAddress}`;
  const chainIdLine = `EVM_CHAIN_ID=${chainId}`;
  
  if (envContent.includes("EVM_HTLC_ADDRESS=")) {
    envContent = envContent.replace(/EVM_HTLC_ADDRESS=.*/g, addressLine);
  } else {
    envContent += `\n${addressLine}`;
  }

  if (envContent.includes("EVM_CHAIN_ID=")) {
    envContent = envContent.replace(/EVM_CHAIN_ID=.*/g, chainIdLine);
  } else {
    envContent += `\n${chainIdLine}`;
  }

  writeFileSync(envPath, envContent.trim() + "\n");
  console.log(`📋 Updated .env.local with contract address`);

  console.log("\n🎉 EVM deployment completed successfully!");
  console.log(`📍 Contract Address: ${htlcAddress}`);
  console.log(`🔗 Chain ID: ${chainId}`);
  
  return {
    address: htlcAddress,
    chainId,
    deployer: deployerAddress,
  };
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then((result) => {
    console.log("\n✨ Deployment result:", result);
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Deployment failed:", error);
    process.exit(1);
  });