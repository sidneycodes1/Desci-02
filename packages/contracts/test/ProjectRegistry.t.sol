// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ProtocolTest} from "./ProtocolTest.sol";
import {EmptyValue} from "../src/ProtocolErrors.sol";
import {IProjectRegistry} from "../src/interfaces/IProjectRegistry.sol";

contract ProjectRegistryTest is ProtocolTest {
  function testCreateProjectStoresProjectData() public {
    _grantProjectCreator(alice);

    vm.prank(alice);
    uint256 projectId = projectRegistry.createProject("Quantum Grants", "ipfs://quantum");

    IProjectRegistry.Project memory project = projectRegistry.getProject(projectId);

    _assertEqUint(project.id, projectId);
    _assertEqAddress(project.owner, alice);
    _assertEqString(project.name, "Quantum Grants");
    _assertEqString(project.metadataURI, "ipfs://quantum");
    require(project.active, "project should be active");
  }

  function testPauseAndUnpauseProjectRegistry() public {
    _grantProjectCreator(alice);

    vm.prank(admin);
    projectRegistry.pause();

    vm.expectRevert();
    vm.prank(alice);
    projectRegistry.createProject("Paused", "ipfs://paused");

    vm.prank(admin);
    projectRegistry.unpause();

    vm.prank(alice);
    uint256 projectId = projectRegistry.createProject("Restored", "ipfs://restored");

    require(projectRegistry.projectExists(projectId), "project should exist");
  }

  function testCreateProjectRejectsEmptyInputs() public {
    _grantProjectCreator(alice);

    vm.expectRevert(EmptyValue.selector);
    vm.prank(alice);
    projectRegistry.createProject("", "ipfs://empty");
  }
}

