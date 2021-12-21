// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

struct Auction {
    ERC721 nft;
    address payable seller;
    address highestBidder;
    uint nftId;
    uint highestBid;
    uint endAt;
    bool started;
    bool ended;
}
contract NFTAuction is Ownable, ReentrancyGuard{
    event Start();
    event Bid(address indexed sender, uint amount);
    event Withdraw(address indexed bidder, uint amount);
    event End(address winner, uint amount);
    event TimeIncreased(address sender, uint increasedMinutes);

    mapping(uint => Auction) public auctions;
    mapping(uint => mapping(address => uint)) bids;

    modifier isNFTOwner(uint _nftId, address _address) {
        require(auctions[_nftId].seller == _address, "not seller");
        _;
    }
    constructor() {
    }

    function createAuction(address _nft, uint _nftId, uint _startingBid) external {
        require(auctions[_nftId].seller == address(0), "already created");

        Auction memory auction;
        auction.nft = ERC721(_nft);
        auction.nftId = _nftId;
        auction.seller = payable(msg.sender);
        auction.highestBid = _startingBid;

        auctions[_nftId] = auction;
    }
    function getSeller(uint _nftId) public onlyOwner view returns(address) {
        return auctions[_nftId].seller;
    }

    function start(uint _nftId) external isNFTOwner(_nftId, msg.sender) {
        require(!auctions[_nftId].started, "started");

        auctions[_nftId].nft.transferFrom(msg.sender, address(this), _nftId);
        auctions[_nftId].started = true;
        auctions[_nftId].endAt = block.timestamp + 7 days;

        emit Start();
    }

    function bid(uint _nftId) external payable {
        require(auctions[_nftId].started, "not started");
        require(block.timestamp < auctions[_nftId].endAt, "ended");
        require(msg.value > auctions[_nftId].highestBid, "value < highest");

        if (auctions[_nftId].highestBidder != address(0)) {
            bids[_nftId][auctions[_nftId].highestBidder] += auctions[_nftId].highestBid;
        }

        auctions[_nftId].highestBidder = msg.sender;
        auctions[_nftId].highestBid = msg.value;

        if (block.timestamp > auctions[_nftId].endAt - 10 minutes) {
            auctions[_nftId].endAt += 10 minutes;
            emit TimeIncreased(msg.sender, 10);    
        }

        emit Bid(msg.sender, msg.value);
    }

    function withdraw(uint _nftId) external nonReentrant {
        uint bal = bids[_nftId][msg.sender];
        require(bal > 0, "Not bidder exist");

        bids[_nftId][msg.sender] = 0;
        payable(msg.sender).transfer(bal);

        emit Withdraw(msg.sender, bal);
    }

    function end(uint _nftId) external {
        require(auctions[_nftId].started, "not started");
        require(block.timestamp >= auctions[_nftId].endAt, "not ended");
        require(!auctions[_nftId].ended, "ended");

        auctions[_nftId].ended = true;
        if (auctions[_nftId].highestBidder != address(0)) {
            auctions[_nftId].nft.safeTransferFrom(address(this), auctions[_nftId].highestBidder, _nftId);
            auctions[_nftId].seller.transfer(auctions[_nftId].highestBid);
        } else {
            auctions[_nftId].nft.safeTransferFrom(address(this), auctions[_nftId].seller, _nftId);
        }

        emit End(auctions[_nftId].highestBidder, auctions[_nftId].highestBid);
    }
}