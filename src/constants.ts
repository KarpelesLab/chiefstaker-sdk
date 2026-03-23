import { PublicKey } from "@solana/web3.js";

/** ChiefStaker program ID */
export const PROGRAM_ID = new PublicKey(
  "3Ecf8gyRURyrBtGHS1XAVXyQik5PqgDch4VkxrH4ECcr"
);

/** SPL Token program ID */
export const TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
);

/** Token 2022 program ID */
export const TOKEN_2022_PROGRAM_ID = new PublicKey(
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
);

/** System program ID */
export const SYSTEM_PROGRAM_ID = new PublicKey(
  "11111111111111111111111111111111"
);

/** Rent sysvar */
export const RENT_SYSVAR_ID = new PublicKey(
  "SysvarRent111111111111111111111111111111111"
);

/** Associated Token Program */
export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
);

/** Wrapped SOL mint */
export const WSOL_MINT = new PublicKey(
  "So11111111111111111111111111111111111111112"
);

/** pfee program */
export const PFEE_PROGRAM_ID = new PublicKey(
  "pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ"
);

/** Pump.fun program */
export const PUMP_PROGRAM_ID = new PublicKey(
  "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"
);

/** Pump AMM program */
export const PUMP_AMM_PROGRAM_ID = new PublicKey(
  "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA"
);

/** Metaplex Token Metadata program */
export const METAPLEX_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);

// PDA seeds
export const POOL_SEED = Buffer.from("pool");
export const TOKEN_VAULT_SEED = Buffer.from("token_vault");
export const STAKE_SEED = Buffer.from("stake");
export const METADATA_SEED = Buffer.from("metadata");

// Account discriminators
export const STAKING_POOL_DISCRIMINATOR = Buffer.from([
  0xc7, 0x5f, 0x7e, 0x2d, 0x3b, 0x1a, 0x9c, 0x4e,
]);
export const USER_STAKE_DISCRIMINATOR = Buffer.from([
  0xa3, 0x8b, 0x5d, 0x2f, 0x7c, 0x4a, 0x1e, 0x9d,
]);
export const POOL_METADATA_DISCRIMINATOR = Buffer.from([
  0xd4, 0x2a, 0x8f, 0x6b, 0x51, 0x3c, 0xe7, 0x90,
]);

/** WAD = 10^18, used for fixed-point math */
export const WAD = BigInt("1000000000000000000");
