const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function deployToNetwork(networkName, contracts = {}) {
  console.log(`\n🚀 Deploying to ${networkName}...`);
  
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  
  console.log("👤 Deployer:", deployer.address);
  console.log("💰 Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");
  console.log("🌐 Network:", network.name, `(Chain ID: ${network.chainId})`);

  const deploymentResult = {
    network: networkName,
    chainId: Number(network.chainId),
    contracts: {},
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
  };

  try {
    // Deploy FusionHTLC
    if (!contracts.FusionHTLC) {
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
    } else {
      deploymentResult.contracts.FusionHTLC = contracts.FusionHTLC;
      console.log("✅ Using existing FusionHTLC at:", contracts.FusionHTLC.address);
    }

    // Deploy FusionForwarder
    if (!contracts.FusionForwarder) {
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
    } else {
      deploymentResult.contracts.FusionForwarder = contracts.FusionForwarder;
      console.log("✅ Using existing FusionForwarder at:", contracts.FusionForwarder.address);
    }

    // Deploy FusionPoolManager
    if (!contracts.FusionPoolManager) {
      console.log("📦 Deploying FusionPoolManager...");
      const FusionPoolManager = await ethers.getContractFactory("FusionPoolManager");
      const poolManager = await FusionPoolManager.deploy(deploymentResult.contracts.FusionHTLC.address);
      await poolManager.waitForDeployment();
      const poolManagerAddress = await poolManager.getAddress();
      
      deploymentResult.contracts.FusionPoolManager = {
        address: poolManagerAddress,
        txHash: poolManager.deploymentTransaction()?.hash || "",
      };
      console.log("✅ FusionPoolManager deployed at:", poolManagerAddress);
    } else {
      deploymentResult.contracts.FusionPoolManager = contracts.FusionPoolManager;
      console.log("✅ Using existing FusionPoolManager at:", contracts.FusionPoolManager.address);
    }

    // Deploy SwapSageHTLCForwarder
    if (!contracts.SwapSageHTLCForwarder) {
      console.log("📦 Deploying SwapSageHTLCForwarder...");
      const SwapSageHTLCForwarder = await ethers.getContractFactory("SwapSageHTLCForwarder");
      const htlcForwarder = await SwapSageHTLCForwarder.deploy(
        deploymentResult.contracts.FusionHTLC.address,
        deploymentResult.contracts.FusionForwarder.address
      );
      await htlcForwarder.waitForDeployment();
      const htlcForwarderAddress = await htlcForwarder.getAddress();
      
      deploymentResult.contracts.SwapSageHTLCForwarder = {
        address: htlcForwarderAddress,
        txHash: htlcForwarder.deploymentTransaction()?.hash || "",
      };
      console.log("✅ SwapSageHTLCForwarder deployed at:", htlcForwarderAddress);
    } else {
      deploymentResult.contracts.SwapSageHTLCForwarder = contracts.SwapSageHTLCForwarder;
      console.log("✅ Using existing SwapSageHTLCForwarder at:", contracts.SwapSageHTLCForwarder.address);
    }

    // Deploy custom test token with specific symbol based on network
    const tokenSymbol = networkName === 'sepolia' ? 'MONSTER' : 'OMNI';
    const tokenName = networkName === 'sepolia' ? 'Monster Token' : 'Omni Token';
    
    console.log(`📦 Deploying ${tokenName} (${tokenSymbol})...`);
    const SimpleMonsterToken = await ethers.getContractFactory("SimpleMonsterToken");
    const testToken = await SimpleMonsterToken.deploy(tokenName, tokenSymbol);
    await testToken.waitForDeployment();
    const testTokenAddress = await testToken.getAddress();
    
    deploymentResult.contracts.TestToken = {
      address: testTokenAddress,
      txHash: testToken.deploymentTransaction()?.hash || "",
      symbol: tokenSymbol,
      name: tokenName
    };
    console.log(`✅ ${tokenName} deployed at:`, testTokenAddress);

    // Mint test tokens
    console.log("🪙 Minting test tokens...");
    const mintAmount = ethers.parseEther("1000000"); // 1M tokens
    await testToken.mint(deployer.address, mintAmount);
    console.log("✅ Minted", ethers.formatEther(mintAmount), tokenSymbol, "tokens to deployer");

    // Try to set up pool manager with test token (if pool manager was deployed)
    if (deploymentResult.contracts.FusionPoolManager && !contracts.FusionPoolManager) {
      try {
        console.log("🏊 Adding test token to pool manager...");
        const poolManagerContract = await ethers.getContractAt(
          "FusionPoolManager", 
          deploymentResult.contracts.FusionPoolManager.address
        );
        
        const minThreshold = ethers.parseEther("1000"); // 1K tokens minimum
        await poolManagerContract.addToken(testTokenAddress, minThreshold);
        console.log(`✅ Added ${tokenSymbol} token to pool manager`);

        // Add initial liquidity
        console.log("💧 Adding initial liquidity...");
        const liquidityAmount = ethers.parseEther("100000"); // 100K tokens
        await testToken.approve(deploymentResult.contracts.FusionPoolManager.address, liquidityAmount);
        await poolManagerContract.addLiquidity(testTokenAddress, liquidityAmount);
        console.log("✅ Added", ethers.formatEther(liquidityAmount), tokenSymbol, "tokens liquidity");
      } catch (poolError) {
        console.warn("⚠️ Could not set up pool manager:", poolError.message);
      }
    }

    return deploymentResult;

  } catch (error) {
    console.error(`❌ Deployment to ${networkName} failed:`, error);
    throw error;
  }
}

async function main() {
  const networkName = process.env.HARDHAT_NETWORK || 'localhost';
  console.log(`🎯 Target Network: ${networkName}`);

  // Check if we should use existing contracts
  const useExisting = process.env.USE_EXISTING_CONTRACTS === 'true';
  let existingContracts = {};
  
  if (useExisting) {
    // Try to load existing deployment
    const deploymentsDir = path.join(__dirname, "..", "deployments");
    const network = await ethers.provider.getNetwork();
    const deploymentFile = path.join(deploymentsDir, `fusion-${networkName}-${network.chainId}.json`);
    
    if (fs.existsSync(deploymentFile)) {
      try {
        const existingDeployment = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
        existingContracts = existingDeployment.contracts;
        console.log("📋 Found existing deployment, reusing contracts where possible");
      } catch (error) {
        console.warn("⚠️ Could not load existing deployment:", error.message);
      }
    }
  }

  const result = await deployToNetwork(networkName, existingContracts);

  // Save deployment info
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const deploymentFile = path.join(deploymentsDir, `fusion-${networkName}-${result.chainId}.json`);
  fs.writeFileSync(deploymentFile, JSON.stringify(result, null, 2));
  console.log("💾 Deployment info saved to:", deploymentFile);

  // Display summary
  console.log("\n🎉 Deployment Summary:");
  console.log("📋 Contract Addresses:");
  Object.entries(result.contracts).forEach(([name, contract]) => {
    console.log(`   ${name}: ${contract.address}`);
  });

  // Save addresses to environment format for easy copy-paste
  const envFile = path.join(__dirname, `../.env.${networkName}`);
  const envContent = [
    `# ${networkName.toUpperCase()} DEPLOYMENT - ${result.deployedAt}`,
    `${networkName.toUpperCase()}_FUSION_HTLC=${result.contracts.FusionHTLC.address}`,
    `${networkName.toUpperCase()}_FUSION_POOL_MANAGER=${result.contracts.FusionPoolManager.address}`,
    `${networkName.toUpperCase()}_FUSION_FORWARDER=${result.contracts.FusionForwarder.address}`,
    `${networkName.toUpperCase()}_HTLC_FORWARDER=${result.contracts.SwapSageHTLCForwarder.address}`,
    `${networkName.toUpperCase()}_TEST_TOKEN=${result.contracts.TestToken.address}`,
    `${networkName.toUpperCase()}_TEST_TOKEN_SYMBOL=${result.contracts.TestToken.symbol}`,
    ''
  ].join('\n');
  
  fs.writeFileSync(envFile, envContent);
  console.log("💾 Environment variables saved to:", envFile);

  // Verification commands
  if (result.chainId !== 31337) {
    console.log("\n🔍 Verification Commands:");
    console.log(`npx hardhat verify --network ${networkName} ${result.contracts.FusionHTLC.address}`);
    console.log(`npx hardhat verify --network ${networkName} ${result.contracts.FusionForwarder.address} "FusionForwarder"`);
    console.log(`npx hardhat verify --network ${networkName} ${result.contracts.FusionPoolManager.address} ${result.contracts.FusionHTLC.address}`);
    console.log(`npx hardhat verify --network ${networkName} ${result.contracts.SwapSageHTLCForwarder.address} ${result.contracts.FusionHTLC.address} ${result.contracts.FusionForwarder.address}`);
    console.log(`npx hardhat verify --network ${networkName} ${result.contracts.TestToken.address} "${result.contracts.TestToken.name}" "${result.contracts.TestToken.symbol}"`);
  }

  return result;
}

if (require.main === module) {
  main().catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exitCode = 1;
  });
}

module.exports = { main, deployToNetwork };