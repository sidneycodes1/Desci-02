// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

error ZeroAddress();
error EmptyValue();
error InvalidAmount();
error ProjectDoesNotExist(uint256 projectId);
error ExpenseDoesNotExist(uint256 expenseId);
error ExpenseNotApproved(uint256 expenseId);
error ExpenseAlreadyApproved(uint256 expenseId);
error ExpenseAlreadyExecuted(uint256 expenseId);
error ExpenseExecutionFailed(uint256 expenseId);
error MilestoneDoesNotExist(uint256 milestoneId);
error MilestoneNotSubmitted(uint256 milestoneId);
error MilestoneAlreadyApproved(uint256 milestoneId);
error NotProjectOwner(uint256 projectId);
error UnauthorizedExpenseExecution(uint256 expenseId);
error InvalidExpenseRecipient(uint256 projectId);
error MemoTooLong(uint256 maxLength);

