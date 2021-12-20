const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Test NFTauction start()", function () {
  let nftAuction;
  let mockNFT;
  let accounts;

  beforeEach(async function () {
    // accounts = await ethers.getSigners();

    // const MockNFT = await ethers.getContractFactory("MockNFT");
    // mockNFT = await MockNFT.deploy();
    // await mockNFT.deployed();

    // // token Id '2' auction with '10' starting amount
    // const NFTAuction = await ethers.getContractFactory("NFTAuction");
    // nftAuction = await NFTAuction.deploy(mockNFT.address, 2, 10);
    // await nftAuction.deployed();
  })

  it("Should set the seller with the caller", async function () {
    accounts = await ethers.getSigners();

    const MockNFT = await ethers.getContractFactory("MockNFT");
    mockNFT = await MockNFT.deploy();
    await mockNFT.deployed();

    // token Id '2' auction with '10' starting amount
    const NFTAuction = await ethers.getContractFactory("NFTAuction");
    nftAuction = await NFTAuction.deploy(mockNFT.address, 2, 10);
    await nftAuction.deployed();
    const owner = await nftAuction.seller.call();

    expect( owner).to.equal(accounts[0].address);
  });

  it("Should only start with seller", async function () {
    await expect( nftAuction.connect(accounts[1]).start()).to.be.revertedWith("not seller");
  });

  it("Should not start if already started", async function () {
    await mockNFT.approve(nftAuction.address, 2);
    await nftAuction.start();
    
    await expect( nftAuction.start()).to.be.revertedWith("started");
  });

  it("Should deposit token Id 2 to the contract", async function () {
    const balance = await mockNFT.balanceOf(nftAuction.address);
    expect(balance.toString()).to.equal("1");
  });
});

describe("Test NFTauction bid()", function () {
  let nftAuction;
  let mockNFT;
  let accounts;

  beforeEach(async function () {
    accounts = await ethers.getSigners();

    const MockNFT = await ethers.getContractFactory("MockNFT");
    mockNFT = await MockNFT.deploy();
    await mockNFT.deployed();

    // token '2' auction with 10 starting amount
    const NFTAuction = await ethers.getContractFactory("NFTAuction");
    nftAuction = await NFTAuction.deploy(mockNFT.address, 2, 10);
    await nftAuction.deployed();
  })
  
  it("Should not bid before started", async function () {
    await expect( nftAuction.bid()).to.be.revertedWith("not started");
  });

  it("Should not bid after end time passed", async function () {
    await mockNFT.approve(nftAuction.address, 2);
    await nftAuction.start();

    await ethers.provider.send('evm_increaseTime', [1000 * 60 * 60 * 24 * 7 + 1]);
    await ethers.provider.send('evm_mine');

    await expect( nftAuction.bid({
      from: accounts[0].address,
      value: 15
    })).to.be.revertedWith("ended");
  });
  
  it("Should bid with higher amount than current highest bid ", async function () {
    await mockNFT.approve(nftAuction.address, 2);
    await nftAuction.start();

    await nftAuction.connect(accounts[1]).bid({
      from: accounts[1].address,
      value: 15
    })
    await expect( nftAuction.connect(accounts[2]).bid({
      from: accounts[2].address,
      value: 15
    })).to.be.revertedWith("value < highest");
  });
  
  it("Should increase end time with 10 mins", async function () {
    await mockNFT.approve(nftAuction.address, 2);
    await nftAuction.start();

    await ethers.provider.send('evm_increaseTime', [60 * 60 * 24 * 7 - 60]);
    await ethers.provider.send('evm_mine');

    await expect( nftAuction.connect(accounts[1]).bid({
      from: accounts[1].address,
      value: 20
    })).to.emit(nftAuction, "TimeIncreased")
    .withArgs(accounts[1].address, 10);
  });

  it("Should emit Bid event", async function () {
    await mockNFT.approve(nftAuction.address, 2);
    await nftAuction.start();

    await expect( nftAuction.connect(accounts[1]).bid({
      from: accounts[1].address,
      value: 20
    })).to.emit(nftAuction, "Bid")
    .withArgs(accounts[1].address, 20);
  });
});

describe("Test NFTAuction end()", function () {
  let nftAuction;
  let mockNFT;
  let accounts;
  
  beforeEach(async function () {
    accounts = await ethers.getSigners();

    const MockNFT = await ethers.getContractFactory("MockNFT");
    mockNFT = await MockNFT.deploy();
    await mockNFT.deployed();

    // token '2' auction with 10 starting amount
    const NFTAuction = await ethers.getContractFactory("NFTAuction");
    nftAuction = await NFTAuction.deploy(mockNFT.address, 2, 10);
    await nftAuction.deployed();
  })

  it("Should not end before started", async function () {
    await expect( nftAuction.end()).to.be.revertedWith("not started");
  });
  
  it("Should not end before end time passed", async function () {
    await mockNFT.approve(nftAuction.address, 2);
    await nftAuction.start();

    await ethers.provider.send('evm_increaseTime', [60 * 60 * 24 * 7 - 10]);
    await ethers.provider.send('evm_mine');

    await expect( nftAuction.end()).to.be.revertedWith("not ended");
  });
 
  it("Should not end after ended", async function () {
    await mockNFT.approve(nftAuction.address, 2);
    await nftAuction.start();

    await ethers.provider.send('evm_increaseTime', [60 * 60 * 24 * 7 + 1]);
    await ethers.provider.send('evm_mine');
    await nftAuction.end();

    await expect( nftAuction.end()).to.be.revertedWith("ended");
  });

  it("Should pay to the seller 20 and send NFT to highest bidder", async function () {
    await mockNFT.approve(nftAuction.address, 2);
    await nftAuction.start();

    await nftAuction.connect(accounts[1]).bid({
      from: accounts[1].address,
      value: 20
    })

    await ethers.provider.send('evm_increaseTime', [60 * 60 * 24 * 7 + 1]);
    await ethers.provider.send('evm_mine');

    await expect(() => nftAuction.end()).to.changeEtherBalance(accounts[0], 20);

    const balance = await mockNFT.balanceOf(accounts[1].address);
    await expect( balance.toString()).to.equal("1");
  });
  
  it("Should refund NFT to the seller when not bid", async function () {
    await mockNFT.approve(nftAuction.address, 2);
    await nftAuction.start();

    await ethers.provider.send('evm_increaseTime', [60 * 60 * 24 * 7 +1]);
    await ethers.provider.send('evm_mine');

    await nftAuction.end();

    const balance = await mockNFT.balanceOf(accounts[0].address);
    await expect( balance.toString()).to.equal("10");
  }); 
});

describe("Test NFTauction withdraw()", function () {
  let nftAuction;
  let mockNFT;
  let accounts;

  beforeEach(async function () {
    accounts = await ethers.getSigners();

    const MockNFT = await ethers.getContractFactory("MockNFT");
    mockNFT = await MockNFT.deploy();
    await mockNFT.deployed();

    // token '2' auction with 10 starting amount
    const NFTAuction = await ethers.getContractFactory("NFTAuction");
    nftAuction = await NFTAuction.deploy(mockNFT.address, 2, 10);
    await nftAuction.deployed();
  })
  
  it("Should withdraw the bid for the account1", async function () {
    await mockNFT.approve(nftAuction.address, 2);
    await nftAuction.start();

    await nftAuction.bid({
      from: accounts[0].address,
      value: 11
    });
    await nftAuction.connect(accounts[1]).bid({
      from: accounts[1].address,
      value: 12
    });
    await nftAuction.connect(accounts[2]).bid({
      from: accounts[2].address,
      value: 13
    });

    await expect(() => nftAuction.connect(accounts[1]).withdraw()).to.be.changeEtherBalance(accounts[1], 12);
  });

  it("Should not withdraw for the highest bidder", async function () {
    await mockNFT.approve(nftAuction.address, 2);
    await nftAuction.start();

    await nftAuction.bid({
      from: accounts[0].address,
      value: 11
    });
    await nftAuction.connect(accounts[1]).bid({
      from: accounts[1].address,
      value: 12
    });
    await nftAuction.connect(accounts[2]).bid({
      from: accounts[2].address,
      value: 13
    });

    await expect( nftAuction.connect(accounts[2]).withdraw()).to.be.revertedWith("Not bidder exist");
  });

  it("Should withdraw for only bidder", async function () {
    await mockNFT.approve(nftAuction.address, 2);
    await nftAuction.start();

    await nftAuction.bid({
      from: accounts[0].address,
      value: 11
    });
    await nftAuction.connect(accounts[1]).bid({
      from: accounts[1].address,
      value: 12
    });

   await expect( nftAuction.connect(accounts[2]).withdraw()).to.be.revertedWith("Not bidder exist");
  });
});