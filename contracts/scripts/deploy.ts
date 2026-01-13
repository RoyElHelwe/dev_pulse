import { ethers } from "hardhat";

async function main() {
  console.log("Deploying TaskRecord contract...");

  const TaskRecord = await ethers.getContractFactory("TaskRecord");
  const taskRecord = await TaskRecord.deploy();

  await taskRecord.waitForDeployment();

  const address = await taskRecord.getAddress();
  console.log(`TaskRecord deployed to: ${address}`);

  // Verify on Etherscan (for testnet/mainnet)
  if (process.env.ETHERSCAN_API_KEY) {
    console.log("Waiting for block confirmations...");
    // Wait for 5 block confirmations
    await new Promise((resolve) => setTimeout(resolve, 60000));

    console.log("Verifying contract on Etherscan...");
    try {
      await (await import("hardhat")).run("verify:verify", {
        address: address,
        constructorArguments: [],
      });
      console.log("Contract verified on Etherscan!");
    } catch (error: any) {
      if (error.message.includes("Already Verified")) {
        console.log("Contract is already verified!");
      } else {
        console.error("Verification failed:", error);
      }
    }
  }

  console.log("\n=== Deployment Summary ===");
  console.log(`Contract Address: ${address}`);
  console.log(`Network: ${(await ethers.provider.getNetwork()).name}`);
  console.log(`\nAdd this to your .env file:`);
  console.log(`CONTRACT_ADDRESS=${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
