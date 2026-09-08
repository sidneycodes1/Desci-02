// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ProtocolTest} from "./ProtocolTest.sol";
import {GrantTreasury} from "../src/GrantTreasury.sol";
import {
  InvalidExpenseRecipient,
  MemoTooLong,
  UnauthorizedExpenseExecution
} from "../src/ProtocolErrors.sol";

contract GrantTreasuryTest is ProtocolTest {
  function testDepositAndExpenseLifecycle() public {
    uint256 projectId = _createProjectAsAdmin();
    vm.prank(alice);
    grantTreasury.deposit{value: 5 ether}(projectId);

    vm.prank(admin);
    uint256 expenseId = grantTreasury.proposeExpense(
      projectId,
      payable(admin),
      2 ether,
      "seed the build"
    );

    _grantTreasuryApprover(admin);
    vm.prank(admin);
    grantTreasury.approveExpense(expenseId);

    uint256 adminBefore = admin.balance;
    vm.prank(admin);
    grantTreasury.executeExpense(expenseId);

    _assertEqUint(grantTreasury.projectBalances(projectId), 3 ether);
    _assertEqUint(admin.balance, adminBefore + 2 ether);
  }

  function testPauseBlocksDepositAndUnpauseRestoresIt() public {
    uint256 projectId = _createProjectAsAdmin();

    vm.prank(admin);
    grantTreasury.pause();

    vm.expectRevert();
    vm.prank(alice);
    grantTreasury.deposit{value: 1 ether}(projectId);

    vm.prank(admin);
    grantTreasury.unpause();

    vm.prank(alice);
    grantTreasury.deposit{value: 1 ether}(projectId);

    _assertEqUint(grantTreasury.projectBalances(projectId), 1 ether);
  }

  function testCannotExecuteExpenseTwice() public {
    uint256 projectId = _createProjectAsAdmin();
    vm.prank(alice);
    grantTreasury.deposit{value: 3 ether}(projectId);

    vm.prank(admin);
    uint256 expenseId = grantTreasury.proposeExpense(
      projectId,
      payable(admin),
      1 ether,
      "single payment"
    );

    _grantTreasuryApprover(admin);
    vm.prank(admin);
    grantTreasury.approveExpense(expenseId);

    vm.prank(admin);
    grantTreasury.executeExpense(expenseId);

    vm.expectRevert();
    vm.prank(admin);
    grantTreasury.executeExpense(expenseId);
  }

  function testUnauthorizedAddressCannotExecuteExpense() public {
    uint256 projectId = _createProjectAsAdmin();
    vm.prank(alice);
    grantTreasury.deposit{value: 2 ether}(projectId);

    vm.prank(admin);
    uint256 expenseId = grantTreasury.proposeExpense(
      projectId,
      payable(admin),
      1 ether,
      "restricted payout"
    );

    _grantTreasuryApprover(admin);
    vm.prank(admin);
    grantTreasury.approveExpense(expenseId);

    // carol is neither proposer (admin) nor approver — must revert
    vm.expectRevert(abi.encodeWithSelector(UnauthorizedExpenseExecution.selector, expenseId));
    vm.prank(carol);
    grantTreasury.executeExpense(expenseId);
  }

  function testProposerCanExecuteWithoutApproverRole() public {
    // alice owns project, proposes to herself, admin approves, alice executes
    uint256 projectId = _createProjectAsAlice();
    vm.prank(alice);
    grantTreasury.deposit{value: 2 ether}(projectId);

    vm.prank(alice);
    uint256 expenseId = grantTreasury.proposeExpense(
      projectId,
      payable(alice),
      1 ether,
      "proposer executes"
    );

    _grantTreasuryApprover(admin);
    vm.prank(admin);
    grantTreasury.approveExpense(expenseId);

    uint256 aliceBefore = alice.balance;
    vm.prank(alice);
    grantTreasury.executeExpense(expenseId);

    _assertEqUint(alice.balance, aliceBefore + 1 ether);
  }

  function testOversizedMemoIsRejected() public {
    uint256 projectId = _createProjectAsAdmin();
    string memory longMemo = new string(1025);

    vm.expectRevert(abi.encodeWithSelector(MemoTooLong.selector, grantTreasury.MAX_MEMO_LENGTH()));
    vm.prank(admin);
    grantTreasury.proposeExpense(projectId, payable(admin), 1 ether, longMemo);
  }

  function testNonOwnerRecipientIsRejected() public {
    uint256 projectId = _createProjectAsAdmin();

    vm.expectRevert(abi.encodeWithSelector(InvalidExpenseRecipient.selector, projectId));
    vm.prank(admin);
    grantTreasury.proposeExpense(projectId, payable(bob), 1 ether, "vendor payout");
  }
}
