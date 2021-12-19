const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Test MockNFT", function () {
  let mockNFT;
  
  it("Should create 10 NFTs", async function () {
    const accounts = await ethers.getSigners();
    const MockNFT = await ethers.getContractFactory("MockNFT");
    mockNFT = await MockNFT.deploy();
    await mockNFT.deployed();

    const balance = await mockNFT.balanceOf(accounts[0].address);
    expect(balance.toString()).to.equal("10");
  });
});