// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IProjectRegistry} from "./interfaces/IProjectRegistry.sol";
import {EmptyValue, ProjectDoesNotExist, ZeroAddress} from "./ProtocolErrors.sol";
import {ProtocolRoles} from "./ProtocolRoles.sol";

/// @title ProjectRegistry
/// @notice Root of trust for the protocol: mints projects and records ownership.
/// @dev Immutable (no proxy). All other modules resolve validity and ownership
/// through this contract. Pausable by DEFAULT_ADMIN_ROLE only.
contract ProjectRegistry is AccessControl, Pausable, ReentrancyGuard, IProjectRegistry {
  using ProtocolRoles for bytes32;

  uint256 private _nextProjectId = 1;

  mapping(uint256 => Project) private _projects;

  /// @notice Emitted on every project creation.
  /// @param projectId Sequential id assigned to the project.
  /// @param owner Creator; recorded as the project owner.
  /// @param name Project name as supplied.
  /// @param metadataURI IPFS metadata URI as supplied.
  event ProjectCreated(
    uint256 indexed projectId,
    address indexed owner,
    string name,
    string metadataURI
  );

  /// @notice Emitted whenever pause state changes.
  /// @param paused True when paused, false when unpaused.
  event ProjectPausingStatusChanged(bool paused);

  /// @notice Deploy the registry and bootstrap roles to `admin`.
  /// @dev Grants DEFAULT_ADMIN_ROLE and PROJECT_CREATOR_ROLE to `admin`;
  /// the admin is expected to delegate the creator role and keep admin offline.
  /// @param admin Initial admin and creator. Must not be the zero address.
  constructor(address admin) {
    if (admin == address(0)) {
      revert ZeroAddress();
    }

    _grantRole(DEFAULT_ADMIN_ROLE, admin);
    _grantRole(ProtocolRoles.PROJECT_CREATOR_ROLE, admin);
  }

  /// @notice Pause project creation. Caller must hold DEFAULT_ADMIN_ROLE.
  function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
    _pause();
    emit ProjectPausingStatusChanged(true);
  }

  /// @notice Unpause project creation. Caller must hold DEFAULT_ADMIN_ROLE.
  function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
    _unpause();
    emit ProjectPausingStatusChanged(false);
  }

  /// @notice Create a project owned by the caller.
  /// @dev Requires PROJECT_CREATOR_ROLE; reverts on empty inputs.
  /// @param name Non-empty project name.
  /// @param metadataURI Non-empty IPFS metadata URI.
  /// @return projectId Sequential id of the new project.
  function createProject(
    string calldata name,
    string calldata metadataURI
  ) external whenNotPaused nonReentrant onlyRole(ProtocolRoles.PROJECT_CREATOR_ROLE) returns (uint256 projectId) {
    if (bytes(name).length == 0 || bytes(metadataURI).length == 0) {
      revert EmptyValue();
    }

    projectId = _nextProjectId++;
    _projects[projectId] = Project({
      id: projectId,
      owner: msg.sender,
      name: name,
      metadataURI: metadataURI,
      createdAt: block.timestamp,
      active: true
    });

    emit ProjectCreated(projectId, msg.sender, name, metadataURI);
  }

  /// @notice Fetch a project or revert with ProjectDoesNotExist.
  /// @param projectId Id to look up.
  /// @return project The stored record.
  function getProject(uint256 projectId) external view override returns (Project memory project) {
    project = _projects[projectId];
    if (project.id == 0) {
      revert ProjectDoesNotExist(projectId);
    }
  }

  /// @notice Existence check that never reverts.
  /// @param projectId Id to look up.
  /// @return True when the project exists.
  function projectExists(uint256 projectId) external view override returns (bool) {
    return _projects[projectId].id != 0;
  }

  /// @notice Number of projects created so far.
  /// @return Count of minted project ids.
  function totalProjects() external view returns (uint256) {
    return _nextProjectId - 1;
  }
}

