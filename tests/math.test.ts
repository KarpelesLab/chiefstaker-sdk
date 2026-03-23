import { describe, it, expect } from "vitest";
import {
  wadMul,
  wadDiv,
  expWad,
  expNegWad,
  expNegTimeRatio,
  calculateUserWeightedStake,
  syncExpStartFactor,
  calculatePendingRewards,
  WAD,
} from "../src/index.js";

describe("wadMul", () => {
  it("1 * 1 = 1 (WAD-scaled)", () => {
    expect(wadMul(WAD, WAD)).toBe(WAD);
  });

  it("2 * 3 = 6", () => {
    expect(wadMul(2n * WAD, 3n * WAD)).toBe(6n * WAD);
  });

  it("0.5 * 0.5 = 0.25", () => {
    const half = WAD / 2n;
    const quarter = WAD / 4n;
    expect(wadMul(half, half)).toBe(quarter);
  });

  it("anything * 0 = 0", () => {
    expect(wadMul(123n * WAD, 0n)).toBe(0n);
  });
});

describe("wadDiv", () => {
  it("6 / 3 = 2", () => {
    expect(wadDiv(6n * WAD, 3n * WAD)).toBe(2n * WAD);
  });

  it("1 / 2 = 0.5", () => {
    expect(wadDiv(WAD, 2n * WAD)).toBe(WAD / 2n);
  });

  it("throws on division by zero", () => {
    expect(() => wadDiv(WAD, 0n)).toThrow("Division by zero");
  });
});

describe("expWad", () => {
  it("e^0 = 1", () => {
    expect(expWad(0n)).toBe(WAD);
  });

  it("e^1 ≈ 2.718", () => {
    const result = expWad(WAD);
    const expected = 2_718_281_828_459_045_235n;
    const diff = result > expected ? result - expected : expected - result;
    // Allow 0.01% error
    expect(diff).toBeLessThan(expected / 10000n);
  });

  it("e^2 ≈ 7.389", () => {
    const result = expWad(2n * WAD);
    const expected = 7_389_056_098_930_650_227n;
    const diff = result > expected ? result - expected : expected - result;
    expect(diff).toBeLessThan(expected / 1000n);
  });

  it("throws for very large input", () => {
    expect(() => expWad(43n * WAD)).toThrow("exp overflow");
  });
});

describe("expNegWad", () => {
  it("e^(-0) = 1", () => {
    expect(expNegWad(0n)).toBe(WAD);
  });

  it("e^(-1) ≈ 0.3679", () => {
    const result = expNegWad(WAD);
    const expected = 367_879_441_171_442_322n;
    const diff = result > expected ? result - expected : expected - result;
    expect(diff).toBeLessThan(expected / 10000n);
  });

  it("returns 0 for large input", () => {
    expect(expNegWad(42n * WAD)).toBe(0n);
    expect(expNegWad(100n * WAD)).toBe(0n);
  });
});

describe("expNegTimeRatio", () => {
  it("returns WAD for zero age", () => {
    expect(expNegTimeRatio(0n, 86400n)).toBe(WAD);
  });

  it("returns WAD for negative age", () => {
    expect(expNegTimeRatio(-100n, 86400n)).toBe(WAD);
  });

  it("e^(-1) at age=tau", () => {
    const tau = 2592000n; // 30 days
    const result = expNegTimeRatio(tau, tau);
    const expected = 367_879_441_171_442_322n;
    const diff = result > expected ? result - expected : expected - result;
    expect(diff).toBeLessThan(expected / 10000n);
  });

  it("returns 0 for very large age", () => {
    expect(expNegTimeRatio(100n * 2592000n, 2592000n)).toBe(0n);
  });
});

describe("calculateUserWeightedStake", () => {
  const tau = 2592000n; // 30 days
  const baseTime = 1700000000n;

  it("returns 0 for zero amount", () => {
    expect(calculateUserWeightedStake(0n, WAD, baseTime + tau, baseTime, tau)).toBe(0n);
  });

  it("returns 0 for brand new stake (age=0)", () => {
    const esf = WAD; // staked at base_time
    const result = calculateUserWeightedStake(1000n, esf, baseTime, baseTime, tau);
    expect(result).toBe(0n);
  });

  it("~63% weight at age = tau", () => {
    const amount = 1_000_000n;
    const esf = WAD; // staked at base_time
    const currentTime = baseTime + tau;
    const result = calculateUserWeightedStake(amount, esf, currentTime, baseTime, tau);
    const maxWeight = amount * WAD;
    const pct = Number(result * 10000n / maxWeight);
    // Should be ~6321 (63.21%)
    expect(pct).toBeGreaterThan(6200);
    expect(pct).toBeLessThan(6400);
  });

  it("~95% weight at age = 3*tau", () => {
    const amount = 1_000_000n;
    const esf = WAD;
    const currentTime = baseTime + 3n * tau;
    const result = calculateUserWeightedStake(amount, esf, currentTime, baseTime, tau);
    const maxWeight = amount * WAD;
    const pct = Number(result * 10000n / maxWeight);
    expect(pct).toBeGreaterThan(9400);
    expect(pct).toBeLessThan(9600);
  });

  it("100% weight at age >> tau", () => {
    const amount = 1_000_000n;
    const esf = WAD;
    const currentTime = baseTime + 100n * tau;
    const result = calculateUserWeightedStake(amount, esf, currentTime, baseTime, tau);
    const maxWeight = amount * WAD;
    expect(result).toBe(maxWeight);
  });

  it("weight is monotonically increasing", () => {
    const amount = 1_000_000n;
    const esf = WAD;
    let prev = 0n;
    for (let age = 0n; age <= 5n * tau; age += 3600n) {
      const w = calculateUserWeightedStake(amount, esf, baseTime + age, baseTime, tau);
      expect(w).toBeGreaterThanOrEqual(prev);
      prev = w;
    }
  });

  it("weight never exceeds amount * WAD", () => {
    const amount = 1_000_000n;
    const esf = WAD;
    const maxWeight = amount * WAD;
    for (const age of [0n, 1n, 3600n, 86400n, tau, 5n * tau, 100n * tau]) {
      const w = calculateUserWeightedStake(amount, esf, baseTime + age, baseTime, tau);
      expect(w).toBeLessThanOrEqual(maxWeight);
    }
  });
});

describe("syncExpStartFactor", () => {
  const tau = 86400n;

  it("returns unchanged when already synced", () => {
    const esf = 2n * WAD;
    expect(syncExpStartFactor(esf, 100n, 100n, 0n, tau)).toBe(esf);
  });

  it("legacy account with no rebase returns unchanged", () => {
    const esf = 2n * WAD;
    expect(syncExpStartFactor(esf, 0n, 100n, 0n, tau)).toBe(esf);
  });

  it("adjusts for rebase delta", () => {
    const esf = 2n * WAD;
    const result = syncExpStartFactor(esf, 100n, 200n, 0n, tau);
    // Should be esf * exp(-(200-100)/tau) < esf
    expect(result).toBeLessThan(esf);
    expect(result).toBeGreaterThan(0n);
  });
});

describe("calculatePendingRewards", () => {
  const tau = 86400n;
  const baseTime = 1700000000n;

  it("returns 0 for zero amount with zero reward_debt", () => {
    const result = calculatePendingRewards({
      amount: 0n,
      expStartFactor: WAD,
      rewardDebt: 0n,
      claimedRewardsWad: 0n,
      baseTimeSnapshot: baseTime,
      poolAccRewardPerWeightedShare: WAD,
      poolBaseTime: baseTime,
      poolInitialBaseTime: 0n,
      poolTauSeconds: tau,
      currentTime: baseTime + tau,
    });
    expect(result).toBe(0n);
  });

  it("returns residual rewards for zero-amount staker", () => {
    const residual = 5_000_000n * WAD; // 5M lamports in WAD
    const result = calculatePendingRewards({
      amount: 0n,
      expStartFactor: WAD,
      rewardDebt: residual,
      claimedRewardsWad: 0n,
      baseTimeSnapshot: baseTime,
      poolAccRewardPerWeightedShare: 0n,
      poolBaseTime: baseTime,
      poolInitialBaseTime: 0n,
      poolTauSeconds: tau,
      currentTime: baseTime,
    });
    expect(result).toBe(5_000_000n);
  });

  it("returns positive rewards for mature staker with acc_rps > 0", () => {
    // Single staker with fully mature position, pool has accumulated rewards
    const amount = 1_000_000n;
    const accRps = WAD; // 1 WAD of reward per weighted share
    const currentTime = baseTime + 100n * tau; // fully mature

    const result = calculatePendingRewards({
      amount,
      expStartFactor: WAD,
      rewardDebt: 0n, // staked from genesis, snapshot = 0
      claimedRewardsWad: 0n,
      baseTimeSnapshot: baseTime,
      poolAccRewardPerWeightedShare: accRps,
      poolBaseTime: baseTime,
      poolInitialBaseTime: 0n,
      poolTauSeconds: tau,
      currentTime,
    });
    expect(result).toBeGreaterThan(0n);
  });

  it("returns 0 when already fully claimed", () => {
    const amount = 1_000_000n;
    const accRps = WAD;
    const currentTime = baseTime + 100n * tau;

    // Calculate expected full entitlement first
    const userWeighted = calculateUserWeightedStake(amount, WAD, currentTime, baseTime, tau);
    const fullEntitlement = wadMul(userWeighted, accRps);

    const result = calculatePendingRewards({
      amount,
      expStartFactor: WAD,
      rewardDebt: 0n,
      claimedRewardsWad: fullEntitlement, // already claimed everything
      baseTimeSnapshot: baseTime,
      poolAccRewardPerWeightedShare: accRps,
      poolBaseTime: baseTime,
      poolInitialBaseTime: 0n,
      poolTauSeconds: tau,
      currentTime,
    });
    expect(result).toBe(0n);
  });

  it("claiming twice yields same total as claiming once", () => {
    const amount = 1_000n;
    const tau = 86400n;
    const baseTime = 0n;

    // Simulate 2 acc_rps increases
    const steps = [
      { time: 86400n, accRps: 1n * WAD },
      { time: 2n * 86400n, accRps: 2n * WAD },
    ];

    let claimedWad = 0n;
    let totalLamports = 0n;

    for (const step of steps) {
      const userWeighted = calculateUserWeightedStake(amount, WAD, step.time, baseTime, tau);
      const fullEnt = wadMul(userWeighted, step.accRps);
      const pending = fullEnt > claimedWad ? fullEnt - claimedWad : 0n;
      totalLamports += pending / WAD;
      claimedWad += pending;
    }

    // Single claim at final step
    const lastStep = steps[steps.length - 1];
    const singleWeighted = calculateUserWeightedStake(amount, WAD, lastStep.time, baseTime, tau);
    const singleEnt = wadMul(singleWeighted, lastStep.accRps);
    const singleLamports = singleEnt / WAD;

    // Multi-claim may differ by at most N-1 lamports (floor rounding)
    const diff = totalLamports > singleLamports
      ? totalLamports - singleLamports
      : singleLamports - totalLamports;
    expect(diff).toBeLessThanOrEqual(BigInt(steps.length));
  });
});
