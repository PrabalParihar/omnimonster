const { ethers } = require("hardhat");

async function main() {
  console.log("\n🐉 DEPLOYING SIMPLE MONSTER TOKENS\n");
  
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)));

  // Deploy Monster Token
  console.log("\n📦 Deploying MONSTER token...");
  const MonsterToken = await ethers.getContractFactory("SimpleMonsterToken");
  const monster = await MonsterToken.deploy("Monster Token", "MONSTER");
  await monster.waitForDeployment();
  const monsterAddress = await monster.getAddress();
  console.log("MONSTER deployed to:", monsterAddress);

  // Deploy Omni Monster Token
  console.log("\n📦 Deploying OMNIMONSTER token...");
  const omniMonster = await MonsterToken.deploy("Omni Monster Token", "OMNIMONSTER");
  await omniMonster.waitForDeployment();
  const omniAddress = await omniMonster.getAddress();
  console.log("OMNIMONSTER deployed to:", omniAddress);

  // Mint initial supply
  console.log("\n🖨️  Minting initial supply...");
  const mintAmount = ethers.parseEther("1000000"); // 1M tokens
  
  await monster.mint(deployer.address, mintAmount);
  console.log("✅ Minted 1M MONSTER to deployer");
  
  await omniMonster.mint(deployer.address, mintAmount);
  console.log("✅ Minted 1M OMNIMONSTER to deployer");

  // Verify balances
  const monsterBalance = await monster.balanceOf(deployer.address);
  const omniBalance = await omniMonster.balanceOf(deployer.address);
  
  console.log("\n📊 Final Balances:");
  console.log("MONSTER balance:", ethers.formatEther(monsterBalance));
  console.log("OMNIMONSTER balance:", ethers.formatEther(omniBalance));

  console.log("\n🎉 DEPLOYMENT COMPLETE!");
  console.log("═".repeat(50));
  console.log("MONSTER Token:", monsterAddress);
  console.log("OMNIMONSTER Token:", omniAddress);
  console.log("═".repeat(50));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });