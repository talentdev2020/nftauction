const { expect } = require("chai");
const { ethers } = require("hardhat");

async function init() {
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
    const auctionHashes=  [];
    auctionHashes[0] = ethers.utils.solidityKeccak256(["address", "address", "uint"], [accounts[0].address, mockNFT.address, 2]);
    auctionHashes[1] = ethers.utils.solidityKeccak256(["address", "address", "uint"], [accounts[0].address, mockNFT.address, 3]);
    auctionHashes[2] = ethers.utils.solidityKeccak256(["address", "address", "uint"], [accounts[1].address, mockNFT.address, 4]);

    return {
      nftAuction,
      mockNFT,
      accounts,
      auctionHashes
    }
}

describe("Test NFTauction createAuction()", function () {
  let nftAuction;
  let mockNFT;
  let accounts;
  let auctionHashes = [];

  it("Should set the seller of auction with the caller", async function () {
    const initData = await init();

    ({accounts, nftAuction, mockNFT, auctionHashes} = initData);

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
    await nftAuction.startAll();

    await expect( nftAuction.createAuction(mockNFT.address, 2, 10)).to.be.revertedWith("already started");
  });

  it("Should not create for the not owner of token", async function () {
    await expect( nftAuction.connect(accounts[1]).createAuction(mockNFT.address, 5, 10)).to.be.revertedWith("not owner of token");
  });
})

describe("Test NFTauction start()", function () {
  let nftAuction;
  let accounts;
  let auctionHashes = [];

  it("Should create auctions", async function () {
    const initData = await init();

    ({accounts, nftAuction, auctionHashes} = initData);

    const seller = await nftAuction.getSeller(auctionHashes[2]);
    expect( seller ).to.equal(accounts[1].address);

  })

  it("Should not start for not seller or not owner", async function () {
    await expect( nftAuction.connect(accounts[1]).start(auctionHashes[0])).to.be.revertedWith("not owner");
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

describe("Test NFTauction startAll()", function () {
  let nftAuction;
  let mockNFT;
  let accounts;
  let auctionHashes = [];

  it("Should create auctions", async function () {
    const initData = await init();

    ({accounts, nftAuction, mockNFT, auctionHashes} = initData);

    const seller = await nftAuction.getSeller(auctionHashes[2]);
    expect( seller ).to.equal(accounts[1].address);

  })

  it("Should not start all auctions for not owner", async function () {
    await expect( nftAuction.connect(accounts[1]).startAll()).to.be.revertedWith("Ownable: caller is not the owner");
  });

  it("Should start all auctions", async function () {
    await nftAuction.startAll();
    
    const auction0 = await nftAuction.getAuction(auctionHashes[0]);
    expect(auction0.started).to.be.equal(true);

    const auction1 = await nftAuction.getAuction(auctionHashes[1]);
    expect(auction1.started).to.be.equal(true);
    
    const auction2 = await nftAuction.getAuction(auctionHashes[2]);
    expect(auction2.started).to.be.equal(true);
  });
});

describe("Test NFTauction bid()", function () {
  let nftAuction;
  let mockNFT;
  let accounts;
  let auctionHashes = [];

  beforeEach(async function () {
    const initData = await init();

    ({accounts, nftAuction, mockNFT, auctionHashes} = initData);
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
  
  it("Should not bid with samller amount than minium bid ", async function () {
    await nftAuction.start(auctionHashes[0]);

    
    await nftAuction.connect(accounts[1]).bid(auctionHashes[0], {
      from: accounts[1].address,
      value: 15
    })
    // when current highest bid is 15;
    await expect( nftAuction.connect(accounts[2]).bid(auctionHashes[0], {
      from: accounts[2].address,
      value: 24
    })).to.be.revertedWith("not miniumbid");

    // bid with 25
    await nftAuction.connect(accounts[1]).bid(auctionHashes[0], {
      from: accounts[1].address,
      value: 25
    })

    await nftAuction.connect(accounts[1]).bid(auctionHashes[0], {
      from: accounts[1].address,
      value: 101
    })
    // when current highest bid is 101;
    await expect( nftAuction.connect(accounts[2]).bid(auctionHashes[0], {
      from: accounts[2].address,
      value: 150
    })).to.be.revertedWith("not miniumbid");
  });
  
  it("Should increase end time with 10 mins", async function () {
    await nftAuction.startAll();

    await ethers.provider.send('evm_increaseTime', [60 * 60 * 24 * 3 - 60]);
    await ethers.provider.send('evm_mine');

    await expect( nftAuction.connect(accounts[1]).bid(auctionHashes[0], {
      from: accounts[1].address,
      value: 20
    })).to.emit(nftAuction, "TimeIncreased")
    .withArgs(auctionHashes[0], accounts[1].address, 10);
  });

  it("Should increase end time with 10 mins for multiple actions", async function () {
    await nftAuction.startAll();
    
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
    await nftAuction.startAll();

    await expect( nftAuction.connect(accounts[1]).bid(auctionHashes[0], {
      from: accounts[1].address,
      value: 20
    })).to.emit(nftAuction, "Bid")
   
    await expect( nftAuction.connect(accounts[1]).bid(auctionHashes[0], {
      from: accounts[1].address,
      value: 10
    })).to.emit(nftAuction, "Bid")
    .withArgs(auctionHashes[0], accounts[1].address, 30);
  });

  it("Should update the existing Bid", async function () {
    await nftAuction.startAll();

    await nftAuction.connect(accounts[1]).bid(auctionHashes[0], {
      from: accounts[1].address,
      value: 20
    })

    await nftAuction.connect(accounts[2]).bid(auctionHashes[0], {
      from: accounts[2].address,
      value: 35
    });
    
    await nftAuction.connect(accounts[1]).bid(auctionHashes[0], {
      from: accounts[1].address,
      value: 25
    });

    const auction = await nftAuction.getAuction(auctionHashes[0]);

    expect(auction.highestBid).to.be.equal("45")
  });
  
  it("Should not update when adding balance is not greater than minium bid", async function () {
    await nftAuction.startAll();

    await nftAuction.connect(accounts[1]).bid(auctionHashes[0], {
      from: accounts[1].address,
      value: 20
    })

    await expect(nftAuction.connect(accounts[2]).bid(auctionHashes[0], {
      from: accounts[2].address,
      value: 35
    }));
    
    await (expect(nftAuction.connect(accounts[1]).bid(auctionHashes[0], {
      from: accounts[1].address,
      value: 24
    }))).to.be.revertedWith("not miniumbid");;
  });
 
  it("Should emit Bid event for muliple acutions", async function () {
    await nftAuction.startAll();

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
    const initData = await init();

    ({accounts, nftAuction, mockNFT, auctionHashes} = initData);
  })

  it("Should not accept before started", async function () {
    await expect( nftAuction.accept(auctionHashes[0])).to.be.revertedWith("not started");
  });
  
  it("Should not accept after ended", async function () {
    await mockNFT.approve(nftAuction.address, 2);
    await nftAuction.startAll();
   
    await nftAuction.bid(auctionHashes[0], {
      from: accounts[0].address,
      value: 20
    })
    await ethers.provider.send('evm_increaseTime', [60 * 60 * 24 * 7 + 1]);
    await ethers.provider.send('evm_mine');
    
    await nftAuction.accept(auctionHashes[0]);

    await expect( nftAuction.accept(auctionHashes[0])).to.be.revertedWith("ended");
  });

  it("Should pay to the seller and send NFTs to highest bidders: multiple actions for Token2 and Token3", async function () {
    await mockNFT.approve(nftAuction.address, 2);
    await mockNFT.approve(nftAuction.address, 3);
    await nftAuction.startAll();

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
  let auctionHashes = [];
  
  beforeEach(async function () {
    const initData = await init();

    ({nftAuction, mockNFT, auctionHashes} = initData);
  })

  it("Should not cancel before started", async function () {
    await expect( nftAuction.cancel(auctionHashes[0])).to.be.revertedWith("not started");
  });
 
  it("Should not accept after ended", async function () {
    await mockNFT.approve(nftAuction.address, 2);
    await nftAuction.startAll();
    
    await nftAuction.bid(auctionHashes[0], {
      from: accounts[0].address,
      value: 11
    });

    await ethers.provider.send('evm_increaseTime', [60 * 60 * 24 * 7 + 1]);
    await ethers.provider.send('evm_mine');
    
    await nftAuction.accept(auctionHashes[0]);

    await expect( nftAuction.cancel(auctionHashes[0])).to.be.revertedWith("ended");
  });

 
  it("Should not accept after canceled", async function () {
    await mockNFT.approve(nftAuction.address, 2);
    await nftAuction.startAll();

    await ethers.provider.send('evm_increaseTime', [60 * 60 * 24 * 7 + 1]);
    await ethers.provider.send('evm_mine');
    await nftAuction.cancel(auctionHashes[0]);

    await expect( nftAuction.accept(auctionHashes[0])).to.be.revertedWith("ended");
  });
  
  it("Should relist after canceled", async function () {
    await mockNFT.approve(nftAuction.address, 2);
    await nftAuction.startAll();

    await ethers.provider.send('evm_increaseTime', [60 * 60 * 24 * 7 + 1]);
    await ethers.provider.send('evm_mine');
    await nftAuction.cancel(auctionHashes[0]);

    // relist the auctionHash[0]
    await nftAuction.createAuction(mockNFT.address, 2, 100);
    const auction = await nftAuction.getAuction(auctionHashes[0]);
    expect(auction.started).to.be.equal(false);
    expect(auction.ended).to.be.equal(false);
    expect(auction.isValue).to.be.equal(true);
    expect(auction.highestBid).to.be.equal(100);
  });
});

describe("Test NFTauction withdraw()", function () {
  let nftAuction;
  let mockNFT;
  let accounts;
  let auctionHashes = []

  beforeEach(async function () {
    const initData = await init();

    ({accounts, nftAuction, mockNFT, auctionHashes} = initData);
  })

  it("Should withdraw the bid for outbid: account1", async function () {
    await mockNFT.approve(nftAuction.address, 2);
    await nftAuction.start(auctionHashes[0]);

    await nftAuction.bid(auctionHashes[0], {
      from: accounts[0].address,
      value: 11
    });
    await nftAuction.connect(accounts[1]).bid(auctionHashes[0], {
      from: accounts[1].address,
      value: 21
    });
    await nftAuction.connect(accounts[2]).bid(auctionHashes[0], {
      from: accounts[2].address,
      value: 31
    });

    await nftAuction.accept(auctionHashes[0]);
 
    // for not existing bidder
    await expect( nftAuction.connect(accounts[3]).withdraw(auctionHashes[0])).to.be.revertedWith("no bidder exist");

    await expect(() => nftAuction.withdraw(auctionHashes[0])).to.be.changeEtherBalance(accounts[0], 11);
    await expect(() => nftAuction.connect(accounts[1]).withdraw(auctionHashes[0])).to.be.changeEtherBalance(accounts[1], 21);
  });

  it("Should not withdraw for the highest bidder", async function () {
    await mockNFT.approve(nftAuction.address, 2);
    await nftAuction.startAll();

    await nftAuction.bid(auctionHashes[0],{
      from: accounts[0].address,
      value: 11
    });
    await nftAuction.connect(accounts[1]).bid(auctionHashes[0],{
      from: accounts[1].address,
      value: 21
    });

   await nftAuction.accept(auctionHashes[0]);

   // for highest bidder
   await expect( nftAuction.connect(accounts[1]).withdraw(auctionHashes[0])).to.be.revertedWith("not available for highest bidder");
  });
  
  it("Should not withdraw after withdrawn", async function () {
    await mockNFT.approve(nftAuction.address, 2);
    await nftAuction.startAll();

    await nftAuction.bid(auctionHashes[0],{
      from: accounts[0].address,
      value: 11
    });
    await nftAuction.connect(accounts[1]).bid(auctionHashes[0],{
      from: accounts[1].address,
      value: 21
    });

   await nftAuction.accept(auctionHashes[0]);

   await nftAuction.withdraw(auctionHashes[0]);

   await expect( nftAuction.withdraw(auctionHashes[0])).to.be.revertedWith("no bidder exist");
  });

  it("Should allow withdraw for the highest bidder after cancelling the auction", async function () {
    await nftAuction.startAll();

    await nftAuction.bid(auctionHashes[0],{
      from: accounts[0].address,
      value: 11
    });
    await nftAuction.connect(accounts[1]).bid(auctionHashes[0],{
      from: accounts[1].address,
      value: 21
    });

   await nftAuction.cancel(auctionHashes[0]);

   // for highest bidder
   expect( await nftAuction.connect(accounts[1]).withdraw(auctionHashes[0])).to.be.changeEtherBalance(accounts[1], 21);
  });
});

describe("Test NFTauction getAllBids()", function () {
  let nftAuction;
  let accounts;
  let auctionHashes = []

  beforeEach(async function () {
    const initData = await init();

    ({accounts, nftAuction, auctionHashes} = initData);
  })

  it("Should return all bids", async function () {
    await nftAuction.startAll();

    await nftAuction.bid(auctionHashes[0], {
      from: accounts[0].address,
      value: 11
    });
    await nftAuction.connect(accounts[1]).bid(auctionHashes[0], {
      from: accounts[1].address,
      value: 21
    });
    await nftAuction.connect(accounts[2]).bid(auctionHashes[0], {
      from: accounts[2].address,
      value: 31
    });
   
    const auctions = await nftAuction.getAllBids(auctionHashes[0]);

    expect(auctions.length).to.be.equal(3);
    expect(auctions[0].bidder).to.be.equal(accounts[0].address);
    expect(auctions[1].bidder).to.be.equal(accounts[1].address);
    expect(auctions[2].bidder).to.be.equal(accounts[2].address);

  });
});

describe("Test NFTauction minimumBid()", function () {
  let nftAuction;
  let accounts;
  let auctionHashes = []

  beforeEach(async function () {
    const initData = await init();

    ({accounts, nftAuction, auctionHashes} = initData);
  })

  it("Should return correct next highest bid", async function () {
    await nftAuction.startAll();

    await nftAuction.bid(auctionHashes[0], {
      from: accounts[0].address,
      value: 11
    });
    // when current highest bid is 11
    expect(await nftAuction.minimumBid(auctionHashes[0])).to.be.equal(21);

    await nftAuction.connect(accounts[1]).bid(auctionHashes[0], {
      from: accounts[1].address,
      value: 101
    });
    // when current highest bid is 101
    expect(await nftAuction.minimumBid(auctionHashes[0])).to.be.equal(151);

    await nftAuction.connect(accounts[2]).bid(auctionHashes[0], {
      from: accounts[2].address,
      value: 1001
    });
    // when current highest bid is 1001
    expect(await nftAuction.minimumBid(auctionHashes[0])).to.be.equal(1101);

    await nftAuction.connect(accounts[3]).bid(auctionHashes[0], {
      from: accounts[3].address,
      value: 5000
    });
    // when current highest bid is 5000
    expect(await nftAuction.minimumBid(auctionHashes[0])).to.be.equal(5100);
    
    await nftAuction.connect(accounts[4]).bid(auctionHashes[0], {
      from: accounts[4].address,
      value: 5100
    });
    // when current highest bid is 5100
    expect(await nftAuction.minimumBid(auctionHashes[0])).to.be.equal(5350);
   
    await nftAuction.connect(accounts[5]).bid(auctionHashes[0], {
      from: accounts[5].address,
      value: 10001
    });
    // when current highest bid is 10001
    expect(await nftAuction.minimumBid(auctionHashes[0])).to.be.equal(10501);
  });
});