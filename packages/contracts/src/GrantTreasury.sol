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
  ProjectDoesNotExist,
  NotProjectOwner,
  ZeroAddress
} from "./ProtocolErrors.sol";
import {ProtocolRoles} from "./ProtocolRoles.sol";

contract GrantTreasury is AccessControl, Pausable, ReentrancyGuard {
  using ProtocolRoles for bytes32;

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

  event Deposited(uint256 indexed projectId, address indexed from, uint256 amount);
  event ExpenseProposed(
    uint256 indexed expenseId,
    uint256 indexed projectId,
    address indexed proposer,
    address recipient,
    uint256 amount,
    string memo
  );
  event ExpenseApproved(uint256 indexed expenseId, address indexed approver);
  event ExpenseExecuted(uint256 indexed expenseId, address indexed recipient, uint256 amount);
  event TreasuryPausingStatusChanged(bool paused);

  constructor(address admin, address projectRegistryAddress) {
    if (admin == address(0) || projectRegistryAddress == address(0)) {
      revert ZeroAddress();
    }

    projectRegistry = IProjectRegistry(projectRegistryAddress);
    _grantRole(DEFAULT_ADMIN_ROLE, admin);
    _grantRole(ProtocolRoles.TREASURY_PROPOSER_ROLE, admin);
    _grantRole(ProtocolRoles.TREASURY_APPROVER_ROLE, admin);
  }

  receive() external payable {
    revert InvalidAmount();
  }

  function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
    _pause();
    emit TreasuryPausingStatusChanged(true);
  }

  function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
    _unpause();
    emit TreasuryPausingStatusChanged(false);
  }

  function deposit(uint256 projectId) external payable whenNotPaused nonReentrant {
    if (msg.value == 0) {
      revert InvalidAmount();
    }

    _assertProjectExists(projectId);
    projectBalances[projectId] += msg.value;

    emit Deposited(projectId, msg.sender, msg.value);
  }

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

  function approveExpense(uint256 expenseId) external whenNotPaused nonReentrant onlyRole(ProtocolRoles.TREASURY_APPROVER_ROLE) {
    Expense storage expense = _getExpense(expenseId);

    if (expense.approved) {
      revert ExpenseAlreadyApproved(expenseId);
    }

    expense.approved = true;
    expense.approvedAt = block.timestamp;

    emit ExpenseApproved(expenseId, msg.sender);
  }

  function executeExpense(uint256 expenseId) external whenNotPaused nonReentrant {
    Expense storage expense = _getExpense(expenseId);

    if (!expense.approved) {
      revert ExpenseNotApproved(expenseId);
    }

    if (expense.executed) {
      revert ExpenseAlreadyExecuted(expenseId);
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
