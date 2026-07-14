// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IProjectRegistry} from "./interfaces/IProjectRegistry.sol";
import {EmptyValue, ZeroAddress} from "./ProtocolErrors.sol";
import {ProtocolRoles} from "./ProtocolRoles.sol";

contract ReputationRegistry is AccessControl, Pausable, ReentrancyGuard {
  using ProtocolRoles for bytes32;

  struct ReputationEvent {
    uint256 id;
    address subject;
    uint256 projectId;
    int256 points;
    string reason;
    address actor;
    uint256 createdAt;
  }

  IProjectRegistry public immutable projectRegistry;
  uint256 private _nextEventId = 1;

  mapping(uint256 => ReputationEvent) private _events;
  mapping(address => int256) private _scores;

  event ReputationEventAdded(
    uint256 indexed eventId,
    address indexed subject,
    uint256 indexed projectId,
    int256 points,
    string reason,
    address actor
  );
  event ReputationPausingStatusChanged(bool paused);

  constructor(address admin, address projectRegistryAddress) {
    if (admin == address(0) || projectRegistryAddress == address(0)) {
      revert ZeroAddress();
    }

    projectRegistry = IProjectRegistry(projectRegistryAddress);
    _grantRole(DEFAULT_ADMIN_ROLE, admin);
    _grantRole(ProtocolRoles.REPUTATION_ORACLE_ROLE, admin);
  }

  function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
    _pause();
    emit ReputationPausingStatusChanged(true);
  }

  function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
    _unpause();
    emit ReputationPausingStatusChanged(false);
  }

  function addReputationEvent(
    address subject,
    uint256 projectId,
    int256 points,
    string calldata reason
  ) external whenNotPaused nonReentrant onlyRole(ProtocolRoles.REPUTATION_ORACLE_ROLE) returns (uint256 eventId) {
    if (subject == address(0) || points == 0 || bytes(reason).length == 0) {
      revert EmptyValue();
    }

    projectRegistry.getProject(projectId);

    eventId = _nextEventId++;
    _events[eventId] = ReputationEvent({
      id: eventId,
      subject: subject,
      projectId: projectId,
      points: points,
      reason: reason,
      actor: msg.sender,
      createdAt: block.timestamp
    });
    _scores[subject] += points;

    emit ReputationEventAdded(eventId, subject, projectId, points, reason, msg.sender);
  }

  function getReputation(address subject) external view returns (int256) {
    return _scores[subject];
  }

  function getReputationEvent(uint256 eventId) external view returns (ReputationEvent memory) {
    return _events[eventId];
  }
}

