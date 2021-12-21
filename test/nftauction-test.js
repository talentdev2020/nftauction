const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Test NFTauction createAuction()", function () {
  let nftAuction;
  let mockNFT;
  let accounts;

  it("Should set the seller of auction with the caller", async function () {
    accounts = await ethers.getSigners();

    const MockNFT = await ethers.getContractFactory("MockNFT");
    mockNFT = await MockNFT.deploy();
    await mockNFT.deployed();

    const NFTAuction = await ethers.getContractFactory("NFTAuction");
    nftAuction = await NFTAuction.deploy();
    await nftAuction.deployed();
   
    // token Id '2' auction with '10' starting amount
    await nftAuction.createAuction(mockNFT.address, 2, 10)
    const seller1 = await nftAuction.getSeller(2);

    // token Id '3' auction with '11' starting amount
    await nftAuction.createAuction(mockNFT.address, 2, 10)
    const seller2 = await nftAuction.getSeller(3);

    expect( seller1 ).to.equal(accounts[0].address);
    expect( seller2 ).to.equal(accounts[0].address);
  });
  it("Should not create with existing auction", async function () {
    await expect( nftAuction.createAuction(mockNFT.address, 2, 10)).to.be.revertedWith("already created");
  });
})

describe("Test NFTauction start()", function () {
  let nftAuction;
  let mockNFT;
  let accounts;

  it("Should create auctions", async function () {
    accounts = await ethers.getSigners();

    const MockNFT = await ethers.getContractFactory("MockNFT");
    mockNFT = await MockNFT.deploy();
    await mockNFT.deployed();

    const NFTAuction = await ethers.getContractFactory("NFTAuction");
    nftAuction = await NFTAuction.deploy();
    await nftAuction.deployed();

    // token Id '2' auction with '10' starting amount for owner
    await nftAuction.createAuction(mockNFT.address, 2, 10);

    // token Id '3' auction with '10' starting amount for owner
    await nftAuction.createAuction(mockNFT.address, 3, 10);

    // token Id '4' auction with '10' starting amount for account1
    await nftAuction.connect(accounts[1]).createAuction(mockNFT.address, 2, 10);

    const seller = await nftAuction.getSeller(4);
    expect( seller ).to.equal(accounts[1].address);

  })

  it("Should only start with seller", async function () {
    await expect( nftAuction.connect(accounts[1]).start(2)).to.be.revertedWith("not seller");

    await expect( nftAuction.start(4)).to.be.revertedWith("not seller");
  });

  it("Should deposit token Id 2 and 4 to the contract after started", async function () {
    await mockNFT.approve(nftAuction.address, 2);
    await mockNFT.approve(nftAuction.address, 3);
    await nftAuction.start(2);
    await nftAuction.start(3);

    const balance = await mockNFT.balanceOf(nftAuction.address);
    expect(balance.toString()).to.equal("2");
  });

  it("Should not start if already started", async function () {
    await expect( nftAuction.start(2)).to.be.revertedWith("started");
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

    // token Id '2' auction with '10' starting amount
    const NFTAuction = await ethers.getContractFactory("NFTAuction");
    nftAuction = await NFTAuction.deploy();
    await nftAuction.deployed();

    await nftAuction.createAuction(mockNFT.address, 2, 10)
  })
  
  it("Should not bid before started", async function () {
    await expect( nftAuction.bid(2)).to.be.revertedWith("not started");
  });

  it("Should not bid after end time passed", async function () {
    await mockNFT.approve(nftAuction.address, 2);
    await nftAuction.start(2);

    await ethers.provider.send('evm_increaseTime', [1000 * 60 * 60 * 24 * 7 + 1]);
    await ethers.provider.send('evm_mine');

    await expect( nftAuction.bid(2, {
      from: accounts[0].address,
      value: 15
    })).to.be.revertedWith("ended");
  });
  
  it("Should bid with higher amount than current highest bid ", async function () {
    await mockNFT.approve(nftAuction.address, 2);
    await nftAuction.start(2);

    await nftAuction.connect(accounts[1]).bid(2, {
      from: accounts[1].address,
      value: 15
    })
    await expect( nftAuction.connect(accounts[2]).bid(2, {
      from: accounts[2].address,
      value: 15
    })).to.be.revertedWith("value < highest");
  });
  
  it("Should increase end time with 10 mins", async function () {
    await mockNFT.approve(nftAuction.address, 2);
    await nftAuction.start(2);

    await ethers.provider.send('evm_increaseTime', [60 * 60 * 24 * 7 - 60]);
    await ethers.provider.send('evm_mine');

    await expect( nftAuction.connect(accounts[1]).bid(2, {
      from: accounts[1].address,
      value: 20
    })).to.emit(nftAuction, "TimeIncreased")
    .withArgs(accounts[1].address, 10);
  });

  it("Should emit Bid event", async function () {
    await mockNFT.approve(nftAuction.address, 2);
    await nftAuction.start(2);

    await expect( nftAuction.connect(accounts[1]).bid(2, {
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

    // token Id '2' auction with '10' starting amount
    const NFTAuction = await ethers.getContractFactory("NFTAuction");
    nftAuction = await NFTAuction.deploy();
    await nftAuction.deployed();

    await nftAuction.createAuction(mockNFT.address, 2, 10)
  })

  it("Should not end before started", async function () {
    await expect( nftAuction.end(2)).to.be.revertedWith("not started");
  });
  
  it("Should not end before end time passed", async function () {
    await mockNFT.approve(nftAuction.address, 2);
    await nftAuction.start(2);

    await ethers.provider.send('evm_increaseTime', [60 * 60 * 24 * 7 - 10]);
    await ethers.provider.send('evm_mine');

    await expect( nftAuction.end(2)).to.be.revertedWith("not ended");
  });
 
  it("Should not end after ended", async function () {
    await mockNFT.approve(nftAuction.address, 2);
    await nftAuction.start(2);

    await ethers.provider.send('evm_increaseTime', [60 * 60 * 24 * 7 + 1]);
    await ethers.provider.send('evm_mine');
    await nftAuction.end(2);

    await expect( nftAuction.end(2)).to.be.revertedWith("ended");
  });

  it("Should pay to the seller 20 and send NFT to highest bidder", async function () {
    await mockNFT.approve(nftAuction.address, 2);
    await nftAuction.start(2);

    await nftAuction.connect(accounts[1]).bid(2, {
      from: accounts[1].address,
      value: 20
    })

    await ethers.provider.send('evm_increaseTime', [60 * 60 * 24 * 7 + 1]);
    await ethers.provider.send('evm_mine');

    await expect(() => nftAuction.end(2)).to.changeEtherBalance(accounts[0], 20);

    const balance = await mockNFT.balanceOf(accounts[1].address);
    await expect( balance.toString()).to.equal("1");
  });
  
  it("Should refund NFT to the seller when not bid", async function () {
    await mockNFT.approve(nftAuction.address, 2);
    await nftAuction.start(2);

    await ethers.provider.send('evm_increaseTime', [60 * 60 * 24 * 7 +1]);
    await ethers.provider.send('evm_mine');

    await nftAuction.end(2);

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

    // token Id '2' auction with '10' starting amount
    const NFTAuction = await ethers.getContractFactory("NFTAuction");
    nftAuction = await NFTAuction.deploy();
    await nftAuction.deployed();

    await nftAuction.createAuction(mockNFT.address, 2, 10)
  })
  
  it("Should withdraw the bid for the account1", async function () {
    await mockNFT.approve(nftAuction.address, 2);
    await nftAuction.start(2);

    await nftAuction.bid(2, {
      from: accounts[0].address,
      value: 11
    });
    await nftAuction.connect(accounts[1]).bid(2, {
      from: accounts[1].address,
      value: 12
    });
    await nftAuction.connect(accounts[2]).bid(2, {
      from: accounts[2].address,
      value: 13
    });

    await expect(() => nftAuction.connect(accounts[1]).withdraw(2)).to.be.changeEtherBalance(accounts[1], 12);
  });

  it("Should not withdraw for the highest bidder", async function () {
    await mockNFT.approve(nftAuction.address, 2);
    await nftAuction.start(2);

    await nftAuction.bid(2, {
      from: accounts[0].address,
      value: 11
    });
    await nftAuction.connect(accounts[1]).bid(2, {
      from: accounts[1].address,
      value: 12
    });
    await nftAuction.connect(accounts[2]).bid(2, {
      from: accounts[2].address,
      value: 13
    });

    await expect( nftAuction.connect(accounts[2]).withdraw(2)).to.be.revertedWith("Not bidder exist");
  });

  it("Should withdraw for only bidder", async function () {
    await mockNFT.approve(nftAuction.address, 2);
    await nftAuction.start(2);

    await nftAuction.bid(2,{
      from: accounts[0].address,
      value: 11
    });
    await nftAuction.connect(accounts[1]).bid(2,{
      from: accounts[1].address,
      value: 12
    });

   await expect( nftAuction.connect(accounts[2]).withdraw(2)).to.be.revertedWith("Not bidder exist");
  });
});