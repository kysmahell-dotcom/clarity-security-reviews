/*
 * PoC harness for escrow.clar (friedger/clarity-smart-contracts)
 *
 * This is a faithful JS re-implementation of the contract's state machine.
 * Each function maps 1:1 to the Clarity source so the logic can be verified
 * line-by-line against escrow.clar. It is NOT the Clarity VM — it proves the
 * *design* logic (state transitions + fund accounting), which is where the
 * bugs live. STX transfers are modeled as balance moves between principals.
 *
 * Clarity semantics modeled:
 *  - (begin a b c) evaluates all, returns last  -> the first `if` result in
 *    `accept` is DISCARDED (matches source lines 43-63).
 *  - stx-transfer? moves funds and returns (ok true)/(err ..); (as-contract ..)
 *    makes the escrow the sender.
 *  - data-vars persist across calls; payout-balance does NOT reset `balance`.
 */

// ---- principals & their real STX ledgers (chain-truth, independent of `balance` var) ----
const BUYER = "buyer";
const SELLER = "seller";
const THIRD = "third_party";
const ESCROW = "escrow_contract";

function newChain() {
  return {
    ledger: { [BUYER]: 1000, [SELLER]: 1000, [THIRD]: 1000, [ESCROW]: 0 },
    // contract data-vars (lines 14-16)
    buyerOk: false,
    sellerOk: false,
    balance: 0,
  };
}

// stx-transfer? amount from -> to
function stxTransfer(s, amount, from, to) {
  if (s.ledger[from] < amount) return { err: "insufficient" };
  s.ledger[from] -= amount;
  s.ledger[to] += amount;
  return { ok: true };
}

// (define-private (payout-balance)) lines 26-28
// NOTE: transfers `balance` var amount, escrow -> seller. Does NOT zero balance.
function payoutBalance(s) {
  const r = stxTransfer(s, s.balance, ESCROW, SELLER);
  if (r.err) throw new Error("payout panic: " + r.err); // unwrap-panic
  return { ok: true };
}

// (define-private (if-deal-closed-then-panic)) lines 31-38
function ifDealClosedThenPanic(s) {
  if (s.buyerOk && s.sellerOk) throw new Error("panic: deal closed (err 1)");
  return { ok: true };
}

// (define-public (deposit (amount uint))) lines 67-73
function deposit(s, txSender, amount) {
  ifDealClosedThenPanic(s);
  s.balance = amount + s.balance;                 // line 70
  return stxTransfer(s, amount, txSender, ESCROW); // line 71
}

// (define-public (accept)) lines 42-64
function accept(s, txSender) {
  // ----- first `if` block (lines 45-57): its return value is DISCARDED by begin -----
  if (txSender === BUYER) {
    s.buyerOk = true;
  } else if (txSender === SELLER) {
    s.sellerOk = true;
  } else {
    /* (ok false) - discarded */
  }
  // ----- second `if` block (lines 59-62): the value actually returned -----
  if (s.buyerOk && s.sellerOk) {
    return { ok: payoutBalance(s) }; // line 60 - pays seller EVERY time this runs
  }
  return { ok: true };
}

// (define-public (cancel)) lines 76-83
function cancel(s, txSender) {
  ifDealClosedThenPanic(s);
  if (txSender === BUYER || txSender === SELLER) {
    // refunds ENTIRE balance var to buyer, regardless of who deposited (line 80)
    return stxTransfer(s, s.balance, ESCROW, BUYER);
  }
  return { ok: false };
}

// ---------------------------------------------------------------------------
function fmt(s) {
  return `ledger=${JSON.stringify(s.ledger)} | balance-var=${s.balance} buyerOk=${s.buyerOk} sellerOk=${s.sellerOk}`;
}
function line() { console.log("-".repeat(90)); }

// ===========================================================================
// SCENARIO 0 (control): honest happy path — must behave correctly
// ===========================================================================
console.log("\n### SCENARIO 0 — Honest happy path (control, expected: correct) ###");
{
  const s = newChain();
  deposit(s, BUYER, 100);
  console.log("buyer deposits 100 :", fmt(s));
  accept(s, BUYER);
  console.log("buyer accepts      :", fmt(s));
  accept(s, SELLER);
  console.log("seller accepts     :", fmt(s));
  const sellerNet = s.ledger[SELLER] - 1000;
  const escrowLeft = s.ledger[ESCROW];
  console.log(`RESULT: seller net = ${sellerNet}, escrow holds = ${escrowLeft}`);
  console.log(sellerNet === 100 && escrowLeft === 0
    ? "OK  -> seller got exactly 100, escrow drained. Correct."
    : "??  -> unexpected");
}

// ===========================================================================
// SCENARIO 1 (BUG #1): third-party deposit is stolen by the refund path
// ===========================================================================
line();
console.log("\n### SCENARIO 1 — BUG #1: third-party funds mis-refunded on cancel ###");
{
  const s = newChain();
  deposit(s, BUYER, 100);
  console.log("buyer deposits 100 :", fmt(s));
  deposit(s, THIRD, 50); // contract allows ANYONE to deposit (line 66)
  console.log("third deposits 50  :", fmt(s));

  // seller cancels the deal
  cancel(s, SELLER);
  console.log("seller cancels     :", fmt(s));

  const buyerNet = s.ledger[BUYER] - 1000;
  const thirdNet = s.ledger[THIRD] - 1000;
  console.log(`RESULT: buyer net = ${buyerNet}, third-party net = ${thirdNet}`);
  console.log(buyerNet === 50 && thirdNet === -50
    ? "BUG CONFIRMED -> buyer recovered his own 100 AND pocketed the third party's 50.\n" +
      "   Third party is down 50 STX with no recourse.\n" +
      "   Root cause: contract tracks a single `balance` var, not per-depositor amounts.\n" +
      "   cancel() refunds the ENTIRE balance to `buyer` (line 80)."
    : "-> not reproduced");
}

// ===========================================================================
// SCENARIO 2 (same root cause): non-segregated balance -> seller over-paid.
// (Note: an earlier hypothesis that accept() could be *replayed* for a second
//  payout was tested and DISPROVEN — the second call reverts via unwrap-panic
//  because the escrow is already empty. The real, proven issue is over-payment
//  from the shared `balance`, the same root cause as Bug #1.)
// ===========================================================================
line();
console.log("\n### SCENARIO 2 — seller over-paid from shared balance (root cause as Bug #1) ###");
{
  const s = newChain();
  // buyer deposits the agreed 100
  deposit(s, BUYER, 100);
  // a third party adds 50 while the deal is still open (contract allows it)
  deposit(s, THIRD, 50);
  console.log("deposits done      :", fmt(s), "(escrow physically holds 150)");

  accept(s, BUYER);
  console.log("buyer accepts      :", fmt(s));

  accept(s, SELLER); // payout runs here
  console.log("seller accepts     :", fmt(s));

  // Demonstrate the disproven replay: a second accept() by seller must revert.
  let replayReverted = false;
  try {
    accept(s, SELLER);
  } catch (e) {
    replayReverted = true;
    console.log("seller accepts x2  : reverted ->", e.message, "(replay is NOT exploitable)");
  }

  const sellerNet = s.ledger[SELLER] - 1000;
  const thirdNet = s.ledger[THIRD] - 1000;
  console.log(`RESULT: seller net = ${sellerNet} (agreed deal was 100), third-party net = ${thirdNet}`);
  console.log(sellerNet === 150 && thirdNet === -50 && replayReverted
    ? "BUG CONFIRMED -> seller received 150 instead of 100; the extra 50 is the third\n" +
      "   party's stolen deposit. Replay correctly reverts, so the ONLY issue is the\n" +
      "   shared-balance over-payment (same root cause as Bug #1)."
    : "-> unexpected");
}
line();
console.log("\nAll scenarios executed against the modeled state machine of escrow.clar.\n");
