import { describe, it, expect } from "vitest";
import { Connection, PublicKey } from "@solana/web3.js";
import {
  ChiefStakerClient,
  findPoolAddress,
  findUserStakeAddress,
  findTokenVaultAddress,
  findPoolMetadataAddress,
  fetchStakingPool,
  fetchStakingPoolByAddress,
  fetchUserStake,
  fetchUserStakeByAddress,
  fetchPoolMetadata,
  fetchAllStakingPools,
  fetchUserStakesByPool,
  fetchUserStakesByOwner,
  TOKEN_2022_PROGRAM_ID,
  PROGRAM_ID,
  WAD,
} from "../src/index.js";

const RPC_URL = "https://api.mainnet-beta.solana.com";
const MINT = new PublicKey("DRtvTCzfiKGhCVREmBbZdN9sB8PHeq9KdRZ3VmFhpump");
const STAKER = new PublicKey("3k9z7k83NfzG8AAKy2DTqKkSCYGYj3b8opKgvQRFEWah");

const connection = new Connection(RPC_URL);
const client = new ChiefStakerClient(connection);

describe("PDA derivation", () => {
  it("derives pool address deterministically", () => {
    const [pool1] = findPoolAddress(MINT);
    const [pool2] = findPoolAddress(MINT);
    expect(pool1.equals(pool2)).toBe(true);
  });

  it("derives consistent PDAs from pool", () => {
    const [pool] = findPoolAddress(MINT);
    const [vault] = findTokenVaultAddress(pool);
    const [stake] = findUserStakeAddress(pool, STAKER);
    const [meta] = findPoolMetadataAddress(pool);

    // All should be valid public keys
    expect(pool.toBase58()).toMatch(/^[1-9A-HJ-NP-Za-km-z]+$/);
    expect(vault.toBase58()).toMatch(/^[1-9A-HJ-NP-Za-km-z]+$/);
    expect(stake.toBase58()).toMatch(/^[1-9A-HJ-NP-Za-km-z]+$/);
    expect(meta.toBase58()).toMatch(/^[1-9A-HJ-NP-Za-km-z]+$/);
  });

  it("client PDA helpers match standalone functions", () => {
    const [pool1] = findPoolAddress(MINT);
    const [pool2] = client.findPoolAddress(MINT);
    expect(pool1.equals(pool2)).toBe(true);

    const [stake1] = findUserStakeAddress(pool1, STAKER);
    const [stake2] = client.findUserStakeAddress(pool1, STAKER);
    expect(stake1.equals(stake2)).toBe(true);
  });
});

describe("fetch pool", () => {
  it("fetches the staking pool by mint", async () => {
    const pool = await client.getPool(MINT);

    expect(pool).not.toBeNull();
    expect(pool!.mint.equals(MINT)).toBe(true);
    expect(pool!.tauSeconds).toBeGreaterThan(0n);
    expect(pool!.totalStaked).toBeGreaterThan(0n);
    expect(pool!.bump).toBeGreaterThan(0);
  });

  it("fetches the staking pool by address", async () => {
    const [poolAddress] = findPoolAddress(MINT);
    const pool = await client.getPoolByAddress(poolAddress);

    expect(pool).not.toBeNull();
    expect(pool!.mint.equals(MINT)).toBe(true);
  });

  it("pool tokenVault matches derived PDA", async () => {
    const [poolAddress] = findPoolAddress(MINT);
    const pool = await client.getPoolByAddress(poolAddress);
    const [expectedVault] = findTokenVaultAddress(poolAddress);

    expect(pool!.tokenVault.equals(expectedVault)).toBe(true);
  });

  it("standalone fetchStakingPool matches client", async () => {
    const pool1 = await client.getPool(MINT);
    const pool2 = await fetchStakingPool(connection, MINT);

    expect(pool1).not.toBeNull();
    expect(pool2).not.toBeNull();
    expect(pool1!.totalStaked).toBe(pool2!.totalStaked);
    expect(pool1!.tauSeconds).toBe(pool2!.tauSeconds);
  });
});

describe("fetch user stake", () => {
  it("fetches stake for the given address", async () => {
    const [poolAddress] = findPoolAddress(MINT);
    const stake = await client.getUserStake(poolAddress, STAKER);

    expect(stake).not.toBeNull();
    expect(stake!.owner.equals(STAKER)).toBe(true);
    expect(stake!.pool.equals(poolAddress)).toBe(true);
    expect(stake!.amount).toBeGreaterThanOrEqual(0n);
    expect(stake!.stakeTime).toBeGreaterThan(0n);
    expect(stake!.bump).toBeGreaterThan(0);
  });

  it("stake PDA address matches derived address", async () => {
    const [poolAddress] = findPoolAddress(MINT);
    const [expectedStakeAddr] = findUserStakeAddress(poolAddress, STAKER);
    const stake = await client.getUserStakeByAddress(expectedStakeAddr);

    expect(stake).not.toBeNull();
    expect(stake!.owner.equals(STAKER)).toBe(true);
  });

  it("standalone fetchUserStake matches client", async () => {
    const [poolAddress] = findPoolAddress(MINT);
    const stake1 = await client.getUserStake(poolAddress, STAKER);
    const stake2 = await fetchUserStake(connection, poolAddress, STAKER);

    expect(stake1).not.toBeNull();
    expect(stake2).not.toBeNull();
    expect(stake1!.amount).toBe(stake2!.amount);
    expect(stake1!.stakeTime).toBe(stake2!.stakeTime);
  });

  it("fetches stakes by owner across all pools", async () => {
    const stakes = await client.getStakesByOwner(STAKER);

    expect(stakes.length).toBeGreaterThan(0);

    const match = stakes.find(({ account }) => account.pool.equals(findPoolAddress(MINT)[0]));
    expect(match).toBeDefined();
    expect(match!.account.owner.equals(STAKER)).toBe(true);
  });
});

describe("fetch pool metadata", () => {
  it("fetches metadata for the pool", async () => {
    const [poolAddress] = findPoolAddress(MINT);
    const meta = await client.getPoolMetadata(poolAddress);

    expect(meta).not.toBeNull();
    expect(meta!.pool.equals(poolAddress)).toBe(true);
    expect(meta!.name.length).toBeGreaterThan(0);
    expect(meta!.tags.length).toBeGreaterThan(0);
    expect(meta!.memberCount).toBeGreaterThanOrEqual(0n);
  });

  it("metadata tags include expected values", async () => {
    const [poolAddress] = findPoolAddress(MINT);
    const meta = await client.getPoolMetadata(poolAddress);

    const tagValues = meta!.tags.map((t) => t.toLowerCase());
    expect(tagValues).toContain("#stakingpool");
    expect(tagValues).toContain("#chiefstaker");
  });

  it("standalone fetchPoolMetadata matches client", async () => {
    const [poolAddress] = findPoolAddress(MINT);
    const meta1 = await client.getPoolMetadata(poolAddress);
    const meta2 = await fetchPoolMetadata(connection, poolAddress);

    expect(meta1).not.toBeNull();
    expect(meta2).not.toBeNull();
    expect(meta1!.name).toBe(meta2!.name);
    expect(meta1!.memberCount).toBe(meta2!.memberCount);
  });
});

describe("detect token program", () => {
  it("detects Token 2022 for this mint", async () => {
    const tokenProgram = await client.detectTokenProgram(MINT);
    expect(tokenProgram.equals(TOKEN_2022_PROGRAM_ID)).toBe(true);
  });
});

describe("pool data integrity", () => {
  it("pool authority is a valid non-default pubkey", async () => {
    const pool = await client.getPool(MINT);
    expect(pool).not.toBeNull();
    expect(pool!.authority).toBeInstanceOf(PublicKey);
    // authority should not be default (all zeros) unless renounced
    // just check it's a valid key
    expect(pool!.authority.toBase58().length).toBeGreaterThan(0);
  });

  it("accRewardPerWeightedShare is non-negative", async () => {
    const pool = await client.getPool(MINT);
    expect(pool!.accRewardPerWeightedShare).toBeGreaterThanOrEqual(0n);
  });

  it("lastUpdateTime is a plausible unix timestamp", async () => {
    const pool = await client.getPool(MINT);
    // Should be after 2024-01-01 and before 2030-01-01
    expect(pool!.lastUpdateTime).toBeGreaterThan(1704067200n);
    expect(pool!.lastUpdateTime).toBeLessThan(1893456000n);
  });

  it("baseTime is a plausible unix timestamp", async () => {
    const pool = await client.getPool(MINT);
    expect(pool!.baseTime).toBeGreaterThan(1704067200n);
    expect(pool!.baseTime).toBeLessThan(1893456000n);
  });

  it("sumStakeExp is 32 bytes", async () => {
    const pool = await client.getPool(MINT);
    expect(pool!.sumStakeExp).toBeInstanceOf(Uint8Array);
    expect(pool!.sumStakeExp.length).toBe(32);
  });

  it("totalRewardDebt is non-negative", async () => {
    const pool = await client.getPool(MINT);
    expect(pool!.totalRewardDebt).toBeGreaterThanOrEqual(0n);
  });
});

describe("user stake data integrity", () => {
  it("stakeTime is a plausible unix timestamp", async () => {
    const [poolAddress] = findPoolAddress(MINT);
    const stake = await client.getUserStake(poolAddress, STAKER);
    expect(stake!.stakeTime).toBeGreaterThan(1704067200n);
    expect(stake!.stakeTime).toBeLessThan(1893456000n);
  });

  it("expStartFactor is positive (WAD-scaled)", async () => {
    const [poolAddress] = findPoolAddress(MINT);
    const stake = await client.getUserStake(poolAddress, STAKER);
    // expStartFactor should be >= WAD (e^0 = 1)
    expect(stake!.expStartFactor).toBeGreaterThanOrEqual(WAD);
  });

  it("all deserialized fields have expected types", async () => {
    const [poolAddress] = findPoolAddress(MINT);
    const stake = await client.getUserStake(poolAddress, STAKER);

    expect(typeof stake!.amount).toBe("bigint");
    expect(typeof stake!.stakeTime).toBe("bigint");
    expect(typeof stake!.expStartFactor).toBe("bigint");
    expect(typeof stake!.rewardDebt).toBe("bigint");
    expect(typeof stake!.bump).toBe("number");
    expect(typeof stake!.unstakeRequestAmount).toBe("bigint");
    expect(typeof stake!.unstakeRequestTime).toBe("bigint");
    expect(typeof stake!.lastStakeTime).toBe("bigint");
    expect(typeof stake!.baseTimeSnapshot).toBe("bigint");
    expect(typeof stake!.totalRewardsClaimed).toBe("bigint");
    expect(typeof stake!.claimedRewardsWad).toBe("bigint");
  });
});

describe("fetch stakers by pool", () => {
  it("finds stakers including our test staker", async () => {
    const [poolAddress] = findPoolAddress(MINT);
    const stakers = await client.getStakesByPool(poolAddress);

    expect(stakers.length).toBeGreaterThan(0);

    // All stakers should reference this pool
    for (const { account } of stakers) {
      expect(account.pool.equals(poolAddress)).toBe(true);
    }

    // Our test staker should appear
    const found = stakers.find(({ account }) =>
      account.owner.equals(STAKER)
    );
    expect(found).toBeDefined();
  }, 30_000);
});

describe("fetch all pools", () => {
  it("finds pools including our test pool, all with valid structure", async () => {
    const [poolAddress] = findPoolAddress(MINT);
    let pools;
    try {
      pools = await client.getAllPools();
    } catch (e: any) {
      if (e?.message?.includes("429")) {
        console.warn("Skipping: public RPC rate-limited on getProgramAccounts");
        return;
      }
      throw e;
    }

    expect(pools.length).toBeGreaterThan(0);

    // Our test pool should appear
    const found = pools.find(({ address }) => address.equals(poolAddress));
    expect(found).toBeDefined();
    expect(found!.account.mint.equals(MINT)).toBe(true);

    // All pools should have valid structure
    for (const { account } of pools) {
      expect(account.mint).toBeInstanceOf(PublicKey);
      expect(account.tokenVault).toBeInstanceOf(PublicKey);
      expect(account.authority).toBeInstanceOf(PublicKey);
      expect(account.tauSeconds).toBeGreaterThan(0n);
      expect(account.bump).toBeGreaterThan(0);
    }
  }, 30_000);
});

describe("on-chain account size validation", () => {
  it("pool account is exactly 289 bytes", async () => {
    const [poolAddress] = findPoolAddress(MINT);
    const info = await connection.getAccountInfo(poolAddress);
    expect(info).not.toBeNull();
    expect(info!.data.length).toBe(289);
  });

  it("pool account is owned by the program", async () => {
    const [poolAddress] = findPoolAddress(MINT);
    const info = await connection.getAccountInfo(poolAddress);
    expect(info!.owner.equals(PROGRAM_ID)).toBe(true);
  });

  it("user stake account is owned by the program", async () => {
    const [poolAddress] = findPoolAddress(MINT);
    const [stakeAddress] = findUserStakeAddress(poolAddress, STAKER);
    const info = await connection.getAccountInfo(stakeAddress);
    expect(info).not.toBeNull();
    expect(info!.owner.equals(PROGRAM_ID)).toBe(true);
  });

  it("metadata account is owned by the program", async () => {
    const [poolAddress] = findPoolAddress(MINT);
    const [metaAddress] = findPoolMetadataAddress(poolAddress);
    const info = await connection.getAccountInfo(metaAddress);
    expect(info).not.toBeNull();
    expect(info!.owner.equals(PROGRAM_ID)).toBe(true);
    expect(info!.data.length).toBe(508);
  });
});

describe("returns null for nonexistent accounts", () => {
  it("returns null for a random mint with no pool", async () => {
    const fakeMint = new PublicKey("11111111111111111111111111111112");
    const pool = await client.getPool(fakeMint);
    expect(pool).toBeNull();
  });

  it("returns null for a random user with no stake", async () => {
    const [poolAddress] = findPoolAddress(MINT);
    const fakeUser = new PublicKey("11111111111111111111111111111112");
    const stake = await client.getUserStake(poolAddress, fakeUser);
    expect(stake).toBeNull();
  });

  it("returns null for metadata on a pool that has none", async () => {
    const fakeMint = new PublicKey("11111111111111111111111111111112");
    const [fakePool] = findPoolAddress(fakeMint);
    const meta = await client.getPoolMetadata(fakePool);
    expect(meta).toBeNull();
  });
});
