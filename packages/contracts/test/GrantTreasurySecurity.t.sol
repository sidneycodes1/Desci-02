// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {GrantTreasury} from "../src/GrantTreasury.sol";
import {MemoTooLong} from "../src/ProtocolErrors.sol";

import {ProtocolTest} from "./ProtocolTest.sol";

/// @notice Malicious recipient that attempts to reenter executeExpense
/// from its receive() and records whether the reentry succeeded.
/// @dev Deployed as a project owner (owner-only recipient rule), so the
/// attack exercises the real payout path, not a reverted proposal.
contract ReenteringRecipient {
  GrantTreasury public treasury;
  uint256 public targetExpense;
  bool public reentered;
  bool public reentrySucceeded;

  constructor(address treasuryAddress) {
    treasury = GrantTreasury(payable(treasuryAddress));
  }

  function setTarget(uint256 expenseId) external {
    targetExpense = expenseId;
  }

  receive() external payable {
    reentered = true;
    try treasury.executeExpense(targetExpense) {
      reentrySucceeded = true;
    } catch {
      reentrySucceeded = false;
    }
  }
}

contract GrantTreasurySecurityTest is ProtocolTest {
  function testReentrantRecipientCannotDoubleSpend() public {
    ReenteringRecipient attacker = new ReenteringRecipient(address(grantTreasury));

    // Attacker owns its project (satisfies the owner-only recipient rule).
    _grantProjectCreator(address(attacker));
    vm.prank(address(attacker));
    uint256 projectId = projectRegistry.createProject("Attack", "ipfs://attack");

    vm.prank(alice);
    grantTreasury.deposit{value: 2 ether}(projectId);

    vm.prank(address(attacker));
    uint256 expenseId = grantTreasury.proposeExpense(
      projectId,
      payable(address(attacker)),
      1 ether,
      "payout"
    );
    attacker.setTarget(expenseId);

    _grantTreasuryApprover(admin);
    vm.prank(admin);
    grantTreasury.approveExpense(expenseId);

    uint256 attackerBefore = address(attacker).balance;
    vm.prank(admin);
    grantTreasury.executeExpense(expenseId);

    // receive() ran, the nested executeExpense was blocked, single payout.
    require(attacker.reentered(), "receive never ran");
    require(!attacker.reentrySucceeded(), "reentry succeeded");
    _assertEqUint(address(attacker).balance, attackerBefore + 1 ether);
    _assertEqUint(grantTreasury.projectBalances(projectId), 1 ether);
    require(grantTreasury.getExpense(expenseId).executed, "expense not marked executed");
  }

  function testMemoAtMaxLengthIsAccepted() public {
    uint256 projectId = _createProjectAsAdmin();
    string memory maxMemo = new string(1024);

    vm.prank(admin);
    uint256 expenseId = grantTreasury.proposeExpense(
      projectId,
      payable(admin),
      1 ether,
      maxMemo
    );

    _assertEqUint(grantTreasury.getExpense(expenseId).id, expenseId);
  }

  function testMemoOneByteOverMaxIsRejected() public {
    uint256 projectId = _createProjectAsAdmin();

    vm.expectRevert(abi.encodeWithSelector(MemoTooLong.selector, grantTreasury.MAX_MEMO_LENGTH()));
    vm.prank(admin);
    grantTreasury.proposeExpense(projectId, payable(admin), 1 ether, new string(1025));
  }
}
