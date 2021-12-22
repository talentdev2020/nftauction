// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Counters.sol";


/**
question:
  
  For the event, auctionhash or actionId
  For all function, auction id or action hash?
  Why auctionHash?
 */
struct Auction {
    address nft;
    address payable seller;
    address highestBidder;
    uint nftId;
    uint highestBid;
    uint endAt;
    bool started;
    bool ended;
}
contract NFTAuction is Ownable, ReentrancyGuard{
    event Start(uint indexed auctionId);
    event Bid(uint indexed auctionId, address indexed sender, uint amount);
    event Withdraw(uint indexed auctionId, address indexed bidder, uint amount);
    event Accept(uint indexed auctionId, address winner, uint amount);
    event Cancel(uint indexed auctionId, address seller);
    event TimeIncreased(uint indexed auctionId, address sender, uint increasedMinutes);

    using Counters for Counters.Counter;

    Counters.Counter public auctionId;

    //AuctionId to Auction Data
    mapping(uint => Auction) public auctions;
    mapping(uint => mapping(address => uint)) bids;
    //Hash to AuctionId
    mapping(bytes32 => uint) public auctionHashes;

    modifier onlyAuctionOwner(uint _auctionId, address _address) {
        require(auctions[_auctionId].seller == _address, "not seller");
        _;
    }

    modifier onlyAuctionStarted(uint _auctionId) {
        require(auctions[_auctionId].started, "not started");
        _;
    }

    constructor() {
    }

    // makeHash from auction information
    function makeHash(address seller, address _nft, uint _nftId) internal pure returns(bytes32) {
        return keccak256(abi.encode(seller, _nft, _nftId));
    }
    
    function updateAuction(uint _auctionId, address _nft, uint _nftId, uint _startingBid) internal {
        Auction memory auction;
        auction.nft = _nft;
        auction.nftId = _nftId;
        auction.seller = payable(msg.sender);
        auction.highestBid = _startingBid;

        auctions[_auctionId] = auction;
    }

    // create or update auction
    function createAuction(address _nft, uint _nftId, uint _startingBid) external {
        require(ERC721(_nft).ownerOf(_nftId) == msg.sender, "not owner of token");
        
        bytes32 auctionHash = makeHash(msg.sender, _nft, _nftId);
        uint _auctionId = auctionHashes[auctionHash];

        //Auction already exists, update if not active otherwise revert
        if (_auctionId == 0) {
            auctionId.increment();
            uint currentId = auctionId.current();
            auctionHashes[auctionHash] == currentId;   
            
            updateAuction(currentId, _nft, _nftId, _startingBid);
        } else {
            if (!auctions[_auctionId].started) {
                updateAuction(_auctionId, _nft, _nftId, _startingBid);
            } else {
                revert("already started");
            }
        }
    }

    // get the seller of the auction
    function getSeller(uint _auctionId) public onlyOwner view returns(address) {
        return auctions[_auctionId].seller;
    }

    function getAcution(bytes32 _auctionHash) public view returns(Auction memory) {
        return auctions[auctionHashes[_auctionHash]];
    }

    function start(uint _auctionId) external onlyAuctionOwner(_auctionId, msg.sender) {
        require(!auctions[_auctionId].started, "started");
        
        auctions[_auctionId].started = true;
        auctions[_auctionId].endAt = block.timestamp + 7 days;

        emit Start(_auctionId);
    }

    function bid(uint _auctionId) external payable onlyAuctionStarted(_auctionId) {
        require(!auctions[_auctionId].ended, "auction ended");
        require(block.timestamp < auctions[_auctionId].endAt, "ended");
        require(msg.value > auctions[_auctionId].highestBid, "value < highest");

        if (auctions[_auctionId].highestBidder != address(0)) {
            bids[_auctionId][auctions[_auctionId].highestBidder] += auctions[_auctionId].highestBid;
        }

        auctions[_auctionId].highestBidder = msg.sender;
        auctions[_auctionId].highestBid = msg.value;

        if (block.timestamp > auctions[_auctionId].endAt - 10 minutes) {
            auctions[_auctionId].endAt += 10 minutes;
            emit TimeIncreased(_auctionId, msg.sender, 10);    
        }

        emit Bid(_auctionId, msg.sender, msg.value);
    }

    function withdraw(uint _auctionId) external nonReentrant {
        require(auctions[_auctionId].ended, "not auction ended");

        uint bal = bids[_auctionId][msg.sender];
        require(bal > 0, "no bidder exist");

        bids[_auctionId][msg.sender] = 0;
        payable(msg.sender).transfer(bal);

        emit Withdraw(_auctionId, msg.sender, bal);
    }

    function accept(uint _auctionId) external 
        onlyAuctionOwner (_auctionId, msg.sender)
        onlyAuctionStarted(_auctionId) 
    {
        require(block.timestamp >= auctions[_auctionId].endAt, "not ended");
        require(!auctions[_auctionId].ended, "ended");

        auctions[_auctionId].ended = true;
        if (auctions[_auctionId].highestBidder != address(0)) {
            ERC721(auctions[_auctionId].nft).safeTransferFrom(address(this), auctions[_auctionId].highestBidder, _auctionId);
            auctions[_auctionId].seller.transfer(auctions[_auctionId].highestBid);
        }

        emit Accept(_auctionId, auctions[_auctionId].highestBidder, auctions[_auctionId].highestBid);
    }

    function cancel(uint _auctionId) external 
        onlyAuctionOwner(_auctionId, msg.sender)
        onlyAuctionStarted(_auctionId)
    {
        require(block.timestamp >= auctions[_auctionId].endAt, "not ended");
        require(!auctions[_auctionId].ended, "ended");

        auctions[_auctionId].ended = true;

        bytes32 auctionHash = makeHash(auctions[_auctionId].seller, auctions[_auctionId].nft, auctions[_auctionId].nftId);
        delete auctionHashes[auctionHash];

        emit Cancel(_auctionId, msg.sender);
    }
}