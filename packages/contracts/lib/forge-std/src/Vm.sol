// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface Vm {
  function prank(address msgSender) external;

  function startPrank(address msgSender) external;

  function stopPrank() external;

  function expectRevert(bytes calldata revertData) external;

  function expectRevert(bytes4 revertData) external;

  function expectRevert() external;

  function expectEmit() external;

  function deal(address account, uint256 newBalance) external;

  function warp(uint256 newTimestamp) external;

  function roll(uint256 newBlockNumber) external;

  function startBroadcast() external;

  function stopBroadcast() external;
}
