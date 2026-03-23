import { describe, it, expect } from "vitest";
import { PublicKey } from "@solana/web3.js";
import {
  deserializeStakingPool,
  deserializeUserStake,
  deserializePoolMetadata,
  STAKING_POOL_DISCRIMINATOR,
  USER_STAKE_DISCRIMINATOR,
  POOL_METADATA_DISCRIMINATOR,
} from "../src/index.js";

describe("deserializeStakingPool", () => {
  function makePoolBuffer(overrides?: Partial<{ totalStaked: bigint; tauSeconds: bigint }>): Buffer {
    const buf = Buffer.alloc(289);
    let offset = 0;

    // discriminator
    STAKING_POOL_DISCRIMINATOR.copy(buf, offset);
    offset += 8;

    // mint (32 bytes) - random
    const mint = PublicKey.unique();
    mint.toBuffer().copy(buf, offset);
    offset += 32;

    // tokenVault (32)
    PublicKey.unique().toBuffer().copy(buf, offset);
    offset += 32;

    // rewardVault (32)
    PublicKey.unique().toBuffer().copy(buf, offset);
    offset += 32;

    // authority (32)
    PublicKey.unique().toBuffer().copy(buf, offset);
    offset += 32;

    // totalStaked (u128)
    const totalStaked = overrides?.totalStaked ?? 1_000_000n;
    buf.writeBigUInt64LE(totalStaked & 0xffffffffffffffffn, offset);
    buf.writeBigUInt64LE(totalStaked >> 64n, offset + 8);
    offset += 16;

    // sumStakeExp (32 bytes)
    offset += 32;

    // tauSeconds (u64)
    buf.writeBigUInt64LE(overrides?.tauSeconds ?? 2592000n, offset);
    offset += 8;

    // baseTime (i64)
    buf.writeBigInt64LE(1700000000n, offset);
    offset += 8;

    // accRewardPerWeightedShare (u128)
    offset += 16;

    // lastUpdateTime (i64)
    buf.writeBigInt64LE(1700001000n, offset);
    offset += 8;

    // bump (u8)
    buf[offset] = 255;
    offset += 1;

    // lastSyncedLamports (u64)
    buf.writeBigUInt64LE(5_000_000_000n, offset);
    offset += 8;

    // minStakeAmount (u64)
    buf.writeBigUInt64LE(100n, offset);
    offset += 8;

    // lockDurationSeconds (u64)
    buf.writeBigUInt64LE(86400n, offset);
    offset += 8;

    // unstakeCooldownSeconds (u64)
    buf.writeBigUInt64LE(259200n, offset);
    offset += 8;

    // initialBaseTime (i64)
    buf.writeBigInt64LE(1699999000n, offset);
    offset += 8;

    // totalRewardDebt (u128)
    offset += 16;

    // totalResidualUnpaid (u64)
    buf.writeBigUInt64LE(1000n, offset);

    return buf;
  }

  it("deserializes a valid pool buffer", () => {
    const buf = makePoolBuffer();
    const pool = deserializeStakingPool(buf);

    expect(pool.totalStaked).toBe(1_000_000n);
    expect(pool.tauSeconds).toBe(2592000n);
    expect(pool.bump).toBe(255);
    expect(pool.lastSyncedLamports).toBe(5_000_000_000n);
    expect(pool.minStakeAmount).toBe(100n);
    expect(pool.lockDurationSeconds).toBe(86400n);
    expect(pool.unstakeCooldownSeconds).toBe(259200n);
    expect(pool.initialBaseTime).toBe(1699999000n);
    expect(pool.totalResidualUnpaid).toBe(1000n);
    expect(pool.baseTime).toBe(1700000000n);
    expect(pool.lastUpdateTime).toBe(1700001000n);
  });

  it("preserves mint and authority as valid PublicKeys", () => {
    const buf = makePoolBuffer();
    const pool = deserializeStakingPool(buf);

    expect(pool.mint).toBeInstanceOf(PublicKey);
    expect(pool.tokenVault).toBeInstanceOf(PublicKey);
    expect(pool.authority).toBeInstanceOf(PublicKey);
  });

  it("handles large u128 totalStaked", () => {
    const large = (123n << 64n) + 456789n;
    const buf = makePoolBuffer({ totalStaked: large });
    const pool = deserializeStakingPool(buf);

    expect(pool.totalStaked).toBe(large);
  });

  it("throws on wrong discriminator", () => {
    const buf = makePoolBuffer();
    buf[0] = 0xff; // corrupt discriminator
    expect(() => deserializeStakingPool(buf)).toThrow("Invalid StakingPool discriminator");
  });
});

describe("deserializeUserStake", () => {
  function makeStakeBuffer(size: number = 177): Buffer {
    const buf = Buffer.alloc(size);
    let offset = 0;

    // discriminator
    USER_STAKE_DISCRIMINATOR.copy(buf, offset);
    offset += 8;

    // owner (32)
    const owner = PublicKey.unique();
    owner.toBuffer().copy(buf, offset);
    offset += 32;

    // pool (32)
    const pool = PublicKey.unique();
    pool.toBuffer().copy(buf, offset);
    offset += 32;

    // amount (u64)
    buf.writeBigUInt64LE(500_000n, offset);
    offset += 8;

    // stakeTime (i64)
    buf.writeBigInt64LE(1700000000n, offset);
    offset += 8;

    // expStartFactor (u128)
    buf.writeBigUInt64LE(1_000_000_000_000_000_000n, offset);
    buf.writeBigUInt64LE(0n, offset + 8);
    offset += 16;

    // rewardDebt (u128)
    buf.writeBigUInt64LE(500_000_000_000_000_000n, offset);
    buf.writeBigUInt64LE(0n, offset + 8);
    offset += 16;

    // bump (u8)
    buf[offset] = 254;
    offset += 1;

    if (size >= 153) {
      // unstakeRequestAmount (u64)
      buf.writeBigUInt64LE(100_000n, offset);
      offset += 8;

      // unstakeRequestTime (i64)
      buf.writeBigInt64LE(1700002000n, offset);
      offset += 8;

      // lastStakeTime (i64)
      buf.writeBigInt64LE(1700001000n, offset);
      offset += 8;
    }

    if (size >= 161) {
      // baseTimeSnapshot (i64)
      buf.writeBigInt64LE(1699999000n, offset);
      offset += 8;
    }

    if (size >= 177) {
      // totalRewardsClaimed (u64)
      buf.writeBigUInt64LE(2_000_000n, offset);
      offset += 8;

      // claimedRewardsWad (u128)
      buf.writeBigUInt64LE(2_000_000_000_000_000_000n, offset);
      buf.writeBigUInt64LE(0n, offset + 8);
      offset += 16;
    }

    return buf;
  }

  it("deserializes a full 177-byte stake", () => {
    const buf = makeStakeBuffer(177);
    const stake = deserializeUserStake(buf);

    expect(stake.amount).toBe(500_000n);
    expect(stake.stakeTime).toBe(1700000000n);
    expect(stake.expStartFactor).toBe(1_000_000_000_000_000_000n);
    expect(stake.rewardDebt).toBe(500_000_000_000_000_000n);
    expect(stake.bump).toBe(254);
    expect(stake.unstakeRequestAmount).toBe(100_000n);
    expect(stake.unstakeRequestTime).toBe(1700002000n);
    expect(stake.lastStakeTime).toBe(1700001000n);
    expect(stake.baseTimeSnapshot).toBe(1699999000n);
    expect(stake.totalRewardsClaimed).toBe(2_000_000n);
    expect(stake.claimedRewardsWad).toBe(2_000_000_000_000_000_000n);
  });

  it("handles legacy 153-byte accounts", () => {
    const buf = makeStakeBuffer(153);
    const stake = deserializeUserStake(buf);

    expect(stake.amount).toBe(500_000n);
    expect(stake.unstakeRequestAmount).toBe(100_000n);
    // Fields beyond 153 bytes default to 0
    expect(stake.baseTimeSnapshot).toBe(0n);
    expect(stake.totalRewardsClaimed).toBe(0n);
    expect(stake.claimedRewardsWad).toBe(0n);
  });

  it("handles legacy 161-byte accounts", () => {
    const buf = makeStakeBuffer(161);
    const stake = deserializeUserStake(buf);

    expect(stake.baseTimeSnapshot).toBe(1699999000n);
    expect(stake.totalRewardsClaimed).toBe(0n);
    expect(stake.claimedRewardsWad).toBe(0n);
  });

  it("owner and pool are valid PublicKeys", () => {
    const buf = makeStakeBuffer();
    const stake = deserializeUserStake(buf);

    expect(stake.owner).toBeInstanceOf(PublicKey);
    expect(stake.pool).toBeInstanceOf(PublicKey);
  });

  it("throws on wrong discriminator", () => {
    const buf = makeStakeBuffer();
    buf[0] = 0x00;
    expect(() => deserializeUserStake(buf)).toThrow("Invalid UserStake discriminator");
  });
});

describe("deserializePoolMetadata", () => {
  function makeMetadataBuffer(): Buffer {
    const buf = Buffer.alloc(508);
    let offset = 0;

    // discriminator
    POOL_METADATA_DISCRIMINATOR.copy(buf, offset);
    offset += 8;

    // pool (32)
    PublicKey.unique().toBuffer().copy(buf, offset);
    offset += 32;

    // nameLen (u8)
    const name = "Test Staking Pool";
    buf[offset] = name.length;
    offset += 1;

    // name (64 bytes, zero-padded)
    buf.write(name, offset, "utf-8");
    offset += 64;

    // numTags (u8)
    buf[offset] = 3;
    offset += 1;

    // tagLengths (8 bytes)
    const tags = ["#stakingpool", "#chiefstaker", "#test"];
    for (let i = 0; i < 8; i++) {
      buf[offset + i] = i < tags.length ? tags[i].length : 0;
    }
    offset += 8;

    // tags (8 * 32 bytes)
    for (let i = 0; i < tags.length; i++) {
      buf.write(tags[i], offset + i * 32, "utf-8");
    }
    offset += 8 * 32;

    // urlLen (u8)
    const url = "https://www.tibane.net/staking/test";
    buf[offset] = url.length;
    offset += 1;

    // url (128 bytes)
    buf.write(url, offset, "utf-8");
    offset += 128;

    // memberCount (u64)
    buf.writeBigUInt64LE(42n, offset);
    offset += 8;

    // bump (u8)
    buf[offset] = 253;

    return buf;
  }

  it("deserializes name, tags, url, and memberCount", () => {
    const buf = makeMetadataBuffer();
    const meta = deserializePoolMetadata(buf);

    expect(meta.name).toBe("Test Staking Pool");
    expect(meta.tags).toEqual(["#stakingpool", "#chiefstaker", "#test"]);
    expect(meta.url).toBe("https://www.tibane.net/staking/test");
    expect(meta.memberCount).toBe(42n);
    expect(meta.bump).toBe(253);
  });

  it("pool is a valid PublicKey", () => {
    const buf = makeMetadataBuffer();
    const meta = deserializePoolMetadata(buf);
    expect(meta.pool).toBeInstanceOf(PublicKey);
  });

  it("throws on wrong discriminator", () => {
    const buf = makeMetadataBuffer();
    buf[0] = 0x00;
    expect(() => deserializePoolMetadata(buf)).toThrow("Invalid PoolMetadata discriminator");
  });

  it("handles zero tags", () => {
    const buf = makeMetadataBuffer();
    // Set numTags to 0
    buf[8 + 32 + 1 + 64] = 0;
    const meta = deserializePoolMetadata(buf);
    expect(meta.tags).toEqual([]);
  });

  it("handles empty name", () => {
    const buf = makeMetadataBuffer();
    // Set nameLen to 0
    buf[8 + 32] = 0;
    const meta = deserializePoolMetadata(buf);
    expect(meta.name).toBe("");
  });
});
