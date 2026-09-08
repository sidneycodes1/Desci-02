// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IProjectRegistry} from "./interfaces/IProjectRegistry.sol";
import {
  EmptyValue,
  MilestoneAlreadyApproved,
  MilestoneDoesNotExist,
  MilestoneNotSubmitted,
  NotProjectOwner,
  ZeroAddress
} from "./ProtocolErrors.sol";
import {ProtocolRoles} from "./ProtocolRoles.sol";

/// @title MilestoneRegistry
/// @notice Milestone lifecycle (Created -> Submitted -> Approved) per project.
/// @dev Immutable (no proxy). Creation is project-owner-or-creator-role;
/// submission is creator-or-owner-or-creator-role; approval is approver-role
/// only and requires a submitted proof. Fund release on approval is handled
/// off-chain/by the treasury in Phase 8 — this contract only attests state.
contract MilestoneRegistry is AccessControl, Pausable, ReentrancyGuard {
  using ProtocolRoles for bytes32;

  /// @notice Lifecycle states. None marks an uninitialized slot.
  enum MilestoneState {
    None,
    Created,
    Submitted,
    Approved
  }

  /// @notice Single milestone with its audit timestamps.
  /// @param id Sequential milestone id.
  /// @param projectId Owning project.
  /// @param creator Account that created the milestone.
  /// @param title Human-readable title.
  /// @param descriptionURI IPFS URI of the milestone brief.
  /// @param proofURI IPFS URI of submitted proof (empty until submitted).
  /// @param state Current lifecycle state.
  /// @param createdAt Block timestamp of creation.
  /// @param submittedAt Block timestamp of last proof submission (0 if never).
  /// @param approvedAt Block timestamp of approval (0 if never).
  struct Milestone {
    uint256 id;
    uint256 projectId;
    address creator;
    string title;
    string descriptionURI;
    string proofURI;
    MilestoneState state;
    uint256 createdAt;
    uint256 submittedAt;
    uint256 approvedAt;
  }

  IProjectRegistry public immutable projectRegistry;
  uint256 private _nextMilestoneId = 1;

  mapping(uint256 => Milestone) private _milestones;

  /// @notice Emitted on milestone creation.
  /// @param milestoneId Sequential id assigned.
  /// @param projectId Owning project.
  /// @param creator Creator account.
  /// @param title Title as supplied.
  /// @param descriptionURI Brief URI as supplied.
  event MilestoneCreated(
    uint256 indexed milestoneId,
    uint256 indexed projectId,
    address indexed creator,
    string title,
    string descriptionURI
  );
  /// @notice Emitted on every proof submission (resubmission allowed until approved).
  /// @param milestoneId Milestone id.
  /// @param submitter Account that submitted.
  /// @param proofURI Proof URI as supplied.
  event MilestoneProofSubmitted(uint256 indexed milestoneId, address indexed submitter, string proofURI);
  /// @notice Emitted on approval.
  /// @param milestoneId Milestone id.
  /// @param approver Approver account.
  event MilestoneApproved(uint256 indexed milestoneId, address indexed approver);
  /// @notice Emitted whenever pause state changes.
  /// @param paused True when paused, false when unpaused.
  event MilestonePausingStatusChanged(bool paused);

  /// @notice Deploy the registry bound to a ProjectRegistry.
  /// @dev Grants DEFAULT_ADMIN_ROLE, MILESTONE_CREATOR_ROLE and
  /// MILESTONE_APPROVER_ROLE to `admin`.
  /// @param admin Initial admin/creator/approver. Must not be zero.
  /// @param projectRegistryAddress ProjectRegistry used for ownership checks.
  constructor(address admin, address projectRegistryAddress) {
    if (admin == address(0) || projectRegistryAddress == address(0)) {
      revert ZeroAddress();
    }

    projectRegistry = IProjectRegistry(projectRegistryAddress);
    _grantRole(DEFAULT_ADMIN_ROLE, admin);
    _grantRole(ProtocolRoles.MILESTONE_CREATOR_ROLE, admin);
    _grantRole(ProtocolRoles.MILESTONE_APPROVER_ROLE, admin);
  }

  /// @notice Pause milestone actions. Caller must hold DEFAULT_ADMIN_ROLE.
  function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
    _pause();
    emit MilestonePausingStatusChanged(true);
  }

  /// @notice Unpause milestone actions. Caller must hold DEFAULT_ADMIN_ROLE.
  function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
    _unpause();
    emit MilestonePausingStatusChanged(false);
  }

  /// @notice Create a milestone under an existing project.
  /// @dev Caller must be the project owner or hold MILESTONE_CREATOR_ROLE.
  /// @param projectId Existing project id.
  /// @param title Non-empty title.
  /// @param descriptionURI Non-empty brief URI.
  /// @return milestoneId Sequential id of the new milestone.
  function createMilestone(
    uint256 projectId,
    string calldata title,
    string calldata descriptionURI
  ) external whenNotPaused nonReentrant returns (uint256 milestoneId) {
    _assertProjectOwnerOrRole(projectId, ProtocolRoles.MILESTONE_CREATOR_ROLE);

    if (bytes(title).length == 0 || bytes(descriptionURI).length == 0) {
      revert EmptyValue();
    }

    milestoneId = _nextMilestoneId++;
    _milestones[milestoneId] = Milestone({
      id: milestoneId,
      projectId: projectId,
      creator: msg.sender,
      title: title,
      descriptionURI: descriptionURI,
      proofURI: "",
      state: MilestoneState.Created,
      createdAt: block.timestamp,
      submittedAt: 0,
      approvedAt: 0
    });

    emit MilestoneCreated(milestoneId, projectId, msg.sender, title, descriptionURI);
  }

  /// @notice Submit (or resubmit, while unapproved) proof for a milestone.
  /// @dev Caller must be the milestone creator, the project owner, or hold
  /// MILESTONE_CREATOR_ROLE. Overwrites proofURI and submittedAt.
  /// @param milestoneId Existing, unapproved milestone id.
  /// @param proofURI Non-empty proof URI.
  function submitProof(uint256 milestoneId, string calldata proofURI) external whenNotPaused nonReentrant {
    Milestone storage milestone = _getMilestone(milestoneId);

    if (bytes(proofURI).length == 0) {
      revert EmptyValue();
    }

    if (milestone.state == MilestoneState.Approved) {
      revert MilestoneAlreadyApproved(milestoneId);
    }

    if (
      milestone.creator != msg.sender &&
      projectRegistry.getProject(milestone.projectId).owner != msg.sender &&
      !hasRole(ProtocolRoles.MILESTONE_CREATOR_ROLE, msg.sender)
    ) {
      revert NotProjectOwner(milestone.projectId);
    }

    milestone.proofURI = proofURI;
    milestone.state = MilestoneState.Submitted;
    milestone.submittedAt = block.timestamp;

    emit MilestoneProofSubmitted(milestoneId, msg.sender, proofURI);
  }

  /// @notice Approve a submitted milestone. Caller must hold MILESTONE_APPROVER_ROLE.
  /// @dev Requires state Submitted; transitions to Approved exactly once.
  /// @param milestoneId Submitted milestone id.
  function approveMilestone(uint256 milestoneId) external whenNotPaused nonReentrant onlyRole(ProtocolRoles.MILESTONE_APPROVER_ROLE) {
    Milestone storage milestone = _getMilestone(milestoneId);

    if (milestone.state == MilestoneState.Approved) {
      revert MilestoneAlreadyApproved(milestoneId);
    }

    if (milestone.state != MilestoneState.Submitted) {
      revert MilestoneNotSubmitted(milestoneId);
    }

    milestone.state = MilestoneState.Approved;
    milestone.approvedAt = block.timestamp;

    emit MilestoneApproved(milestoneId, msg.sender);
  }

  /// @notice Fetch a milestone or revert with MilestoneDoesNotExist.
  /// @param milestoneId Id to look up.
  /// @return The stored milestone.
  function getMilestone(uint256 milestoneId) external view returns (Milestone memory) {
    return _getMilestone(milestoneId);
  }

  function _getMilestone(uint256 milestoneId) internal view returns (Milestone storage milestone) {
    milestone = _milestones[milestoneId];
    if (milestone.id == 0) {
      revert MilestoneDoesNotExist(milestoneId);
    }
  }

  function _assertProjectOwnerOrRole(uint256 projectId, bytes32 role) internal view {
    IProjectRegistry.Project memory project = projectRegistry.getProject(projectId);
    if (project.owner != msg.sender && !hasRole(role, msg.sender)) {
      revert NotProjectOwner(projectId);
    }
  }
}
