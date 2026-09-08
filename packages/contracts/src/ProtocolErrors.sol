// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title ProtocolErrors
/// @notice Every custom error in the protocol, shared so clients can decode
/// reverts uniformly across registries and the treasury.

/// @notice Thrown when a zero address is supplied where an actor is required.
error ZeroAddress();
/// @notice Thrown when a required string/amount is empty or zero.
error EmptyValue();
/// @notice Thrown for zero-value deposits, underfunded executions and rejected direct transfers.
error InvalidAmount();
/// @notice Thrown when referencing a project id that was never created.
/// @param projectId The missing project id.
error ProjectDoesNotExist(uint256 projectId);
/// @notice Thrown when referencing an expense id that was never proposed.
/// @param expenseId The missing expense id.
error ExpenseDoesNotExist(uint256 expenseId);
/// @notice Thrown when executing an expense that was never approved.
/// @param expenseId The unapproved expense id.
error ExpenseNotApproved(uint256 expenseId);
/// @notice Thrown when approving an already-approved expense.
/// @param expenseId The expense id.
error ExpenseAlreadyApproved(uint256 expenseId);
/// @notice Thrown when executing an already-executed expense (double-spend guard).
/// @param expenseId The expense id.
error ExpenseAlreadyExecuted(uint256 expenseId);
/// @notice Thrown when the ETH transfer to the recipient fails.
/// @dev State changes are reverted with the expense; safe to retry execution.
/// @param expenseId The failed expense id.
error ExpenseExecutionFailed(uint256 expenseId);
/// @notice Thrown when referencing a milestone id that was never created.
/// @param milestoneId The missing milestone id.
error MilestoneDoesNotExist(uint256 milestoneId);
/// @notice Thrown when approving a milestone with no submitted proof.
/// @param milestoneId The milestone id.
error MilestoneNotSubmitted(uint256 milestoneId);
/// @notice Thrown when approving or re-submitting an approved milestone.
/// @param milestoneId The milestone id.
error MilestoneAlreadyApproved(uint256 milestoneId);
/// @notice Thrown when the caller is neither the project owner nor the required role.
/// @param projectId The project the caller tried to act on.
error NotProjectOwner(uint256 projectId);
/// @notice Thrown when anyone other than the proposer or a treasury approver calls executeExpense.
/// @param expenseId The expense id.
error UnauthorizedExpenseExecution(uint256 expenseId);
/// @notice Thrown when an expense recipient is not the project owner (owner-only payout rule).
/// @param projectId The project of the rejected expense.
error InvalidExpenseRecipient(uint256 projectId);
/// @notice Thrown when an expense memo exceeds MAX_MEMO_LENGTH bytes.
/// @param maxLength The enforced cap in bytes.
error MemoTooLong(uint256 maxLength);
