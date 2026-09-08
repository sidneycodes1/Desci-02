// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ProtocolTest} from "./ProtocolTest.sol";
import {GrantTreasury} from "../src/GrantTreasury.sol";

contract GrantTreasuryTest is ProtocolTest {
  function testDepositAndExpenseLifecycle() public {
    uint256 projectId = _createProjectAsAdmin();
    vm.prank(alice);
    grantTreasury.deposit{value: 5 ether}(projectId);

    vm.prank(admin);
    uint256 expenseId = grantTreasury.proposeExpense(
      projectId,
      payable(bob),
      2 ether,
      "seed the build"
    );

    _grantTreasuryApprover(admin);
    vm.prank(admin);
    grantTreasury.approveExpense(expenseId);

    uint256 bobBefore = bob.balance;
    vm.prank(carol);
    grantTreasury.executeExpense(expenseId);

    _assertEqUint(grantTreasury.projectBalances(projectId), 3 ether);
    _assertEqUint(bob.balance, bobBefore + 2 ether);
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
      payable(bob),
      1 ether,
      "single payment"
    );

    _grantTreasuryApprover(admin);
    vm.prank(admin);
    grantTreasury.approveExpense(expenseId);

    vm.prank(carol);
    grantTreasury.executeExpense(expenseId);

    vm.expectRevert();
    vm.prank(carol);
    grantTreasury.executeExpense(expenseId);
  }
}
