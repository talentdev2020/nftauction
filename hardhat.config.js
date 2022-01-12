// require('hardhat-abi-exporter');
require("@nomiclabs/hardhat-waffle");
require('hardhat-abi-exporter');

const { SIGNER } = require('./.secret.json');

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: {
    version: "0.8.4",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks : {
    cronos : {
      url : "https://evm-cronos.crypto.org",
      chainId: 25,
      accounts: SIGNER !== undefined ? [SIGNER] : [],
    },
    cronos_testnet : {
      url : "https://cronos-testnet-3.crypto.org:8545/",
      chainId : 338,
      accounts:  SIGNER !== undefined ? [SIGNER] : [],
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
   
  abiExporter: {
    path: './abi',
    runOnCompile: true,
    clear: true,
    flat: true,
    only: [],
    spacing: 2,
    pretty: true,
  }
};
