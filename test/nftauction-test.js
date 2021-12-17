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
  let nftAuction;
  let mockNFT;
  let accounts;
  
  beforeEach(async function () {
    accounts = await ethers.getSigners();

    const MockNFT = await ethers.getContractFactory("MockNFT");
    mockNFT = await MockNFT.deploy("");
    await mockNFT.deployed();

    // token '2' auction with 10 starting amount
    const NFTAuction = await ethers.getContractFactory("NFTAuction");
    nftAuction = await NFTAuction.deploy(mockNFT.address, 2, 10);
    await nftAuction.deployed();
  })

  it("Should only start for seller", async function () {
    await expect( nftAuction.connect(accounts[1]).start()).to.be.revertedWith("not seller");
  });

  it("Should not start if already started", async function () {
    nftAuction.start();
    await expect( nftAuction.start()).to.be.revertedWith("started");
  });

  
  it("Should deposit token Id 2 to the contract", async function () {
    nftAuction.start();
    const balance = mockNFT.balanceOf(nftAuction.address);
    expect(balance.toString()).to.equal("1");
  });

  it("Should bid after started", async function () {
    await expect( nftAuction.bid()).to.be.revertedWith("not started");
  });
  
  it("Should bid before ended", async function () {
    nftAuction.start();
    await ethers.provider.send('evm_increaseTime', [1000 * 60 * 60 * 24 * 7 + 1]);
    await ethers.provider.send('evm_mine');

    await expect( nftAuction.bid({
      from: accounts[0].address,
      value: 15
    })).to.be.revertedWith("ended");
  });
  
  it("Should bid with higher amount than current highest bid ", async function () {
    nftAuction.start();

    await nftAuction.connect(accounts[1]).bid({
      from: accounts[1].address,
      value: 15
    })
    await expect( nftAuction.connect(accounts[2]).bid({
      from: accounts[2].address,
      value: 15
    })).to.be.revertedWith("value < highest");
  });
  
  it("Should increase endAt 10 mins", async function () {
    nftAuction.start();

    await ethers.provider.send('evm_increaseTime', [1000 * 60 * 60 * 24 * 7 - 1000 * 60]);
    await ethers.provider.send('evm_mine');

    await nftAuction.bid({
      from: accounts[0].address,
      value: 15
    });

    await expect( nftAuction.connect(accounts[1]).bid({
      from: accounts[1].address,
      value: 20
    })).to.emit(nftAuction, "TimeIncreased")
    .withArgs(accounts[1].address, 10);
  });

  it("Should emit Bid event", async function () {
    nftAuction.start();

    await expect( nftAuction.connect(accounts[1]).bid({
      from: accounts[1].address,
      value: 20
    })).to.emit(nftAuction, "Bid")
    .withArgs(accounts[1].address, 20);
  });

 
});
