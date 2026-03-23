# @karpeleslab/chiefstaker-sdk

TypeScript SDK for the **ChiefStaker** time-weighted staking program on Solana.

ChiefStaker lets token holders stake SPL Token or Token 2022 assets and earn SOL
rewards distributed proportionally by a time-weighted formula. Newer stakers
start with near-zero weight that grows exponentially toward full weight over a
configurable time constant (tau).

**Program ID:** `3Ecf8gyRURyrBtGHS1XAVXyQik5PqgDch4VkxrH4ECcr`

**Staking UI:** `https://www.tibane.net/staking/<mint_address>`

## Installation

```bash
npm install @karpeleslab/chiefstaker-sdk @solana/web3.js
```

`@solana/web3.js` v1.90+ is a peer dependency.

## Quick start

```ts
import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import { ChiefStakerClient } from "@karpeleslab/chiefstaker-sdk";

const connection = new Connection("https://api.mainnet-beta.solana.com");
const client = new ChiefStakerClient(connection);

const mint = new PublicKey("YourTokenMint...");

// Fetch pool state
const pool = await client.getPool(mint);
console.log("Total staked:", pool.totalStaked);

// Fetch your stake
const [poolAddress] = client.findPoolAddress(mint);
const stake = await client.getUserStake(poolAddress, wallet.publicKey);
console.log("My stake:", stake?.amount);
```

## Usage

The SDK provides three layers you can use independently:

1. **`ChiefStakerClient`** — high-level class with account fetching, PDA
   derivation, instruction building, and transaction sending in one place.
2. **Instruction builders** — standalone `create*Instruction()` functions that
   return a `TransactionInstruction` for composing into your own transactions.
3. **Account helpers** — `fetch*()` and `deserialize*()` functions for reading
   on-chain state.

### Using the client

```ts
import { ChiefStakerClient } from "@karpeleslab/chiefstaker-sdk";

const client = new ChiefStakerClient(connection);
```

You can optionally pass a custom program ID as the second argument.

### Staking tokens

```ts
const tokenProgram = await client.detectTokenProgram(mint);
const [poolAddress] = client.findPoolAddress(mint);

const ix = client.stake({
  pool: poolAddress,
  mint,
  owner: wallet.publicKey,
  userTokenAccount: myTokenAccount,
  amount: 1_000_000n,
  tokenProgram,
  includeMetadata: true, // increment the pool's member count
});

await client.sendTransaction([ix], [keypair]);
```

### Unstaking tokens

Pools can be configured with or without an unstake cooldown. Check
`pool.unstakeCooldownSeconds` to determine which flow to use.

**Direct unstake** (when `unstakeCooldownSeconds === 0n`):

```ts
const ix = client.unstake({
  pool: poolAddress,
  mint,
  owner: wallet.publicKey,
  userTokenAccount: myTokenAccount,
  amount: 500_000n,
  tokenProgram,
});
```

**Cooldown unstake** (when `unstakeCooldownSeconds > 0n`):

```ts
// Step 1: Request unstake (starts the cooldown timer)
const requestIx = client.requestUnstake({
  pool: poolAddress,
  owner: wallet.publicKey,
  amount: 500_000n,
});

// Step 2: After cooldown elapses, complete the unstake
const completeIx = client.completeUnstake({
  pool: poolAddress,
  mint,
  owner: wallet.publicKey,
  userTokenAccount: myTokenAccount,
  tokenProgram,
});

// Optional: Cancel a pending request (tokens remain staked)
const cancelIx = client.cancelUnstakeRequest({
  pool: poolAddress,
  owner: wallet.publicKey,
});
```

### Claiming rewards

SOL rewards accrue based on your time-weighted stake. Claim them at any time:

```ts
const ix = client.claimRewards({
  pool: poolAddress,
  owner: wallet.publicKey,
});
```

### Depositing rewards

Anyone can deposit SOL rewards into a pool:

```ts
const ix = client.depositRewards({
  pool: poolAddress,
  depositor: wallet.publicKey,
  amount: 1_000_000_000n, // 1 SOL in lamports
});
```

### Pool administration

These operations require the pool authority to sign.

```ts
// Update pool settings
const ix = client.updatePoolSettings({
  pool: poolAddress,
  authority: authorityKeypair.publicKey,
  minStakeAmount: 100_000n,           // set minimum stake
  lockDurationSeconds: 86400n,         // 1 day lock after staking
  unstakeCooldownSeconds: 259200n,     // 3 day cooldown to unstake
});

// Transfer authority (set to PublicKey.default to renounce irreversibly)
const ix = client.transferAuthority({
  pool: poolAddress,
  authority: authorityKeypair.publicKey,
  newAuthority: newAuthorityPubkey,
});
```

### Permissionless cranks

These instructions can be called by anyone and require no special authority:

```ts
// Rebase pool to prevent overflow (call periodically)
const syncIx = client.syncPool(poolAddress);

// Sync SOL sent directly to the pool PDA (e.g., from pump.fun fees)
const syncRewardsIx = client.syncRewards(poolAddress);

// Set pool metadata for explorer display
const metaIx = client.setPoolMetadata({
  pool: poolAddress,
  mint,
  payer: wallet.publicKey,
});

// Claim pump.fun fee ownership for the pool
const feeIx = client.takeFeeOwnership({
  pool: poolAddress,
  mint,
});
```

### Staking on behalf of another user

Stake tokens for a beneficiary who doesn't need to sign:

```ts
const ix = client.stakeOnBehalf({
  pool: poolAddress,
  mint,
  staker: myKeypair.publicKey,        // pays rent and provides tokens
  beneficiary: recipientPubkey,        // receives the staking position
  stakerTokenAccount: myTokenAccount,
  amount: 1_000_000n,
  tokenProgram,
  includeMetadata: true,
});
```

### Closing a stake account

After fully unstaking and claiming all rewards, reclaim the rent:

```ts
const ix = client.closeStakeAccount({
  pool: poolAddress,
  owner: wallet.publicKey,
});
```

### Using with wallet adapters

The client works with any `@solana/wallet-adapter` compatible wallet:

```ts
const ix = client.stake({ /* ... */ });
await client.sendTransactionWithWallet([ix], wallet);
```

### Using standalone instruction builders

If you prefer to compose transactions yourself:

```ts
import {
  createStakeInstruction,
  createClaimRewardsInstruction,
} from "@karpeleslab/chiefstaker-sdk";
import { Transaction } from "@solana/web3.js";

const stakeIx = createStakeInstruction({
  pool: poolAddress,
  mint,
  owner: wallet.publicKey,
  userTokenAccount: myTokenAccount,
  amount: 1_000_000n,
  tokenProgram,
});

const claimIx = createClaimRewardsInstruction({
  pool: poolAddress,
  owner: wallet.publicKey,
});

// Combine into a single transaction
const tx = new Transaction().add(stakeIx, claimIx);
```

## Fetching accounts

### Single account fetches

```ts
import {
  fetchStakingPool,
  fetchUserStake,
  fetchPoolMetadata,
} from "@karpeleslab/chiefstaker-sdk";

// By mint address
const pool = await fetchStakingPool(connection, mint);

// By pool PDA address (if you already know it)
const pool = await client.getPoolByAddress(poolPda);

// User stake
const stake = await fetchUserStake(connection, poolAddress, ownerPubkey);

// Pool metadata
const meta = await fetchPoolMetadata(connection, poolAddress);
console.log(meta.name, meta.tags, meta.memberCount);
```

### Batch fetches

```ts
import {
  fetchAllStakingPools,
  fetchUserStakesByPool,
  fetchUserStakesByOwner,
} from "@karpeleslab/chiefstaker-sdk";

// All pools in the program
const allPools = await fetchAllStakingPools(connection);
for (const { address, account } of allPools) {
  console.log(address.toBase58(), account.totalStaked);
}

// All stakers in a specific pool
const stakers = await fetchUserStakesByPool(connection, poolAddress);

// All of a user's stakes across every pool
const myStakes = await fetchUserStakesByOwner(connection, wallet.publicKey);
```

### Raw deserialization

If you already have account data (e.g., from `getMultipleAccountsInfo`):

```ts
import {
  deserializeStakingPool,
  deserializeUserStake,
  deserializePoolMetadata,
} from "@karpeleslab/chiefstaker-sdk";

const accountInfo = await connection.getAccountInfo(poolAddress);
const pool = deserializeStakingPool(accountInfo.data);
```

## PDA derivation

All PDAs can be derived without network calls:

```ts
import {
  findPoolAddress,
  findTokenVaultAddress,
  findUserStakeAddress,
  findPoolMetadataAddress,
} from "@karpeleslab/chiefstaker-sdk";

const [pool, poolBump] = findPoolAddress(mint);               // ["pool", mint]
const [vault, vaultBump] = findTokenVaultAddress(pool);        // ["token_vault", pool]
const [stake, stakeBump] = findUserStakeAddress(pool, owner);  // ["stake", pool, owner]
const [meta, metaBump] = findPoolMetadataAddress(pool);        // ["metadata", pool]
```

Additional PDAs for pump.fun fee integration:

```ts
import {
  findSharingConfig,
  findBondingCurve,
  findPumpCreatorVault,
  findCoinCreatorVaultAuth,
} from "@karpeleslab/chiefstaker-sdk";

const [sharingConfig] = findSharingConfig(mint);
const [bondingCurve] = findBondingCurve(mint);
const [creatorVault] = findPumpCreatorVault(sharingConfig);
const [vaultAuth] = findCoinCreatorVaultAuth(sharingConfig);
```

## Error handling

Parse program errors from failed transactions:

```ts
import { extractProgramError, ChiefStakerError } from "@karpeleslab/chiefstaker-sdk";

try {
  await client.sendTransaction([ix], [keypair]);
} catch (err) {
  const parsed = extractProgramError(err);
  if (parsed) {
    console.error(`${parsed.name}: ${parsed.message}`);
    // e.g. "StakeLocked: Stake is locked - lock duration has not elapsed"

    if (parsed.code === ChiefStakerError.CooldownRequired) {
      // Use requestUnstake flow instead of direct unstake
    }
  }
}
```

## Account types

### StakingPool

| Field                       | Type         | Description                                           |
|-----------------------------|--------------|-------------------------------------------------------|
| `mint`                      | `PublicKey`  | Token mint address                                    |
| `tokenVault`                | `PublicKey`  | PDA holding staked tokens                             |
| `authority`                 | `PublicKey`  | Admin authority                                       |
| `totalStaked`               | `bigint`     | Total tokens staked                                   |
| `tauSeconds`                | `bigint`     | Time constant for weight curve (seconds)              |
| `baseTime`                  | `bigint`     | Base time for rebasing (Unix timestamp)               |
| `accRewardPerWeightedShare` | `bigint`     | Accumulated reward per weighted share (WAD-scaled)    |
| `lastUpdateTime`            | `bigint`     | Last reward update timestamp                          |
| `bump`                      | `number`     | PDA bump seed                                         |
| `lastSyncedLamports`        | `bigint`     | Last known lamport balance                            |
| `minStakeAmount`            | `bigint`     | Minimum stake amount (0 = no minimum)                 |
| `lockDurationSeconds`       | `bigint`     | Lock period after staking (0 = no lock)               |
| `unstakeCooldownSeconds`    | `bigint`     | Cooldown period for unstaking (0 = direct unstake)    |
| `initialBaseTime`           | `bigint`     | Original base_time before rebasing                    |
| `totalRewardDebt`           | `bigint`     | Sum of all users' reward_debt (WAD-scaled)            |
| `totalResidualUnpaid`       | `bigint`     | Lamports owed to fully-unstaked users                 |

### UserStake

| Field                 | Type        | Description                                       |
|-----------------------|-------------|---------------------------------------------------|
| `owner`               | `PublicKey` | Stake owner                                       |
| `pool`                | `PublicKey` | Pool this stake belongs to                        |
| `amount`              | `bigint`    | Tokens staked                                     |
| `stakeTime`           | `bigint`    | When the stake began (Unix timestamp)             |
| `expStartFactor`      | `bigint`    | Exponential factor at stake time (WAD-scaled)     |
| `rewardDebt`          | `bigint`    | Reward debt snapshot (WAD-scaled)                 |
| `bump`                | `number`    | PDA bump seed                                     |
| `unstakeRequestAmount`| `bigint`    | Pending unstake amount (0 = none)                 |
| `unstakeRequestTime`  | `bigint`    | When unstake was requested                        |
| `lastStakeTime`       | `bigint`    | Most recent deposit timestamp                     |
| `baseTimeSnapshot`    | `bigint`    | Pool base_time when last calibrated               |
| `totalRewardsClaimed` | `bigint`    | Cumulative SOL claimed (lamports)                 |
| `claimedRewardsWad`   | `bigint`    | Cumulative WAD-scaled rewards paid                |

### PoolMetadata

| Field         | Type        | Description                |
|---------------|-------------|----------------------------|
| `pool`        | `PublicKey` | Back-reference to pool     |
| `name`        | `string`    | Pool display name          |
| `tags`        | `string[]`  | Tags (e.g. #stakingpool)   |
| `url`         | `string`    | URL                        |
| `memberCount` | `bigint`    | Active staker count        |
| `bump`        | `number`    | PDA bump seed              |

## Constants

```ts
import {
  PROGRAM_ID,              // ChiefStaker program
  TOKEN_PROGRAM_ID,        // SPL Token
  TOKEN_2022_PROGRAM_ID,   // Token 2022
  WAD,                     // 10^18 (fixed-point scale)
} from "@karpeleslab/chiefstaker-sdk";
```

## How time-weighted staking works

ChiefStaker uses an exponential decay curve for staking weight:

```
weight = stake_amount * (1 - e^(-age / tau))
```

- **New stakers** start with ~0% weight
- **At 1 tau** (e.g., 30 days): ~63% weight
- **At 3 tau**: ~95% weight
- **At 5 tau**: ~99% weight

This means long-term stakers earn proportionally more rewards than recent
stakers, incentivizing commitment. When adding to an existing stake, the
maturity percentage is preserved through blending.

## License

MIT
