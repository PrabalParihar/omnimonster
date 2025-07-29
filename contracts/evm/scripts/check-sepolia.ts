import { ethers } from "hardhat";

async function main() {
  console.log("🔍 Checking Sepolia HTLC deployment...");

  // Contract address from deployment file
  const contractAddress = "0x3D06e852c8027a5582380c86413A2B7Bc78E3F74";
  
  // Get network info
  const network = await ethers.provider.getNetwork();
  console.log(`📡 Network: ${network.name} (Chain ID: ${network.chainId})`);

  // Check if contract exists
  const code = await ethers.provider.getCode(contractAddress);
  console.log(`📄 Contract code length: ${code.length}`);
  
  if (code === "0x") {
    console.log("❌ No contract deployed at this address");
    return false;
  }
  
  console.log("✅ Contract exists at address");
  
  // Try to interact with the contract
  try {
    const SwapSageHTLC = await ethers.getContractFactory("SwapSageHTLC");
    const htlc = SwapSageHTLC.attach(contractAddress);
    
    const currentTime = await htlc.getCurrentTime();
    console.log(`⏰ Contract time: ${new Date(Number(currentTime) * 1000).toISOString()}`);
    console.log("✅ Contract is functional");
    
    return true;
  } catch (error) {
    console.log("❌ Contract interaction failed:", error);
    return false;
  }
}

main()
  .then((success) => {
    console.log(`\n${success ? "🎉" : "❌"} Check ${success ? "passed" : "failed"}`);
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error("❌ Check failed:", error);
    process.exit(1);
  });