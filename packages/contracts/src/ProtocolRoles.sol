// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

library ProtocolRoles {
  bytes32 internal constant PROJECT_CREATOR_ROLE = keccak256("PROJECT_CREATOR_ROLE");
  bytes32 internal constant TREASURY_PROPOSER_ROLE = keccak256("TREASURY_PROPOSER_ROLE");
  bytes32 internal constant TREASURY_APPROVER_ROLE = keccak256("TREASURY_APPROVER_ROLE");
  bytes32 internal constant MILESTONE_CREATOR_ROLE = keccak256("MILESTONE_CREATOR_ROLE");
  bytes32 internal constant MILESTONE_APPROVER_ROLE = keccak256("MILESTONE_APPROVER_ROLE");
  bytes32 internal constant REPUTATION_ORACLE_ROLE = keccak256("REPUTATION_ORACLE_ROLE");
}

