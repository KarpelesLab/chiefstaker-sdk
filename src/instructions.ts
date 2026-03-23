import {
  PublicKey,
  TransactionInstruction,
  AccountMeta,
} from "@solana/web3.js";
import {
  PROGRAM_ID,
  SYSTEM_PROGRAM_ID,
  RENT_SYSVAR_ID,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  WSOL_MINT,
  PFEE_PROGRAM_ID,
  PUMP_PROGRAM_ID,
  PUMP_AMM_PROGRAM_ID,
} from "./constants.js";
import {
  findPoolAddress,
  findTokenVaultAddress,
  findUserStakeAddress,
  findPoolMetadataAddress,
  findPfeeEventAuthority,
  findPumpGlobal,
  findSharingConfig,
  findBondingCurve,
  findPumpCreatorVault,
  findPumpEventAuthority,
  findAmmEventAuthority,
  findCoinCreatorVaultAuth,
} from "./pda.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";

// --- Borsh serialization helpers ---

function encodeU8(value: number): Buffer {
  const buf = Buffer.alloc(1);
  buf.writeUInt8(value);
  return buf;
}

function encodeU64(value: bigint | number): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(value));
  return buf;
}

function encodeU128(value: bigint): Buffer {
  const buf = Buffer.alloc(16);
  buf.writeBigUInt64LE(value & 0xffffffffffffffffn);
  buf.writeBigUInt64LE(value >> 64n, 8);
  return buf;
}

function encodeOptionU64(value: bigint | number | null): Buffer {
  if (value === null || value === undefined) {
    return Buffer.from([0]); // None
  }
  return Buffer.concat([Buffer.from([1]), encodeU64(value)]); // Some
}

function encodePubkey(key: PublicKey): Buffer {
  return key.toBuffer();
}

// --- Instruction builders ---

export interface InitializePoolParams {
  /** Token mint (SPL Token or Token 2022) */
  mint: PublicKey;
  /** Authority / payer (must be mint_authority, metadata update_authority, or pfee admin) */
  authority: PublicKey;
  /** Time constant in seconds (e.g. 2592000 for 30 days) */
  tauSeconds: bigint | number;
  /** Token program (SPL Token or Token 2022) */
  tokenProgram: PublicKey;
  /** Optional remaining accounts for authority proof (Metaplex metadata PDA or pfee SharingConfig) */
  remainingAccounts?: AccountMeta[];
  programId?: PublicKey;
}

/** Build an InitializePool instruction */
export function createInitializePoolInstruction(
  params: InitializePoolParams
): TransactionInstruction {
  const programId = params.programId ?? PROGRAM_ID;
  const [pool] = findPoolAddress(params.mint, programId);
  const [tokenVault] = findTokenVaultAddress(pool, programId);

  const data = Buffer.concat([encodeU8(0), encodeU64(params.tauSeconds)]);

  const keys: AccountMeta[] = [
    { pubkey: pool, isSigner: false, isWritable: true },
    { pubkey: params.mint, isSigner: false, isWritable: false },
    { pubkey: tokenVault, isSigner: false, isWritable: true },
    { pubkey: params.authority, isSigner: true, isWritable: true },
    { pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: params.tokenProgram, isSigner: false, isWritable: false },
    { pubkey: RENT_SYSVAR_ID, isSigner: false, isWritable: false },
    ...(params.remainingAccounts ?? []),
  ];

  return new TransactionInstruction({ keys, programId, data });
}

export interface StakeParams {
  /** Pool address */
  pool: PublicKey;
  /** Token mint */
  mint: PublicKey;
  /** User / owner (signer) */
  owner: PublicKey;
  /** User's token account */
  userTokenAccount: PublicKey;
  /** Amount to stake */
  amount: bigint | number;
  /** Token program (SPL Token or Token 2022) */
  tokenProgram: PublicKey;
  /** Include PoolMetadata PDA to increment member_count */
  includeMetadata?: boolean;
  programId?: PublicKey;
}

/** Build a Stake instruction */
export function createStakeInstruction(
  params: StakeParams
): TransactionInstruction {
  const programId = params.programId ?? PROGRAM_ID;
  const [userStake] = findUserStakeAddress(params.pool, params.owner, programId);
  const [tokenVault] = findTokenVaultAddress(params.pool, programId);

  const data = Buffer.concat([encodeU8(1), encodeU64(params.amount)]);

  const keys: AccountMeta[] = [
    { pubkey: params.pool, isSigner: false, isWritable: true },
    { pubkey: userStake, isSigner: false, isWritable: true },
    { pubkey: tokenVault, isSigner: false, isWritable: true },
    { pubkey: params.userTokenAccount, isSigner: false, isWritable: true },
    { pubkey: params.mint, isSigner: false, isWritable: false },
    { pubkey: params.owner, isSigner: true, isWritable: true },
    { pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: params.tokenProgram, isSigner: false, isWritable: false },
  ];

  if (params.includeMetadata) {
    const [metadata] = findPoolMetadataAddress(params.pool, programId);
    keys.push({ pubkey: metadata, isSigner: false, isWritable: true });
  }

  return new TransactionInstruction({ keys, programId, data });
}

export interface UnstakeParams {
  /** Pool address */
  pool: PublicKey;
  /** Token mint */
  mint: PublicKey;
  /** User / owner (signer) */
  owner: PublicKey;
  /** User's token account to receive unstaked tokens */
  userTokenAccount: PublicKey;
  /** Amount to unstake */
  amount: bigint | number;
  /** Token program (SPL Token or Token 2022) */
  tokenProgram: PublicKey;
  programId?: PublicKey;
}

/** Build an Unstake instruction (direct unstake, only when pool has no cooldown) */
export function createUnstakeInstruction(
  params: UnstakeParams
): TransactionInstruction {
  const programId = params.programId ?? PROGRAM_ID;
  const [userStake] = findUserStakeAddress(params.pool, params.owner, programId);
  const [tokenVault] = findTokenVaultAddress(params.pool, programId);

  const data = Buffer.concat([encodeU8(2), encodeU64(params.amount)]);

  const keys: AccountMeta[] = [
    { pubkey: params.pool, isSigner: false, isWritable: true },
    { pubkey: userStake, isSigner: false, isWritable: true },
    { pubkey: tokenVault, isSigner: false, isWritable: true },
    { pubkey: params.userTokenAccount, isSigner: false, isWritable: true },
    { pubkey: params.mint, isSigner: false, isWritable: false },
    { pubkey: params.owner, isSigner: true, isWritable: true },
    { pubkey: params.tokenProgram, isSigner: false, isWritable: false },
  ];

  return new TransactionInstruction({ keys, programId, data });
}

export interface ClaimRewardsParams {
  /** Pool address */
  pool: PublicKey;
  /** User / owner (signer) */
  owner: PublicKey;
  programId?: PublicKey;
}

/** Build a ClaimRewards instruction */
export function createClaimRewardsInstruction(
  params: ClaimRewardsParams
): TransactionInstruction {
  const programId = params.programId ?? PROGRAM_ID;
  const [userStake] = findUserStakeAddress(params.pool, params.owner, programId);

  const data = encodeU8(3);

  const keys: AccountMeta[] = [
    { pubkey: params.pool, isSigner: false, isWritable: true },
    { pubkey: userStake, isSigner: false, isWritable: true },
    { pubkey: params.owner, isSigner: true, isWritable: true },
  ];

  return new TransactionInstruction({ keys, programId, data });
}

export interface DepositRewardsParams {
  /** Pool address */
  pool: PublicKey;
  /** Depositor (signer) */
  depositor: PublicKey;
  /** Amount of lamports to deposit */
  amount: bigint | number;
  programId?: PublicKey;
}

/** Build a DepositRewards instruction */
export function createDepositRewardsInstruction(
  params: DepositRewardsParams
): TransactionInstruction {
  const programId = params.programId ?? PROGRAM_ID;

  const data = Buffer.concat([encodeU8(4), encodeU64(params.amount)]);

  const keys: AccountMeta[] = [
    { pubkey: params.pool, isSigner: false, isWritable: true },
    { pubkey: params.depositor, isSigner: true, isWritable: true },
    { pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false },
  ];

  return new TransactionInstruction({ keys, programId, data });
}

export interface SyncPoolParams {
  /** Pool address */
  pool: PublicKey;
  programId?: PublicKey;
}

/** Build a SyncPool instruction (permissionless crank) */
export function createSyncPoolInstruction(
  params: SyncPoolParams
): TransactionInstruction {
  const programId = params.programId ?? PROGRAM_ID;
  const data = encodeU8(5);
  const keys: AccountMeta[] = [
    { pubkey: params.pool, isSigner: false, isWritable: true },
  ];
  return new TransactionInstruction({ keys, programId, data });
}

export interface SyncRewardsParams {
  /** Pool address */
  pool: PublicKey;
  programId?: PublicKey;
}

/** Build a SyncRewards instruction (permissionless crank) */
export function createSyncRewardsInstruction(
  params: SyncRewardsParams
): TransactionInstruction {
  const programId = params.programId ?? PROGRAM_ID;
  const data = encodeU8(6);
  const keys: AccountMeta[] = [
    { pubkey: params.pool, isSigner: false, isWritable: true },
  ];
  return new TransactionInstruction({ keys, programId, data });
}

export interface UpdatePoolSettingsParams {
  /** Pool address */
  pool: PublicKey;
  /** Pool authority (signer) */
  authority: PublicKey;
  /** New minimum stake amount (null = don't change) */
  minStakeAmount?: bigint | number | null;
  /** New lock duration in seconds (null = don't change, max 365 days) */
  lockDurationSeconds?: bigint | number | null;
  /** New unstake cooldown in seconds (null = don't change, max 30 days) */
  unstakeCooldownSeconds?: bigint | number | null;
  programId?: PublicKey;
}

/** Build an UpdatePoolSettings instruction */
export function createUpdatePoolSettingsInstruction(
  params: UpdatePoolSettingsParams
): TransactionInstruction {
  const programId = params.programId ?? PROGRAM_ID;

  const data = Buffer.concat([
    encodeU8(7),
    encodeOptionU64(params.minStakeAmount ?? null),
    encodeOptionU64(params.lockDurationSeconds ?? null),
    encodeOptionU64(params.unstakeCooldownSeconds ?? null),
  ]);

  const keys: AccountMeta[] = [
    { pubkey: params.pool, isSigner: false, isWritable: true },
    { pubkey: params.authority, isSigner: true, isWritable: false },
  ];

  return new TransactionInstruction({ keys, programId, data });
}

export interface TransferAuthorityParams {
  /** Pool address */
  pool: PublicKey;
  /** Current authority (signer) */
  authority: PublicKey;
  /** New authority (Pubkey::default() to renounce) */
  newAuthority: PublicKey;
  programId?: PublicKey;
}

/** Build a TransferAuthority instruction */
export function createTransferAuthorityInstruction(
  params: TransferAuthorityParams
): TransactionInstruction {
  const programId = params.programId ?? PROGRAM_ID;

  const data = Buffer.concat([encodeU8(8), encodePubkey(params.newAuthority)]);

  const keys: AccountMeta[] = [
    { pubkey: params.pool, isSigner: false, isWritable: true },
    { pubkey: params.authority, isSigner: true, isWritable: false },
  ];

  return new TransactionInstruction({ keys, programId, data });
}

export interface RequestUnstakeParams {
  /** Pool address */
  pool: PublicKey;
  /** User / owner (signer) */
  owner: PublicKey;
  /** Amount to request unstaking */
  amount: bigint | number;
  programId?: PublicKey;
}

/** Build a RequestUnstake instruction (starts cooldown period) */
export function createRequestUnstakeInstruction(
  params: RequestUnstakeParams
): TransactionInstruction {
  const programId = params.programId ?? PROGRAM_ID;
  const [userStake] = findUserStakeAddress(params.pool, params.owner, programId);

  const data = Buffer.concat([encodeU8(9), encodeU64(params.amount)]);

  const keys: AccountMeta[] = [
    { pubkey: params.pool, isSigner: false, isWritable: true },
    { pubkey: userStake, isSigner: false, isWritable: true },
    { pubkey: params.owner, isSigner: true, isWritable: false },
  ];

  return new TransactionInstruction({ keys, programId, data });
}

export interface CompleteUnstakeParams {
  /** Pool address */
  pool: PublicKey;
  /** Token mint */
  mint: PublicKey;
  /** User / owner (signer) */
  owner: PublicKey;
  /** User's token account to receive unstaked tokens */
  userTokenAccount: PublicKey;
  /** Token program (SPL Token or Token 2022) */
  tokenProgram: PublicKey;
  programId?: PublicKey;
}

/** Build a CompleteUnstake instruction (after cooldown) */
export function createCompleteUnstakeInstruction(
  params: CompleteUnstakeParams
): TransactionInstruction {
  const programId = params.programId ?? PROGRAM_ID;
  const [userStake] = findUserStakeAddress(params.pool, params.owner, programId);
  const [tokenVault] = findTokenVaultAddress(params.pool, programId);

  const data = encodeU8(10);

  const keys: AccountMeta[] = [
    { pubkey: params.pool, isSigner: false, isWritable: true },
    { pubkey: userStake, isSigner: false, isWritable: true },
    { pubkey: tokenVault, isSigner: false, isWritable: true },
    { pubkey: params.userTokenAccount, isSigner: false, isWritable: true },
    { pubkey: params.mint, isSigner: false, isWritable: false },
    { pubkey: params.owner, isSigner: true, isWritable: true },
    { pubkey: params.tokenProgram, isSigner: false, isWritable: false },
  ];

  return new TransactionInstruction({ keys, programId, data });
}

export interface CancelUnstakeRequestParams {
  /** Pool address */
  pool: PublicKey;
  /** User / owner (signer) */
  owner: PublicKey;
  programId?: PublicKey;
}

/** Build a CancelUnstakeRequest instruction */
export function createCancelUnstakeRequestInstruction(
  params: CancelUnstakeRequestParams
): TransactionInstruction {
  const programId = params.programId ?? PROGRAM_ID;
  const [userStake] = findUserStakeAddress(params.pool, params.owner, programId);

  const data = encodeU8(11);

  const keys: AccountMeta[] = [
    { pubkey: params.pool, isSigner: false, isWritable: false },
    { pubkey: userStake, isSigner: false, isWritable: true },
    { pubkey: params.owner, isSigner: true, isWritable: false },
  ];

  return new TransactionInstruction({ keys, programId, data });
}

export interface CloseStakeAccountParams {
  /** Pool address */
  pool: PublicKey;
  /** User / owner (signer, receives rent refund) */
  owner: PublicKey;
  programId?: PublicKey;
}

/** Build a CloseStakeAccount instruction (reclaim rent from zero-balance stake) */
export function createCloseStakeAccountInstruction(
  params: CloseStakeAccountParams
): TransactionInstruction {
  const programId = params.programId ?? PROGRAM_ID;
  const [userStake] = findUserStakeAddress(params.pool, params.owner, programId);

  const data = encodeU8(12);

  const keys: AccountMeta[] = [
    { pubkey: params.pool, isSigner: false, isWritable: false },
    { pubkey: userStake, isSigner: false, isWritable: true },
    { pubkey: params.owner, isSigner: true, isWritable: true },
  ];

  return new TransactionInstruction({ keys, programId, data });
}

export interface SetPoolMetadataParams {
  /** Pool address */
  pool: PublicKey;
  /** Token mint (must have TokenMetadata extension) */
  mint: PublicKey;
  /** Payer (pays rent on first call) */
  payer: PublicKey;
  programId?: PublicKey;
}

/** Build a SetPoolMetadata instruction (permissionless) */
export function createSetPoolMetadataInstruction(
  params: SetPoolMetadataParams
): TransactionInstruction {
  const programId = params.programId ?? PROGRAM_ID;
  const [metadata] = findPoolMetadataAddress(params.pool, programId);

  const data = encodeU8(14);

  const keys: AccountMeta[] = [
    { pubkey: params.pool, isSigner: false, isWritable: false },
    { pubkey: metadata, isSigner: false, isWritable: true },
    { pubkey: params.mint, isSigner: false, isWritable: false },
    { pubkey: params.payer, isSigner: true, isWritable: true },
    { pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false },
  ];

  return new TransactionInstruction({ keys, programId, data });
}

export interface TakeFeeOwnershipParams {
  /** Pool address */
  pool: PublicKey;
  /** Token mint */
  mint: PublicKey;
  programId?: PublicKey;
}

/** Build a TakeFeeOwnership instruction (permissionless crank) */
export function createTakeFeeOwnershipInstruction(
  params: TakeFeeOwnershipParams
): TransactionInstruction {
  const programId = params.programId ?? PROGRAM_ID;

  const [pfeeEventAuthority] = findPfeeEventAuthority();
  const [pumpGlobal] = findPumpGlobal();
  const [sharingConfig] = findSharingConfig(params.mint);
  const [bondingCurve] = findBondingCurve(params.mint);
  const [pumpCreatorVault] = findPumpCreatorVault(sharingConfig);
  const [pumpEventAuthority] = findPumpEventAuthority();
  const [ammEventAuthority] = findAmmEventAuthority();
  const [coinCreatorVaultAuth] = findCoinCreatorVaultAuth(sharingConfig);
  const coinCreatorVaultAta = getAssociatedTokenAddressSync(
    WSOL_MINT,
    coinCreatorVaultAuth,
    true
  );

  const data = encodeU8(15);

  const keys: AccountMeta[] = [
    { pubkey: params.pool, isSigner: false, isWritable: false },
    { pubkey: params.mint, isSigner: false, isWritable: false },
    { pubkey: PFEE_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: pfeeEventAuthority, isSigner: false, isWritable: false },
    { pubkey: pumpGlobal, isSigner: false, isWritable: false },
    { pubkey: sharingConfig, isSigner: false, isWritable: true },
    { pubkey: bondingCurve, isSigner: false, isWritable: false },
    { pubkey: pumpCreatorVault, isSigner: false, isWritable: true },
    { pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: PUMP_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: pumpEventAuthority, isSigner: false, isWritable: false },
    { pubkey: PUMP_AMM_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: ammEventAuthority, isSigner: false, isWritable: false },
    { pubkey: WSOL_MINT, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: coinCreatorVaultAuth, isSigner: false, isWritable: true },
    { pubkey: coinCreatorVaultAta, isSigner: false, isWritable: true },
  ];

  return new TransactionInstruction({ keys, programId, data });
}

export interface StakeOnBehalfParams {
  /** Pool address */
  pool: PublicKey;
  /** Token mint */
  mint: PublicKey;
  /** Staker (signer, pays rent and provides tokens) */
  staker: PublicKey;
  /** Beneficiary (receives staking position, does NOT sign) */
  beneficiary: PublicKey;
  /** Staker's token account (source of tokens) */
  stakerTokenAccount: PublicKey;
  /** Amount to stake */
  amount: bigint | number;
  /** Token program (SPL Token or Token 2022) */
  tokenProgram: PublicKey;
  /** Include PoolMetadata PDA to increment member_count */
  includeMetadata?: boolean;
  programId?: PublicKey;
}

/** Build a StakeOnBehalf instruction */
export function createStakeOnBehalfInstruction(
  params: StakeOnBehalfParams
): TransactionInstruction {
  const programId = params.programId ?? PROGRAM_ID;
  const [beneficiaryStake] = findUserStakeAddress(
    params.pool,
    params.beneficiary,
    programId
  );
  const [tokenVault] = findTokenVaultAddress(params.pool, programId);

  const data = Buffer.concat([encodeU8(16), encodeU64(params.amount)]);

  const keys: AccountMeta[] = [
    { pubkey: params.pool, isSigner: false, isWritable: true },
    { pubkey: beneficiaryStake, isSigner: false, isWritable: true },
    { pubkey: tokenVault, isSigner: false, isWritable: true },
    { pubkey: params.stakerTokenAccount, isSigner: false, isWritable: true },
    { pubkey: params.mint, isSigner: false, isWritable: false },
    { pubkey: params.staker, isSigner: true, isWritable: true },
    { pubkey: params.beneficiary, isSigner: false, isWritable: true },
    { pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: params.tokenProgram, isSigner: false, isWritable: false },
  ];

  if (params.includeMetadata) {
    const [metadata] = findPoolMetadataAddress(params.pool, programId);
    keys.push({ pubkey: metadata, isSigner: false, isWritable: true });
  }

  return new TransactionInstruction({ keys, programId, data });
}

export interface FixStakeAccountParams {
  /** Pool address */
  pool: PublicKey;
  /** User stake account PDA */
  userStake: PublicKey;
  /** Program upgrade authority (signer) */
  upgradeAuthority: PublicKey;
  /** ProgramData account */
  programData: PublicKey;
  /** Corrected exp_start_factor */
  newExpStartFactor: bigint;
  /** Corrected reward_debt */
  newRewardDebt: bigint;
  programId?: PublicKey;
}

/** Build a FixStakeAccount instruction (program upgrade authority only) */
export function createFixStakeAccountInstruction(
  params: FixStakeAccountParams
): TransactionInstruction {
  const programId = params.programId ?? PROGRAM_ID;

  const data = Buffer.concat([
    encodeU8(17),
    encodeU128(params.newExpStartFactor),
    encodeU128(params.newRewardDebt),
  ]);

  const keys: AccountMeta[] = [
    { pubkey: params.pool, isSigner: false, isWritable: true },
    { pubkey: params.userStake, isSigner: false, isWritable: true },
    { pubkey: params.upgradeAuthority, isSigner: true, isWritable: false },
    { pubkey: params.programData, isSigner: false, isWritable: false },
  ];

  return new TransactionInstruction({ keys, programId, data });
}
