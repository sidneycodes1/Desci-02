// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface IProjectRegistry {
  struct Project {
    uint256 id;
    address owner;
    string name;
    string metadataURI;
    uint256 createdAt;
    bool active;
  }

  function getProject(uint256 projectId) external view returns (Project memory);

  function projectExists(uint256 projectId) external view returns (bool);
}

