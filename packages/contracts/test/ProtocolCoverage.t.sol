// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {DeployProtocol} from "../script/Deploy.s.sol";
import {GrantTreasury} from "../src/GrantTreasury.sol";
import {MilestoneRegistry} from "../src/MilestoneRegistry.sol";
import {ProjectRegistry} from "../src/ProjectRegistry.sol";
import {
  EmptyValue,
  ExpenseAlreadyApproved,
  ExpenseDoesNotExist,
  ExpenseExecutionFailed,
  ExpenseNotApproved,
  InvalidAmount,
  MilestoneAlreadyApproved,
  MilestoneDoesNotExist,
  NotProjectOwner,
  ProjectDoesNotExist,
  UnauthorizedExpenseExecution,
  ZeroAddress
} from "../src/ProtocolErrors.sol";
import {ReputationRegistry} from "../src/ReputationRegistry.sol";
import {ProtocolRoles} from "../src/ProtocolRoles.sol";

import {ProtocolTest} from "./ProtocolTest.sol";

contract RejectingRecipient {
  receive() external payable {
    revert("reject");
  }
}

contract ProtocolCoverageTest is ProtocolTest {
  function testDeployScriptReturnsDeploymentAddresses() public {
    DeployProtocol script = new DeployProtocol();
    DeployProtocol.Deployment memory deployment = script.run();

    require(deployment.projectRegistry != address(0), "project registry missing");
    require(deployment.grantTreasury != address(0), "grant treasury missing");
    require(deployment.milestoneRegistry != address(0), "milestone registry missing");
    require(deployment.reputationRegistry != address(0), "reputation registry missing");
  }

  function testProjectRegistryGuardsAndGetters() public {
    vm.expectRevert(ZeroAddress.selector);
    new ProjectRegistry(address(0));

    uint256 projectId = _createProjectAsAdmin();

    require(projectRegistry.projectExists(projectId), "project should exist");
    require(!projectRegistry.projectExists(999), "missing project should be false");
    require(projectRegistry.totalProjects() == 1, "total projects mismatch");

    vm.expectRevert(abi.encodeWithSelector(ProjectDoesNotExist.selector, 999));
    projectRegistry.getProject(999);
  }

  function testReputationRegistryGuards() public {
    vm.expectRevert(ZeroAddress.selector);
    new ReputationRegistry(address(0), address(projectRegistry));

    uint256 projectId = _createProjectAsAdmin();
    _grantReputationOracle(admin);

    vm.expectRevert(EmptyValue.selector);
    vm.prank(admin);
    reputationRegistry.addReputationEvent(address(0), projectId, 1, "reward");
  }

  function testGrantTreasuryConstructorReceiveAndDepositGuards() public {
    vm.expectRevert(ZeroAddress.selector);
    new GrantTreasury(address(0), address(projectRegistry));

    vm.deal(address(this), 1 ether);
    vm.expectRevert(InvalidAmount.selector);
    payable(address(grantTreasury)).transfer(1 ether);

    uint256 projectId = _createProjectAsAdmin();

    vm.expectRevert(InvalidAmount.selector);
    vm.prank(alice);
    grantTreasury.deposit{value: 0}(projectId);

    vm.expectRevert(abi.encodeWithSelector(ProjectDoesNotExist.selector, 999));
    vm.prank(alice);
    grantTreasury.deposit{value: 1 ether}(999);
  }

  function testGrantTreasuryProposalAndApprovalGuards() public {
    uint256 projectId = _createProjectAsAlice();
    _grantTreasuryApprover(admin);

    vm.expectRevert(abi.encodeWithSelector(NotProjectOwner.selector, projectId));
    vm.prank(bob);
    grantTreasury.proposeExpense(projectId, payable(alice), 1 ether, "blocked");

    vm.expectRevert(EmptyValue.selector);
    vm.prank(alice);
    grantTreasury.proposeExpense(projectId, payable(address(0)), 1 ether, "memo");

    vm.expectRevert(abi.encodeWithSelector(ExpenseDoesNotExist.selector, 999));
    vm.prank(admin);
    grantTreasury.approveExpense(999);

    vm.prank(alice);
    uint256 expenseId = grantTreasury.proposeExpense(
      projectId,
      payable(alice),
      1 ether,
      "seed the build"
    );

    GrantTreasury.Expense memory expense = grantTreasury.getExpense(expenseId);
    _assertEqUint(expense.id, expenseId);
    _assertEqAddress(expense.recipient, alice);

    vm.prank(admin);
    grantTreasury.approveExpense(expenseId);

    vm.expectRevert(abi.encodeWithSelector(ExpenseAlreadyApproved.selector, expenseId));
    vm.prank(admin);
    grantTreasury.approveExpense(expenseId);
  }

  function testGrantTreasuryExecutionGuards() public {
    uint256 projectId = _createProjectAsAdmin();
    _grantTreasuryApprover(admin);

    vm.prank(alice);
    grantTreasury.deposit{value: 1 ether}(projectId);

    vm.prank(admin);
    uint256 unapprovedExpenseId = grantTreasury.proposeExpense(
      projectId,
      payable(admin),
      1 ether,
      "unapproved"
    );

    vm.expectRevert(abi.encodeWithSelector(ExpenseNotApproved.selector, unapprovedExpenseId));
    vm.prank(admin);
    grantTreasury.executeExpense(unapprovedExpenseId);

    vm.prank(admin);
    uint256 underfundedExpenseId = grantTreasury.proposeExpense(
      projectId,
      payable(admin),
      2 ether,
      "underfunded"
    );
    vm.prank(admin);
    grantTreasury.approveExpense(underfundedExpenseId);

    vm.expectRevert(InvalidAmount.selector);
    vm.prank(admin);
    grantTreasury.executeExpense(underfundedExpenseId);

    // Unauthorized caller (neither proposer nor approver) must be blocked.
    // Use a funded expense for the auth check so balance is not the revert reason:
    // propose a small funded expense, approve it, then try from carol.
    vm.prank(alice);
    grantTreasury.deposit{value: 2 ether}(projectId);
    vm.prank(admin);
    uint256 authCheckExpenseId = grantTreasury.proposeExpense(
      projectId,
      payable(admin),
      0.5 ether,
      "auth check"
    );
    vm.prank(admin);
    grantTreasury.approveExpense(authCheckExpenseId);
    vm.expectRevert(abi.encodeWithSelector(UnauthorizedExpenseExecution.selector, authCheckExpenseId));
    vm.prank(carol);
    grantTreasury.executeExpense(authCheckExpenseId);

    // Rejecting recipient that is also the project owner (owner-only rule):
    // grant creator role to the contract, have it create its own project.
    RejectingRecipient rejectingRecipient = new RejectingRecipient();
    vm.prank(admin);
    projectRegistry.grantRole(ProtocolRoles.PROJECT_CREATOR_ROLE, address(rejectingRecipient));
    vm.prank(address(rejectingRecipient));
    uint256 rejectingProjectId = projectRegistry.createProject("Rejecting", "ipfs://rejecting");
    vm.prank(alice);
    grantTreasury.deposit{value: 2 ether}(rejectingProjectId);

    vm.prank(address(rejectingRecipient));
    uint256 failingExpenseId = grantTreasury.proposeExpense(
      rejectingProjectId,
      payable(address(rejectingRecipient)),
      1 ether,
      "failing"
    );
    vm.prank(admin);
    grantTreasury.approveExpense(failingExpenseId);

    vm.expectRevert(abi.encodeWithSelector(ExpenseExecutionFailed.selector, failingExpenseId));
    vm.prank(admin);
    grantTreasury.executeExpense(failingExpenseId);
  }

  function testMilestoneRegistryGuards() public {
    vm.expectRevert(ZeroAddress.selector);
    new MilestoneRegistry(address(0), address(projectRegistry));

    uint256 projectId = _createProjectAsAlice();

    vm.expectRevert(EmptyValue.selector);
    vm.prank(alice);
    milestoneRegistry.createMilestone(projectId, "", "ipfs://details");

    vm.expectRevert(abi.encodeWithSelector(NotProjectOwner.selector, projectId));
    vm.prank(bob);
    milestoneRegistry.createMilestone(projectId, "Blocked milestone", "ipfs://details");

    vm.prank(alice);
    uint256 milestoneId = milestoneRegistry.createMilestone(
      projectId,
      "Coverage milestone",
      "ipfs://milestone"
    );

    vm.expectRevert(EmptyValue.selector);
    vm.prank(alice);
    milestoneRegistry.submitProof(milestoneId, "");

    vm.expectRevert(abi.encodeWithSelector(NotProjectOwner.selector, projectId));
    vm.prank(bob);
    milestoneRegistry.submitProof(milestoneId, "ipfs://bad-proof");

    vm.prank(alice);
    milestoneRegistry.submitProof(milestoneId, "ipfs://good-proof");

    vm.prank(admin);
    milestoneRegistry.approveMilestone(milestoneId);

    vm.expectRevert(abi.encodeWithSelector(MilestoneAlreadyApproved.selector, milestoneId));
    vm.prank(admin);
    milestoneRegistry.approveMilestone(milestoneId);

    vm.expectRevert(abi.encodeWithSelector(MilestoneAlreadyApproved.selector, milestoneId));
    vm.prank(alice);
    milestoneRegistry.submitProof(milestoneId, "ipfs://another-proof");

    vm.expectRevert(abi.encodeWithSelector(MilestoneDoesNotExist.selector, 999));
    milestoneRegistry.getMilestone(999);
  }
}
