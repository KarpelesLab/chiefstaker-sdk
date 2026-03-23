/** ChiefStaker program error codes */
export enum ChiefStakerError {
  InvalidInstruction = 6000,
  AlreadyInitialized = 6001,
  NotInitialized = 6002,
  InvalidPoolMint = 6003,
  InvalidTokenVault = 6004,
  InvalidRewardVault = 6005,
  InvalidAuthority = 6006,
  InvalidOwner = 6007,
  InvalidPool = 6008,
  InvalidPDA = 6009,
  InsufficientStakeBalance = 6010,
  InsufficientRewardBalance = 6011,
  MathOverflow = 6012,
  MathUnderflow = 6013,
  ZeroAmount = 6014,
  InvalidTau = 6015,
  PoolRequiresSync = 6016,
  InvalidMintProgram = 6017,
  MissingRequiredSigner = 6018,
  AccountDataTooSmall = 6019,
  InvalidAccountOwner = 6020,
  BelowMinimumStake = 6021,
  StakeLocked = 6022,
  CooldownNotElapsed = 6023,
  CooldownRequired = 6024,
  NoPendingUnstakeRequest = 6025,
  PendingUnstakeRequestExists = 6026,
  AuthorityRenounced = 6027,
  CooldownNotConfigured = 6028,
  SettingExceedsMaximum = 6029,
  AccountNotEmpty = 6030,
  InvalidTokenProgram = 6031,
  UnsupportedMintExtension = 6032,
  MissingSystemProgram = 6033,
  RewardDebtExceedsBound = 6034,
}

const ERROR_MESSAGES: Record<number, string> = {
  6000: "Invalid instruction data",
  6001: "Account already initialized",
  6002: "Account not initialized",
  6003: "Invalid pool mint",
  6004: "Invalid token vault",
  6005: "Invalid reward vault",
  6006: "Invalid authority",
  6007: "Invalid owner",
  6008: "Invalid pool",
  6009: "Invalid PDA",
  6010: "Insufficient stake balance",
  6011: "Insufficient reward balance",
  6012: "Math overflow",
  6013: "Math underflow",
  6014: "Zero amount not allowed",
  6015: "Invalid tau value",
  6016: "Pool requires sync before operation",
  6017: "Invalid mint - must be Token or Token 2022",
  6018: "Missing required signer",
  6019: "Account data too small",
  6020: "Invalid account owner",
  6021: "Stake amount below pool minimum",
  6022: "Stake is locked - lock duration has not elapsed",
  6023: "Unstake cooldown period has not elapsed",
  6024: "Pool requires RequestUnstake flow, not direct Unstake",
  6025: "No pending unstake request",
  6026: "Must cancel existing unstake request first",
  6027: "Authority has been renounced",
  6028: "Pool has no cooldown configured - use direct Unstake instead",
  6029: "Setting value exceeds maximum allowed",
  6030: "User stake account still has balance or pending requests",
  6031: "Invalid token program",
  6032: "Token mint has a dangerous extension (PermanentDelegate, TransferHook, etc.)",
  6033: "System program required for legacy account reallocation",
  6034: "New total_reward_debt exceeds maximum accumulated rewards",
};

/** Parse a ChiefStaker program error from a transaction error */
export function parseChiefStakerError(
  errorCode: number
): { code: ChiefStakerError; name: string; message: string } | null {
  const name = ChiefStakerError[errorCode];
  if (!name) return null;
  return {
    code: errorCode as ChiefStakerError,
    name,
    message: ERROR_MESSAGES[errorCode] ?? "Unknown error",
  };
}

/**
 * Extract the custom error code from a Solana SendTransactionError.
 * Returns the parsed error or null if not a ChiefStaker error.
 */
export function extractProgramError(
  error: unknown
): { code: ChiefStakerError; name: string; message: string } | null {
  if (!error || typeof error !== "object") return null;

  // Solana errors embed InstructionError as [index, { Custom: code }]
  const err = error as Record<string, unknown>;
  const logs = err.logs as string[] | undefined;
  if (logs) {
    for (const log of logs) {
      const match = log.match(/custom program error: 0x([0-9a-fA-F]+)/);
      if (match) {
        const code = parseInt(match[1], 16);
        return parseChiefStakerError(code);
      }
    }
  }

  // Try direct error code extraction
  const message = err.message as string | undefined;
  if (message) {
    const match = message.match(/custom program error: 0x([0-9a-fA-F]+)/);
    if (match) {
      const code = parseInt(match[1], 16);
      return parseChiefStakerError(code);
    }
  }

  return null;
}
