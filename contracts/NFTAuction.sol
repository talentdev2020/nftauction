// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "hardhat/console.sol";

struct Auction {
    address nft;
    address payable seller;
    address highestBidder;
    uint nftId;
    uint highestBid;
    uint endAt;
    bool started;
    bool ended;
    bool isValue;
    uint hashId;
}
struct BidInfo{
  address bidder;
  uint value;
  bool hasWithdrawn;
}

contract NFTAuction is Ownable, ReentrancyGuard{
    event Start(bytes32 indexed auctionHash);
    event Bid(bytes32 indexed auctionHash, address indexed sender, uint amount);
    event Withdraw(bytes32 indexed auctionHash, address indexed bidder, uint amount);
    event Accept(bytes32 indexed auctionHash, address winner, uint amount);
    event Cancel(bytes32 indexed auctionHash, address seller);
    event TimeIncreased(bytes32 indexed auctionHash, address sender, uint increasedMinutes);

    // using Counters for Counters.Counter;

    // Counters.Counter public auctionId;

    //AuctionId to Auction Data
    mapping(bytes32 => Auction) public auctions;
    // mapping(bytes32 => mapping(address => uint)) bids;
    mapping(bytes32 => BidInfo[]) bids;
    bytes32[] public auctionHashes;
    uint runTime = 3 days;
    // //Hash to AuctionId
    // mapping(bytes32 => uint) public auctionHashes;

    modifier onlyAuctionOwner(bytes32 _auctionHash, address _address) {
        require(auctions[_auctionHash].seller == _address, "not seller");
        _;
    }

    modifier onlyAuctionStarted(bytes32 _auctionHash) {
        require(auctions[_auctionHash].started, "not started");
        _;
    }

    function count() public view returns(uint){
        return auctionHashes.length;
    }

    function hashes() public view returns(bytes32[] memory){
        return auctionHashes;
    }

    function updateRuntime(uint _time) public onlyOwner{
        runTime = _time;
    }

    constructor() {
    }
    
    function _createAuction(bytes32 _auctionHash, address _nft, uint _nftId, uint _startingBid, address _seller) internal {
        auctionHashes.push(_auctionHash);
        Auction memory auction;
        auction.nft = _nft;
        auction.nftId = _nftId;
        auction.seller = payable(_seller);
        auction.highestBid = _startingBid;
        auction.isValue = true;
        auction.hashId = count() - 1;
        auctions[_auctionHash] = auction;
    }
    
    function _updateAuction(bytes32 _auctionHash, uint _startingBid) internal {
        auctions[_auctionHash].highestBid = _startingBid;
    }

    // create or update auction
    function createAuction(address _nft, uint _nftId, uint _startingBid) external {
        require(ERC721(_nft).ownerOf(_nftId) == msg.sender, "not owner of token");
        
        bytes32 auctionHash = keccak256(abi.encodePacked(msg.sender, _nft, _nftId));
        //Auction already exists, update if not active otherwise revert
        if (!auctions[auctionHash].isValue) {
            _createAuction(auctionHash, _nft, _nftId, _startingBid, msg.sender);
        } else {
            if (!auctions[auctionHash].started) {
                _updateAuction(auctionHash, _startingBid);
            } else {
                revert("already started");
            }
        }
    }

    // get the seller of the auction
    function getSeller(bytes32 _auctionHash) public onlyOwner view returns(address) {
        return auctions[_auctionHash].seller;
    }

    function getAuction(bytes32 _auctionHash) public view returns(Auction memory) {
        return auctions[_auctionHash];
    }

    function start(bytes32 _auctionHash) external onlyOwner {
        require(!auctions[_auctionHash].started, "started");
        
        auctions[_auctionHash].started = true;
        auctions[_auctionHash].endAt = block.timestamp + runTime;

        emit Start(_auctionHash);
    }

    function getBidIndex(bytes32 _auctionHash, address _address) internal view returns (uint256) {
        uint256 len = bids[_auctionHash].length;
        
        for(uint256 i = 0; i < len; i ++) {
            if (bids[_auctionHash][i].bidder == _address && !bids[_auctionHash][i].hasWithdrawn) {
                return i;
            }
        }
        
        return type(uint256).max;
    }

    function bid(bytes32 _auctionHash) external payable onlyAuctionStarted(_auctionHash) {
        require(!auctions[_auctionHash].ended, "auction ended");
        require(block.timestamp < auctions[_auctionHash].endAt, "ended");

        uint bidIndex = getBidIndex(_auctionHash, msg.sender);
        uint newBidAmount = msg.value;
        if (type(uint256).max != bidIndex) {
            newBidAmount = bids[_auctionHash][bidIndex].value + msg.value;
            
            require(newBidAmount > auctions[_auctionHash].highestBid, "value < highest");
            bids[_auctionHash][bidIndex].value = newBidAmount;
         } else {
            require(msg.value > auctions[_auctionHash].highestBid, "value < highest");

            BidInfo memory newBid;
            newBid.value = msg.value;
            newBid.bidder = msg.sender;

            bids[_auctionHash].push(newBid);
        }

        auctions[_auctionHash].highestBidder = msg.sender;
        auctions[_auctionHash].highestBid = newBidAmount;

        if (block.timestamp > auctions[_auctionHash].endAt - 10 minutes) {
            auctions[_auctionHash].endAt += 10 minutes;
            emit TimeIncreased(_auctionHash, msg.sender, 10);    
        }

        emit Bid(_auctionHash, msg.sender, msg.value);
    }

    function withdraw(bytes32 _auctionHash) external nonReentrant {
        require(auctions[_auctionHash].highestBidder != msg.sender, "not available for highest bidder");
        
        uint bidIndex = getBidIndex(_auctionHash, msg.sender);
        require(type(uint256).max != bidIndex, "no bidder exist");

        uint balance = bids[_auctionHash][bidIndex].value;   

        bids[_auctionHash][bidIndex].hasWithdrawn = true;
        payable(msg.sender).transfer(balance);

        emit Withdraw(_auctionHash, msg.sender, balance);
    }

    function getAllBids(bytes32 _auctionHash) external view returns(BidInfo[] memory) {
        return bids[_auctionHash];
    }

    function accept(bytes32 _auctionHash) external 
        onlyAuctionOwner (_auctionHash, msg.sender)
        onlyAuctionStarted(_auctionHash) 
    {
        require(!auctions[_auctionHash].ended, "ended");

        auctions[_auctionHash].ended = true;
        if (auctions[_auctionHash].highestBidder != address(0)) {
            ERC721(auctions[_auctionHash].nft).safeTransferFrom(auctions[_auctionHash].seller, auctions[_auctionHash].highestBidder, auctions[_auctionHash].nftId);
            auctions[_auctionHash].seller.transfer(auctions[_auctionHash].highestBid);
        }

        emit Accept(_auctionHash, auctions[_auctionHash].highestBidder, auctions[_auctionHash].highestBid);
    }

    function cancel(bytes32 _auctionHash) external 
        onlyAuctionOwner(_auctionHash, msg.sender)
        onlyAuctionStarted(_auctionHash)
    {
        require(!auctions[_auctionHash].ended, "ended");

        auctions[_auctionHash].ended = true;

        emit Cancel(_auctionHash, msg.sender);
    }
}