# @sciagent/contracts

Foundry project for the SciAgent registries on Base: `ProjectRegistry`,
`GrantTreasury` (ETH escrow + expense lifecycle), `MilestoneRegistry`,
`ReputationRegistry` — plus `ProtocolRoles`, `ProtocolErrors`, and
`script/Deploy.s.sol` (`DeployProtocol`). Solidity 0.8.26, OpenZeppelin 5.x,
immutable (no proxies).

```bash
cd packages/contracts
forge build
forge test
```

`src/index.ts` exposes address/ABI helpers for the app layer. See
[SECURITY.md](./SECURITY.md) for the threat model, fund-movement safety,
gas reference, and audit focus.
