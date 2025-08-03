const hre = require("hardhat");

async function main() {
  console.log("🚀 Deploying to Etherlink Testnet...\n");

  // Get the deployer account
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "XTZ\n");

  // Deploy DragonToken
  console.log("1️⃣ Deploying DragonToken...");
  const DragonToken = await hre.ethers.getContractFactory("DragonToken");
  const dragonToken = await DragonToken.deploy();
  await dragonToken.waitForDeployment();
  const dragonTokenAddress = await dragonToken.getAddress();
  console.log("✅ DragonToken deployed to:", dragonTokenAddress);

  // Deploy SimpleHTLC
  console.log("\n2️⃣ Deploying SimpleHTLC...");
  const SimpleHTLC = await hre.ethers.getContractFactory("SimpleHTLC");
  const simpleHTLC = await SimpleHTLC.deploy();
  await simpleHTLC.waitForDeployment();
  const htlcAddress = await simpleHTLC.getAddress();
  console.log("✅ SimpleHTLC deployed to:", htlcAddress);

  // Verify token details
  console.log("\n📊 Token Details:");
  const name = await dragonToken.name();
  const symbol = await dragonToken.symbol();
  const decimals = await dragonToken.decimals();
  const totalSupply = await dragonToken.totalSupply();
  
  console.log("Name:", name);
  console.log("Symbol:", symbol);
  console.log("Decimals:", decimals);
  console.log("Total Supply:", hre.ethers.formatUnits(totalSupply, decimals), symbol);

  // Summary
  console.log("\n🎉 Deployment Complete!");
  console.log("================================");
  console.log("DRAGON Token:", dragonTokenAddress);
  console.log("HTLC Contract:", htlcAddress);
  console.log("================================");
  
  console.log("\n📝 Next Steps:");
  console.log("1. Update NEXT_PUBLIC_ETHERLINK_HTLC in .env:", htlcAddress);
  console.log("2. Update Dragon token address in tokens.ts:", dragonTokenAddress);
  console.log("3. Fund the pool wallet with DRAGON tokens for liquidity");
  
  // Save deployment info
  const fs = require("fs");
  const deploymentInfo = {
    network: "etherlinkTestnet",
    chainId: 128123,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      DragonToken: dragonTokenAddress,
      SimpleHTLC: htlcAddress
    }
  };
  
  fs.writeFileSync(
    `./deployments/etherlink-${Date.now()}.json`,
    JSON.stringify(deploymentInfo, null, 2)
  );
  
  console.log("\n💾 Deployment info saved to deployments/");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });