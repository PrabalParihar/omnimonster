// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Import ERC20 interface for token transfers
interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

contract SimpleHTLC {
    enum HTLCState { INVALID, PENDING, CLAIMED, REFUNDED }
    
    struct HTLC {
        address token;
        address payable beneficiary;
        address payable originator;
        bytes32 hashLock;
        uint256 timelock;
        uint256 value;
        HTLCState state;
    }
    
    mapping(bytes32 => HTLC) public contracts;
    
    event HTLCCreated(bytes32 indexed contractId, address indexed originator, address indexed beneficiary, address token, uint256 value, bytes32 hashLock, uint256 timelock);
    event HTLCClaimed(bytes32 indexed contractId, address indexed claimer, bytes32 preimage);
    event HTLCRefunded(bytes32 indexed contractId, address indexed refunder);
    
    modifier contractExists(bytes32 contractId) {
        require(contracts[contractId].state != HTLCState.INVALID, "Contract does not exist");
        _;
    }
    
    modifier contractPending(bytes32 contractId) {
        require(contracts[contractId].state == HTLCState.PENDING, "Contract is not pending");
        _;
    }
    
    function getCurrentTime() public view returns (uint256) {
        return block.timestamp;
    }
    
    function fund(
        bytes32 contractId,
        address token,
        address payable beneficiary,
        bytes32 hashLock,
        uint256 timelock,
        uint256 value
    ) external payable {
        require(contracts[contractId].state == HTLCState.INVALID, "Contract already exists");
        require(beneficiary != address(0), "Beneficiary cannot be zero address");
        require(token != address(0), "Token cannot be zero address");
        require(timelock > block.timestamp, "Timelock must be in the future");
        require(value > 0, "Value must be greater than 0");
        
        // Transfer tokens from sender to this contract
        require(IERC20(token).transferFrom(msg.sender, address(this), value), "Token transfer failed");
        
        contracts[contractId] = HTLC({
            token: token,
            beneficiary: beneficiary,
            originator: payable(msg.sender),
            hashLock: hashLock,
            timelock: timelock,
            value: value,
            state: HTLCState.PENDING
        });
        
        emit HTLCCreated(contractId, msg.sender, beneficiary, token, value, hashLock, timelock);
    }
    
    function fundETH(
        bytes32 contractId,
        address payable beneficiary,
        bytes32 hashLock,
        uint256 timelock
    ) external payable {
        require(contracts[contractId].state == HTLCState.INVALID, "Contract already exists");
        require(beneficiary != address(0), "Beneficiary cannot be zero address");
        require(timelock > block.timestamp, "Timelock must be in the future");
        require(msg.value > 0, "Value must be greater than 0");
        
        contracts[contractId] = HTLC({
            token: address(0), // ETH
            beneficiary: beneficiary,
            originator: payable(msg.sender),
            hashLock: hashLock,
            timelock: timelock,
            value: msg.value,
            state: HTLCState.PENDING
        });
        
        emit HTLCCreated(contractId, msg.sender, beneficiary, address(0), msg.value, hashLock, timelock);
    }
    
    function claim(bytes32 contractId, bytes32 preimage) 
        external 
        contractExists(contractId) 
        contractPending(contractId) 
    {
        HTLC storage htlc = contracts[contractId];
        
        require(block.timestamp <= htlc.timelock, "Contract has expired");
        require(sha256(abi.encodePacked(preimage)) == htlc.hashLock, "Invalid preimage");
        require(msg.sender == htlc.beneficiary, "Only beneficiary can claim");
        
        htlc.state = HTLCState.CLAIMED;
        
        if (htlc.token == address(0)) {
            // ETH transfer
            htlc.beneficiary.transfer(htlc.value);
        } else {
            // ERC20 transfer
            require(IERC20(htlc.token).transfer(htlc.beneficiary, htlc.value), "Token transfer failed");
        }
        
        emit HTLCClaimed(contractId, msg.sender, preimage);
    }
    
    function refund(bytes32 contractId) 
        external 
        contractExists(contractId) 
        contractPending(contractId) 
    {
        HTLC storage htlc = contracts[contractId];
        
        require(block.timestamp > htlc.timelock, "Contract has not expired");
        require(msg.sender == htlc.originator, "Only originator can refund");
        
        htlc.state = HTLCState.REFUNDED;
        
        if (htlc.token == address(0)) {
            // ETH refund
            htlc.originator.transfer(htlc.value);
        } else {
            // ERC20 refund
            require(IERC20(htlc.token).transfer(htlc.originator, htlc.value), "Token transfer failed");
        }
        
        emit HTLCRefunded(contractId, msg.sender);
    }
    
    function getDetails(bytes32 contractId) 
        external 
        view 
        returns (
            address token,
            address beneficiary,
            address originator,
            bytes32 hashLock,
            uint256 timelock,
            uint256 value,
            uint8 state
        ) 
    {
        HTLC memory htlc = contracts[contractId];
        return (
            htlc.token,
            htlc.beneficiary,
            htlc.originator,
            htlc.hashLock,
            htlc.timelock,
            htlc.value,
            uint8(htlc.state)
        );
    }
    
    function isClaimable(bytes32 contractId) external view returns (bool) {
        HTLC memory htlc = contracts[contractId];
        return htlc.state == HTLCState.PENDING && block.timestamp <= htlc.timelock;
    }
    
    function isRefundable(bytes32 contractId) external view returns (bool) {
        HTLC memory htlc = contracts[contractId];
        return htlc.state == HTLCState.PENDING && block.timestamp > htlc.timelock;
    }
}