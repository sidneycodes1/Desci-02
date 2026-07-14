// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script} from "forge-std/Script.sol";

import {GrantTreasury} from "../src/GrantTreasury.sol";
import {MilestoneRegistry} from "../src/MilestoneRegistry.sol";
import {ProjectRegistry} from "../src/ProjectRegistry.sol";
import {ReputationRegistry} from "../src/ReputationRegistry.sol";

contract DeployProtocol is Script {
  struct Deployment {
    address projectRegistry;
    address grantTreasury;
    address milestoneRegistry;
    address reputationRegistry;
  }

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

