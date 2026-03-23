import { PublicKey } from "@solana/web3.js";
import {
  PROGRAM_ID,
  POOL_SEED,
  TOKEN_VAULT_SEED,
  STAKE_SEED,
  METADATA_SEED,
  PFEE_PROGRAM_ID,
  PUMP_PROGRAM_ID,
  PUMP_AMM_PROGRAM_ID,
} from "./constants.js";

/** Derive the pool PDA for a given mint. Seeds: ["pool", mint] */
export function findPoolAddress(
  mint: PublicKey,
  programId: PublicKey = PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [POOL_SEED, mint.toBuffer()],
    programId
  );
}

/** Derive the token vault PDA for a given pool. Seeds: ["token_vault", pool] */
export function findTokenVaultAddress(
  pool: PublicKey,
  programId: PublicKey = PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [TOKEN_VAULT_SEED, pool.toBuffer()],
    programId
  );
}

/** Derive the user stake PDA. Seeds: ["stake", pool, owner] */
export function findUserStakeAddress(
  pool: PublicKey,
  owner: PublicKey,
  programId: PublicKey = PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [STAKE_SEED, pool.toBuffer(), owner.toBuffer()],
    programId
  );
}

/** Derive the pool metadata PDA. Seeds: ["metadata", pool] */
export function findPoolMetadataAddress(
  pool: PublicKey,
  programId: PublicKey = PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [METADATA_SEED, pool.toBuffer()],
    programId
  );
}

/** Derive the pfee event authority PDA. Seeds: ["__event_authority"] */
export function findPfeeEventAuthority(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("__event_authority")],
    PFEE_PROGRAM_ID
  );
}

/** Derive the pump global PDA. Seeds: ["global"] */
export function findPumpGlobal(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("global")],
    PUMP_PROGRAM_ID
  );
}

/** Derive the pfee sharing config PDA. Seeds: ["sharing-config", mint] */
export function findSharingConfig(mint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("sharing-config"), mint.toBuffer()],
    PFEE_PROGRAM_ID
  );
}

/** Derive the pump bonding curve PDA. Seeds: ["bonding-curve", mint] */
export function findBondingCurve(mint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("bonding-curve"), mint.toBuffer()],
    PUMP_PROGRAM_ID
  );
}

/** Derive the pump creator vault PDA. Seeds: ["creator-vault", sharingConfig] */
export function findPumpCreatorVault(
  sharingConfig: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("creator-vault"), sharingConfig.toBuffer()],
    PUMP_PROGRAM_ID
  );
}

/** Derive the pump event authority PDA. Seeds: ["__event_authority"] */
export function findPumpEventAuthority(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("__event_authority")],
    PUMP_PROGRAM_ID
  );
}

/** Derive the pump AMM event authority PDA. Seeds: ["__event_authority"] */
export function findAmmEventAuthority(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("__event_authority")],
    PUMP_AMM_PROGRAM_ID
  );
}

/** Derive the AMM creator vault authority PDA. Seeds: ["creator_vault", sharingConfig] */
export function findCoinCreatorVaultAuth(
  sharingConfig: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("creator_vault"), sharingConfig.toBuffer()],
    PUMP_AMM_PROGRAM_ID
  );
}
