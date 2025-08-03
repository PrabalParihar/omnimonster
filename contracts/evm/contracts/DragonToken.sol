// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title DragonToken
 * @dev ERC20 token for testing cross-chain swaps on Etherlink testnet
 */
contract DragonToken is ERC20, Ownable {
    uint256 public constant INITIAL_SUPPLY = 1000000 * 10**18; // 1 million tokens
    
    constructor() ERC20("Dragon Token", "DRAGON") Ownable(msg.sender) {
        _mint(msg.sender, INITIAL_SUPPLY);
    }
    
    /**
     * @dev Mints new tokens to the specified address
     * @param to The address to mint tokens to
     * @param amount The amount of tokens to mint
     */
    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }
    
    /**
     * @dev Burns tokens from the caller's account
     * @param amount The amount of tokens to burn
     */
    function burn(uint256 amount) public {
        _burn(msg.sender, amount);
    }
    
    /**
     * @dev Returns the number of decimals used by the token
     */
    function decimals() public pure override returns (uint8) {
        return 18;
    }
}