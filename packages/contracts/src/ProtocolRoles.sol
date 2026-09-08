// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title ProtocolRoles
/// @notice Single source of truth for every AccessControl role in the protocol.
/// @dev Role assignment policy: the deployer admin holds every role at
/// construction and is expected to delegate (and eventually renounce)
/// operational roles to multisigs or protocol modules. Project ownership
/// (ProjectRegistry.owner) is orthogonal: owners may act on their own
/// projects without holding any role.
library ProtocolRoles {
  /// @notice May create projects in ProjectRegistry.
  bytes32 internal constant PROJECT_CREATOR_ROLE = keccak256("PROJECT_CREATOR_ROLE");
  /// @notice May propose treasury expenses alongside project owners.
  bytes32 internal constant TREASURY_PROPOSER_ROLE = keccak256("TREASURY_PROPOSER_ROLE");
  /// @notice May approve expenses and is one of the two parties allowed to execute them.
  bytes32 internal constant TREASURY_APPROVER_ROLE = keccak256("TREASURY_APPROVER_ROLE");
  /// @notice May create milestones alongside project owners.
  bytes32 internal constant MILESTONE_CREATOR_ROLE = keccak256("MILESTONE_CREATOR_ROLE");
  /// @notice Sole role allowed to approve submitted milestones.
  bytes32 internal constant MILESTONE_APPROVER_ROLE = keccak256("MILESTONE_APPROVER_ROLE");
  /// @notice Sole role allowed to record reputation events.
  bytes32 internal constant REPUTATION_ORACLE_ROLE = keccak256("REPUTATION_ORACLE_ROLE");
}
