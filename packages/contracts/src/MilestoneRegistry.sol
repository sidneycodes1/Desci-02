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

contract MilestoneRegistry is AccessControl, Pausable, ReentrancyGuard {
  using ProtocolRoles for bytes32;

  enum MilestoneState {
    None,
    Created,
    Submitted,
    Approved
  }

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

  event MilestoneCreated(
    uint256 indexed milestoneId,
    uint256 indexed projectId,
    address indexed creator,
    string title,
    string descriptionURI
  );
  event MilestoneProofSubmitted(uint256 indexed milestoneId, address indexed submitter, string proofURI);
  event MilestoneApproved(uint256 indexed milestoneId, address indexed approver);
  event MilestonePausingStatusChanged(bool paused);

  constructor(address admin, address projectRegistryAddress) {
    if (admin == address(0) || projectRegistryAddress == address(0)) {
      revert ZeroAddress();
    }

    projectRegistry = IProjectRegistry(projectRegistryAddress);
    _grantRole(DEFAULT_ADMIN_ROLE, admin);
    _grantRole(ProtocolRoles.MILESTONE_CREATOR_ROLE, admin);
    _grantRole(ProtocolRoles.MILESTONE_APPROVER_ROLE, admin);
  }

  function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
    _pause();
    emit MilestonePausingStatusChanged(true);
  }

  function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
    _unpause();
    emit MilestonePausingStatusChanged(false);
  }

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
