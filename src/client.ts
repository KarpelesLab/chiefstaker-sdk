import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  Signer,
  SendOptions,
  TransactionSignature,
  VersionedTransaction,
} from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { PROGRAM_ID, TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, WAD } from "./constants.js";
import { calculatePendingRewards, calculateUserWeightedStake, syncExpStartFactor } from "./math.js";
import { findPoolAddress, findTokenVaultAddress, findUserStakeAddress, findPoolMetadataAddress } from "./pda.js";
import { StakingPool, UserStake, PoolMetadata } from "./types.js";
import {
  fetchStakingPool,
  fetchStakingPoolByAddress,
  fetchUserStake,
  fetchUserStakeByAddress,
  fetchPoolMetadata,
  fetchAllStakingPools,
  fetchUserStakesByPool,
  fetchUserStakesByOwner,
} from "./accounts.js";
import {
  createInitializePoolInstruction,
  createStakeInstruction,
  createUnstakeInstruction,
  createClaimRewardsInstruction,
  createDepositRewardsInstruction,
  createSyncPoolInstruction,
  createSyncRewardsInstruction,
  createUpdatePoolSettingsInstruction,
  createTransferAuthorityInstruction,
  createRequestUnstakeInstruction,
  createCompleteUnstakeInstruction,
  createCancelUnstakeRequestInstruction,
  createCloseStakeAccountInstruction,
  createSetPoolMetadataInstruction,
  createTakeFeeOwnershipInstruction,
  createStakeOnBehalfInstruction,
  createFixStakeAccountInstruction,
} from "./instructions.js";

/** Wallet interface compatible with @solana/wallet-adapter */
export interface WalletAdapter {
  publicKey: PublicKey;
  signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T>;
  signAllTransactions<T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]>;
}

/**
 * High-level client for interacting with the ChiefStaker program.
 *
 * Provides both instruction-building methods (for composing transactions)
 * and send-and-confirm methods (for quick one-shot operations).
 */
export class ChiefStakerClient {
  readonly connection: Connection;
  readonly programId: PublicKey;

  constructor(connection: Connection, programId: PublicKey = PROGRAM_ID) {
    this.connection = connection;
    this.programId = programId;
  }

  // ------------------------------------------------------------------
  // PDA helpers
  // ------------------------------------------------------------------

  /** Derive pool PDA for a mint */
  findPoolAddress(mint: PublicKey): [PublicKey, number] {
    return findPoolAddress(mint, this.programId);
  }

  /** Derive token vault PDA for a pool */
  findTokenVaultAddress(pool: PublicKey): [PublicKey, number] {
    return findTokenVaultAddress(pool, this.programId);
  }

  /** Derive user stake PDA */
  findUserStakeAddress(pool: PublicKey, owner: PublicKey): [PublicKey, number] {
    return findUserStakeAddress(pool, owner, this.programId);
  }

  /** Derive pool metadata PDA */
  findPoolMetadataAddress(pool: PublicKey): [PublicKey, number] {
    return findPoolMetadataAddress(pool, this.programId);
  }

  // ------------------------------------------------------------------
  // Account fetchers
  // ------------------------------------------------------------------

  /** Fetch a StakingPool by its mint */
  async getPool(mint: PublicKey): Promise<StakingPool | null> {
    return fetchStakingPool(this.connection, mint, this.programId);
  }

  /** Fetch a StakingPool by pool address */
  async getPoolByAddress(pool: PublicKey): Promise<StakingPool | null> {
    return fetchStakingPoolByAddress(this.connection, pool);
  }

  /** Fetch a UserStake */
  async getUserStake(pool: PublicKey, owner: PublicKey): Promise<UserStake | null> {
    return fetchUserStake(this.connection, pool, owner, this.programId);
  }

  /** Fetch a UserStake by address */
  async getUserStakeByAddress(stakeAddress: PublicKey): Promise<UserStake | null> {
    return fetchUserStakeByAddress(this.connection, stakeAddress);
  }

  /** Fetch pool metadata */
  async getPoolMetadata(pool: PublicKey): Promise<PoolMetadata | null> {
    return fetchPoolMetadata(this.connection, pool, this.programId);
  }

  /** Fetch all staking pools */
  async getAllPools(): Promise<{ address: PublicKey; account: StakingPool }[]> {
    return fetchAllStakingPools(this.connection, this.programId);
  }

  /** Fetch all user stakes for a pool */
  async getStakesByPool(pool: PublicKey): Promise<{ address: PublicKey; account: UserStake }[]> {
    return fetchUserStakesByPool(this.connection, pool, this.programId);
  }

  /** Fetch all stakes for a user across all pools */
  async getStakesByOwner(owner: PublicKey): Promise<{ address: PublicKey; account: UserStake }[]> {
    return fetchUserStakesByOwner(this.connection, owner, this.programId);
  }

  // ------------------------------------------------------------------
  // Instruction builders
  // ------------------------------------------------------------------

  /** Build InitializePool instruction */
  initializePool(params: {
    mint: PublicKey;
    authority: PublicKey;
    tauSeconds: bigint | number;
    tokenProgram: PublicKey;
    remainingAccounts?: { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }[];
  }): TransactionInstruction {
    return createInitializePoolInstruction({
      ...params,
      programId: this.programId,
    });
  }

  /** Build Stake instruction */
  stake(params: {
    pool: PublicKey;
    mint: PublicKey;
    owner: PublicKey;
    userTokenAccount: PublicKey;
    amount: bigint | number;
    tokenProgram: PublicKey;
    includeMetadata?: boolean;
  }): TransactionInstruction {
    return createStakeInstruction({ ...params, programId: this.programId });
  }

  /** Build Unstake instruction (direct, only when pool has no cooldown) */
  unstake(params: {
    pool: PublicKey;
    mint: PublicKey;
    owner: PublicKey;
    userTokenAccount: PublicKey;
    amount: bigint | number;
    tokenProgram: PublicKey;
  }): TransactionInstruction {
    return createUnstakeInstruction({ ...params, programId: this.programId });
  }

  /** Build ClaimRewards instruction */
  claimRewards(params: {
    pool: PublicKey;
    owner: PublicKey;
  }): TransactionInstruction {
    return createClaimRewardsInstruction({ ...params, programId: this.programId });
  }

  /** Build DepositRewards instruction */
  depositRewards(params: {
    pool: PublicKey;
    depositor: PublicKey;
    amount: bigint | number;
  }): TransactionInstruction {
    return createDepositRewardsInstruction({ ...params, programId: this.programId });
  }

  /** Build SyncPool instruction */
  syncPool(pool: PublicKey): TransactionInstruction {
    return createSyncPoolInstruction({ pool, programId: this.programId });
  }

  /** Build SyncRewards instruction */
  syncRewards(pool: PublicKey): TransactionInstruction {
    return createSyncRewardsInstruction({ pool, programId: this.programId });
  }

  /** Build UpdatePoolSettings instruction */
  updatePoolSettings(params: {
    pool: PublicKey;
    authority: PublicKey;
    minStakeAmount?: bigint | number | null;
    lockDurationSeconds?: bigint | number | null;
    unstakeCooldownSeconds?: bigint | number | null;
  }): TransactionInstruction {
    return createUpdatePoolSettingsInstruction({ ...params, programId: this.programId });
  }

  /** Build TransferAuthority instruction */
  transferAuthority(params: {
    pool: PublicKey;
    authority: PublicKey;
    newAuthority: PublicKey;
  }): TransactionInstruction {
    return createTransferAuthorityInstruction({ ...params, programId: this.programId });
  }

  /** Build RequestUnstake instruction (starts cooldown) */
  requestUnstake(params: {
    pool: PublicKey;
    owner: PublicKey;
    amount: bigint | number;
  }): TransactionInstruction {
    return createRequestUnstakeInstruction({ ...params, programId: this.programId });
  }

  /** Build CompleteUnstake instruction (after cooldown) */
  completeUnstake(params: {
    pool: PublicKey;
    mint: PublicKey;
    owner: PublicKey;
    userTokenAccount: PublicKey;
    tokenProgram: PublicKey;
  }): TransactionInstruction {
    return createCompleteUnstakeInstruction({ ...params, programId: this.programId });
  }

  /** Build CancelUnstakeRequest instruction */
  cancelUnstakeRequest(params: {
    pool: PublicKey;
    owner: PublicKey;
  }): TransactionInstruction {
    return createCancelUnstakeRequestInstruction({ ...params, programId: this.programId });
  }

  /** Build CloseStakeAccount instruction */
  closeStakeAccount(params: {
    pool: PublicKey;
    owner: PublicKey;
  }): TransactionInstruction {
    return createCloseStakeAccountInstruction({ ...params, programId: this.programId });
  }

  /** Build SetPoolMetadata instruction */
  setPoolMetadata(params: {
    pool: PublicKey;
    mint: PublicKey;
    payer: PublicKey;
  }): TransactionInstruction {
    return createSetPoolMetadataInstruction({ ...params, programId: this.programId });
  }

  /** Build TakeFeeOwnership instruction */
  takeFeeOwnership(params: {
    pool: PublicKey;
    mint: PublicKey;
  }): TransactionInstruction {
    return createTakeFeeOwnershipInstruction({ ...params, programId: this.programId });
  }

  /** Build StakeOnBehalf instruction */
  stakeOnBehalf(params: {
    pool: PublicKey;
    mint: PublicKey;
    staker: PublicKey;
    beneficiary: PublicKey;
    stakerTokenAccount: PublicKey;
    amount: bigint | number;
    tokenProgram: PublicKey;
    includeMetadata?: boolean;
  }): TransactionInstruction {
    return createStakeOnBehalfInstruction({ ...params, programId: this.programId });
  }

  /** Build FixStakeAccount instruction (upgrade authority only) */
  fixStakeAccount(params: {
    pool: PublicKey;
    userStake: PublicKey;
    upgradeAuthority: PublicKey;
    programData: PublicKey;
    newExpStartFactor: bigint;
    newRewardDebt: bigint;
  }): TransactionInstruction {
    return createFixStakeAccountInstruction({ ...params, programId: this.programId });
  }

  // ------------------------------------------------------------------
  // Reward calculation
  // ------------------------------------------------------------------

  /**
   * Compute the pending claimable SOL rewards (in lamports) for a staker.
   *
   * Pass `currentTime` to override the current timestamp (unix seconds),
   * otherwise the on-chain clock is fetched automatically.
   */
  async getClaimableRewards(
    pool: PublicKey,
    owner: PublicKey,
    currentTime?: bigint | number
  ): Promise<bigint> {
    const [poolData, stakeData] = await Promise.all([
      this.getPoolByAddress(pool),
      this.getUserStake(pool, owner),
    ]);
    if (!poolData || !stakeData) return 0n;

    let now: bigint;
    if (currentTime !== undefined) {
      now = BigInt(currentTime);
    } else {
      const slot = await this.connection.getSlot();
      const blockTime = await this.connection.getBlockTime(slot);
      now = BigInt(blockTime ?? Math.floor(Date.now() / 1000));
    }

    return calculatePendingRewards({
      amount: stakeData.amount,
      expStartFactor: stakeData.expStartFactor,
      rewardDebt: stakeData.rewardDebt,
      claimedRewardsWad: stakeData.claimedRewardsWad,
      baseTimeSnapshot: stakeData.baseTimeSnapshot,
      poolAccRewardPerWeightedShare: poolData.accRewardPerWeightedShare,
      poolBaseTime: poolData.baseTime,
      poolInitialBaseTime: poolData.initialBaseTime,
      poolTauSeconds: poolData.tauSeconds,
      currentTime: now,
    });
  }

  /**
   * Compute the current staking weight (0–100%) for a user.
   *
   * Returns a number between 0 and 1 (e.g. 0.632 = 63.2%).
   */
  async getStakeWeight(
    pool: PublicKey,
    owner: PublicKey,
    currentTime?: bigint | number
  ): Promise<number> {
    const [poolData, stakeData] = await Promise.all([
      this.getPoolByAddress(pool),
      this.getUserStake(pool, owner),
    ]);
    if (!poolData || !stakeData || stakeData.amount === 0n) return 0;

    let now: bigint;
    if (currentTime !== undefined) {
      now = BigInt(currentTime);
    } else {
      const slot = await this.connection.getSlot();
      const blockTime = await this.connection.getBlockTime(slot);
      now = BigInt(blockTime ?? Math.floor(Date.now() / 1000));
    }

    const syncedEsf = syncExpStartFactor(
      stakeData.expStartFactor,
      stakeData.baseTimeSnapshot,
      poolData.baseTime,
      poolData.initialBaseTime,
      poolData.tauSeconds
    );

    const weighted = calculateUserWeightedStake(
      stakeData.amount,
      syncedEsf,
      now,
      poolData.baseTime,
      poolData.tauSeconds
    );

    const maxWeight = stakeData.amount * WAD;
    if (maxWeight === 0n) return 0;
    return Number(weighted * 10000n / maxWeight) / 10000;
  }

  // ------------------------------------------------------------------
  // Send-and-confirm helpers
  // ------------------------------------------------------------------

  /**
   * Detect whether a mint belongs to SPL Token or Token 2022.
   * Returns the appropriate token program ID.
   */
  async detectTokenProgram(mint: PublicKey): Promise<PublicKey> {
    const info = await this.connection.getAccountInfo(mint);
    if (!info) throw new Error(`Mint account ${mint.toBase58()} not found`);
    if (info.owner.equals(TOKEN_2022_PROGRAM_ID)) return TOKEN_2022_PROGRAM_ID;
    if (info.owner.equals(TOKEN_PROGRAM_ID)) return TOKEN_PROGRAM_ID;
    throw new Error(`Mint ${mint.toBase58()} is not owned by a known token program`);
  }

  /**
   * Helper to send and confirm a transaction using a Keypair signer.
   */
  async sendTransaction(
    instructions: TransactionInstruction[],
    signers: Signer[],
    options?: SendOptions
  ): Promise<TransactionSignature> {
    const tx = new Transaction().add(...instructions);
    const { blockhash, lastValidBlockHeight } =
      await this.connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.lastValidBlockHeight = lastValidBlockHeight;
    tx.feePayer = signers[0].publicKey;
    tx.sign(...signers);
    const sig = await this.connection.sendRawTransaction(tx.serialize(), options);
    await this.connection.confirmTransaction(
      { signature: sig, blockhash, lastValidBlockHeight },
      "confirmed"
    );
    return sig;
  }

  /**
   * Helper to send and confirm a transaction using a wallet adapter.
   */
  async sendTransactionWithWallet(
    instructions: TransactionInstruction[],
    wallet: WalletAdapter,
    options?: SendOptions
  ): Promise<TransactionSignature> {
    const tx = new Transaction().add(...instructions);
    const { blockhash, lastValidBlockHeight } =
      await this.connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.lastValidBlockHeight = lastValidBlockHeight;
    tx.feePayer = wallet.publicKey;
    const signed = await wallet.signTransaction(tx);
    const sig = await this.connection.sendRawTransaction(
      signed.serialize(),
      options
    );
    await this.connection.confirmTransaction(
      { signature: sig, blockhash, lastValidBlockHeight },
      "confirmed"
    );
    return sig;
  }
}
