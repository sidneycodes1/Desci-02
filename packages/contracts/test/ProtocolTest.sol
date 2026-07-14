// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";

import {GrantTreasury} from "../src/GrantTreasury.sol";
import {MilestoneRegistry} from "../src/MilestoneRegistry.sol";
import {ProjectRegistry} from "../src/ProjectRegistry.sol";
import {ProtocolRoles} from "../src/ProtocolRoles.sol";
import {ReputationRegistry} from "../src/ReputationRegistry.sol";

abstract contract ProtocolTest is Test {
  address internal admin = address(0xA11CE);
  address internal alice = address(0xB0B);
  address internal bob = address(0xC0DE);
  address internal carol = address(0xCAFE);

  ProjectRegistry internal projectRegistry;
  GrantTreasury internal grantTreasury;
  MilestoneRegistry internal milestoneRegistry;
  ReputationRegistry internal reputationRegistry;

  function setUp() public virtual {
    projectRegistry = new ProjectRegistry(admin);
    grantTreasury = new GrantTreasury(admin, address(projectRegistry));
    milestoneRegistry = new MilestoneRegistry(admin, address(projectRegistry));
    reputationRegistry = new ReputationRegistry(admin, address(projectRegistry));

    vm.deal(admin, 100 ether);
    vm.deal(alice, 100 ether);
    vm.deal(bob, 100 ether);
    vm.deal(carol, 100 ether);
  }

  function _grantProjectCreator(address account) internal {
    vm.prank(admin);
    projectRegistry.grantRole(ProtocolRoles.PROJECT_CREATOR_ROLE, account);
  }

  function _grantTreasuryApprover(address account) internal {
    vm.prank(admin);
    grantTreasury.grantRole(ProtocolRoles.TREASURY_APPROVER_ROLE, account);
  }

  function _grantTreasuryProposer(address account) internal {
    vm.prank(admin);
    grantTreasury.grantRole(ProtocolRoles.TREASURY_PROPOSER_ROLE, account);
  }

  function _grantMilestoneCreator(address account) internal {
    vm.prank(admin);
    milestoneRegistry.grantRole(ProtocolRoles.MILESTONE_CREATOR_ROLE, account);
  }

  function _grantMilestoneApprover(address account) internal {
    vm.prank(admin);
    milestoneRegistry.grantRole(ProtocolRoles.MILESTONE_APPROVER_ROLE, account);
  }

  function _grantReputationOracle(address account) internal {
    vm.prank(admin);
    reputationRegistry.grantRole(ProtocolRoles.REPUTATION_ORACLE_ROLE, account);
  }

  function _createProjectAsAdmin() internal returns (uint256 projectId) {
    vm.prank(admin);
    projectId = projectRegistry.createProject("Project One", "ipfs://project-one");
  }

  function _createProjectAsAlice() internal returns (uint256 projectId) {
    _grantProjectCreator(alice);
    vm.prank(alice);
    projectId = projectRegistry.createProject("Alice Project", "ipfs://alice-project");
  }

  function _assertEqUint(uint256 left, uint256 right) internal pure {
    require(left == right, "uint mismatch");
  }

  function _assertEqInt(int256 left, int256 right) internal pure {
    require(left == right, "int mismatch");
  }

  function _assertEqAddress(address left, address right) internal pure {
    require(left == right, "address mismatch");
  }

  function _assertEqString(string memory left, string memory right) internal pure {
    require(
      keccak256(bytes(left)) == keccak256(bytes(right)),
      "string mismatch"
    );
  }
}

