import { PublicKey } from "@solana/web3.js";

/** Decoded StakingPool account */
export interface StakingPool {
  /** Token mint address */
  mint: PublicKey;
  /** PDA holding staked tokens */
  tokenVault: PublicKey;
  /** DEPRECATED: no longer used */
  rewardVault: PublicKey;
  /** Admin authority */
  authority: PublicKey;
  /** Total tokens staked (raw amount) */
  totalStaked: bigint;
  /** Sum of stake_i * e^(start_time_i / tau) as U256 little-endian (WAD-scaled) */
  sumStakeExp: Uint8Array;
  /** Time constant in seconds */
  tauSeconds: bigint;
  /** Base time for rebasing (Unix timestamp) */
  baseTime: bigint;
  /** Accumulated reward per weighted share (WAD-scaled) */
  accRewardPerWeightedShare: bigint;
  /** Last time rewards were updated */
  lastUpdateTime: bigint;
  /** PDA bump seed */
  bump: number;
  /** Last known lamport balance */
  lastSyncedLamports: bigint;
  /** Minimum stake amount (0 = no minimum) */
  minStakeAmount: bigint;
  /** Lock duration in seconds (0 = no lock) */
  lockDurationSeconds: bigint;
  /** Unstake cooldown in seconds (0 = direct unstake) */
  unstakeCooldownSeconds: bigint;
  /** Original base_time before first rebase */
  initialBaseTime: bigint;
  /** Sum of all active users' reward_debt (WAD-scaled) */
  totalRewardDebt: bigint;
  /** Total lamports owed to residual claimants */
  totalResidualUnpaid: bigint;
}

/** Decoded UserStake account */
export interface UserStake {
  /** Owner of this stake */
  owner: PublicKey;
  /** Pool this stake belongs to */
  pool: PublicKey;
  /** Amount of tokens staked */
  amount: bigint;
  /** Unix timestamp when stake began */
  stakeTime: bigint;
  /** e^((stake_time - base_time) / tau) at time of staking (WAD-scaled) */
  expStartFactor: bigint;
  /** Reward debt snapshot (WAD-scaled) */
  rewardDebt: bigint;
  /** PDA bump seed */
  bump: number;
  /** Pending unstake request amount (0 = no pending) */
  unstakeRequestAmount: bigint;
  /** Timestamp when unstake was requested */
  unstakeRequestTime: bigint;
  /** Timestamp of most recent stake deposit */
  lastStakeTime: bigint;
  /** Pool base_time when exp_start_factor was last calibrated */
  baseTimeSnapshot: bigint;
  /** Cumulative SOL rewards claimed (lamports) */
  totalRewardsClaimed: bigint;
  /** Cumulative WAD-scaled rewards already paid */
  claimedRewardsWad: bigint;
}

/** Decoded PoolMetadata account */
export interface PoolMetadata {
  /** Back-reference to staking pool */
  pool: PublicKey;
  /** Pool name (UTF-8) */
  name: string;
  /** Tags (UTF-8 strings) */
  tags: string[];
  /** URL */
  url: string;
  /** Active staker count */
  memberCount: bigint;
  /** PDA bump seed */
  bump: number;
}
