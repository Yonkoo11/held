// Escrow. This is the whole point of Held: x402 pays for the request immediately, but the
// money lands here instead of in the seller's account, and only moves once the buyer has had a
// real chance to look at what the agent produced.
//
// Release happens one of three ways:
//   approve  -> pay the seller now
//   reject   -> refund the buyer now
//   silence  -> a scheduled transaction pays the seller at the review deadline
import fs from 'node:fs';
import path from 'node:path';

// Tests must not write into the demo's data. Set DATA_DIR to isolate a run.
const DATA_DIR = path.join(process.cwd(), process.env.DATA_DIR || 'data');
import { settlementTier, payAsset, MIRROR_NODE } from './config.js';

const LEDGER = path.join(DATA_DIR, 'escrow-ledger.json');

export const toUnits = (amount) => String(Math.round(Number(amount) * 10 ** payAsset().decimals));
export const fromUnits = (units) => Number(units) / 10 ** payAsset().decimals;

function readLedger() {
  try { return JSON.parse(fs.readFileSync(LEDGER, 'utf8')); } catch { return { held: {}, entries: [] }; }
}
function writeLedger(l) {
  fs.mkdirSync(path.dirname(LEDGER), { recursive: true });
  fs.writeFileSync(LEDGER, JSON.stringify(l, null, 2));
}

class LocalSettlement {
  constructor() { this.tier = settlementTier(); }
  // Nothing executes a scheduled transfer for us here, so the seller's sweeper is the mechanism.
  get schedulesOnChain() { return false; }
  async scheduleStatus() { return { executed: false }; }
  async init() {
    this.account = 'local-escrow';
    return { escrow: this.account, degraded: true };
  }
  escrowAccount() { return this.account; }

  async recordDeposit(jobId, { payer, amount, asset, releasesTo }) {
    const l = readLedger();
    l.held[jobId] = { payer, amount, asset, releasesTo, scheduledTo: releasesTo, at: Date.now(), state: 'held' };
    l.entries.push({ jobId, kind: 'deposit', amount, payer, at: Date.now(), tier: 'local-standin' });
    writeLedger(l);
    return { txId: `local-deposit-${jobId}`, degraded: true };
  }

  async scheduleRelease(jobId, { to, deadlineMs }) {
    if (process.env.SIMULATE_SCHEDULE_FAILURE === '1') {
      throw new Error('simulated schedule failure');
    }
    const l = readLedger();
    if (l.held[jobId]) { l.held[jobId].scheduledFor = deadlineMs; l.held[jobId].scheduledTo = to; }
    writeLedger(l);
    // No real scheduler on this tier. The seller process sweeps due jobs instead, and every
    // receipt says the release was swept locally rather than scheduled on Hedera.
    return { scheduleId: `local-schedule-${jobId}`, degraded: true };
  }

  async release(jobId, reason) {
    const l = readLedger();
    const h = l.held[jobId];
    if (!h) return { txId: null, error: 'nothing held for this job' };
    h.state = 'released'; h.reason = reason;
    l.entries.push({ jobId, kind: 'release', amount: h.amount, to: h.scheduledTo || h.releasesTo, reason, at: Date.now(), tier: 'local-standin' });
    writeLedger(l);
    return { txId: `local-release-${jobId}`, degraded: true };
  }

  async refund(jobId, reason) {
    const l = readLedger();
    const h = l.held[jobId];
    if (!h) return { txId: null, error: 'nothing held for this job' };
    h.state = 'refunded'; h.reason = reason;
    l.entries.push({ jobId, kind: 'refund', amount: h.amount, to: h.payer, reason, at: Date.now(), tier: 'local-standin' });
    writeLedger(l);
    return { txId: `local-refund-${jobId}`, degraded: true };
  }

  async held(jobId) { return readLedger().held[jobId] || null; }
  explorerUrl() { return null; }
}

// UNRUN as of 2026-09-10 — no Hedera operator key has existed on this machine yet. Every method
// below is written against the SDK but has never executed. Do not claim it works.
async function buildTransfer(from, to, units) {
  const { TransferTransaction, AccountId, TokenId, Hbar, HbarUnit } = await import('@hiero-ledger/sdk');
  const asset = payAsset();
  const tx = new TransferTransaction();
  if (asset.isHbar) {
    tx.addHbarTransfer(AccountId.fromString(from), Hbar.from(-Number(units), HbarUnit.Tinybar));
    tx.addHbarTransfer(AccountId.fromString(to), Hbar.from(Number(units), HbarUnit.Tinybar));
  } else {
    const token = TokenId.fromString(asset.id);
    tx.addTokenTransfer(token, AccountId.fromString(from), -Number(units));
    tx.addTokenTransfer(token, AccountId.fromString(to), Number(units));
  }
  return tx;
}

class HederaSettlement {
  // Hedera executes the scheduled release itself at expiry. The seller's sweeper must therefore
  // NOT also transfer — doing both paid the seller twice for one job on 2026-09-12, visible on
  // chain as two 0.05 HBAR debits from the escrow 13 seconds apart.
  get schedulesOnChain() { return true; }

  async scheduleStatus(scheduleId) {
    if (!scheduleId) return { executed: false };
    const r = await fetch(`${MIRROR_NODE}/api/v1/schedules/${encodeURIComponent(scheduleId)}`);
    if (!r.ok) return { executed: false, unknown: true };
    const d = await r.json();
    if (!d.executed_timestamp) return { executed: false, deleted: Boolean(d.deleted) };
    let txId = null;
    try {
      const t = await fetch(`${MIRROR_NODE}/api/v1/transactions?timestamp=${d.executed_timestamp}&limit=1`);
      if (t.ok) txId = ((await t.json()).transactions || [])[0]?.transaction_id || null;
    } catch { /* the timestamp alone is still evidence */ }
    return { executed: true, executedAt: d.executed_timestamp, txId };
  }

  constructor() {
    this.tier = settlementTier();
    this.account = process.env.HEDERA_ESCROW_ID || process.env.HEDERA_OPERATOR_ID;
  }
  // The escrow account has its own key. The client signs as the operator, so any transfer that
  // DEBITS the escrow must also carry the escrow's signature or the network returns
  // INVALID_SIGNATURE — which it did, on the first real run.
  async #escrowKey() {
    if (this._escrowKey) return this._escrowKey;
    const { PrivateKey } = await import('@hiero-ledger/sdk');
    const { resolveOperator } = await import('./hedera-key.js');
    const raw = process.env.HEDERA_ESCROW_KEY;
    if (!raw) throw new Error('HEDERA_ESCROW_KEY is not set — run: npm run go-live');
    const { key } = await resolveOperator(PrivateKey, this.account, raw);
    this._escrowKey = key;
    return key;
  }

  async #client() {
    if (this._client) return this._client;
    const { Client, PrivateKey, AccountId } = await import('@hiero-ledger/sdk');
    const { resolveOperator } = await import('./hedera-key.js');
    // Verified against the ledger once, then cached: a raw ECDSA key parsed as ED25519 succeeds
    // silently and only fails later as INVALID_SIGNATURE.
    const operator = await resolveOperator(PrivateKey, process.env.HEDERA_OPERATOR_ID,
                                           process.env.HEDERA_OPERATOR_KEY);
    const c = Client.forTestnet();
    c.setOperator(AccountId.fromString(process.env.HEDERA_OPERATOR_ID), operator.key);
    this._client = c;
    return c;
  }
  async init() {
    // The escrow account must be associated with testnet USDC or the x402 preflight rejects the
    // payment before it is ever attempted. See CLAUDE.md, "HTS association is a real trap".
    const asset = payAsset();
    if (asset.isHbar) return { escrow: this.account, degraded: false };  // HBAR needs no association
    const { TokenAssociateTransaction, AccountId, TokenId } = await import('@hiero-ledger/sdk');
    const client = await this.#client();
    try {
      await new TokenAssociateTransaction()
        .setAccountId(AccountId.fromString(this.account))
        .setTokenIds([TokenId.fromString(asset.id)])
        .execute(client);
    } catch (e) {
      // Already associated is the common and harmless case.
      if (!String(e).includes('TOKEN_ALREADY_ASSOCIATED_TO_ACCOUNT')) throw e;
    }
    return { escrow: this.account, degraded: false };
  }
  escrowAccount() { return this.account; }

  async recordDeposit(jobId, { payer, amount, asset, txId, releasesTo }) {
    // The x402 settlement already moved the funds into the escrow account; nothing to send here.
    const l = readLedger();
    l.held[jobId] = { payer, amount, asset, txId, releasesTo, scheduledTo: releasesTo,
                      at: Date.now(), state: 'held' };
    writeLedger(l);
    return { txId, degraded: false };
  }

  async scheduleRelease(jobId, { to, deadlineMs }) {
    // Fault injection for tests. Arming the timer must never be able to strand a paid job, and the
    // only way to know that is to make it fail on purpose.
    if (process.env.SIMULATE_SCHEDULE_FAILURE === '1') {
      throw new Error('simulated schedule failure');
    }
    const { ScheduleCreateTransaction, Timestamp } = await import('@hiero-ledger/sdk');
    const l = readLedger();
    const h = l.held[jobId];
    const client = await this.#client();
    const inner = await buildTransfer(this.account, to, h.amount);
    // Signing the ScheduleCreate with the escrow key supplies the scheduled transfer's required
    // signature up front, so it can execute at expiry without anyone being online.
    const escrowKey = await this.#escrowKey();
    const scheduleTx = await new ScheduleCreateTransaction()
      .setScheduledTransaction(inner)
      .setScheduleMemo(`Held auto-release ${jobId}`)
      .setWaitForExpiry(true)
      .setExpirationTime(Timestamp.fromDate(new Date(deadlineMs)))
      .freezeWith(client)
      .sign(escrowKey);
    const rx = await (await scheduleTx.execute(client)).getReceipt(client);
    const scheduleId = rx.scheduleId.toString();
    h.scheduleId = scheduleId; h.scheduledTo = to; h.scheduledFor = deadlineMs;
    writeLedger(l);
    return { scheduleId, degraded: false };
  }

  async release(jobId, reason) {
    const { ScheduleDeleteTransaction } = await import('@hiero-ledger/sdk');
    const l = readLedger(); const h = l.held[jobId];
    if (!h) return { txId: null, error: 'nothing held for this job' };
    const client = await this.#client();
    if (h.scheduleId) {
      try { await new ScheduleDeleteTransaction().setScheduleId(h.scheduleId).execute(client); } catch { /* already gone */ }
    }
    const to = h.scheduledTo || h.releasesTo;
    if (!to) return { txId: null, error: 'no payout destination recorded for this job' };
    const tx = await buildTransfer(this.account, to, h.amount);
    const signed = await tx.freezeWith(client).sign(await this.#escrowKey());
    const response = await signed.execute(client);
    await response.getReceipt(client);          // throws unless consensus status is SUCCESS
    h.state = 'released'; h.reason = reason; writeLedger(l);
    return { txId: response.transactionId.toString(), degraded: false };
  }

  async refund(jobId, reason) {
    const { ScheduleDeleteTransaction } = await import('@hiero-ledger/sdk');
    const l = readLedger(); const h = l.held[jobId];
    if (!h) return { txId: null, error: 'nothing held for this job' };
    const client = await this.#client();
    if (h.scheduleId) {
      try { await new ScheduleDeleteTransaction().setScheduleId(h.scheduleId).execute(client); } catch { /* already gone */ }
    }
    const tx = await buildTransfer(this.account, h.payer, h.amount);
    const signed = await tx.freezeWith(client).sign(await this.#escrowKey());
    const response = await signed.execute(client);
    await response.getReceipt(client);
    h.state = 'refunded'; h.reason = reason; writeLedger(l);
    return { txId: response.transactionId.toString(), degraded: false };
  }

  async held(jobId) { return readLedger().held[jobId] || null; }
  explorerUrl() { return `https://hashscan.io/testnet/account/${this.account}`; }
}

export function makeSettlement() {
  return settlementTier().name === 'hedera-testnet' ? new HederaSettlement() : new LocalSettlement();
}
