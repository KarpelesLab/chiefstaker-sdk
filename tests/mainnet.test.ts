import { describe, it, expect } from "vitest";
import { Connection, PublicKey } from "@solana/web3.js";
import {
  ChiefStakerClient,
  findPoolAddress,
  findUserStakeAddress,
  findTokenVaultAddress,
  findPoolMetadataAddress,
  fetchStakingPool,
  fetchUserStake,
  fetchPoolMetadata,
  fetchUserStakesByOwner,
  TOKEN_2022_PROGRAM_ID,
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
});
