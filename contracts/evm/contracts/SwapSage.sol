// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract SwapSage is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    event SwapInitiated(
        bytes32 indexed swapId,
        address indexed user,
        address tokenIn,
        uint256 amountIn,
        string destinationChain,
        string destinationAddress
    );

    constructor() Ownable(msg.sender) {}

    function initiateSwap(
        address tokenIn,
        uint256 amountIn,
        string calldata destinationChain,
        string calldata destinationAddress
    ) external nonReentrant {
        require(amountIn > 0, "Amount must be greater than 0");
        require(bytes(destinationChain).length > 0, "Destination chain required");
        require(bytes(destinationAddress).length > 0, "Destination address required");

        bytes32 swapId = keccak256(
            abi.encodePacked(msg.sender, tokenIn, amountIn, block.timestamp)
        );

        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);

        emit SwapInitiated(
            swapId,
            msg.sender,
            tokenIn,
            amountIn,
            destinationChain,
            destinationAddress
        );
    }
}