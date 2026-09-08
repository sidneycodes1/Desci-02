// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IProjectRegistry} from "./interfaces/IProjectRegistry.sol";
import {
  ExpenseAlreadyApproved,
  ExpenseAlreadyExecuted,
  ExpenseDoesNotExist,
  ExpenseExecutionFailed,
  ExpenseNotApproved,
  EmptyValue,
  InvalidAmount,
  InvalidExpenseRecipient,
  MemoTooLong,
  ProjectDoesNotExist,
  NotProjectOwner,
  UnauthorizedExpenseExecution,
  ZeroAddress
} from "./ProtocolErrors.sol";
import {ProtocolRoles} from "./ProtocolRoles.sol";

/// @title GrantTreasury
/// @notice Holds per-project ETH balances and pays approved expenses.
/// @dev Immutable (no proxy). Expense flow: propose (project owner or
/// TREASURY_PROPOSER_ROLE) -> approve (TREASURY_APPROVER_ROLE) -> execute
/// (proposer or approver). Payouts go ONLY to the project owner and memos
/// are capped at MAX_MEMO_LENGTH bytes. State is updated before the external
/// call (checks-effects-interactions) and every mutating function is
/// nonReentrant. Direct ETH transfers revert; use deposit().
contract GrantTreasury is AccessControl, Pausable, ReentrancyGuard {
  using ProtocolRoles for bytes32;

  /// @notice Maximum expense memo length in bytes (gas-griefing bound).
  uint256 public constant MAX_MEMO_LENGTH = 1024;

  /// @notice Single spend request through its lifecycle.
  /// @param id Sequential expense id.
  /// @param projectId Project the funds are drawn from.
  /// @param proposer Account that proposed the expense.
  /// @param recipient Payout target; always the project owner by construction.
  /// @param amount Wei to send on execution.
  /// @param memo Bounded justification string (<= MAX_MEMO_LENGTH bytes).
  /// @param approved True once a treasury approver signs off.
  /// @param executed True once funds have left the treasury.
  /// @param createdAt Block timestamp of proposal.
  /// @param approvedAt Block timestamp of approval (0 if never).
  /// @param executedAt Block timestamp of execution (0 if never).
  struct Expense {
    uint256 id;
    uint256 projectId;
    address proposer;
    address payable recipient;
    uint256 amount;
    string memo;
    bool approved;
    bool executed;
    uint256 createdAt;
    uint256 approvedAt;
    uint256 executedAt;
  }

  IProjectRegistry public immutable projectRegistry;
  uint256 private _nextExpenseId = 1;

  mapping(uint256 => uint256) public projectBalances;
  mapping(uint256 => Expense) private _expenses;

  /// @notice Emitted on every deposit.
  /// @param projectId Credited project.
  /// @param from Depositor.
  /// @param amount Wei received.
  event Deposited(uint256 indexed projectId, address indexed from, uint256 amount);
  /// @notice Emitted on every expense proposal.
  /// @param expenseId Sequential id assigned.
  /// @param projectId Project to be debited.
  /// @param proposer Proposing account.
  /// @param recipient Payout target (always the project owner).
  /// @param amount Wei requested.
  /// @param memo Justification as supplied.
  event ExpenseProposed(
    uint256 indexed expenseId,
    uint256 indexed projectId,
    address indexed proposer,
    address recipient,
    uint256 amount,
    string memo
  );
  /// @notice Emitted on approval.
  /// @param expenseId Expense id.
  /// @param approver Approver account.
  event ExpenseApproved(uint256 indexed expenseId, address indexed approver);
  /// @notice Emitted after funds leave the treasury.
  /// @param expenseId Expense id.
  /// @param recipient Payout target.
  /// @param amount Wei sent.
  event ExpenseExecuted(uint256 indexed expenseId, address indexed recipient, uint256 amount);
  /// @notice Emitted whenever pause state changes.
  /// @param paused True when paused, false when unpaused.
  event TreasuryPausingStatusChanged(bool paused);

  /// @notice Deploy the treasury bound to a ProjectRegistry.
  /// @dev Grants DEFAULT_ADMIN_ROLE, TREASURY_PROPOSER_ROLE and
  /// TREASURY_APPROVER_ROLE to `admin`.
  /// @param admin Initial admin/proposer/approver. Must not be zero.
  /// @param projectRegistryAddress ProjectRegistry used for existence and ownership checks.
  constructor(address admin, address projectRegistryAddress) {
    if (admin == address(0) || projectRegistryAddress == address(0)) {
      revert ZeroAddress();
    }

    projectRegistry = IProjectRegistry(projectRegistryAddress);
    _grantRole(DEFAULT_ADMIN_ROLE, admin);
    _grantRole(ProtocolRoles.TREASURY_PROPOSER_ROLE, admin);
    _grantRole(ProtocolRoles.TREASURY_APPROVER_ROLE, admin);
  }

  /// @notice Rejects direct transfers so funds cannot bypass project accounting.
  /// @dev Always reverts; fund projects via deposit().
  receive() external payable {
    revert InvalidAmount();
  }

  /// @notice Pause deposits, proposals, approvals and executions. Admin only.
  function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
    _pause();
    emit TreasuryPausingStatusChanged(true);
  }

  /// @notice Unpause the treasury. Admin only.
  function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
    _unpause();
    emit TreasuryPausingStatusChanged(false);
  }

  /// @notice Credit `msg.value` to a project's balance. Anyone may fund any existing project.
  /// @dev Requires non-zero value and an existing project.
  /// @param projectId Project to credit.
  function deposit(uint256 projectId) external payable whenNotPaused nonReentrant {
    if (msg.value == 0) {
      revert InvalidAmount();
    }

    _assertProjectExists(projectId);
    projectBalances[projectId] += msg.value;

    emit Deposited(projectId, msg.sender, msg.value);
  }

  /// @notice Propose a spend request against a project balance.
  /// @dev Caller must be the project owner or hold TREASURY_PROPOSER_ROLE.
  /// Recipient must equal the project owner; memo is bounded by MAX_MEMO_LENGTH.
  /// @param projectId Existing project to debit.
  /// @param recipient Payout target; must be the project owner.
  /// @param amount Non-zero wei requested (funding checked at execution, not here).
  /// @param memo Non-empty justification of at most MAX_MEMO_LENGTH bytes.
  /// @return expenseId Sequential id of the new expense.
  function proposeExpense(
    uint256 projectId,
    address payable recipient,
    uint256 amount,
    string calldata memo
  ) external whenNotPaused nonReentrant returns (uint256 expenseId) {
    _assertProjectOwnerOrRole(projectId, ProtocolRoles.TREASURY_PROPOSER_ROLE);

    if (recipient == address(0) || amount == 0 || bytes(memo).length == 0) {
      revert EmptyValue();
    }

    if (bytes(memo).length > MAX_MEMO_LENGTH) {
      revert MemoTooLong(MAX_MEMO_LENGTH);
    }

    IProjectRegistry.Project memory project = projectRegistry.getProject(projectId);
    if (recipient != project.owner) {
      revert InvalidExpenseRecipient(projectId);
    }

    expenseId = _nextExpenseId++;
    _expenses[expenseId] = Expense({
      id: expenseId,
      projectId: projectId,
      proposer: msg.sender,
      recipient: recipient,
      amount: amount,
      memo: memo,
      approved: false,
      executed: false,
      createdAt: block.timestamp,
      approvedAt: 0,
      executedAt: 0
    });

    emit ExpenseProposed(expenseId, projectId, msg.sender, recipient, amount, memo);
  }

  /// @notice Approve a proposed expense exactly once. Caller must hold TREASURY_APPROVER_ROLE.
  /// @param expenseId Proposed expense id.
  function approveExpense(uint256 expenseId) external whenNotPaused nonReentrant onlyRole(ProtocolRoles.TREASURY_APPROVER_ROLE) {
    Expense storage expense = _getExpense(expenseId);

    if (expense.approved) {
      revert ExpenseAlreadyApproved(expenseId);
    }

    expense.approved = true;
    expense.approvedAt = block.timestamp;

    emit ExpenseApproved(expenseId, msg.sender);
  }

  /// @notice Pay out an approved expense to the project owner.
  /// @dev Caller must be the proposer or hold TREASURY_APPROVER_ROLE.
  /// Follows checks-effects-interactions (balance and flags update before
  /// the external call) plus nonReentrant, so a malicious recipient cannot
  /// drain via reentry. A failed transfer reverts the whole call and the
  /// expense stays approved-but-unexecuted for retry.
  /// @param expenseId Approved, unexecuted expense id.
  function executeExpense(uint256 expenseId) external whenNotPaused nonReentrant {
    Expense storage expense = _getExpense(expenseId);

    if (!expense.approved) {
      revert ExpenseNotApproved(expenseId);
    }

    if (expense.executed) {
      revert ExpenseAlreadyExecuted(expenseId);
    }

    if (msg.sender != expense.proposer && !hasRole(ProtocolRoles.TREASURY_APPROVER_ROLE, msg.sender)) {
      revert UnauthorizedExpenseExecution(expenseId);
    }

    if (projectBalances[expense.projectId] < expense.amount) {
      revert InvalidAmount();
    }

    projectBalances[expense.projectId] -= expense.amount;
    expense.executed = true;
    expense.executedAt = block.timestamp;

    (bool success, ) = expense.recipient.call{value: expense.amount}("");
    if (!success) {
      revert ExpenseExecutionFailed(expenseId);
    }

    emit ExpenseExecuted(expenseId, expense.recipient, expense.amount);
  }

  /// @notice Fetch an expense or revert with ExpenseDoesNotExist.
  /// @param expenseId Id to look up.
  /// @return The stored expense.
  function getExpense(uint256 expenseId) external view returns (Expense memory) {
    return _getExpense(expenseId);
  }

  function _getExpense(uint256 expenseId) internal view returns (Expense storage expense) {
    expense = _expenses[expenseId];
    if (expense.id == 0) {
      revert ExpenseDoesNotExist(expenseId);
    }
  }

  function _assertProjectExists(uint256 projectId) internal view {
    if (!projectRegistry.projectExists(projectId)) {
      revert ProjectDoesNotExist(projectId);
    }
  }

  function _assertProjectOwnerOrRole(uint256 projectId, bytes32 role) internal view {
    IProjectRegistry.Project memory project = projectRegistry.getProject(projectId);
    if (project.owner != msg.sender && !hasRole(role, msg.sender)) {
      revert NotProjectOwner(projectId);
    }
  }
}
