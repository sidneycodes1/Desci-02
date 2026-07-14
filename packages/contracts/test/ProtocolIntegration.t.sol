// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ProtocolTest} from "./ProtocolTest.sol";
import {MilestoneRegistry} from "../src/MilestoneRegistry.sol";
import {ReputationRegistry} from "../src/ReputationRegistry.sol";

contract ProtocolIntegrationTest is ProtocolTest {
  function testFullProtocolFlowAcrossRegistries() public {
    _grantProjectCreator(alice);
    _grantTreasuryApprover(admin);
    _grantMilestoneApprover(admin);
    _grantReputationOracle(admin);

    vm.prank(alice);
    uint256 projectId = projectRegistry.createProject("Open Science", "ipfs://open-science");

    vm.prank(alice);
    grantTreasury.deposit{value: 8 ether}(projectId);

    vm.prank(alice);
    uint256 expenseId = grantTreasury.proposeExpense(
      projectId,
      payable(bob),
      3 ether,
      hex"",
      "publish paper"
    );

    vm.prank(admin);
    grantTreasury.approveExpense(expenseId);

    vm.prank(carol);
    grantTreasury.executeExpense(expenseId);

    vm.prank(alice);
    uint256 milestoneId = milestoneRegistry.createMilestone(
      projectId,
      "Preprint submission",
      "ipfs://milestone-brief"
    );

    vm.prank(alice);
    milestoneRegistry.submitProof(milestoneId, "ipfs://preprint-proof");

    vm.prank(admin);
    milestoneRegistry.approveMilestone(milestoneId);

    vm.prank(admin);
    reputationRegistry.addReputationEvent(alice, projectId, 15, "delivered the milestone");

    _assertEqUint(grantTreasury.projectBalances(projectId), 5 ether);
    _assertEqInt(reputationRegistry.getReputation(alice), 15);

    MilestoneRegistry.Milestone memory milestone = milestoneRegistry.getMilestone(milestoneId);
    require(milestone.state == MilestoneRegistry.MilestoneState.Approved, "milestone not approved");

    ReputationRegistry.ReputationEvent memory eventRecord = reputationRegistry.getReputationEvent(1);
    _assertEqString(eventRecord.reason, "delivered the milestone");
    _assertEqAddress(eventRecord.subject, alice);
  }
}
