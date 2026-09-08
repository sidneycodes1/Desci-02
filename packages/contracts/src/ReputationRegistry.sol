// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IProjectRegistry} from "./interfaces/IProjectRegistry.sol";
import {EmptyValue, ZeroAddress} from "./ProtocolErrors.sol";
import {ProtocolRoles} from "./ProtocolRoles.sol";

/// @title ReputationRegistry
/// @notice Oracle-written reputation ledger with per-subject score cache.
/// @dev Immutable (no proxy). Only REPUTATION_ORACLE_ROLE may record events;
/// reads are open. Scores are a running sum and may go negative.
contract ReputationRegistry is AccessControl, Pausable, ReentrancyGuard {
  using ProtocolRoles for bytes32;

  /// @notice Single reputation observation.
  /// @param id Sequential event id.
  /// @param subject Address the points apply to.
  /// @param projectId Project the observation belongs to.
  /// @param points Signed delta applied to the subject score (never zero).
  /// @param reason Human-readable justification.
  /// @param actor Oracle account that recorded the event.
  /// @param createdAt Block timestamp of recording.
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

  /// @notice Emitted on every recorded event.
  /// @param eventId Sequential id assigned to the event.
  /// @param subject Address the points apply to.
  /// @param projectId Project the observation belongs to.
  /// @param points Signed delta applied.
  /// @param reason Justification as supplied.
  /// @param actor Oracle that recorded the event.
  event ReputationEventAdded(
    uint256 indexed eventId,
    address indexed subject,
    uint256 indexed projectId,
    int256 points,
    string reason,
    address actor
  );
  /// @notice Emitted whenever pause state changes.
  /// @param paused True when paused, false when unpaused.
  event ReputationPausingStatusChanged(bool paused);

  /// @notice Deploy the registry bound to a ProjectRegistry.
  /// @dev Grants DEFAULT_ADMIN_ROLE and REPUTATION_ORACLE_ROLE to `admin`.
  /// @param admin Initial admin and oracle. Must not be the zero address.
  /// @param projectRegistryAddress ProjectRegistry used to validate project ids.
  constructor(address admin, address projectRegistryAddress) {
    if (admin == address(0) || projectRegistryAddress == address(0)) {
      revert ZeroAddress();
    }

    projectRegistry = IProjectRegistry(projectRegistryAddress);
    _grantRole(DEFAULT_ADMIN_ROLE, admin);
    _grantRole(ProtocolRoles.REPUTATION_ORACLE_ROLE, admin);
  }

  /// @notice Pause event recording. Caller must hold DEFAULT_ADMIN_ROLE.
  function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
    _pause();
    emit ReputationPausingStatusChanged(true);
  }

  /// @notice Unpause event recording. Caller must hold DEFAULT_ADMIN_ROLE.
  function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
    _unpause();
    emit ReputationPausingStatusChanged(false);
  }

  /// @notice Record a reputation event and update the subject score.
  /// @dev Caller must hold REPUTATION_ORACLE_ROLE; the project must exist.
  /// @param subject Address receiving the points. Must not be zero.
  /// @param projectId Existing project the observation belongs to.
  /// @param points Signed non-zero delta.
  /// @param reason Non-empty justification.
  /// @return eventId Sequential id of the recorded event.
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

  /// @notice Current cached score of a subject (sum of all its events).
  /// @param subject Address to look up.
  /// @return Score, possibly negative; zero when no events exist.
  function getReputation(address subject) external view returns (int256) {
    return _scores[subject];
  }

  /// @notice Fetch a recorded event (zero-filled struct when never recorded).
  /// @param eventId Id to look up.
  /// @return The stored event.
  function getReputationEvent(uint256 eventId) external view returns (ReputationEvent memory) {
    return _events[eventId];
  }
}

