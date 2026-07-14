// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IProjectRegistry} from "./interfaces/IProjectRegistry.sol";
import {EmptyValue, ProjectDoesNotExist, ZeroAddress} from "./ProtocolErrors.sol";
import {ProtocolRoles} from "./ProtocolRoles.sol";

contract ProjectRegistry is AccessControl, Pausable, ReentrancyGuard, IProjectRegistry {
  using ProtocolRoles for bytes32;

  uint256 private _nextProjectId = 1;

  mapping(uint256 => Project) private _projects;

  event ProjectCreated(
    uint256 indexed projectId,
    address indexed owner,
    string name,
    string metadataURI
  );

  event ProjectPausingStatusChanged(bool paused);

  constructor(address admin) {
    if (admin == address(0)) {
      revert ZeroAddress();
    }

    _grantRole(DEFAULT_ADMIN_ROLE, admin);
    _grantRole(ProtocolRoles.PROJECT_CREATOR_ROLE, admin);
  }

  function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
    _pause();
    emit ProjectPausingStatusChanged(true);
  }

  function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
    _unpause();
    emit ProjectPausingStatusChanged(false);
  }

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

  function getProject(uint256 projectId) external view override returns (Project memory project) {
    project = _projects[projectId];
    if (project.id == 0) {
      revert ProjectDoesNotExist(projectId);
    }
  }

  function projectExists(uint256 projectId) external view override returns (bool) {
    return _projects[projectId].id != 0;
  }

  function totalProjects() external view returns (uint256) {
    return _nextProjectId - 1;
  }
}

