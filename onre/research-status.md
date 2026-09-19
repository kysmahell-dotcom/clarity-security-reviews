# OnRe research status

**Target reviewed:** `onre-finance/onre-sol`, `mainnet-live` commit `1dbc6ec0ed18a8fc81516f930d85e669b689d852`  
**Status:** Candidate Medium promoted for Immunefi submission

This file records coverage and the evidence supporting the promoted Category 3 bounty candidate.
A lead is promoted to a report only after it has a deterministic source-faithful PoC, an impact
listed by the current Immunefi rules, deployment reachability, and no verifiable prior knowledge.

## Reviewed surfaces

- regular, V2, legacy, and permissionless offer execution;
- Prop AMM buy, sell, quote, pressure, cadence, and hard-wall accounting;
- redemption request creation, PDA/offer linkage, partial fulfillment, manual persistence/closure,
  cancellation, and pooled vault accounting;
- BUFFER accrual, fee splitting, high-watermark handling, supply baselines, and NAV burns;
- configurable fee/proceeds vault initialization, destinations, and withdrawals;
- state initialization/closure, boss transfer, admins, workers, approvers, and kill switches;
- Ed25519 instruction parsing, expiry checks, and approval replay boundaries;
- market-stat refresh, excluded-supply caching, and lazy PDA initialization;
- SPL Token and Token-2022 mint/account constraints, extensions, and transfer-fee rejection;
- targeted offer/redemption disable authorization and asymmetric kill-switch controls;
- quote/execution parity, minimum-output enforcement, and buy/sell pressure accounting;
- deployed mainnet state, main offer, program-data account, and the V5 MarketStats, BUFFER,
  and excluded-balance PDA initialization state, using read-only RPC calls only.

## Rejected leads

The order-splitting behavior is real but is explicitly regression-tested upstream and was
previously documented as accepted. It is therefore prior knowledge, not a payout candidate.
Other observed legacy/V2 routing differences, permissionless approval behavior, stale excluded
balance behavior, and partial-redemption fee rounding are documented in source, protocol docs,
or prior audits and are not being represented as novel findings. A sequential redemption-request
PDA prefunding hypothesis was also rejected: Anchor 1.1.2 handles a lamport-prefunded system
account by topping up rent, allocating space, and assigning ownership with the PDA signer.

## Promoted candidate

The Prop AMM cadence counter can be raised by economically negligible dust sells because it
counts transactions without weighting them by notional. The live USDG pair has a threshold of
20, a nonzero cadence wave, and a zero minimum sell haircut. A deterministic harness using the
live account snapshot shows that 19 dust sells costing less than `0.000017 ONyc` move the pair
from its observed count of 1 to the maximum cadence penalty and reduce a subsequent 100,000-USDG
raw sell quote by more than 8,000 USDG. This is a global, permissionless state-poisoning/griefing
issue rather than the already-known same-user order-splitting behavior.

See [`onre-cadence-griefing.md`](./onre-cadence-griefing.md) and run
`node onre/cadence_griefing_poc.js` for the report and deterministic reproduction.
