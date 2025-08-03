// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockUSDC
 * @dev Mock USDC token for testing on testnets
 */
contract MockUSDC is ERC20, Ownable {
    constructor() ERC20("USD Coin", "USDC") Ownable(msg.sender) {
        // Mint 1 million USDC to deployer
        _mint(msg.sender, 1000000 * 10**6); // USDC uses 6 decimals
    }
    
    function decimals() public pure override returns (uint8) {
        return 6;
    }
    
    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }
}