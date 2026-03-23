// Client
export { ChiefStakerClient } from "./client.js";
export type { WalletAdapter } from "./client.js";

// Constants
export {
  PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  SYSTEM_PROGRAM_ID,
  RENT_SYSVAR_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  WSOL_MINT,
  PFEE_PROGRAM_ID,
  PUMP_PROGRAM_ID,
  PUMP_AMM_PROGRAM_ID,
  METAPLEX_PROGRAM_ID,
  POOL_SEED,
  TOKEN_VAULT_SEED,
  STAKE_SEED,
  METADATA_SEED,
  STAKING_POOL_DISCRIMINATOR,
  USER_STAKE_DISCRIMINATOR,
  POOL_METADATA_DISCRIMINATOR,
  WAD,
} from "./constants.js";

// PDA derivation
export {
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

// Types
export type { StakingPool, UserStake, PoolMetadata } from "./types.js";

// Account deserialization & fetching
export {
  deserializeStakingPool,
  deserializeUserStake,
  deserializePoolMetadata,
  fetchStakingPool,
  fetchStakingPoolByAddress,
  fetchUserStake,
  fetchUserStakeByAddress,
  fetchPoolMetadata,
  fetchAllStakingPools,
  fetchUserStakesByPool,
  fetchUserStakesByOwner,
} from "./accounts.js";

// Instruction builders
export {
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
export type {
  InitializePoolParams,
  StakeParams,
  UnstakeParams,
  ClaimRewardsParams,
  DepositRewardsParams,
  SyncPoolParams,
  SyncRewardsParams,
  UpdatePoolSettingsParams,
  TransferAuthorityParams,
  RequestUnstakeParams,
  CompleteUnstakeParams,
  CancelUnstakeRequestParams,
  CloseStakeAccountParams,
  SetPoolMetadataParams,
  TakeFeeOwnershipParams,
  StakeOnBehalfParams,
  FixStakeAccountParams,
} from "./instructions.js";

// Errors
export {
  ChiefStakerError,
  parseChiefStakerError,
  extractProgramError,
} from "./errors.js";

// Math
export {
  wadMul,
  wadDiv,
  expWad,
  expNegWad,
  expNegTimeRatio,
  calculateUserWeightedStake,
  syncExpStartFactor,
  calculatePendingRewards,
} from "./math.js";
