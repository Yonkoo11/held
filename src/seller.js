// The seller: an x402-gated agent service on Hedera.
//
// The one thing that makes this different from every other x402 service: `payTo` is not the
// seller. It is the escrow account. The buyer pays for the request the normal x402 way, the
// facilitator settles it immediately, and the money sits in escrow until the buyer has seen the
// deliverable — or until the review deadline passes.
import express from 'express';
import crypto from 'node:crypto';
import path from 'node:path';
import { FACILITATOR_URL, HEDERA_CAIP2, payAsset, printTiers, tiers } from './config.js';
import { buildPaymentFor } from './payment.js';
import { makeEvidence, sha256 } from './evidence.js';
import { makeSettlement, toUnits, fromUnits } from './settlement.js';
import { doWork, agentVersion } from './worker.js';
import * as store from './store.js';

const PORT = Number(process.env.PORT || 4021);
const PRICE = Number(process.env.PRICE || process.env.PRICE_USDC || 0.05);
const REVIEW_WINDOW_MS = Number(process.env.REVIEW_MINUTES || 10) * 60 * 1000;

const app = express();
app.use(express.json({ limit: '256kb' }));
app.use(express.static(path.join(process.cwd(), 'public')));

const evidence = makeEvidence();
const settlement = makeSettlement();
let feePayer = null;
let escrow = null;
let evidenceTopic = null;

async function loadFacilitatorSupport(attempt = 1) {
  let r;
  try {
    r = await fetch(`${FACILITATOR_URL}/supported`);
  } catch (e) {
    // Seen once on 2026-09-10: a single transient `fetch failed` at boot that succeeded on retry.
    if (attempt >= 4) throw e;
    console.log(`[seller] facilitator unreachable (${e.message}), retry ${attempt} of 3...`);
    await new Promise((ok) => setTimeout(ok, 1500 * attempt));
    return loadFacilitatorSupport(attempt + 1);
  }
  if (!r.ok) throw new Error(`facilitator /supported returned ${r.status}`);
  const { kinds = [] } = await r.json();
  const hedera = kinds.find((k) => k.network === HEDERA_CAIP2 && k.scheme === 'exact');
  if (!hedera) throw new Error(`facilitator does not support ${HEDERA_CAIP2}`);
  feePayer = hedera.extra?.feePayer || null;
  return hedera;
}

function requirements(resourceUrl) {
  return {
    scheme: 'exact',
    network: HEDERA_CAIP2,
    asset: payAsset().id,
    amount: toUnits(PRICE),
    payTo: escrow,                       // <- escrow, not the seller. This is the whole product.
    maxTimeoutSeconds: 120,
    extra: feePayer ? { feePayer } : {},
  };
}

function paymentRequired(res, resourceUrl, error) {
  return res.status(402).json({
    x402Version: 2,
    error: error || 'payment required',
    resource: {
      url: resourceUrl,
      description: `Research answer from an agent. ${PRICE} ${payAsset().symbol}, held in escrow until you approve it.`,
      mimeType: 'application/json',
    },
    accepts: [requirements(resourceUrl)],
    extensions: {
      outcomelock: {
        escrow,
        reviewWindowMinutes: REVIEW_WINDOW_MS / 60000,
        releasePolicy: 'approve pays the seller, reject refunds you, silence pays the seller at the deadline',
      },
    },
  });
}

const LOCAL_SETTLEMENT = () => settlement.tier?.name === 'local-standin';

// Local stand-in for the facilitator. Same request and response shapes as Blocky402, so the seller
// has exactly one code path; the difference is that nothing is on a real ledger and the response
// says so. Used only when no Hedera operator key is present.
function localFacilitator(path, body) {
  const payload = body?.paymentPayload?.payload || {};
  const req = body?.paymentRequirements || {};
  const payer = payload.payer || 'local-buyer';
  if (path === '/verify') {
    if (payload.simulated !== true) {
      return { ok: true, status: 200, json: { isValid: false, invalidReason: 'not_a_local_payment',
        invalidMessage: 'local tier only accepts payloads marked simulated:true' } };
    }
    if (String(payload.amount) !== String(req.amount)) {
      return { ok: true, status: 200, json: { isValid: false, invalidReason: 'amount_mismatch',
        invalidMessage: `expected ${req.amount}, payload had ${payload.amount}` } };
    }
    return { ok: true, status: 200, json: { isValid: true, payer, extra: { simulated: true } } };
  }
  if (path === '/settle') {
    return { ok: true, status: 200, json: { success: true, payer,
      transaction: `LOCAL-SIMULATION-${Date.now()}`, network: req.network,
      amount: req.amount, extra: { simulated: true } } };
  }
  return { ok: false, status: 404, json: null, text: 'unknown local facilitator path' };
}

async function facilitator(path, body) {
  if (LOCAL_SETTLEMENT()) return localFacilitator(path, body);
  const r = await fetch(`${FACILITATOR_URL}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* facilitator returned non-JSON */ }
  return { ok: r.ok, status: r.status, json, text };
}

app.get('/health', (_req, res) => res.json({
  status: 'ok', escrow, feePayer,
  evidenceTopic, facilitator: FACILITATOR_URL,
  price: PRICE, asset: payAsset(), agent: agentVersion(), tiers: tiers(),
}));

// Convenience for the browser demo: the page has no wallet, so the server walks the same 402 ->
// pay -> retry round trip against itself using the buyer's payment builder. Identical code path to
// the CLI buyer — it is the same /work endpoint, the same facilitator and the same escrow.
app.post('/demo/buy', async (req, res) => {
  const question = (req.body?.question || '').toString().trim();
  if (!question) return res.status(400).json({ error: 'send { "question": "..." }' });
  const base = `http://127.0.0.1:${PORT}`;
  try {
    const quote = await fetch(`${base}/work`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question }),
    });
    if (quote.status !== 402) {
      return res.status(500).json({ error: `expected 402, got ${quote.status}` });
    }
    const accepted = (await quote.json()).accepts[0];
    const payment = await buildPaymentFor(accepted);
    const paid = await fetch(`${base}/work`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-PAYMENT': Buffer.from(JSON.stringify(payment)).toString('base64'),
      },
      body: JSON.stringify({ question }),
    });
    const body = await paid.json();
    if (!paid.ok) return res.status(paid.status).json({ error: body.error || 'payment failed' });
    res.json(body);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/work', async (req, res) => {
  const resourceUrl = `${req.protocol}://${req.get('host')}/work`;
  const question = (req.body?.question || '').toString().trim();
  if (!question) return res.status(400).json({ error: 'send { "question": "..." }' });

  const header = req.get('X-PAYMENT');
  if (!header) return paymentRequired(res, resourceUrl);

  let paymentPayload;
  try {
    paymentPayload = JSON.parse(Buffer.from(header, 'base64').toString('utf8'));
  } catch {
    return paymentRequired(res, resourceUrl, 'X-PAYMENT header is not base64 JSON');
  }

  const paymentRequirements = requirements(resourceUrl);

  // 1. Verify before doing any work.
  const verify = await facilitator('/verify', { x402Version: 2, paymentPayload, paymentRequirements });
  if (!verify.ok || !verify.json?.isValid) {
    return paymentRequired(res, resourceUrl,
      verify.json?.invalidMessage || verify.json?.invalidReason || `verify failed (${verify.status})`);
  }
  const payer = verify.json.payer || paymentPayload?.payload?.payer || 'unknown';

  // 2. Do the work.
  const jobId = crypto.randomUUID();
  const work = await doWork(question);

  // 3. Settle — the funds land in escrow, not with the seller.
  const settle = await facilitator('/settle', { x402Version: 2, paymentPayload, paymentRequirements });
  if (!settle.ok || !settle.json?.success) {
    return res.status(402).json({
      x402Version: 2,
      error: settle.json?.errorMessage || settle.json?.errorReason || `settle failed (${settle.status})`,
      accepts: [paymentRequirements],
    });
  }

  const deadline = Date.now() + REVIEW_WINDOW_MS;
  await settlement.recordDeposit(jobId, {
    payer, amount: paymentRequirements.amount, asset: paymentRequirements.asset,
    txId: settle.json.transaction,
  });
  const sellerPayout = process.env.SELLER_ACCOUNT_ID || escrow;
  const scheduled = await settlement.scheduleRelease(jobId, { to: sellerPayout, deadlineMs: deadline });

  const job = store.put({
    id: jobId, question, payer,
    amount: paymentRequirements.amount, amountDisplay: fromUnits(paymentRequirements.amount),
    assetSymbol: payAsset().symbol,
    asset: paymentRequirements.asset,
    deliverable: work.output,
    deliverableHash: sha256(work.output),
    agentVersion: work.agentVersion,
    workerTier: work.workerTier, model: work.model, workerDegraded: work.degraded,
    failedOver: work.failedOver,
    settleTx: settle.json.transaction,
    scheduleId: scheduled.scheduleId,
    escrow, state: 'held', deadline,
    createdAt: Date.now(), updatedAt: Date.now(),
  });

  await evidence.append(jobId, 'paid', {
    payer, amount: paymentRequirements.amount, asset: paymentRequirements.asset,
    settleTx: settle.json.transaction, escrow,
  });
  await evidence.append(jobId, 'delivered', {
    questionHash: sha256(question), deliverableHash: job.deliverableHash,
    agentVersion: work.agentVersion, workerTier: work.workerTier, model: work.model,
  });
  await evidence.append(jobId, 'escrow-scheduled', {
    scheduleId: scheduled.scheduleId, releasesTo: sellerPayout,
    deadline: new Date(deadline).toISOString(),
  });

  res.set('X-PAYMENT-RESPONSE', Buffer.from(JSON.stringify(settle.json)).toString('base64'));
  res.json({
    jobId, deliverable: work.output,
    agentVersion: work.agentVersion, workerTier: work.workerTier, model: work.model,
    escrow: { account: escrow, state: 'held', amount: fromUnits(paymentRequirements.amount),
              asset: payAsset().symbol,
              releasesAt: new Date(deadline).toISOString(), scheduleId: scheduled.scheduleId },
    review: { approve: `POST /jobs/${jobId}/approve`, reject: `POST /jobs/${jobId}/reject` },
    settleTx: settle.json.transaction,
  });
});

async function decide(req, res, action) {
  const job = store.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'no such job' });
  if (job.state !== 'held') return res.status(409).json({ error: `job already ${job.state}` });
  const reason = (req.body?.reason || '').toString().slice(0, 500) || null;

  const result = action === 'approve'
    ? await settlement.release(job.id, reason || 'buyer approved')
    : await settlement.refund(job.id, reason || 'buyer rejected');
  if (result.error) return res.status(409).json({ error: result.error });

  const state = action === 'approve' ? 'released' : 'refunded';
  store.patch(job.id, { state, decisionReason: reason, decisionTx: result.txId, decidedAt: Date.now() });
  await evidence.append(job.id, state, { reason, tx: result.txId, by: 'buyer' });
  res.json({ jobId: job.id, state, tx: result.txId, reason });
}

app.post('/jobs/:id/approve', (req, res) => decide(req, res, 'approve'));
app.post('/jobs/:id/reject', (req, res) => decide(req, res, 'reject'));

app.get('/jobs/:id', async (req, res) => {
  const job = store.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'no such job' });
  res.json({ ...job, evidence: await evidence.read(job.id), evidenceUrl: evidence.publicUrl() });
});
app.get('/jobs', (_req, res) => res.json(store.list()));

// On the local tier nothing executes a scheduled transaction for us, so the service sweeps due
// jobs itself. Every receipt says which of the two happened.
async function sweep() {
  for (const job of store.list()) {
    if (job.state === 'held' && Date.now() >= job.deadline) {
      const r = await settlement.release(job.id, 'review window expired — auto-released');
      if (!r.error) {
        store.patch(job.id, { state: 'released', decisionTx: r.txId, decidedAt: Date.now(),
                              decisionReason: 'review window expired' });
        await evidence.append(job.id, 'released', { reason: 'review window expired', tx: r.txId, by: 'deadline' });
        console.log(`[sweep] auto-released ${job.id}`);
      }
    }
  }
}

const boot = async () => {
  const t = printTiers('seller');
  const hedera = await loadFacilitatorSupport();
  console.log(`[seller] facilitator ${FACILITATOR_URL} supports ${hedera.network}, feePayer ${feePayer}`);
  ({ escrow } = await settlement.init());
  ({ topic: evidenceTopic } = await evidence.init());
  console.log(`[seller] escrow account: ${escrow}`);
  console.log(`[seller] evidence trail: ${evidenceTopic}`);
  console.log(`[seller] price: ${PRICE} ${payAsset().symbol} (asset ${payAsset().id}), review window ${REVIEW_WINDOW_MS / 60000} min`);
  if (t.settlement.degraded) console.log('[seller] NOTE: settlement is on the local stand-in tier, not Hedera.');
  setInterval(() => sweep().catch((e) => console.error('[sweep]', e)), 15000);
  app.listen(PORT, () => console.log(`[seller] listening on http://localhost:${PORT}`));
};

boot().catch((e) => {
  console.error('[seller] boot failed:', e.message);
  if (e.cause) console.error('[seller] cause:', e.cause.code || e.cause.message || String(e.cause));
  console.error(e.stack?.split('\n').slice(0, 4).join('\n'));
  process.exit(1);
});
