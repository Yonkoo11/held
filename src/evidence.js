// The evidence trail. Every job gets an append-only record of what was asked, which agent version
// answered, what it produced, and what the buyer decided. On the full tier this is a Hedera
// Consensus Service topic, so anyone can read it without trusting us. On the degraded tier it is a
// local JSONL file that says so in every entry.
import fs from 'node:fs';
import path from 'node:path';

import { inData } from './data-dir.js';
import crypto from 'node:crypto';
import { evidenceTier, MIRROR_NODE } from './config.js';

const FILE = inData('evidence.jsonl');

export const sha256 = (s) =>
  crypto.createHash('sha256').update(typeof s === 'string' ? s : JSON.stringify(s)).digest('hex');

function entry(jobId, type, payload) {
  const tier = evidenceTier();
  return {
    jobId, type, payload,
    at: new Date().toISOString(),
    tier: tier.name,
    degraded: tier.degraded,
  };
}

class FileEvidence {
  constructor() { this.tier = evidenceTier(); }
  async init() {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    return { topic: `file://${FILE}`, degraded: true };
  }
  async append(jobId, type, payload) {
    const e = entry(jobId, type, payload);
    fs.appendFileSync(FILE, JSON.stringify(e) + '\n');
    return e;
  }
  async read(jobId) {
    if (!fs.existsSync(FILE)) return [];
    return fs.readFileSync(FILE, 'utf8').split('\n').filter(Boolean)
      .map((l) => JSON.parse(l)).filter((e) => !jobId || e.jobId === jobId);
  }
  publicUrl() { return null; }
}

// UNRUN as of 2026-09-10 — no operator key has existed on this machine yet. Do not describe this
// path as working until a topic id appears in a run log.
class HcsEvidence {
  constructor() { this.tier = evidenceTier(); this.topicId = process.env.HCS_TOPIC_ID || null; }
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
    if (this.topicId) return { topic: this.topicId, degraded: false };
    const { TopicCreateTransaction } = await import('@hiero-ledger/sdk');
    const client = await this.#client();
    const rx = await (await new TopicCreateTransaction()
      .setTopicMemo('Held evidence trail')
      .execute(client)).getReceipt(client);
    this.topicId = rx.topicId.toString();
    console.log(`[evidence] created HCS topic ${this.topicId} — put HCS_TOPIC_ID=${this.topicId} in your env to reuse it`);
    return { topic: this.topicId, degraded: false };
  }
  async append(jobId, type, payload) {
    const { TopicMessageSubmitTransaction } = await import('@hiero-ledger/sdk');
    const e = entry(jobId, type, payload);
    const client = await this.#client();
    await new TopicMessageSubmitTransaction()
      .setTopicId(this.topicId)
      .setMessage(JSON.stringify(e))
      .execute(client);
    return e;
  }
  async read(jobId) {
    const r = await fetch(`${MIRROR_NODE}/api/v1/topics/${this.topicId}/messages?limit=100&order=asc`);
    const d = await r.json();
    return (d.messages || [])
      .map((m) => { try { return JSON.parse(Buffer.from(m.message, 'base64').toString()); } catch { return null; } })
      .filter(Boolean).filter((e) => !jobId || e.jobId === jobId);
  }
  publicUrl() { return this.topicId ? `https://hashscan.io/testnet/topic/${this.topicId}` : null; }
}

export function makeEvidence() {
  return evidenceTier().name === 'hcs' ? new HcsEvidence() : new FileEvidence();
}
