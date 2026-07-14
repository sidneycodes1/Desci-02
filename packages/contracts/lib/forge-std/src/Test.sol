// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Vm} from "./Vm.sol";

abstract contract Test {
  address internal constant HEVM_ADDRESS = address(
    uint160(uint256(keccak256("hevm cheat code")))
  );

  Vm internal constant vm = Vm(HEVM_ADDRESS);
}

