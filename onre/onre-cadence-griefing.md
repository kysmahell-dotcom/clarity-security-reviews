# OnRe Prop AMM cadence state can be poisoned with dust sells

## Suggested severity

**Medium — griefing / temporary loss of availability of the sell path.**

The attacker does not need to profit. A permissionless attacker can make later users receive a
materially worse quote or make their already-quoted swaps revert on `minimum_out`, while spending
only transaction fees and economically negligible token dust.

## Scope and deployment evidence

The affected program is the in-scope OnRe mainnet program
`onreuGhHHgVzMWSkj2oQDLDtvvGvoepBPkqyaubFcwe`, reviewed at the `mainnet-live` source commit
`1dbc6ec0ed18a8fc81516f930d85e669b689d852`.

A read-only `getAccountInfo` query of the deployed USDG `PropAmmPairState` account
`4xYJH6Yf3bTPmsVoqi9rfBCSVyiwSkU1VMMcE6LE86oG` produced the following relevant values:

| Field | Live value |
| --- | ---: |
| `enabled` | `true` |
| `curve_peg_haircut_bps` | `700` |
| `curve_exponent_scaled` | `25,000` |
| `cadence_threshold` | `20` |
| `cadence_wave_scaled` | `10,000` |
| `epoch_duration_seconds` | `86,400` |
| `wall_sensitivity_scaled` | `20,000` |
| `minimum_sell_haircut_onyc` | **`0`** |
| `curr_sell_trade_count` | `1` |
| `curr_sell_value_stable` | `5,718,071` |

The USDG redemption-vault balance used by the PoC snapshot is `2,499,965.861190 USDG`.

## Root cause

`record_prop_amm_sell` increments `curr_sell_trade_count` by exactly one for every successful
sell, irrespective of its notional value. The quote path then derives the cadence-wave height
only from that count:

```text
y_quote = cadence_wave_scaled * min(curr_sell_trade_count, cadence_threshold)
          / cadence_threshold
```

The resulting cadence target is used as a lower bound on the sell haircut. There is no minimum
raw stable value for a trade to count. The configured `minimum_sell_haircut_onyc` could impose an
economic cost on each count increment, but it is validly configurable to zero and is zero on the
deployed USDG pair.

With the live 9-decimal ONyc and 6-decimal USDG mints, only 875 ONyc base units
(`0.000000875 ONyc`) are needed to produce a nonzero one-micro-USDG raw output after the 20-bps
Prop AMM sell fee. Because the utilization calculation floors this dust trade to zero at the
`1e12` hard-wall scale, it still pays one micro-USDG and successfully increments the counter.

This differs from the already-known order-splitting behavior. Splitting concerns how one
seller's notional is priced across several chunks. Here, an unrelated account can cheaply poison
global pair state before a victim's independent trade; the attack works even though the dust
notional is effectively zero and adds no meaningful sell pressure.

## Attack path

1. Observe a victim quote or pre-poison the pair at any point in the active 24-hour epoch.
2. Submit enough minimum-size `open_swap_sell` calls to bring `curr_sell_trade_count` to 20.
   Starting from the captured live count of 1 requires 19 calls.
3. Each call sells 875 ONyc base units with `minimum_out = 1` USDG base unit. All calls succeed,
   while the total gross input is less than `0.000017 ONyc`.
4. The victim's quote now uses the maximum cadence-wave height for the remainder of the epoch.
5. A victim transaction using the earlier quote reverts if its `minimum_out` is protected. With
   permissive slippage, it executes at the poisoned, materially lower output.

Using the captured deployment values, the included harness models a victim sell with a raw value
of 100,000 USDG:

| State | Victim output |
| --- | ---: |
| Observed count `1` | about `99,557.7 USDG` |
| Poisoned count `20` | about `91,154.6 USDG` |
| Attacker-induced reduction | **more than `8,400 USDG`** |

The attack's token dust is almost entirely returned as USDG; its meaningful cost is transaction
fees. Even a partial bundle that adds only a few count increments can invalidate ordinary
slippage limits, and the poisoned counter persists until the current epoch rolls.

## Proof of concept

Run:

```bash
node onre/cadence_griefing_poc.js
```

The harness is dependency-free. It reproduces the on-chain integer fee, dynamic-wall,
utilization, cadence-wave, and output calculations using the captured live configuration. It
asserts that every dust sell has nonzero output, that 19 dust sells saturate the cadence counter,
that their total input stays below `0.000017 ONyc`, and that the victim-output reduction exceeds
8,000 USDG.

## Recommended remediation

Do not let raw transaction count independently control a global quote parameter. Prefer one of:

1. weight cadence by cumulative sell notional instead of transaction count;
2. increment the cadence counter only when raw sell value exceeds a meaningful pair-specific
   threshold; or
3. maintain per-seller cadence state if the intended control is repeated behavior by one seller.

As defense in depth, enforce a nonzero minimum sell notional or non-bypassable minimum fee, but do
not rely on it as the primary fix: a fixed per-trade fee still permits a griefing multiplier when
the harm to third parties greatly exceeds the attacker's fee.

Add a regression test in which an unrelated attacker performs threshold-many minimum-size sells
and assert that the victim's quote cannot move materially unless the attacker contributes
comparable economic notional.

## Prior-knowledge check

The source history, tracked documentation, tests, and public GitHub issues were searched for
`dust`, `spam`, `grief`, and `sybil` in connection with cadence; no disclosure of this
third-party state-poisoning vector was found. Existing tests document that a high count changes
pricing and that cadence penalizes split sells, but they do not test whether negligible-notional
transactions from an unrelated account can manufacture that high count. The previously rejected
split-order report is therefore not reused as this finding's impact or novelty basis.
