const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Test MockNFT", function () {
  const mockNFT;
  
  it("Should create 10 NFTs", async function () {
    const MockNFT = await ethers.getContractFactory("MockNFT");
    mockNFT = await MockNFT.deploy("");
    await mockNFT.deployed();

    const balance = mockNFT.balanceOf();
    expect(balance.toString()).to.equal("10");
  });
});


describe("Test NFTAuction Core Functionalities", function () {
  const nFTAuction;
  const mockNFT;
  
  beforeEach(async function () {
    const MockNFT = await ethers.getContractFactory("MockNFT");
    mockNFT = await MockNFT.deploy("");
    await mockNFT.deployed();

    const NFTAuction = await ethers.getContractFactory("NFTAuction");
    nFTAuction = await NFTAuction.deploy(mockNFT.address, 1, 10);
    await nFTAuction.deployed();
  })

  it("Should bid after started", async function () {

  });

  it("Should deposit token Id 1 to the contract", async function () {
    
  });
});
