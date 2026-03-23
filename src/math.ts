import { WAD } from "./constants.js";

const WAD_SQ = WAD * WAD;

// ln(2) scaled by WAD
const LN2_WAD = 693_147_180_559_945_309n;
// 1/ln(2) scaled by WAD
const INV_LN2_WAD = 1_442_695_040_888_963_407n;
// e^(-x) returns 0 for x >= this threshold (42 * WAD)
const EXP_NEG_ZERO_THRESHOLD = 42_000_000_000_000_000_000n;

/** Multiply two WAD-scaled values, returning WAD-scaled result */
export function wadMul(a: bigint, b: bigint): bigint {
  return (a * b) / WAD;
}

/** Divide two WAD-scaled values, returning WAD-scaled result */
export function wadDiv(a: bigint, b: bigint): bigint {
  if (b === 0n) throw new Error("Division by zero");
  return (a * WAD) / b;
}

// Precomputed 1/n! values scaled by WAD
const INV_FACTORIAL = [
  WAD,                            // 1/0! = 1
  WAD,                            // 1/1! = 1
  500_000_000_000_000_000n,       // 1/2!
  166_666_666_666_666_667n,       // 1/3!
  41_666_666_666_666_667n,        // 1/4!
  8_333_333_333_333_333n,         // 1/5!
  1_388_888_888_888_889n,         // 1/6!
];

/** Taylor series for e^x where x < ln(2), WAD-scaled */
function expTaylor(x: bigint): bigint {
  let result = WAD;
  let xPow = x;
  for (let i = 1; i <= 6; i++) {
    result += wadMul(xPow, INV_FACTORIAL[i]);
    if (i < 6) xPow = wadMul(xPow, x);
  }
  return result;
}

/** Calculate e^x where x is WAD-scaled. Returns WAD-scaled result. */
export function expWad(x: bigint): bigint {
  if (x === 0n) return WAD;
  if (x > 42_000_000_000_000_000_000n) throw new Error("exp overflow");

  // Range reduction: e^x = 2^(x/ln2) = 2^n * 2^f
  const xDivLn2 = wadMul(x, INV_LN2_WAD);
  const intPart = xDivLn2 / WAD;
  const fracPart = xDivLn2 % WAD;

  // 2^frac via Taylor(frac * ln2)
  const fLn2 = wadMul(fracPart, LN2_WAD);
  const twoPowFrac = expTaylor(fLn2);

  if (intPart > 127n) throw new Error("exp overflow");

  const twoPowInt = 1n << intPart;
  return wadMul(twoPowInt * WAD, twoPowFrac);
}

/** Calculate e^(-x) where x is WAD-scaled. Returns WAD-scaled result. */
export function expNegWad(x: bigint): bigint {
  if (x === 0n) return WAD;
  if (x >= EXP_NEG_ZERO_THRESHOLD) return 0n;
  return wadDiv(WAD, expWad(x));
}

/** Calculate e^(-t/tau) where t is seconds, tau is seconds. Returns WAD-scaled. */
export function expNegTimeRatio(t: bigint, tau: bigint): bigint {
  if (t <= 0n) return WAD;
  if (tau === 0n) throw new Error("Invalid tau");
  const ratio = (t * WAD) / tau;
  return expNegWad(ratio);
}

/**
 * Calculate a user's weighted stake.
 *
 * weight = amount * (WAD - exp(-(currentTime - baseTime)/tau) * expStartFactor / WAD)
 *
 * Returns a WAD-scaled value.
 */
export function calculateUserWeightedStake(
  amount: bigint,
  expStartFactor: bigint,
  currentTime: bigint,
  baseTime: bigint,
  tauSeconds: bigint
): bigint {
  if (amount === 0n) return 0n;

  const age = currentTime - baseTime;
  const expNegCurrent = expNegTimeRatio(age > 0n ? age : 0n, tauSeconds);
  const decay = wadMul(expNegCurrent, expStartFactor);
  const weightFactor = WAD - decay;
  if (weightFactor <= 0n) return 0n;

  return wadMul(amount * WAD, weightFactor);
}

/**
 * Adjust a user's expStartFactor to account for pool rebases.
 *
 * Returns the adjusted expStartFactor.
 */
export function syncExpStartFactor(
  expStartFactor: bigint,
  baseTimeSnapshot: bigint,
  poolBaseTime: bigint,
  poolInitialBaseTime: bigint,
  tauSeconds: bigint
): bigint {
  if (baseTimeSnapshot === poolBaseTime) return expStartFactor;

  if (baseTimeSnapshot === 0n) {
    // Legacy account
    if (poolInitialBaseTime === 0n) {
      return expStartFactor;
    }
    const delta = poolBaseTime - poolInitialBaseTime;
    if (delta > 0n) {
      return wadMul(expStartFactor, expNegTimeRatio(delta, tauSeconds));
    }
    return expStartFactor;
  }

  // Standard case
  const delta = poolBaseTime - baseTimeSnapshot;
  if (delta > 0n) {
    return wadMul(expStartFactor, expNegTimeRatio(delta, tauSeconds));
  }
  return expStartFactor;
}

/**
 * Compute pending claimable rewards in lamports for a staker.
 *
 * For active stakers (amount > 0):
 *   snapshot = wadDiv(rewardDebt, amount * WAD)
 *   deltaRps = accRewardPerWeightedShare - snapshot
 *   fullEntitlement = wadMul(userWeighted, deltaRps)
 *   pendingWad = fullEntitlement - claimedRewardsWad
 *   pendingLamports = pendingWad / WAD
 *
 * For residual stakers (amount == 0, post-full-unstake):
 *   pendingLamports = rewardDebt / WAD
 */
export function calculatePendingRewards(params: {
  amount: bigint;
  expStartFactor: bigint;
  rewardDebt: bigint;
  claimedRewardsWad: bigint;
  baseTimeSnapshot: bigint;
  poolAccRewardPerWeightedShare: bigint;
  poolBaseTime: bigint;
  poolInitialBaseTime: bigint;
  poolTauSeconds: bigint;
  currentTime: bigint;
}): bigint {
  const {
    amount,
    rewardDebt,
    claimedRewardsWad,
    poolAccRewardPerWeightedShare,
    poolBaseTime,
    poolInitialBaseTime,
    poolTauSeconds,
    currentTime,
  } = params;

  if (amount === 0n) {
    // Residual claim: rewardDebt holds unclaimed WAD-scaled rewards
    return rewardDebt / WAD;
  }

  // Sync expStartFactor for rebase
  const syncedExpStartFactor = syncExpStartFactor(
    params.expStartFactor,
    params.baseTimeSnapshot,
    poolBaseTime,
    poolInitialBaseTime,
    poolTauSeconds
  );

  // Calculate user's weighted stake at current time
  const userWeighted = calculateUserWeightedStake(
    amount,
    syncedExpStartFactor,
    currentTime,
    poolBaseTime,
    poolTauSeconds
  );
  if (userWeighted === 0n) return 0n;

  // snapshot = wadDiv(rewardDebt, amount * WAD)
  const amountWad = amount * WAD;
  const snapshot = wadDiv(rewardDebt, amountWad);

  // deltaRps = accRps - snapshot
  const deltaRps =
    poolAccRewardPerWeightedShare > snapshot
      ? poolAccRewardPerWeightedShare - snapshot
      : 0n;

  // fullEntitlement = wadMul(userWeighted, deltaRps)
  const fullEntitlement = wadMul(userWeighted, deltaRps);

  // Subtract already claimed
  const pendingWad =
    fullEntitlement > claimedRewardsWad
      ? fullEntitlement - claimedRewardsWad
      : 0n;

  return pendingWad / WAD;
}
