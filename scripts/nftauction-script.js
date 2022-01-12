// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require("hardhat");

async function main() {
  // We get the contract to deploy
  const NFTAuction = await hre.ethers.getContractFactory("NFTAuction");
  const nFTAuction = await NFTAuction.deploy();

  await nFTAuction.deployed();

  console.log("NFTAuction deployed to:", nFTAuction.address);
  //testnet: 0xf6f6677dCBB4219ABddDEa41b71b309f5a4Bc54C
  //  // transfer ownership
  //  const tx = await nFTAuction.transferOwnership(owner);
  //  await tx.wait();
  //  const newOwner = await nFTAuction.owner();
  //  console.log(`owner is now: ${newOwner}`)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
