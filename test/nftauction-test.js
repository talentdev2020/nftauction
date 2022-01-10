const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Test NFTauction createAuction()", function () {
  let nftAuction;
  let mockNFT;
  let accounts;
  let auctionHashes = [];

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

    // token Id '3' auction with '11' starting amount
    await nftAuction.createAuction(mockNFT.address, 3, 10)
   
    auctionHashes[0] = ethers.utils.solidityKeccak256(["address", "address", "uint"], [accounts[0].address, mockNFT.address, 2]);
    auctionHashes[1] = ethers.utils.solidityKeccak256(["address", "address", "uint"], [accounts[0].address, mockNFT.address, 3]);

    const seller1 = await nftAuction.getSeller(auctionHashes[0]);
    const seller2 = await nftAuction.getSeller(auctionHashes[1]);

    expect( seller1 ).to.equal(accounts[0].address);
    expect( seller2 ).to.equal(accounts[0].address);
  });

  it("Should update the auction when already created: startingBid 10 -> 11", async function () {
    await nftAuction.createAuction(mockNFT.address, 2, 11);
    hash = ethers.utils.solidityKeccak256(["address", "address", "uint"], [accounts[0].address, mockNFT.address, 2]);
    const auction = await nftAuction.getAuction(hash);

    await expect( auction.highestBid).to.be.equal("11");
  });
  
  it("Should not create/update after started the auction", async function () {
    await nftAuction.start(auctionHashes[0]);

    await expect( nftAuction.createAuction(mockNFT.address, 2, 10)).to.be.revertedWith("already started");
  });

  it("Should not create for the not owner of token", async function () {
    await expect( nftAuction.connect(accounts[1]).createAuction(mockNFT.address, 5, 10)).to.be.revertedWith("not owner of token");
  });
})

describe("Test NFTauction start()", function () {
  let nftAuction;
  let mockNFT;
  let accounts;
  let auctionHashes = [];

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
    await mockNFT.approve(accounts[1].address, 4);
    await mockNFT.transferFrom(accounts[0].address, accounts[1].address, 4);
    await nftAuction.connect(accounts[1]).createAuction(mockNFT.address, 4, 10);

    auctionHashes[0] = ethers.utils.solidityKeccak256(["address", "address", "uint"], [accounts[0].address, mockNFT.address, 2]);
    auctionHashes[1] = ethers.utils.solidityKeccak256(["address", "address", "uint"], [accounts[0].address, mockNFT.address, 3]);
    auctionHashes[2] = ethers.utils.solidityKeccak256(["address", "address", "uint"], [accounts[1].address, mockNFT.address, 4]);

    const seller = await nftAuction.getSeller(auctionHashes[2]);
    expect( seller ).to.equal(accounts[1].address);

  })

  it("Should not start for not seller", async function () {
    await expect( nftAuction.connect(accounts[1]).start(auctionHashes[0])).to.be.revertedWith("not seller");

    await expect( nftAuction.start(auctionHashes[2])).to.be.revertedWith("not seller");
  });

  it("Should not start if already started", async function () {
    await nftAuction.start(auctionHashes[0]);

    await expect( nftAuction.start(auctionHashes[0])).to.be.revertedWith("started");
  });

  it("Should not start after canceled", async function () {
    await ethers.provider.send('evm_increaseTime', [60 * 60 * 24 * 7 + 1]);
    await ethers.provider.send('evm_mine');
    await nftAuction.cancel(auctionHashes[0]);

    await expect( nftAuction.start(auctionHashes[0])).to.be.revertedWith("started");
  });

});

describe("Test NFTauction bid()", function () {
  let nftAuction;
  let mockNFT;
  let accounts;
  let auctionHashes = [];

  beforeEach(async function () {
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
 
     // send token 4 from owner to account1
      await mockNFT.approve(accounts[1].address, 4);
      await mockNFT.transferFrom(accounts[0].address, accounts[1].address, 4);
     // token Id '4' auction with '10' starting amount for account1
     await nftAuction.connect(accounts[1]).createAuction(mockNFT.address, 4, 10);

    auctionHashes[0] = ethers.utils.solidityKeccak256(["address", "address", "uint"], [accounts[0].address, mockNFT.address, 2]);
    auctionHashes[1] = ethers.utils.solidityKeccak256(["address", "address", "uint"], [accounts[0].address, mockNFT.address, 3]);
    auctionHashes[2] = ethers.utils.solidityKeccak256(["address", "address", "uint"], [accounts[1].address, mockNFT.address, 4]);
  })
  
  it("Should not bid before started", async function () {
    await expect( nftAuction.bid(auctionHashes[0])).to.be.revertedWith("not started");
  });

  it("Should not bid after end time passed", async function () {
    await nftAuction.start(auctionHashes[0]);

    await ethers.provider.send('evm_increaseTime', [1000 * 60 * 60 * 24 * 7 + 1]);
    await ethers.provider.send('evm_mine');

    await expect( nftAuction.bid(auctionHashes[0], {
      from: accounts[0].address,
      value: 15
    })).to.be.revertedWith("ended");
  });
  
  it("Should not bid with samller amount than current highest bid ", async function () {
    await nftAuction.start(auctionHashes[0]);

    await nftAuction.connect(accounts[1]).bid(auctionHashes[0], {
      from: accounts[1].address,
      value: 15
    })
    await expect( nftAuction.connect(accounts[2]).bid(auctionHashes[0], {
      from: accounts[2].address,
      value: 15
    })).to.be.revertedWith("value < highest");
  });
  
  it("Should increase end time with 10 mins", async function () {
    await nftAuction.start(auctionHashes[0]);

    await ethers.provider.send('evm_increaseTime', [60 * 60 * 24 * 3 - 60]);
    await ethers.provider.send('evm_mine');

    await expect( nftAuction.connect(accounts[1]).bid(auctionHashes[0], {
      from: accounts[1].address,
      value: 20
    })).to.emit(nftAuction, "TimeIncreased")
    .withArgs(auctionHashes[0], accounts[1].address, 10);
  });

  it("Should increase end time with 10 mins for multiple actions", async function () {
    await nftAuction.start(auctionHashes[0]);
    await nftAuction.connect(accounts[1]).start(auctionHashes[2]);

    await ethers.provider.send('evm_increaseTime', [60 * 60 * 24 * 3 - 60]);
    await ethers.provider.send('evm_mine');

    await expect( nftAuction.connect(accounts[1]).bid(auctionHashes[0], {
      from: accounts[1].address,
      value: 20
    })).to.emit(nftAuction, "TimeIncreased")
    .withArgs(auctionHashes[0], accounts[1].address, 10);

    await expect( nftAuction.connect(accounts[2]).bid(auctionHashes[2], {
      from: accounts[2].address,
      value: 20
    })).to.emit(nftAuction, "TimeIncreased")
    .withArgs(auctionHashes[2], accounts[2].address, 10);
  });

  it("Should emit Bid event", async function () {
    await nftAuction.start(auctionHashes[0]);

    await expect( nftAuction.connect(accounts[1]).bid(auctionHashes[0], {
      from: accounts[1].address,
      value: 20
    })).to.emit(nftAuction, "Bid")
    .withArgs(auctionHashes[0], accounts[1].address, 20);
  });

  it("Should check existing Bid", async function () {
    await nftAuction.start(auctionHashes[0]);

    await nftAuction.connect(accounts[1]).bid(auctionHashes[0], {
      from: accounts[1].address,
      value: 20
    })

    await expect(nftAuction.connect(accounts[2]).bid(auctionHashes[0], {
      from: accounts[2].address,
      value: 24
    }));
   
    expect(await nftAuction.isExistBidder(auctionHashes[0], accounts[0].address)).to.be.equal(false);
    expect(await nftAuction.isExistBidder(auctionHashes[0], accounts[1].address)).to.be.equal(true);
    expect(await nftAuction.isExistBidder(auctionHashes[0], accounts[2].address)).to.be.equal(true);
  });
  
  it("Should update the existing Bid", async function () {
    await nftAuction.start(auctionHashes[0]);

    await nftAuction.connect(accounts[1]).bid(auctionHashes[0], {
      from: accounts[1].address,
      value: 20
    })

    await nftAuction.connect(accounts[2]).bid(auctionHashes[0], {
      from: accounts[2].address,
      value: 25
    });
    
    await nftAuction.connect(accounts[1]).bid(auctionHashes[0], {
      from: accounts[1].address,
      value: 10
    });

    const auction = await nftAuction.getAuction(auctionHashes[0]);

    expect(auction.highestBid).to.be.equal("30")
  });
  
  it("Should not update when adding balance is not greater than highest bid", async function () {
    await nftAuction.start(auctionHashes[0]);

    await nftAuction.connect(accounts[1]).bid(auctionHashes[0], {
      from: accounts[1].address,
      value: 20
    })

    await expect(nftAuction.connect(accounts[2]).bid(auctionHashes[0], {
      from: accounts[2].address,
      value: 25
    }));
    
    await (expect(nftAuction.connect(accounts[1]).bid(auctionHashes[0], {
      from: accounts[1].address,
      value: 5
    }))).to.be.revertedWith("value < highest");;
  });
 
  it("Should emit Bid event for muliple acutions", async function () {
    await mockNFT.connect(accounts[1]).approve(nftAuction.address, 4);
    await nftAuction.start(auctionHashes[0]);
    await nftAuction.connect(accounts[1]).start(auctionHashes[2]);

    await expect( nftAuction.connect(accounts[1]).bid(auctionHashes[0], {
      from: accounts[1].address,
      value: 20
    })).to.emit(nftAuction, "Bid")
    .withArgs(auctionHashes[0], accounts[1].address, 20);
   
    await expect( nftAuction.connect(accounts[2]).bid(auctionHashes[2], {
      from: accounts[2].address,
      value: 30
    })).to.emit(nftAuction, "Bid")
    .withArgs(auctionHashes[2], accounts[2].address, 30);
  });
});

describe("Test NFTAuction accept()", function () {
  let nftAuction;
  let mockNFT;
  let accounts;
  let auctionHashes = [];
  
  beforeEach(async function () {
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
     await mockNFT.approve(accounts[1].address, 4);
     await mockNFT.transferFrom(accounts[0].address, accounts[1].address, 4);
     await nftAuction.connect(accounts[1]).createAuction(mockNFT.address, 4, 10);

    auctionHashes[0] = ethers.utils.solidityKeccak256(["address", "address", "uint"], [accounts[0].address, mockNFT.address, 2]);
    auctionHashes[1] = ethers.utils.solidityKeccak256(["address", "address", "uint"], [accounts[0].address, mockNFT.address, 3]);
    auctionHashes[2] = ethers.utils.solidityKeccak256(["address", "address", "uint"], [accounts[1].address, mockNFT.address, 4]);
  })

  it("Should not accept before started", async function () {
    await expect( nftAuction.accept(auctionHashes[0])).to.be.revertedWith("not started");
  });
  
  it("Should not accept after ended", async function () {
    await mockNFT.approve(nftAuction.address, 2);
    await nftAuction.start(auctionHashes[0]);

    await ethers.provider.send('evm_increaseTime', [60 * 60 * 24 * 7 + 1]);
    await ethers.provider.send('evm_mine');
    await nftAuction.accept(auctionHashes[0]);

    await expect( nftAuction.accept(auctionHashes[0])).to.be.revertedWith("ended");
  });

  it("Should pay to the seller and send NFTs to highest bidders: multiple actions for Token2 and Token3", async function () {
    await mockNFT.approve(nftAuction.address, 2);
    await mockNFT.approve(nftAuction.address, 3);
    await nftAuction.start(auctionHashes[0]);
    await nftAuction.start(auctionHashes[1]);

    await nftAuction.connect(accounts[1]).bid(auctionHashes[0], {
      from: accounts[1].address,
      value: 20
    })
    await nftAuction.connect(accounts[2]).bid(auctionHashes[1], {
      from: accounts[2].address,
      value: 30
    })

    await ethers.provider.send('evm_increaseTime', [60 * 60 * 24 * 7 + 1]);
    await ethers.provider.send('evm_mine');

    await expect(() => nftAuction.accept(auctionHashes[0])).to.changeEtherBalance(accounts[0], 20);
    await expect(() => nftAuction.accept(auctionHashes[1])).to.changeEtherBalance(accounts[0], 30);
    
    // account1 has token 4 initially and got token2
    const balance1 = await mockNFT.balanceOf(accounts[1].address);
    await expect( balance1.toString()).to.equal("2");
    
    const balance2 = await mockNFT.balanceOf(accounts[2].address);
    await expect( balance2.toString()).to.equal("1");
  });
});

describe("Test NFTAuction cancel()", function () {
  let nftAuction;
  let mockNFT;
  let accounts;
  let auctionHashes = [];
  
  beforeEach(async function () {
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
     await mockNFT.approve(accounts[1].address, 4);
     await mockNFT.transferFrom(accounts[0].address, accounts[1].address, 4);
     await nftAuction.connect(accounts[1]).createAuction(mockNFT.address, 4, 10);

    auctionHashes[0] = ethers.utils.solidityKeccak256(["address", "address", "uint"], [accounts[0].address, mockNFT.address, 2]);
    auctionHashes[1] = ethers.utils.solidityKeccak256(["address", "address", "uint"], [accounts[0].address, mockNFT.address, 3]);
    auctionHashes[2] = ethers.utils.solidityKeccak256(["address", "address", "uint"], [accounts[1].address, mockNFT.address, 4]);
  })

  it("Should not cancel before started", async function () {
    await expect( nftAuction.cancel(auctionHashes[0])).to.be.revertedWith("not started");
  });
 
  it("Should not accept after ended", async function () {
    await mockNFT.approve(nftAuction.address, 2);
    await nftAuction.start(auctionHashes[0]);

    await ethers.provider.send('evm_increaseTime', [60 * 60 * 24 * 7 + 1]);
    await ethers.provider.send('evm_mine');
    await nftAuction.accept(auctionHashes[0]);

    await expect( nftAuction.cancel(auctionHashes[0])).to.be.revertedWith("ended");
  });

 
  it("Should not accept after canceled", async function () {
    await mockNFT.approve(nftAuction.address, 2);
    await nftAuction.start(auctionHashes[0]);

    await ethers.provider.send('evm_increaseTime', [60 * 60 * 24 * 7 + 1]);
    await ethers.provider.send('evm_mine');
    await nftAuction.cancel(auctionHashes[0]);

    await expect( nftAuction.accept(auctionHashes[0])).to.be.revertedWith("ended");
  });
});


describe("Test NFTauction withdraw()", function () {
  let nftAuction;
  let mockNFT;
  let accounts;
  let auctionHashes = []

  beforeEach(async function () {
    accounts = await ethers.getSigners();

    const MockNFT = await ethers.getContractFactory("MockNFT");
    mockNFT = await MockNFT.deploy();
    await mockNFT.deployed();

    const NFTAuction = await ethers.getContractFactory("NFTAuction");
    nftAuction = await NFTAuction.deploy();
    await nftAuction.deployed();

    // token Id '2' auction with '10' starting amount
    await nftAuction.createAuction(mockNFT.address, 2, 10)
    auctionHashes[0] = ethers.utils.solidityKeccak256(["address", "address", "uint"], [accounts[0].address, mockNFT.address, 2]);
  })

  it("Should not withdraw before end", async function () {
    await mockNFT.approve(nftAuction.address, 2);
    await nftAuction.start(auctionHashes[0]);

    await nftAuction.bid(auctionHashes[0], {
      from: accounts[0].address,
      value: 11
    });
    await nftAuction.connect(accounts[1]).bid(auctionHashes[0], {
      from: accounts[1].address,
      value: 12
    });
    await nftAuction.connect(accounts[2]).bid(auctionHashes[0], {
      from: accounts[2].address,
      value: 13
    });
   
    await expect(nftAuction.connect(accounts[1]).withdraw(auctionHashes[0])).to.be.revertedWith("not auction ended");
  });

  it("Should withdraw the bid for outbid: account1", async function () {
    await mockNFT.approve(nftAuction.address, 2);
    await nftAuction.start(auctionHashes[0]);

    await nftAuction.bid(auctionHashes[0], {
      from: accounts[0].address,
      value: 11
    });
    await nftAuction.connect(accounts[1]).bid(auctionHashes[0], {
      from: accounts[1].address,
      value: 12
    });
    await nftAuction.connect(accounts[2]).bid(auctionHashes[0], {
      from: accounts[2].address,
      value: 13
    });

    await nftAuction.accept(auctionHashes[0]);
 
    // for not existing bidder
    await expect( nftAuction.connect(accounts[3]).withdraw(auctionHashes[0])).to.be.revertedWith("no bidder exist");

    await expect(() => nftAuction.withdraw(auctionHashes[0])).to.be.changeEtherBalance(accounts[0], 11);
    await expect(() => nftAuction.connect(accounts[1]).withdraw(auctionHashes[0])).to.be.changeEtherBalance(accounts[1], 12);
  });

  it("Should not withdraw for the highest bidder", async function () {
    await mockNFT.approve(nftAuction.address, 2);
    await nftAuction.start(auctionHashes[0]);

    await nftAuction.bid(auctionHashes[0],{
      from: accounts[0].address,
      value: 11
    });
    await nftAuction.connect(accounts[1]).bid(auctionHashes[0],{
      from: accounts[1].address,
      value: 12
    });

   await nftAuction.accept(auctionHashes[0]);

   // for highest bidder
   await expect( nftAuction.connect(accounts[1]).withdraw(auctionHashes[0])).to.be.revertedWith("not available for highest bidder");
  });
  
  it("Should not withdraw after already withdrawn", async function () {
    await mockNFT.approve(nftAuction.address, 2);
    await nftAuction.start(auctionHashes[0]);

    await nftAuction.bid(auctionHashes[0],{
      from: accounts[0].address,
      value: 11
    });
    await nftAuction.connect(accounts[1]).bid(auctionHashes[0],{
      from: accounts[1].address,
      value: 12
    });

   await nftAuction.accept(auctionHashes[0]);

   await nftAuction.withdraw(auctionHashes[0]);

   await expect( nftAuction.withdraw(auctionHashes[0])).to.be.revertedWith("already withdrawn");
  });
});