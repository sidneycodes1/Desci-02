// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script} from "forge-std/Script.sol";

import {GrantTreasury} from "../src/GrantTreasury.sol";
import {MilestoneRegistry} from "../src/MilestoneRegistry.sol";
import {ProjectRegistry} from "../src/ProjectRegistry.sol";
import {ReputationRegistry} from "../src/ReputationRegistry.sol";

/// @title DeployProtocol
/// @notice Foundry deployment script wiring the four registries together.
/// @dev Broadcasts with msg.sender as the initial admin of every contract.
/// Phase 3 performs implementation and testing only — no network deployment.
contract DeployProtocol is Script {
  /// @notice Deployed contract addresses from a single run.
  struct Deployment {
    address projectRegistry;
    address grantTreasury;
    address milestoneRegistry;
    address reputationRegistry;
  }

  /// @notice Deploy all contracts and return their addresses.
  /// @return deployment Addresses of the four deployed contracts.
  function run() external returns (Deployment memory deployment) {
    vm.startBroadcast();

    address admin = msg.sender;
    ProjectRegistry projectRegistry = new ProjectRegistry(admin);
    GrantTreasury grantTreasury = new GrantTreasury(admin, address(projectRegistry));
    MilestoneRegistry milestoneRegistry = new MilestoneRegistry(admin, address(projectRegistry));
    ReputationRegistry reputationRegistry = new ReputationRegistry(admin, address(projectRegistry));

    vm.stopBroadcast();

    deployment = Deployment({
      projectRegistry: address(projectRegistry),
      grantTreasury: address(grantTreasury),
      milestoneRegistry: address(milestoneRegistry),
      reputationRegistry: address(reputationRegistry)
    });
  }
}

