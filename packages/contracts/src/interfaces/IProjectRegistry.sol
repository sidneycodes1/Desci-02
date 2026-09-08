// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title IProjectRegistry
/// @notice Minimal view interface for project existence and ownership.
/// @dev Consumed by GrantTreasury, MilestoneRegistry and ReputationRegistry
/// so all modules agree on what constitutes a valid project and who owns it.
interface IProjectRegistry {
  /// @notice Canonical project record.
  /// @param id Sequential project id, starting at 1. Zero means "absent".
  /// @param owner Account that created the project; sole spender-side authority.
  /// @param name Human-readable project name (off-chain metadata lives at metadataURI).
  /// @param metadataURI IPFS URI of the project metadata document.
  /// @param createdAt Block timestamp of creation.
  /// @param active Reserved lifecycle flag (currently always true at creation).
  struct Project {
    uint256 id;
    address owner;
    string name;
    string metadataURI;
    uint256 createdAt;
    bool active;
  }

  /// @notice Fetch a project or revert.
  /// @param projectId Id to look up.
  /// @return project The stored record.
  function getProject(uint256 projectId) external view returns (Project memory);

  /// @notice Existence check that never reverts.
  /// @param projectId Id to look up.
  /// @return True when a project with that id has been created.
  function projectExists(uint256 projectId) external view returns (bool);
}
