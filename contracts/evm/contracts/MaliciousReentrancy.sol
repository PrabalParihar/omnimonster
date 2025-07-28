// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./SwapSageHTLC.sol";

contract MaliciousReentrancy {
    SwapSageHTLC public htlc;
    bytes32 public targetContract;
    bytes32 public preimage;
    bool public attacked = false;

    constructor(address _htlc) {
        htlc = SwapSageHTLC(_htlc);
    }

    function attemptReentrancy(bytes32 _contractId, bytes32 _preimage) external {
        targetContract = _contractId;
        preimage = _preimage;
        htlc.claim(_contractId, _preimage);
    }

    receive() external payable {
        if (!attacked) {
            attacked = true;
            // Try to claim again (should fail due to reentrancy guard)
            htlc.claim(targetContract, preimage);
        }
    }
}