// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ProtocolTest} from "./ProtocolTest.sol";
import {MilestoneRegistry} from "../src/MilestoneRegistry.sol";

contract MilestoneRegistryTest is ProtocolTest {
  function testCreateSubmitAndApproveMilestone() public {
    uint256 projectId = _createProjectAsAlice();
    _grantMilestoneApprover(admin);

    vm.prank(alice);
    uint256 milestoneId = milestoneRegistry.createMilestone(
      projectId,
      "Research validation",
      "ipfs://milestone-brief"
    );

    vm.prank(alice);
    milestoneRegistry.submitProof(milestoneId, "ipfs://proof-package");

    vm.prank(admin);
    milestoneRegistry.approveMilestone(milestoneId);

    MilestoneRegistry.Milestone memory milestone = milestoneRegistry.getMilestone(milestoneId);
    require(milestone.state == MilestoneRegistry.MilestoneState.Approved, "milestone not approved");
    _assertEqString(milestone.proofURI, "ipfs://proof-package");
  }

  function testPauseBlocksCreateAndUnpauseRestoresIt() public {
    uint256 projectId = _createProjectAsAlice();

    vm.prank(admin);
    milestoneRegistry.pause();

    vm.expectRevert();
    vm.prank(alice);
    milestoneRegistry.createMilestone(projectId, "Paused milestone", "ipfs://paused");

    vm.prank(admin);
    milestoneRegistry.unpause();

    vm.prank(alice);
    uint256 milestoneId = milestoneRegistry.createMilestone(
      projectId,
      "Active milestone",
      "ipfs://active"
    );

    require(milestoneId == 1, "milestone id mismatch");
  }

  function testApprovingBeforeProofReverts() public {
    uint256 projectId = _createProjectAsAlice();
    _grantMilestoneApprover(admin);

    vm.prank(alice);
    uint256 milestoneId = milestoneRegistry.createMilestone(
      projectId,
      "Premature approval",
      "ipfs://premature"
    );

    vm.expectRevert();
    vm.prank(admin);
    milestoneRegistry.approveMilestone(milestoneId);
  }
}

