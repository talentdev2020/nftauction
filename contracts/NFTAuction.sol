// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

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
  uint created;
  bool hasWithdrawn;
}

contract NFTAuction is Ownable, ReentrancyGuard{
    event Start(bytes32 indexed auctionHash);
    event Bid(bytes32 indexed auctionHash, address indexed sender, uint amount);
    event CreateAuction(bytes32 indexed auctionHash);
    event Withdraw(bytes32 indexed auctionHash, address indexed bidder, uint amount);
    event Accept(bytes32 indexed auctionHash, address winner, uint amount);
    event Cancel(bytes32 indexed auctionHash, address seller);
    event TimeIncreased(bytes32 indexed auctionHash, address sender, uint increasedMinutes);

    using SafeMath for uint;
    //AuctionId to Auction Data
    mapping(bytes32 => Auction) public auctions;
    // mapping(bytes32 => mapping(address => uint)) bids;
    mapping(bytes32 => BidInfo[]) bids;
    bytes32[] public auctionHashes;
    uint runTime = 3 days;
    // //Hash to AuctionId
    // mapping(bytes32 => uint) public auctionHashes;

    modifier onlyAuctionOwner(bytes32 _auctionHash) {
        require(auctions[_auctionHash].seller == msg.sender, "not seller");
        _;
    }

    modifier restricted(bytes32 _auctionHash){
        require(auctions[_auctionHash].seller == msg.sender || owner() == msg.sender , "not owner");
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
        emit CreateAuction(auctionHash);
    }

    // get the seller of the auction
    function getSeller(bytes32 _auctionHash) public onlyOwner view returns(address) {
        return auctions[_auctionHash].seller;
    }

    function getAuction(bytes32 _auctionHash) public view returns(Auction memory) {
        return auctions[_auctionHash];
    }

    function start(bytes32 _auctionHash) public restricted(_auctionHash) {
        require(!auctions[_auctionHash].started, "started");
        
        auctions[_auctionHash].started = true;
        auctions[_auctionHash].endAt = block.timestamp + runTime;

        emit Start(_auctionHash);
    }
    
    function startAll() external onlyOwner {
        uint256 len = auctionHashes.length;
        
        for(uint256 i = 0; i < len; i ++) {
            if(!auctions[auctionHashes[i]].started) {
                start(auctionHashes[i]);
            }
        }
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
            
            require(newBidAmount >= minimumBid(_auctionHash), "not miniumbid");
            bids[_auctionHash][bidIndex].value = newBidAmount;
            bids[_auctionHash][bidIndex].created = block.timestamp;
         } else {
            require(msg.value >= minimumBid(_auctionHash), "not miniumbid");

            BidInfo memory newBid;
            newBid.value = msg.value;
            newBid.bidder = msg.sender;
            newBid.created = block.timestamp;

            bids[_auctionHash].push(newBid);
        }

        auctions[_auctionHash].highestBidder = msg.sender;
        auctions[_auctionHash].highestBid = newBidAmount;

        if (block.timestamp > auctions[_auctionHash].endAt - 10 minutes) {
            auctions[_auctionHash].endAt += 10 minutes;
            emit TimeIncreased(_auctionHash, msg.sender, 10);    
        }

        emit Bid(_auctionHash, msg.sender, newBidAmount);
    }

    function minimumBid(bytes32 _auctionHash) public view returns(uint) {
        uint highestBid = auctions[_auctionHash].highestBid;
        
        // if this is the first bid, it will return the starting bid
        if (bids[_auctionHash].length == 0) {
            return highestBid;
        }

        uint increaseBid;

        if (highestBid <= 100) {
            increaseBid = 10;
        } else if (highestBid <= 1000) {
            increaseBid = 50;
        } else if (highestBid <= 5000) {
            increaseBid = 100;
        } else if (highestBid <= 10000) {
            increaseBid = 250;
        } else {
            increaseBid = 500;
        }

        return highestBid.add(increaseBid);
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
    {
        require(!auctions[_auctionHash].ended, "ended");

        if (auctions[_auctionHash].highestBidder != address(0)) {
            auctions[_auctionHash].ended = true;
            ERC721(auctions[_auctionHash].nft).safeTransferFrom(auctions[_auctionHash].seller, auctions[_auctionHash].highestBidder, auctions[_auctionHash].nftId);
            auctions[_auctionHash].seller.transfer(auctions[_auctionHash].highestBid);
            emit Accept(_auctionHash, auctions[_auctionHash].highestBidder, auctions[_auctionHash].highestBid);
        }        
    }

    function cancel(bytes32 _auctionHash) external 
        onlyAuctionOwner(_auctionHash)
        onlyAuctionStarted(_auctionHash)
    {
        require(!auctions[_auctionHash].ended, "ended");

        auctions[_auctionHash].ended = true;

        emit Cancel(_auctionHash, msg.sender);
    }
}