// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract MockNFT is ERC721 {
    uint256 public tokenCounter;

    constructor () ERC721("MockNFT", "MN") {
        tokenCounter = 1;
        for (uint i = 0; i < 10; i ++) {
            safeMint();
        }
    }

    function safeMint() private {
        _safeMint(msg.sender, tokenCounter);
        tokenCounter += 1;
    }
}