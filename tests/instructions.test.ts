import { describe, it, expect } from "vitest";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
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
  findPoolAddress,
  findTokenVaultAddress,
  findUserStakeAddress,
  findPoolMetadataAddress,
  PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  SYSTEM_PROGRAM_ID,
  RENT_SYSVAR_ID,
  PFEE_PROGRAM_ID,
  PUMP_PROGRAM_ID,
  PUMP_AMM_PROGRAM_ID,
  WSOL_MINT,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "../src/index.js";

const mint = Keypair.generate().publicKey;
const owner = Keypair.generate().publicKey;
const authority = Keypair.generate().publicKey;
const [pool] = findPoolAddress(mint);
const [tokenVault] = findTokenVaultAddress(pool);
const [userStake] = findUserStakeAddress(pool, owner);
const userTokenAccount = Keypair.generate().publicKey;

describe("initializePool instruction", () => {
  it("encodes discriminator 0 and tauSeconds", () => {
    const ix = createInitializePoolInstruction({
      mint,
      authority,
      tauSeconds: 2592000n,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
    });

    expect(ix.programId.equals(PROGRAM_ID)).toBe(true);
    expect(ix.data[0]).toBe(0); // discriminator
    expect(ix.data.readBigUInt64LE(1)).toBe(2592000n);
    expect(ix.data.length).toBe(9); // 1 + 8
  });

  it("includes correct accounts", () => {
    const ix = createInitializePoolInstruction({
      mint,
      authority,
      tauSeconds: 2592000n,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
    });

    expect(ix.keys.length).toBe(7);
    // pool (writable)
    expect(ix.keys[0].pubkey.equals(pool)).toBe(true);
    expect(ix.keys[0].isWritable).toBe(true);
    expect(ix.keys[0].isSigner).toBe(false);
    // mint (readonly)
    expect(ix.keys[1].pubkey.equals(mint)).toBe(true);
    expect(ix.keys[1].isWritable).toBe(false);
    // tokenVault (writable)
    expect(ix.keys[2].pubkey.equals(tokenVault)).toBe(true);
    expect(ix.keys[2].isWritable).toBe(true);
    // authority (writable, signer)
    expect(ix.keys[3].pubkey.equals(authority)).toBe(true);
    expect(ix.keys[3].isSigner).toBe(true);
    expect(ix.keys[3].isWritable).toBe(true);
    // system program
    expect(ix.keys[4].pubkey.equals(SYSTEM_PROGRAM_ID)).toBe(true);
    // token program
    expect(ix.keys[5].pubkey.equals(TOKEN_2022_PROGRAM_ID)).toBe(true);
    // rent sysvar
    expect(ix.keys[6].pubkey.equals(RENT_SYSVAR_ID)).toBe(true);
  });

  it("appends remaining accounts", () => {
    const extra = Keypair.generate().publicKey;
    const ix = createInitializePoolInstruction({
      mint,
      authority,
      tauSeconds: 2592000n,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      remainingAccounts: [
        { pubkey: extra, isSigner: false, isWritable: false },
      ],
    });

    expect(ix.keys.length).toBe(8);
    expect(ix.keys[7].pubkey.equals(extra)).toBe(true);
  });

  it("accepts number for tauSeconds", () => {
    const ix = createInitializePoolInstruction({
      mint,
      authority,
      tauSeconds: 86400,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
    });

    expect(ix.data.readBigUInt64LE(1)).toBe(86400n);
  });
});

describe("stake instruction", () => {
  it("encodes discriminator 1 and amount", () => {
    const ix = createStakeInstruction({
      pool,
      mint,
      owner,
      userTokenAccount,
      amount: 1_000_000n,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
    });

    expect(ix.data[0]).toBe(1);
    expect(ix.data.readBigUInt64LE(1)).toBe(1_000_000n);
    expect(ix.data.length).toBe(9);
  });

  it("has 8 accounts without metadata", () => {
    const ix = createStakeInstruction({
      pool,
      mint,
      owner,
      userTokenAccount,
      amount: 1_000_000n,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
    });

    expect(ix.keys.length).toBe(8);
    expect(ix.keys[0].pubkey.equals(pool)).toBe(true);
    expect(ix.keys[1].pubkey.equals(userStake)).toBe(true);
    expect(ix.keys[2].pubkey.equals(tokenVault)).toBe(true);
    expect(ix.keys[3].pubkey.equals(userTokenAccount)).toBe(true);
    expect(ix.keys[4].pubkey.equals(mint)).toBe(true);
    expect(ix.keys[5].pubkey.equals(owner)).toBe(true);
    expect(ix.keys[5].isSigner).toBe(true);
    expect(ix.keys[6].pubkey.equals(SYSTEM_PROGRAM_ID)).toBe(true);
    expect(ix.keys[7].pubkey.equals(TOKEN_2022_PROGRAM_ID)).toBe(true);
  });

  it("appends metadata account when includeMetadata is true", () => {
    const [metadata] = findPoolMetadataAddress(pool);
    const ix = createStakeInstruction({
      pool,
      mint,
      owner,
      userTokenAccount,
      amount: 1_000_000n,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      includeMetadata: true,
    });

    expect(ix.keys.length).toBe(9);
    expect(ix.keys[8].pubkey.equals(metadata)).toBe(true);
    expect(ix.keys[8].isWritable).toBe(true);
  });
});

describe("unstake instruction", () => {
  it("encodes discriminator 2 and amount", () => {
    const ix = createUnstakeInstruction({
      pool,
      mint,
      owner,
      userTokenAccount,
      amount: 500_000n,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
    });

    expect(ix.data[0]).toBe(2);
    expect(ix.data.readBigUInt64LE(1)).toBe(500_000n);
    expect(ix.keys.length).toBe(7);
  });

  it("does not include system program", () => {
    const ix = createUnstakeInstruction({
      pool,
      mint,
      owner,
      userTokenAccount,
      amount: 500_000n,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
    });

    const hasSystemProgram = ix.keys.some((k) =>
      k.pubkey.equals(SYSTEM_PROGRAM_ID)
    );
    expect(hasSystemProgram).toBe(false);
  });
});

describe("claimRewards instruction", () => {
  it("encodes discriminator 3 with no args", () => {
    const ix = createClaimRewardsInstruction({ pool, owner });

    expect(ix.data[0]).toBe(3);
    expect(ix.data.length).toBe(1);
    expect(ix.keys.length).toBe(3);
  });

  it("owner is writable signer", () => {
    const ix = createClaimRewardsInstruction({ pool, owner });

    expect(ix.keys[2].pubkey.equals(owner)).toBe(true);
    expect(ix.keys[2].isSigner).toBe(true);
    expect(ix.keys[2].isWritable).toBe(true);
  });
});

describe("depositRewards instruction", () => {
  it("encodes discriminator 4 and lamport amount", () => {
    const depositor = Keypair.generate().publicKey;
    const ix = createDepositRewardsInstruction({
      pool,
      depositor,
      amount: 1_000_000_000n,
    });

    expect(ix.data[0]).toBe(4);
    expect(ix.data.readBigUInt64LE(1)).toBe(1_000_000_000n);
    expect(ix.keys.length).toBe(3);
    expect(ix.keys[1].pubkey.equals(depositor)).toBe(true);
    expect(ix.keys[1].isSigner).toBe(true);
  });
});

describe("syncPool instruction", () => {
  it("encodes discriminator 5 with single account", () => {
    const ix = createSyncPoolInstruction({ pool });

    expect(ix.data[0]).toBe(5);
    expect(ix.data.length).toBe(1);
    expect(ix.keys.length).toBe(1);
    expect(ix.keys[0].pubkey.equals(pool)).toBe(true);
    expect(ix.keys[0].isWritable).toBe(true);
  });
});

describe("syncRewards instruction", () => {
  it("encodes discriminator 6 with single account", () => {
    const ix = createSyncRewardsInstruction({ pool });

    expect(ix.data[0]).toBe(6);
    expect(ix.data.length).toBe(1);
    expect(ix.keys.length).toBe(1);
  });
});

describe("updatePoolSettings instruction", () => {
  it("encodes discriminator 7 with all None options", () => {
    const ix = createUpdatePoolSettingsInstruction({ pool, authority });

    expect(ix.data[0]).toBe(7);
    // 3 Option<u64>: each None is 1 byte (0x00)
    expect(ix.data.length).toBe(1 + 3);
    expect(ix.data[1]).toBe(0); // None
    expect(ix.data[2]).toBe(0); // None
    expect(ix.data[3]).toBe(0); // None
  });

  it("encodes Some values correctly", () => {
    const ix = createUpdatePoolSettingsInstruction({
      pool,
      authority,
      minStakeAmount: 100n,
      lockDurationSeconds: 86400n,
      unstakeCooldownSeconds: null, // explicitly None
    });

    expect(ix.data[0]).toBe(7);
    // Some(100): 0x01 + 8 bytes
    expect(ix.data[1]).toBe(1);
    expect(ix.data.readBigUInt64LE(2)).toBe(100n);
    // Some(86400): 0x01 + 8 bytes
    expect(ix.data[10]).toBe(1);
    expect(ix.data.readBigUInt64LE(11)).toBe(86400n);
    // None
    expect(ix.data[19]).toBe(0);
    expect(ix.data.length).toBe(1 + 9 + 9 + 1);
  });

  it("authority is signer but not writable", () => {
    const ix = createUpdatePoolSettingsInstruction({ pool, authority });

    expect(ix.keys[1].pubkey.equals(authority)).toBe(true);
    expect(ix.keys[1].isSigner).toBe(true);
    expect(ix.keys[1].isWritable).toBe(false);
  });
});

describe("transferAuthority instruction", () => {
  it("encodes discriminator 8 and new authority pubkey", () => {
    const newAuth = Keypair.generate().publicKey;
    const ix = createTransferAuthorityInstruction({
      pool,
      authority,
      newAuthority: newAuth,
    });

    expect(ix.data[0]).toBe(8);
    expect(ix.data.length).toBe(1 + 32);

    const encodedPubkey = new PublicKey(ix.data.subarray(1, 33));
    expect(encodedPubkey.equals(newAuth)).toBe(true);
  });

  it("can encode renounce (all zeros)", () => {
    const ix = createTransferAuthorityInstruction({
      pool,
      authority,
      newAuthority: PublicKey.default,
    });

    const encodedPubkey = new PublicKey(ix.data.subarray(1, 33));
    expect(encodedPubkey.equals(PublicKey.default)).toBe(true);
  });
});

describe("requestUnstake instruction", () => {
  it("encodes discriminator 9 and amount", () => {
    const ix = createRequestUnstakeInstruction({
      pool,
      owner,
      amount: 250_000n,
    });

    expect(ix.data[0]).toBe(9);
    expect(ix.data.readBigUInt64LE(1)).toBe(250_000n);
    expect(ix.keys.length).toBe(3);
  });

  it("owner is signer but not writable", () => {
    const ix = createRequestUnstakeInstruction({
      pool,
      owner,
      amount: 250_000n,
    });

    expect(ix.keys[2].pubkey.equals(owner)).toBe(true);
    expect(ix.keys[2].isSigner).toBe(true);
    expect(ix.keys[2].isWritable).toBe(false);
  });
});

describe("completeUnstake instruction", () => {
  it("encodes discriminator 10 with no args", () => {
    const ix = createCompleteUnstakeInstruction({
      pool,
      mint,
      owner,
      userTokenAccount,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
    });

    expect(ix.data[0]).toBe(10);
    expect(ix.data.length).toBe(1);
    expect(ix.keys.length).toBe(7);
  });
});

describe("cancelUnstakeRequest instruction", () => {
  it("encodes discriminator 11 with no args", () => {
    const ix = createCancelUnstakeRequestInstruction({ pool, owner });

    expect(ix.data[0]).toBe(11);
    expect(ix.data.length).toBe(1);
    expect(ix.keys.length).toBe(3);
  });

  it("pool is not writable", () => {
    const ix = createCancelUnstakeRequestInstruction({ pool, owner });

    expect(ix.keys[0].pubkey.equals(pool)).toBe(true);
    expect(ix.keys[0].isWritable).toBe(false);
  });
});

describe("closeStakeAccount instruction", () => {
  it("encodes discriminator 12 with no args", () => {
    const ix = createCloseStakeAccountInstruction({ pool, owner });

    expect(ix.data[0]).toBe(12);
    expect(ix.data.length).toBe(1);
    expect(ix.keys.length).toBe(3);
  });

  it("owner receives rent refund (writable signer)", () => {
    const ix = createCloseStakeAccountInstruction({ pool, owner });

    expect(ix.keys[2].pubkey.equals(owner)).toBe(true);
    expect(ix.keys[2].isSigner).toBe(true);
    expect(ix.keys[2].isWritable).toBe(true);
  });
});

describe("setPoolMetadata instruction", () => {
  it("encodes discriminator 14 with no args", () => {
    const payer = Keypair.generate().publicKey;
    const ix = createSetPoolMetadataInstruction({ pool, mint, payer });

    expect(ix.data[0]).toBe(14);
    expect(ix.data.length).toBe(1);
    expect(ix.keys.length).toBe(5);
  });

  it("metadata PDA is derived correctly", () => {
    const payer = Keypair.generate().publicKey;
    const [metadata] = findPoolMetadataAddress(pool);
    const ix = createSetPoolMetadataInstruction({ pool, mint, payer });

    expect(ix.keys[1].pubkey.equals(metadata)).toBe(true);
    expect(ix.keys[1].isWritable).toBe(true);
  });
});

describe("takeFeeOwnership instruction", () => {
  it("encodes discriminator 15 with 18 accounts", () => {
    const ix = createTakeFeeOwnershipInstruction({ pool, mint });

    expect(ix.data[0]).toBe(15);
    expect(ix.data.length).toBe(1);
    expect(ix.keys.length).toBe(18);
  });

  it("includes all expected program IDs", () => {
    const ix = createTakeFeeOwnershipInstruction({ pool, mint });

    const pubkeys = ix.keys.map((k) => k.pubkey.toBase58());
    expect(pubkeys).toContain(PFEE_PROGRAM_ID.toBase58());
    expect(pubkeys).toContain(PUMP_PROGRAM_ID.toBase58());
    expect(pubkeys).toContain(PUMP_AMM_PROGRAM_ID.toBase58());
    expect(pubkeys).toContain(WSOL_MINT.toBase58());
    expect(pubkeys).toContain(TOKEN_PROGRAM_ID.toBase58());
    expect(pubkeys).toContain(ASSOCIATED_TOKEN_PROGRAM_ID.toBase58());
    expect(pubkeys).toContain(SYSTEM_PROGRAM_ID.toBase58());
  });
});

describe("stakeOnBehalf instruction", () => {
  it("encodes discriminator 16 and amount", () => {
    const staker = Keypair.generate().publicKey;
    const beneficiary = Keypair.generate().publicKey;
    const stakerTokenAccount = Keypair.generate().publicKey;
    const ix = createStakeOnBehalfInstruction({
      pool,
      mint,
      staker,
      beneficiary,
      stakerTokenAccount,
      amount: 2_000_000n,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
    });

    expect(ix.data[0]).toBe(16);
    expect(ix.data.readBigUInt64LE(1)).toBe(2_000_000n);
    expect(ix.keys.length).toBe(9);
  });

  it("staker is signer, beneficiary is not", () => {
    const staker = Keypair.generate().publicKey;
    const beneficiary = Keypair.generate().publicKey;
    const stakerTokenAccount = Keypair.generate().publicKey;
    const ix = createStakeOnBehalfInstruction({
      pool,
      mint,
      staker,
      beneficiary,
      stakerTokenAccount,
      amount: 2_000_000n,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
    });

    // staker
    expect(ix.keys[5].pubkey.equals(staker)).toBe(true);
    expect(ix.keys[5].isSigner).toBe(true);
    // beneficiary
    expect(ix.keys[6].pubkey.equals(beneficiary)).toBe(true);
    expect(ix.keys[6].isSigner).toBe(false);
  });

  it("derives beneficiary stake PDA, not staker", () => {
    const staker = Keypair.generate().publicKey;
    const beneficiary = Keypair.generate().publicKey;
    const stakerTokenAccount = Keypair.generate().publicKey;
    const [beneficiaryStake] = findUserStakeAddress(pool, beneficiary);
    const ix = createStakeOnBehalfInstruction({
      pool,
      mint,
      staker,
      beneficiary,
      stakerTokenAccount,
      amount: 2_000_000n,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
    });

    expect(ix.keys[1].pubkey.equals(beneficiaryStake)).toBe(true);
  });

  it("appends metadata when includeMetadata is true", () => {
    const staker = Keypair.generate().publicKey;
    const beneficiary = Keypair.generate().publicKey;
    const stakerTokenAccount = Keypair.generate().publicKey;
    const [metadata] = findPoolMetadataAddress(pool);
    const ix = createStakeOnBehalfInstruction({
      pool,
      mint,
      staker,
      beneficiary,
      stakerTokenAccount,
      amount: 2_000_000n,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      includeMetadata: true,
    });

    expect(ix.keys.length).toBe(10);
    expect(ix.keys[9].pubkey.equals(metadata)).toBe(true);
  });
});

describe("fixStakeAccount instruction", () => {
  it("encodes discriminator 17 and two u128 args", () => {
    const upgradeAuthority = Keypair.generate().publicKey;
    const programData = Keypair.generate().publicKey;
    const ix = createFixStakeAccountInstruction({
      pool,
      userStake,
      upgradeAuthority,
      programData,
      newExpStartFactor: 1_000_000_000_000_000_000n,
      newRewardDebt: 500_000_000_000_000_000n,
    });

    expect(ix.data[0]).toBe(17);
    expect(ix.data.length).toBe(1 + 16 + 16); // discriminator + 2 * u128
    expect(ix.keys.length).toBe(4);
  });

  it("encodes u128 values in little-endian", () => {
    const upgradeAuthority = Keypair.generate().publicKey;
    const programData = Keypair.generate().publicKey;
    const expFactor = (42n << 64n) + 123n;
    const rewardDebt = (7n << 64n) + 456n;
    const ix = createFixStakeAccountInstruction({
      pool,
      userStake,
      upgradeAuthority,
      programData,
      newExpStartFactor: expFactor,
      newRewardDebt: rewardDebt,
    });

    // Read back the u128s
    const lo1 = ix.data.readBigUInt64LE(1);
    const hi1 = ix.data.readBigUInt64LE(9);
    expect(lo1 + (hi1 << 64n)).toBe(expFactor);

    const lo2 = ix.data.readBigUInt64LE(17);
    const hi2 = ix.data.readBigUInt64LE(25);
    expect(lo2 + (hi2 << 64n)).toBe(rewardDebt);
  });
});

describe("custom programId override", () => {
  it("uses custom program ID when provided", () => {
    const customProgram = Keypair.generate().publicKey;
    const ix = createSyncPoolInstruction({
      pool,
      programId: customProgram,
    });

    expect(ix.programId.equals(customProgram)).toBe(true);
  });
});
