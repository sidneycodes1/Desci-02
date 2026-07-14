// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ProtocolTest} from "./ProtocolTest.sol";
import {ReputationRegistry} from "../src/ReputationRegistry.sol";

contract ReputationRegistryTest is ProtocolTest {
  function testAddReputationEventAccumulatesScore() public {
    uint256 projectId = _createProjectAsAdmin();
    _grantReputationOracle(admin);

    vm.prank(admin);
    reputationRegistry.addReputationEvent(alice, projectId, 10, "first milestone delivered");

    vm.prank(admin);
    reputationRegistry.addReputationEvent(alice, projectId, -3, "late review turnaround");

    _assertEqInt(reputationRegistry.getReputation(alice), 7);

    ReputationRegistry.ReputationEvent memory eventRecord = reputationRegistry.getReputationEvent(2);
    _assertEqAddress(eventRecord.subject, alice);
    _assertEqString(eventRecord.reason, "late review turnaround");
  }

  function testPauseBlocksAndUnpauseRestoresReputationWrites() public {
    uint256 projectId = _createProjectAsAdmin();
    _grantReputationOracle(admin);

    vm.prank(admin);
    reputationRegistry.pause();

    vm.expectRevert();
    vm.prank(admin);
    reputationRegistry.addReputationEvent(alice, projectId, 1, "blocked");

    vm.prank(admin);
    reputationRegistry.unpause();

    vm.prank(admin);
    reputationRegistry.addReputationEvent(alice, projectId, 1, "restored");

    _assertEqInt(reputationRegistry.getReputation(alice), 1);
  }
}

