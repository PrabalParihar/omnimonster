// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SwapSageHTLC
 * @dev Hash Time Locked Contract for cross-chain atomic swaps
 * Supports both ERC-20 tokens and native ETH
 */
contract SwapSageHTLC is ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum SwapState {
        INVALID,
        OPEN,
        CLAIMED,
        REFUNDED
    }

    struct SwapContract {
        address token;
        address payable beneficiary;
        address payable originator;
        bytes32 hashLock;
        uint256 timelock;
        uint256 value;
        SwapState state;
    }

    mapping(bytes32 => SwapContract) public swaps;

    event Funded(
        bytes32 indexed contractId,
        address indexed originator,
        address indexed beneficiary,
        address token,
        uint256 value,
        bytes32 hashLock,
        uint256 timelock
    );

    event Claimed(
        bytes32 indexed contractId,
        address indexed beneficiary,
        bytes32 preimage,
        uint256 value
    );

    event Refunded(
        bytes32 indexed contractId,
        address indexed originator,
        uint256 value
    );

    modifier swapExists(bytes32 _contractId) {
        require(swaps[_contractId].state == SwapState.OPEN, "Swap does not exist or is not open");
        _;
    }

    modifier swapDoesNotExist(bytes32 _contractId) {
        require(swaps[_contractId].state == SwapState.INVALID, "Swap already exists");
        _;
    }

    modifier onlyBeneficiary(bytes32 _contractId) {
        require(msg.sender == swaps[_contractId].beneficiary, "Only beneficiary can claim");
        _;
    }

    modifier onlyOriginator(bytes32 _contractId) {
        require(msg.sender == swaps[_contractId].originator, "Only originator can refund");
        _;
    }

    modifier onlyIfClaimable(bytes32 _contractId) {
        require(block.timestamp < swaps[_contractId].timelock, "Timelock has expired");
        _;
    }

    modifier onlyIfRefundable(bytes32 _contractId) {
        require(block.timestamp >= swaps[_contractId].timelock, "Timelock has not expired");
        _;
    }

    /**
     * @dev Creates a new HTLC for ERC-20 tokens
     * @param _contractId Unique identifier for this swap
     * @param _token ERC-20 token address (use address(0) for ETH)
     * @param _beneficiary Address that can claim the funds
     * @param _hashLock Hash of the secret
     * @param _timelock Unix timestamp when refund becomes available
     * @param _value Amount of tokens to lock
     */
    function fund(
        bytes32 _contractId,
        address _token,
        address payable _beneficiary,
        bytes32 _hashLock,
        uint256 _timelock,
        uint256 _value
    ) external payable nonReentrant swapDoesNotExist(_contractId) {
        require(_beneficiary != address(0), "Invalid beneficiary address");
        require(_hashLock != bytes32(0), "Invalid hash lock");
        require(_timelock > block.timestamp, "Timelock must be in the future");
        require(_value > 0, "Value must be greater than 0");

        if (_token == address(0)) {
            // Native ETH
            require(msg.value == _value, "ETH value mismatch");
        } else {
            // ERC-20 token
            require(msg.value == 0, "ETH not accepted for token swaps");
            IERC20(_token).safeTransferFrom(msg.sender, address(this), _value);
        }

        swaps[_contractId] = SwapContract({
            token: _token,
            beneficiary: _beneficiary,
            originator: payable(msg.sender),
            hashLock: _hashLock,
            timelock: _timelock,
            value: _value,
            state: SwapState.OPEN
        });

        emit Funded(
            _contractId,
            msg.sender,
            _beneficiary,
            _token,
            _value,
            _hashLock,
            _timelock
        );
    }

    /**
     * @dev Claims the locked funds by providing the preimage
     * @param _contractId The swap contract identifier
     * @param _preimage The secret that hashes to hashLock
     */
    function claim(bytes32 _contractId, bytes32 _preimage)
        external
        nonReentrant
        swapExists(_contractId)
        onlyBeneficiary(_contractId)
        onlyIfClaimable(_contractId)
    {
        SwapContract storage swap = swaps[_contractId];
        
        require(sha256(abi.encodePacked(_preimage)) == swap.hashLock, "Invalid preimage");
        
        swap.state = SwapState.CLAIMED;

        if (swap.token == address(0)) {
            // Native ETH
            swap.beneficiary.transfer(swap.value);
        } else {
            // ERC-20 token
            IERC20(swap.token).safeTransfer(swap.beneficiary, swap.value);
        }

        emit Claimed(_contractId, swap.beneficiary, _preimage, swap.value);
    }

    /**
     * @dev Refunds the locked funds back to the originator after timelock expires
     * @param _contractId The swap contract identifier
     */
    function refund(bytes32 _contractId)
        external
        nonReentrant
        swapExists(_contractId)
        onlyOriginator(_contractId)
        onlyIfRefundable(_contractId)
    {
        SwapContract storage swap = swaps[_contractId];
        
        swap.state = SwapState.REFUNDED;

        if (swap.token == address(0)) {
            // Native ETH
            swap.originator.transfer(swap.value);
        } else {
            // ERC-20 token
            IERC20(swap.token).safeTransfer(swap.originator, swap.value);
        }

        emit Refunded(_contractId, swap.originator, swap.value);
    }

    /**
     * @dev Gets the details of a swap contract
     * @param _contractId The swap contract identifier
     * @return token Token address (address(0) for ETH)
     * @return beneficiary Address that can claim funds
     * @return originator Address that funded the contract
     * @return hashLock Hash of the secret
     * @return timelock Unix timestamp when refund becomes available
     * @return value Amount of tokens/ETH locked
     * @return state Current state of the swap
     */
    function getDetails(bytes32 _contractId)
        external
        view
        returns (
            address token,
            address beneficiary,
            address originator,
            bytes32 hashLock,
            uint256 timelock,
            uint256 value,
            SwapState state
        )
    {
        SwapContract storage swap = swaps[_contractId];
        return (
            swap.token,
            swap.beneficiary,
            swap.originator,
            swap.hashLock,
            swap.timelock,
            swap.value,
            swap.state
        );
    }

    /**
     * @dev Checks if a swap can be claimed
     * @param _contractId The swap contract identifier
     * @return true if the swap can be claimed
     */
    function isClaimable(bytes32 _contractId) external view returns (bool) {
        SwapContract storage swap = swaps[_contractId];
        return swap.state == SwapState.OPEN && block.timestamp < swap.timelock;
    }

    /**
     * @dev Checks if a swap can be refunded
     * @param _contractId The swap contract identifier
     * @return true if the swap can be refunded
     */
    function isRefundable(bytes32 _contractId) external view returns (bool) {
        SwapContract storage swap = swaps[_contractId];
        return swap.state == SwapState.OPEN && block.timestamp >= swap.timelock;
    }

    /**
     * @dev Gets the current timestamp (useful for testing)
     * @return Current block timestamp
     */
    function getCurrentTime() external view returns (uint256) {
        return block.timestamp;
    }
}