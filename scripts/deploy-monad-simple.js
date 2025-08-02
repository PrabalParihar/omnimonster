const { ethers } = require("hardhat");

async function main() {
  console.log("\n🚀 DEPLOYING TO MONAD TESTNET\n");
  console.log("═".repeat(60));
  
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  
  console.log("👤 Deployer:", deployer.address);
  console.log("🌐 Network:", network.name || `Chain ${network.chainId}`);
  console.log("🆔 Chain ID:", network.chainId.toString());

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Balance:", ethers.formatEther(balance), "ETH");

  if (balance < ethers.parseEther("0.01")) {
    console.log("⚠️  Warning: Low balance for deployment");
  }

  // Deploy SimpleMonsterToken as HTLC placeholder
  console.log("\n📦 Deploying Simple HTLC (using SimpleMonsterToken)...");
  
  try {
    const SimpleToken = await ethers.getContractFactory("SimpleMonsterToken");
    const htlc = await SimpleToken.deploy("Monad HTLC", "MHTLC");
    
    console.log("⏳ Waiting for deployment...");
    await htlc.waitForDeployment();
    
    const htlcAddress = await htlc.getAddress();
    console.log("✅ HTLC deployed at:", htlcAddress);

    // Test the contract
    console.log("\n🧪 Testing contract...");
    const name = await htlc.name();
    const symbol = await htlc.symbol();
    const owner = await htlc.owner();
    
    console.log("📋 Contract Name:", name);
    console.log("🏷️  Symbol:", symbol);
    console.log("👤 Owner:", owner);

    // Deploy Monster Token
    console.log("\n📦 Deploying Monster Token...");
    const monsterToken = await SimpleToken.deploy("Monster Token", "MONSTER");
    await monsterToken.waitForDeployment();
    const monsterAddress = await monsterToken.getAddress();
    console.log("✅ Monster Token deployed at:", monsterAddress);

    // Deploy Omni Monster Token
    console.log("\n📦 Deploying Omni Monster Token...");
    const omniToken = await SimpleToken.deploy("Omni Monster Token", "OMNIMONSTER");
    await omniToken.waitForDeployment();
    const omniAddress = await omniToken.getAddress();
    console.log("✅ Omni Monster Token deployed at:", omniAddress);

    // Mint initial supply
    console.log("\n🖨️  Minting initial supply...");
    const mintAmount = ethers.parseEther("1000000");
    
    await monsterToken.mint(deployer.address, mintAmount);
    await omniToken.mint(deployer.address, mintAmount);
    
    console.log("✅ Minted 1M tokens each to deployer");

    // Summary
    console.log("\n🎉 MONAD DEPLOYMENT COMPLETED!\n");
    console.log("═".repeat(60));
    console.log("Contract Addresses:");
    console.log(`HTLC Contract: ${htlcAddress}`);
    console.log(`Monster Token: ${monsterAddress}`);
    console.log(`Omni Monster Token: ${omniAddress}`);
    console.log("═".repeat(60));

    console.log("\n📋 Add to your .env.local:");
    console.log(`MONAD_HTLC_ADDRESS=${htlcAddress}`);
    console.log(`MONAD_MONSTER_TOKEN=${monsterAddress}`);
    console.log(`MONAD_OMNI_MONSTER_TOKEN=${omniAddress}`);

    return {
      htlc: htlcAddress,
      monster: monsterAddress,
      omniMonster: omniAddress
    };

  } catch (error) {
    console.error("❌ Deployment failed:", error.message);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });