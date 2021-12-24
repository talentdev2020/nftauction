// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
// import "@openzeppelin/contracts/utils/Counters.sol";


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
    bool isValue;
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
    mapping(bytes32 => mapping(address => uint)) bids;
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

    constructor() {
    }

    // makeHash from auction information
    // function makeHash(address seller, address _nft, uint _nftId) internal pure returns(bytes32) {
    //     return keccak256(abi.encode(seller, _nft, _nftId));
    // }
    
    function _createAuction(bytes32 _auctionHash, address _nft, uint _nftId, uint _startingBid, address _seller) internal {
        Auction memory auction;
        auction.nft = _nft;
        auction.nftId = _nftId;
        auction.seller = payable(_seller);
        auction.highestBid = _startingBid;
        auction.isValue = true;

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

    function start(bytes32 _auctionHash) external onlyAuctionOwner(_auctionHash, msg.sender) {
        require(!auctions[_auctionHash].started, "started");
        
        auctions[_auctionHash].started = true;
        auctions[_auctionHash].endAt = block.timestamp + 7 days;

        emit Start(_auctionHash);
    }

    function bid(bytes32 _auctionHash) external payable onlyAuctionStarted(_auctionHash) {
        require(!auctions[_auctionHash].ended, "auction ended");
        require(block.timestamp < auctions[_auctionHash].endAt, "ended");
        require(msg.value > auctions[_auctionHash].highestBid, "value < highest");

        if (auctions[_auctionHash].highestBidder != address(0)) {
            bids[_auctionHash][auctions[_auctionHash].highestBidder] += auctions[_auctionHash].highestBid;
        }

        auctions[_auctionHash].highestBidder = msg.sender;
        auctions[_auctionHash].highestBid = msg.value;

        if (block.timestamp > auctions[_auctionHash].endAt - 10 minutes) {
            auctions[_auctionHash].endAt += 10 minutes;
            emit TimeIncreased(_auctionHash, msg.sender, 10);    
        }

        emit Bid(_auctionHash, msg.sender, msg.value);
    }

    function withdraw(bytes32 _auctionHash) external nonReentrant {
        require(auctions[_auctionHash].ended, "not auction ended");

        uint bal = bids[_auctionHash][msg.sender];
        require(bal > 0, "no bidder exist");

        bids[_auctionHash][msg.sender] = 0;
        payable(msg.sender).transfer(bal);

        emit Withdraw(_auctionHash, msg.sender, bal);
    }

    function accept(bytes32 _auctionHash) external 
        onlyAuctionOwner (_auctionHash, msg.sender)
        onlyAuctionStarted(_auctionHash) 
    {
        require(block.timestamp >= auctions[_auctionHash].endAt, "not ended");
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