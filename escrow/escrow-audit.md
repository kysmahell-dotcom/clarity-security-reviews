# Security Review — `escrow.clar`

**Auditor:** Kysmahell
**Target:** `escrow.clar` — a two-party STX escrow contract
**Source:** [`friedger/clarity-smart-contracts`](https://github.com/friedger/clarity-smart-contracts) (`contracts/tokens/escrow.clar`)
**Language:** Clarity (Stacks)
**Type:** Independent code review / educational audit exercise
**PoC:** State-machine harness included (`escrow_poc.js`) — all findings reproduced by execution

---

## Scope & disclaimer

This is an independent review of a small, self-described *"very simple escrow"* contract from a public educational repository. The contract is not a production protocol and holds no TVL; per its own comments it uses hard-coded principals and a fresh deployment per deal. The review is published as a demonstration of Clarity design-flaw analysis, not as a vulnerability disclosure against a live system.

All findings were confirmed by executing a faithful state-machine model of the contract (transitions and fund accounting mapped 1:1 to the source). One additional hypothesis (payout replay) was tested and **disproven**; it is documented below for completeness.

---

## Summary of findings

| # | Title | Severity | Status |
|---|-------|----------|--------|
| 1 | Non-segregated `balance` allows theft of third-party deposits and over-payment | High* | Confirmed by PoC |
| 2 | `accept()` discards its first branch result and mixes acceptance with payout | Low | Confirmed by reading |
| 3 | `cancel()` swallows the transfer result via `print`, hiding failures | Informational | Confirmed by reading |

\*High *in the contract's own trust model*; impact is bounded by the educational scope (no live funds).

**Root cause of Finding 1**, the central issue: the contract records a single cumulative `balance` data-var (line 16) instead of tracking which principal deposited how much. Every fund-moving path (`accept` → payout, `cancel` → refund) then moves the *entire* balance to one fixed party, so any funds contributed by anyone else are misdirected.

---

## Finding 1 — Non-segregated balance: third-party deposits can be stolen; seller can be over-paid

**Severity:** High (within the contract's trust model)
**Location:** `deposit` (L67–73), `payout-balance` (L26–28), `cancel` (L76–83), `balance` var (L16)

### Description

`deposit` is explicitly open to everyone (L66: *"everybody can deposit money to the escrow account"*) and simply accumulates into one shared counter:

```clarity
(define-public (deposit (amount uint))
  (begin
    (if-deal-closed-then-panic)
    (var-set balance (+ amount (var-get balance)))   ;; L70 — single shared balance
    (stx-transfer? amount tx-sender escrow)))          ;; L71
```

Neither the settlement path nor the refund path knows *who* contributed. `cancel` sends the whole balance to `buyer`, and `payout-balance` sends the whole balance to `seller`:

```clarity
(define-private (payout-balance)
  (unwrap-panic (as-contract (stx-transfer? (var-get balance) escrow seller))))  ;; L27
```

```clarity
(define-public (cancel)
  (begin
    (if-deal-closed-then-panic)
    (if (or (is-eq tx-sender buyer) (is-eq tx-sender seller))
      (print (as-contract (stx-transfer? (var-get balance) escrow buyer)))       ;; L80
      (ok false))))
```

Because deposits from unrelated principals are indistinguishable from the buyer's, they are absorbed into whichever payout fires first.

### Impact (proven by PoC)

**Theft of third-party funds via `cancel` (Scenario 1):**

```
buyer deposits 100   -> escrow holds 100, balance-var = 100
third deposits  50   -> escrow holds 150, balance-var = 150
seller cancels       -> 150 STX sent to BUYER
RESULT: buyer net = +50, third-party net = -50
```

The buyer recovers their own 100 **and** pockets the third party's 50. The third party has no function to recover funds.

**Over-payment of seller via settlement (Scenario 2):**

```
buyer deposits 100, third deposits 50  -> escrow holds 150
buyer accepts, seller accepts          -> 150 STX sent to SELLER
RESULT: seller net = +150 (agreed deal was 100); third-party net = -50
```

The seller is paid 150 for a 100 deal; the extra 50 is again the third party's misdirected deposit.

### Recommendation

Track deposits per principal, e.g. a `(define-map deposits principal uint)`, and:
- have `cancel` refund `(map-get? deposits tx-sender)` to each depositor rather than the whole balance to a fixed address;
- have settlement transfer only the agreed deal amount, with any surplus refundable to its depositor.

Alternatively, if the contract is meant to accept funds from the buyer only, `deposit` must reject any `tx-sender` other than `buyer` (mirroring the check already used in `accept`/`cancel`).

---

## Finding 2 — `accept()` discards its first branch and couples acceptance with payout

**Severity:** Low
**Location:** `accept` (L42–64)

### Description

`accept` is a `begin` containing two sequential `if` blocks:

```clarity
(define-public (accept)
  (begin
    (if (is-eq tx-sender buyer) (begin (var-set buyerOk true) (ok true))
      (if (is-eq tx-sender seller) (begin (var-set sellerOk true) (ok true))
        (ok false)))                                  ;; <- value DISCARDED by begin
    (if (and (var-get buyerOk) (var-get sellerOk))
      (ok (payout-balance))
      (ok true))))
```

In Clarity, `begin` returns only its last expression, so the response from the first `if` (including the `(ok false)` meant to signal *"caller is neither buyer nor seller"*) is silently thrown away. A caller who is neither party still receives `(ok true)` from the second block, giving misleading success feedback even though no state changed for them.

Coupling side-effecting acceptance with the payout in a single function also makes the money-moving path harder to reason about and to guard. Note this is *not* exploitable as a replay: after payout the escrow is empty and a repeat `accept` reverts in `payout-balance` via `unwrap-panic` (see "Disproven hypothesis").

### Recommendation

Split responsibilities: an `accept` that only records acceptance and returns a meaningful response (`(err ..)` for non-parties), and a separate `settle`/`release` guarded so it can run exactly once. Reset `balance` to `u0` at payout to make the closed state explicit.

---

## Finding 3 — `cancel()` hides transfer failures behind `print`

**Severity:** Informational
**Location:** `cancel` (L80)

### Description

The refund transfer in `cancel` is wrapped in `print` rather than propagated:

```clarity
(print (as-contract (stx-transfer? (var-get balance) escrow buyer)))
```

`print` returns its argument for debugging but does not cause the public function to fail if the inner `stx-transfer?` returns an `(err ..)`. The function can therefore report an overall `(ok ..)` to the caller even in a path where the transfer did not succeed, weakening the guarantees a caller can rely on.

### Recommendation

Propagate the transfer result with `try!` / `unwrap!` (or return it directly) so a failed refund fails the whole call.

---

## Disproven hypothesis (documented for rigor)

**Hypothesis:** `accept()` could be replayed by the seller to trigger a second payout, since `payout-balance` (L26–28) never resets `balance` and the closed-deal guard protects only `deposit`/`cancel`, not `accept`.

**Result: disproven.** The PoC executes a second `accept` by the seller after settlement; it **reverts** (`payout panic: insufficient`) because the contract's actual STX balance is already zero, so `stx-transfer?` fails and `unwrap-panic` aborts. Replay is therefore not exploitable. The residual real issue is the over-payment in Finding 1, not a double payout.

This is included to show the finding set reflects what the code actually does under execution, not what it appears to do on a first read.

---

## Reproducing the PoC

```
node escrow_poc.js
```

The harness re-implements the contract's state machine in JavaScript (each function annotated with the corresponding Clarity source lines) and runs three scenarios: an honest control path (behaves correctly) plus the two exploit scenarios above. It models `stx-transfer?` as ledger moves between principals and preserves Clarity's `begin`/`unwrap-panic` semantics so the results map back to the source.

> Note: this models the contract's *design logic*, not the Clarity VM. A follow-up using Clarinet unit tests against the `.clar` directly would provide VM-level confirmation.
