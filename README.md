# Clarity Security Reviews

Independent security reviews of Clarity / Stacks smart contracts, each with an **executable proof-of-concept** so every finding can be reproduced rather than taken on faith.

## Approach

Clarity's design eliminates many classic EVM bug classes (reentrancy, integer overflow), so the vulnerabilities that actually reach Stacks contracts tend to be **contract- and application-level design flaws**: state-machine mistakes, broken fund accounting, and authorization gaps. These reviews focus on that class of issue.

Each review ships with a harness that models the contract's state machine and executes the exploit scenarios, plus a control path that confirms the honest flow behaves correctly. Where a hypothesis turns out to be wrong under execution, it is documented as disproven — the goal is what the code *actually* does, not what it appears to do on a first read.

## Reviews

| Contract | Type | Findings | PoC |
|----------|------|----------|-----|
| [`escrow.clar`](./escrow/escrow-audit.md) | Two-party STX escrow | 1 High\*, 1 Low, 1 Info | [`escrow_poc.js`](./escrow/escrow_poc.js) |

\* Severity within the contract's own trust model; the reviewed contract is an educational sample with no live funds (see the review's scope note).

## Running a PoC

```bash
node escrow/escrow_poc.js
```

No dependencies — the harnesses are plain Node.js and re-implement each contract's state machine with functions annotated back to the Clarity source lines.

## About

Reviews by **Kysmahell** ([@kysmahell-dotcom](https://github.com/kysmahell-dotcom)).
Focus areas: Clarity / Stacks and Solidity smart-contract security.

## License

MIT — see [LICENSE](./LICENSE).
