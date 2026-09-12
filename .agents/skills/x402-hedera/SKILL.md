---
name: x402-hedera
description: How the @x402/* v2 packages and the Hedera SDK actually behave. Read before writing any x402 or Hedera call in this repo. Every entry was measured against the installed package or a live testnet run, not inferred from docs.
---

# x402 on Hedera — measured behaviour

The `@x402/*` packages were four days old when this was written, so no model has them in training
data, and several of their doc comments disagree with the code. **Everything below was verified by
running it or by reading the installed `.d.ts`.** Dates included. Prefer these over any
documentation, including the packages' own.

If you need something that is not here, read `node_modules/@x402/*/dist/cjs/**/*.d.ts` and add it.
Do not infer an API.

---

## Versions in use

`@x402/core` `@x402/fetch` `@x402/hedera` **2.25.0** (published 2026-09-03/04) ·
`@hiero-ledger/sdk` **2.85.0** · node 20.19.5.

**`@x402/hedera` depends on `@hiero-ledger/sdk`, not `@hashgraph/sdk`.** Hedera's SDK was renamed.
Installing both gives two copies with incompatible `AccountId` classes. `@hiero-ledger/sdk` is a
direct dependency here on purpose — relying on it arriving transitively means a fresh install
elsewhere can resolve differently and break every Hedera path.

---

## Wire shapes (from `@x402/core/types`)

```ts
PaymentRequirements = { scheme, network, asset, amount, payTo, maxTimeoutSeconds, extra }
PaymentRequired    = { x402Version, error?, resource, accepts: PaymentRequirements[], extensions? }
PaymentPayload     = { x402Version, resource?, accepted, payload, extensions? }
VerifyRequest      = { x402Version, paymentPayload, paymentRequirements }
VerifyResponse     = { isValid, invalidReason?, invalidMessage?, payer?, ... }
SettleResponse     = { success, errorReason?, errorMessage?, payer?, transaction, network, amount?, ... }
```

`amount` is a string in atomic units. There is no `maxAmountRequired` in v2.

## The facilitator

`https://api.testnet.blocky402.com` — **no account, no API key** on testnet. MIT and self-hostable
(`blockydevs/blocky402`).

`GET /supported` returns the networks it will settle and, critically, the **fee payer**:

```json
{ "x402Version": 2, "scheme": "exact", "network": "hedera:testnet",
  "extra": { "feePayer": "0.0.7162784" } }
```

- Read `feePayer` at boot and put it in `requirements.extra`. Payments without it are rejected.
- Because the facilitator pays the Hedera fee, **a buying agent needs no HBAR for gas** — only the
  asset being spent.
- `POST /verify` and `POST /settle` both take `{ x402Version, paymentPayload, paymentRequirements }`.
- Call `/verify` before doing any work, `/settle` after.

## Network identifiers

**Always the CAIP-2 string `hedera:testnet`.** Not `testnet`, not a numeric chain id, not
`hedera-testnet`. This applies to `PaymentRequirements.network` *and* to the client signer's config,
where the doc comment misleadingly says the default is "testnet" — passing `testnet` there throws
`Unsupported Hedera network: testnet`. *(Measured 2026-09-12.)*

## Building a payment (client side)

```js
import { ExactHederaScheme } from '@x402/hedera/exact/client';
import { createClientHederaSigner } from '@x402/hedera';

// POSITIONAL arguments, and a PrivateKey OBJECT — not a config object, not a string.
const signer = createClientHederaSigner(accountId, privateKeyObject, { network: 'hedera:testnet' });
const scheme = new ExactHederaScheme(signer);
const { payload } = await scheme.createPaymentPayload(2, accepted);

const header = Buffer.from(JSON.stringify({ x402Version: 2, accepted, payload })).toString('base64');
```

Passing `{ accountId, privateKey, network }` as one object fails with
**`t.startsWith is not a function`**, which says nothing about the cause. *(Measured 2026-09-12.)*

## Assets

| asset | id | decimals | association needed |
|---|---|---|---|
| HBAR | `0.0.0` | 8 (tinybars) | no |
| USDC testnet | `0.0.429274` | 6 | yes, or an auto-association slot |
| USDC mainnet | `0.0.456858` | 6 | yes |

- Decimal conversion must be per-asset. A hardcoded 6 underpays HBAR by 100×.
- Testnet USDC comes from **<https://faucet.circle.com>** (choose "Hedera Testnet", paste the
  `0.0.x` account id — not an `0x` address). 20 USDC per address per 2 hours.
- `createHederaPreflightTransfer` fails a payment if `payTo` is not associated with an HTS asset.
  Create accounts with `setMaxAutomaticTokenAssociations(n)` and it resolves itself.

## Payment flows

The Hedera scheme declares `paymentFlows.default.supported = ["authorization", "upfront"]`,
defaulting to `authorization`. This looks like it can hold funds pending approval. **It cannot** —
the payload is a partially-signed Hedera transaction and those expire in minutes. Escrow needs a
separate account and a later transfer.

---

## Hedera SDK gotchas

### Keys
The portal issues **ECDSA** accounts by default; ED25519 on request. Both print as 64 hex characters
and are indistinguishable by inspection. **`PrivateKey.fromStringED25519()` accepts a raw ECDSA key
without error and returns a different key** — the failure surfaces much later as `INVALID_SIGNATURE`,
which reads like a network fault.

Do not guess the type. Ask the mirror node what key the account has, parse to match, then verify the
private key derives that public key. `src/hedera-key.js` does this.

### Signatures
The client's operator signs automatically. **Any transaction that debits a different account needs
that account's signature too**:

```js
const signed = await tx.freezeWith(client).sign(escrowKey);
const response = await signed.execute(client);
await response.getReceipt(client);        // throws unless consensus status is SUCCESS
```

### Transaction ids
`TransactionReceipt` has **no** `transactionId`. Take the id from the `TransactionResponse`.
`rx.transactionId?.toString?.() ?? String(rx.status)` silently yields the literal `"SUCCESS"`, which
no explorer can resolve.

`execute()` only pre-checks. Consensus failures are visible only via `getReceipt()`.

### Scheduled transactions
```js
new ScheduleCreateTransaction()
  .setScheduledTransaction(innerTransfer)
  .setWaitForExpiry(true)
  .setExpirationTime(Timestamp.fromDate(deadline))
  .freezeWith(client).sign(escrowKey)       // supplies the inner transfer's required signature
```
Signing the *ScheduleCreate* with the debited account's key lets it execute at expiry with nobody
online. Verified executing on testnet 2026-09-12 (schedule `0.0.10495601`).

**If you also run your own timer, you will pay twice.** When a schedule is armed, poll
`/api/v1/schedules/{id}` for `executed_timestamp` and record that, rather than transferring again.
Keep a direct transfer only as a fallback well past expiry.

### Mirror node
`https://testnet.mirrornode.hedera.com` — public, no key. It is the reliable source for balances and
token association; consensus-node queries are not. It lags consensus by a second or two, so poll.

Transaction ids convert for lookup: `0.0.X@123.456` → `0.0.X-123-456`.

**Transient `fetch failed` happens.** Observed twice on 2026-09-12, once mid-payment. Retry every
mirror-node call rather than letting a blip fail a paid request.

---

## Measuring, not assuming

- `npm run dryrun` builds every Hedera transaction offline — catches malformed builders with no
  account and no network.
- `npm run test:keys` covers both key types in all three formats, including the silent-wrong-type case.
- `npm run prove` runs the real thing and then re-reads the mirror node to confirm each id.

A run that did not end in a third party confirming the transaction is not evidence.
