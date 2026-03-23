import { Connection, PublicKey } from "@solana/web3.js";
import {
  STAKING_POOL_DISCRIMINATOR,
  USER_STAKE_DISCRIMINATOR,
  POOL_METADATA_DISCRIMINATOR,
  PROGRAM_ID,
} from "./constants.js";
import { StakingPool, UserStake, PoolMetadata } from "./types.js";
import {
  findPoolAddress,
  findUserStakeAddress,
  findPoolMetadataAddress,
} from "./pda.js";

// --- Low-level buffer readers ---

function readPublicKey(buf: Buffer, offset: number): PublicKey {
  return new PublicKey(buf.subarray(offset, offset + 32));
}

function readU8(buf: Buffer, offset: number): number {
  return buf[offset];
}

function readU64(buf: Buffer, offset: number): bigint {
  return buf.readBigUInt64LE(offset);
}

function readI64(buf: Buffer, offset: number): bigint {
  return buf.readBigInt64LE(offset);
}

function readU128(buf: Buffer, offset: number): bigint {
  const lo = buf.readBigUInt64LE(offset);
  const hi = buf.readBigUInt64LE(offset + 8);
  return lo + (hi << 64n);
}

// --- Deserialization ---

/** Deserialize a StakingPool from raw account data (289 bytes) */
export function deserializeStakingPool(data: Buffer): StakingPool {
  const disc = data.subarray(0, 8);
  if (!disc.equals(STAKING_POOL_DISCRIMINATOR)) {
    throw new Error("Invalid StakingPool discriminator");
  }

  let offset = 8;

  const mint = readPublicKey(data, offset);
  offset += 32;
  const tokenVault = readPublicKey(data, offset);
  offset += 32;
  const rewardVault = readPublicKey(data, offset);
  offset += 32;
  const authority = readPublicKey(data, offset);
  offset += 32;
  const totalStaked = readU128(data, offset);
  offset += 16;
  const sumStakeExp = new Uint8Array(data.subarray(offset, offset + 32));
  offset += 32;
  const tauSeconds = readU64(data, offset);
  offset += 8;
  const baseTime = readI64(data, offset);
  offset += 8;
  const accRewardPerWeightedShare = readU128(data, offset);
  offset += 16;
  const lastUpdateTime = readI64(data, offset);
  offset += 8;
  const bump = readU8(data, offset);
  offset += 1;
  const lastSyncedLamports = readU64(data, offset);
  offset += 8;
  const minStakeAmount = readU64(data, offset);
  offset += 8;
  const lockDurationSeconds = readU64(data, offset);
  offset += 8;
  const unstakeCooldownSeconds = readU64(data, offset);
  offset += 8;
  const initialBaseTime = readI64(data, offset);
  offset += 8;
  const totalRewardDebt = readU128(data, offset);
  offset += 16;
  const totalResidualUnpaid = readU64(data, offset);

  return {
    mint,
    tokenVault,
    rewardVault,
    authority,
    totalStaked,
    sumStakeExp,
    tauSeconds,
    baseTime,
    accRewardPerWeightedShare,
    lastUpdateTime,
    bump,
    lastSyncedLamports,
    minStakeAmount,
    lockDurationSeconds,
    unstakeCooldownSeconds,
    initialBaseTime,
    totalRewardDebt,
    totalResidualUnpaid,
  };
}

/** Deserialize a UserStake from raw account data (177 bytes, legacy 153/161 supported) */
export function deserializeUserStake(data: Buffer): UserStake {
  const disc = data.subarray(0, 8);
  if (!disc.equals(USER_STAKE_DISCRIMINATOR)) {
    throw new Error("Invalid UserStake discriminator");
  }

  let offset = 8;

  const owner = readPublicKey(data, offset);
  offset += 32;
  const pool = readPublicKey(data, offset);
  offset += 32;
  const amount = readU64(data, offset);
  offset += 8;
  const stakeTime = readI64(data, offset);
  offset += 8;
  const expStartFactor = readU128(data, offset);
  offset += 16;
  const rewardDebt = readU128(data, offset);
  offset += 16;
  const bump = readU8(data, offset);
  offset += 1;

  // Fields added after the original 121-byte layout (offset 129)
  // Legacy accounts may be shorter — default missing fields to 0
  const len = data.length;

  const unstakeRequestAmount = len > offset + 7 ? readU64(data, offset) : 0n;
  offset += 8;
  const unstakeRequestTime = len > offset + 7 ? readI64(data, offset) : 0n;
  offset += 8;
  const lastStakeTime = len > offset + 7 ? readI64(data, offset) : 0n;
  offset += 8;
  const baseTimeSnapshot = len > offset + 7 ? readI64(data, offset) : 0n;
  offset += 8;
  const totalRewardsClaimed = len > offset + 7 ? readU64(data, offset) : 0n;
  offset += 8;
  const claimedRewardsWad = len > offset + 15 ? readU128(data, offset) : 0n;

  return {
    owner,
    pool,
    amount,
    stakeTime,
    expStartFactor,
    rewardDebt,
    bump,
    unstakeRequestAmount,
    unstakeRequestTime,
    lastStakeTime,
    baseTimeSnapshot,
    totalRewardsClaimed,
    claimedRewardsWad,
  };
}

/** Deserialize a PoolMetadata from raw account data (508 bytes) */
export function deserializePoolMetadata(data: Buffer): PoolMetadata {
  const disc = data.subarray(0, 8);
  if (!disc.equals(POOL_METADATA_DISCRIMINATOR)) {
    throw new Error("Invalid PoolMetadata discriminator");
  }

  let offset = 8;

  const pool = readPublicKey(data, offset);
  offset += 32;

  const nameLen = readU8(data, offset);
  offset += 1;
  const name = data.subarray(offset, offset + nameLen).toString("utf-8");
  offset += 64; // fixed 64-byte field

  const numTags = readU8(data, offset);
  offset += 1;

  const tagLengths: number[] = [];
  for (let i = 0; i < 8; i++) {
    tagLengths.push(readU8(data, offset + i));
  }
  offset += 8;

  const tags: string[] = [];
  for (let i = 0; i < numTags; i++) {
    const tagData = data.subarray(offset + i * 32, offset + i * 32 + tagLengths[i]);
    tags.push(tagData.toString("utf-8"));
  }
  offset += 8 * 32; // 8 slots of 32 bytes

  const urlLen = readU8(data, offset);
  offset += 1;
  const url = data.subarray(offset, offset + urlLen).toString("utf-8");
  offset += 128; // fixed 128-byte field

  const memberCount = readU64(data, offset);
  offset += 8;
  const bump = readU8(data, offset);

  return { pool, name, tags, url, memberCount, bump };
}

// --- Fetch helpers ---

/** Fetch and deserialize a StakingPool by its mint address */
export async function fetchStakingPool(
  connection: Connection,
  mint: PublicKey,
  programId: PublicKey = PROGRAM_ID
): Promise<StakingPool | null> {
  const [poolAddress] = findPoolAddress(mint, programId);
  const info = await connection.getAccountInfo(poolAddress);
  if (!info) return null;
  return deserializeStakingPool(info.data as Buffer);
}

/** Fetch and deserialize a StakingPool by its pool PDA address */
export async function fetchStakingPoolByAddress(
  connection: Connection,
  pool: PublicKey
): Promise<StakingPool | null> {
  const info = await connection.getAccountInfo(pool);
  if (!info) return null;
  return deserializeStakingPool(info.data as Buffer);
}

/** Fetch and deserialize a UserStake */
export async function fetchUserStake(
  connection: Connection,
  pool: PublicKey,
  owner: PublicKey,
  programId: PublicKey = PROGRAM_ID
): Promise<UserStake | null> {
  const [stakeAddress] = findUserStakeAddress(pool, owner, programId);
  const info = await connection.getAccountInfo(stakeAddress);
  if (!info) return null;
  return deserializeUserStake(info.data as Buffer);
}

/** Fetch and deserialize a UserStake by its PDA address */
export async function fetchUserStakeByAddress(
  connection: Connection,
  stakeAddress: PublicKey
): Promise<UserStake | null> {
  const info = await connection.getAccountInfo(stakeAddress);
  if (!info) return null;
  return deserializeUserStake(info.data as Buffer);
}

/** Fetch and deserialize PoolMetadata */
export async function fetchPoolMetadata(
  connection: Connection,
  pool: PublicKey,
  programId: PublicKey = PROGRAM_ID
): Promise<PoolMetadata | null> {
  const [metaAddress] = findPoolMetadataAddress(pool, programId);
  const info = await connection.getAccountInfo(metaAddress);
  if (!info) return null;
  return deserializePoolMetadata(info.data as Buffer);
}

/** Fetch all StakingPool accounts owned by the program */
export async function fetchAllStakingPools(
  connection: Connection,
  programId: PublicKey = PROGRAM_ID
): Promise<{ address: PublicKey; account: StakingPool }[]> {
  const accounts = await connection.getProgramAccounts(programId, {
    filters: [
      { dataSize: 289 },
      {
        memcmp: {
          offset: 0,
          bytes: Buffer.from(STAKING_POOL_DISCRIMINATOR).toString("base64"),
          encoding: "base64",
        },
      },
    ],
  });
  return accounts.map(({ pubkey, account }) => ({
    address: pubkey,
    account: deserializeStakingPool(account.data as Buffer),
  }));
}

/** Fetch all UserStake accounts for a given pool */
export async function fetchUserStakesByPool(
  connection: Connection,
  pool: PublicKey,
  programId: PublicKey = PROGRAM_ID
): Promise<{ address: PublicKey; account: UserStake }[]> {
  const accounts = await connection.getProgramAccounts(programId, {
    filters: [
      {
        memcmp: {
          offset: 0,
          bytes: Buffer.from(USER_STAKE_DISCRIMINATOR).toString("base64"),
          encoding: "base64",
        },
      },
      {
        memcmp: {
          offset: 8 + 32, // skip discriminator + owner
          bytes: pool.toBase58(),
        },
      },
    ],
  });
  return accounts.map(({ pubkey, account }) => ({
    address: pubkey,
    account: deserializeUserStake(account.data as Buffer),
  }));
}

/** Fetch all UserStake accounts for a given owner across all pools */
export async function fetchUserStakesByOwner(
  connection: Connection,
  owner: PublicKey,
  programId: PublicKey = PROGRAM_ID
): Promise<{ address: PublicKey; account: UserStake }[]> {
  const accounts = await connection.getProgramAccounts(programId, {
    filters: [
      {
        memcmp: {
          offset: 0,
          bytes: Buffer.from(USER_STAKE_DISCRIMINATOR).toString("base64"),
          encoding: "base64",
        },
      },
      {
        memcmp: {
          offset: 8, // skip discriminator, owner is first field
          bytes: owner.toBase58(),
        },
      },
    ],
  });
  return accounts.map(({ pubkey, account }) => ({
    address: pubkey,
    account: deserializeUserStake(account.data as Buffer),
  }));
}
