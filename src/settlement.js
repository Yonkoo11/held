// Escrow. This is the whole point of OutcomeLock: x402 pays for the request immediately, but the
// money lands here instead of in the seller's account, and only moves once the buyer has had a
// real chance to look at what the agent produced.
//
// Release happens one of three ways:
//   approve  -> pay the seller now
//   reject   -> refund the buyer now
//   silence  -> a scheduled transaction pays the seller at the review deadline
import fs from 'node:fs';
import path from 'node:path';
import { settlementTier, HEDERA_TESTNET_USDC, HEDERA_USDC_DECIMALS } from './config.js';

const LEDGER = path.join(process.cwd(), 'data', 'escrow-ledger.json');

export const toUnits = (usdc) => String(Math.round(Number(usdc) * 10 ** HEDERA_USDC_DECIMALS));
export const fromUnits = (units) => Number(units) / 10 ** HEDERA_USDC_DECIMALS;

function readLedger() {
  try { return JSON.parse(fs.readFileSync(LEDGER, 'utf8')); } catch { return { held: {}, entries: [] }; }
}
function writeLedger(l) {
  fs.mkdirSync(path.dirname(LEDGER), { recursive: true });
  fs.writeFileSync(LEDGER, JSON.stringify(l, null, 2));
}

class LocalSettlement {
  constructor() { this.tier = settlementTier(); }
  async init() {
    this.account = 'local-escrow';
    return { escrow: this.account, degraded: true };
  }
  escrowAccount() { return this.account; }

  async recordDeposit(jobId, { payer, amount, asset }) {
    const l = readLedger();
    l.held[jobId] = { payer, amount, asset, at: Date.now(), state: 'held' };
    l.entries.push({ jobId, kind: 'deposit', amount, payer, at: Date.now(), tier: 'local-standin' });
    writeLedger(l);
    return { txId: `local-deposit-${jobId}`, degraded: true };
  }

  async scheduleRelease(jobId, { to, deadlineMs }) {
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
    if (!h || h.state !== 'held') return { txId: null, error: 'nothing held for this job' };
    h.state = 'released'; h.reason = reason;
    l.entries.push({ jobId, kind: 'release', amount: h.amount, to: h.scheduledTo, reason, at: Date.now(), tier: 'local-standin' });
    writeLedger(l);
    return { txId: `local-release-${jobId}`, degraded: true };
  }

  async refund(jobId, reason) {
    const l = readLedger();
    const h = l.held[jobId];
    if (!h || h.state !== 'held') return { txId: null, error: 'nothing held for this job' };
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
class HederaSettlement {
  constructor() {
    this.tier = settlementTier();
    this.account = process.env.HEDERA_ESCROW_ID || process.env.HEDERA_OPERATOR_ID;
  }
  async #client() {
    const { Client, PrivateKey, AccountId } = await import('@hiero-ledger/sdk');
    const c = Client.forTestnet();
    c.setOperator(AccountId.fromString(process.env.HEDERA_OPERATOR_ID),
                  PrivateKey.fromStringED25519(process.env.HEDERA_OPERATOR_KEY));
    return c;
  }
  async init() {
    // The escrow account must be associated with testnet USDC or the x402 preflight rejects the
    // payment before it is ever attempted. See CLAUDE.md, "HTS association is a real trap".
    const { TokenAssociateTransaction, AccountId, TokenId } = await import('@hiero-ledger/sdk');
    const client = await this.#client();
    try {
      await new TokenAssociateTransaction()
        .setAccountId(AccountId.fromString(this.account))
        .setTokenIds([TokenId.fromString(HEDERA_TESTNET_USDC)])
        .execute(client);
    } catch (e) {
      // Already associated is the common and harmless case.
      if (!String(e).includes('TOKEN_ALREADY_ASSOCIATED_TO_ACCOUNT')) throw e;
    }
    return { escrow: this.account, degraded: false };
  }
  escrowAccount() { return this.account; }

  async recordDeposit(jobId, { payer, amount, asset, txId }) {
    // The x402 settlement already moved the funds into the escrow account; nothing to send here.
    const l = readLedger();
    l.held[jobId] = { payer, amount, asset, txId, at: Date.now(), state: 'held' };
    writeLedger(l);
    return { txId, degraded: false };
  }

  async scheduleRelease(jobId, { to, deadlineMs }) {
    const { ScheduleCreateTransaction, TransferTransaction, AccountId, TokenId, Timestamp } =
      await import('@hiero-ledger/sdk');
    const l = readLedger();
    const h = l.held[jobId];
    const client = await this.#client();
    const inner = new TransferTransaction()
      .addTokenTransfer(TokenId.fromString(HEDERA_TESTNET_USDC), AccountId.fromString(this.account), -Number(h.amount))
      .addTokenTransfer(TokenId.fromString(HEDERA_TESTNET_USDC), AccountId.fromString(to), Number(h.amount));
    const rx = await (await new ScheduleCreateTransaction()
      .setScheduledTransaction(inner)
      .setScheduleMemo(`OutcomeLock auto-release ${jobId}`)
      .setWaitForExpiry(true)
      .setExpirationTime(Timestamp.fromDate(new Date(deadlineMs)))
      .execute(client)).getReceipt(client);
    const scheduleId = rx.scheduleId.toString();
    h.scheduleId = scheduleId; h.scheduledTo = to; h.scheduledFor = deadlineMs;
    writeLedger(l);
    return { scheduleId, degraded: false };
  }

  async release(jobId, reason) {
    const { TransferTransaction, ScheduleDeleteTransaction, AccountId, TokenId } = await import('@hiero-ledger/sdk');
    const l = readLedger(); const h = l.held[jobId];
    if (!h || h.state !== 'held') return { txId: null, error: 'nothing held for this job' };
    const client = await this.#client();
    if (h.scheduleId) {
      try { await new ScheduleDeleteTransaction().setScheduleId(h.scheduleId).execute(client); } catch { /* already gone */ }
    }
    const rx = await (await new TransferTransaction()
      .addTokenTransfer(TokenId.fromString(HEDERA_TESTNET_USDC), AccountId.fromString(this.account), -Number(h.amount))
      .addTokenTransfer(TokenId.fromString(HEDERA_TESTNET_USDC), AccountId.fromString(h.scheduledTo), Number(h.amount))
      .execute(client)).getReceipt(client);
    h.state = 'released'; h.reason = reason; writeLedger(l);
    return { txId: rx.transactionId?.toString?.() ?? String(rx.status), degraded: false };
  }

  async refund(jobId, reason) {
    const { TransferTransaction, ScheduleDeleteTransaction, AccountId, TokenId } = await import('@hiero-ledger/sdk');
    const l = readLedger(); const h = l.held[jobId];
    if (!h || h.state !== 'held') return { txId: null, error: 'nothing held for this job' };
    const client = await this.#client();
    if (h.scheduleId) {
      try { await new ScheduleDeleteTransaction().setScheduleId(h.scheduleId).execute(client); } catch { /* already gone */ }
    }
    const rx = await (await new TransferTransaction()
      .addTokenTransfer(TokenId.fromString(HEDERA_TESTNET_USDC), AccountId.fromString(this.account), -Number(h.amount))
      .addTokenTransfer(TokenId.fromString(HEDERA_TESTNET_USDC), AccountId.fromString(h.payer), Number(h.amount))
      .execute(client)).getReceipt(client);
    h.state = 'refunded'; h.reason = reason; writeLedger(l);
    return { txId: rx.transactionId?.toString?.() ?? String(rx.status), degraded: false };
  }

  async held(jobId) { return readLedger().held[jobId] || null; }
  explorerUrl() { return `https://hashscan.io/testnet/account/${this.account}`; }
}

export function makeSettlement() {
  return settlementTier().name === 'hedera-testnet' ? new HederaSettlement() : new LocalSettlement();
}
