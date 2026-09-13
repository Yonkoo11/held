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
// How long past expiry we wait for Hedera's scheduled release before doing it ourselves.
const SCHEDULE_GRACE_MS = Number(process.env.SCHEDULE_GRACE_SECONDS || 90) * 1000;

const MAX_QUESTION_CHARS = Number(process.env.MAX_QUESTION_CHARS || 2000);
// The browser demo spends the server's own buyer key. That is harmless against a local stand-in
// and a way to empty a funded account on testnet, so it is off by default once money is real.
const DEMO_BUY_ENABLED = (process.env.DEMO_BUY || '').toLowerCase() === 'on';

// Small fixed-window limiter. Every /work call costs a model run and a payment, so an open
// endpoint is a way to spend someone else's money and our own.
const hits = new Map();
function rateLimit(max, windowMs) {
  return (req, res, next) => {
    const key = `${req.path}:${req.ip}`;
    const now = Date.now();
    const rec = hits.get(key);
    if (!rec || now > rec.reset) {
      hits.set(key, { n: 1, reset: now + windowMs });
      return next();
    }
    if (++rec.n > max) {
      return res.status(429).json({ error: `too many requests; try again in ${Math.ceil((rec.reset - now) / 1000)}s` });
    }
    next();
  };
}
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of hits) if (now > v.reset) hits.delete(k);
}, 60000).unref();

const app = express();
app.set('trust proxy', 1);   // behind a tunnel, so req.ip must come from X-Forwarded-For
app.use(express.json({ limit: '256kb' }));
// `extensions` is what makes /ask serve ask.html without a routing library or a build step.
app.use(express.static(path.join(process.cwd(), 'public'), { extensions: ['html'] }));
// One job at its own URL, so a buyer can send someone the thing they bought.
app.get('/job/:id', (_req, res) => res.sendFile(path.join(process.cwd(), 'public', 'job.html')));

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
      held: {
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

// The evidence trail is a record, not a gate. If HCS is unreachable we must still answer the
// buyer correctly — losing a log line is bad, but 500-ing a request whose funds have already moved
// is worse, because the caller cannot tell what happened to the money.
async function record(jobId, type, payload) {
  try {
    return await evidence.append(jobId, type, payload);
  } catch (e) {
    console.error(`[evidence] FAILED to record ${type} for ${jobId}: ${e.message}`);
    return { failed: true, type, error: e.message };
  }
}

// The buyer proves they are the buyer with a token handed out once, at payment. We keep only its
// hash, so reading the jobs file does not let you spend from it.
function tokenMatches(job, presented) {
  if (!job?.claimTokenHash || !presented) return false;
  const want = Buffer.from(job.claimTokenHash, 'hex');
  const got = Buffer.from(sha256(String(presented)), 'hex');
  return want.length === got.length && crypto.timingSafeEqual(want, got);
}

app.get('/health', (_req, res) => res.json({
  status: 'ok', escrow, feePayer,
  evidenceTopic, facilitator: FACILITATOR_URL,
  price: PRICE, asset: payAsset(), agent: agentVersion(), tiers: tiers(),
  reviewMinutes: REVIEW_WINDOW_MS / 60000,
}));

// Convenience for the browser demo: the page has no wallet, so the server walks the same 402 ->
// pay -> retry round trip against itself using the buyer's payment builder. Identical code path to
// the CLI buyer — it is the same /work endpoint, the same facilitator and the same escrow.
app.post('/demo/buy', rateLimit(10, 60000), async (req, res) => {
  if (!DEMO_BUY_ENABLED && settlement.tier?.name !== 'local-standin') {
    return res.status(403).json({
      error: 'the browser demo spends this server\'s own funded account, so it is disabled on a live tier. Set DEMO_BUY=on to allow it.',
    });
  }
  const question = (req.body?.question || '').toString().trim();
  if (!question) return res.status(400).json({ error: 'send { "question": "..." }' });
  if (question.length > MAX_QUESTION_CHARS) {
    return res.status(413).json({ error: `question is longer than ${MAX_QUESTION_CHARS} characters` });
  }
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

app.post('/work', rateLimit(20, 60000), async (req, res) => {
  const resourceUrl = `${req.protocol}://${req.get('host')}/work`;
  const question = (req.body?.question || '').toString().trim();
  if (!question) return res.status(400).json({ error: 'send { "question": "..." }' });
  if (question.length > MAX_QUESTION_CHARS) {
    return res.status(413).json({ error: `question is longer than ${MAX_QUESTION_CHARS} characters` });
  }

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
  const claimToken = crypto.randomBytes(32).toString('hex');
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
  const sellerPayout = process.env.SELLER_ACCOUNT_ID || escrow;

  // The buyer's money is now in escrow. From this line on, NOTHING may throw its way out of this
  // handler before the job exists — a failure here would leave funds in escrow with no record of
  // whose they are. This happened on 2026-09-12: a transient mirror-node lookup inside
  // scheduleRelease threw, the request 500'd, and the paid job was never stored.
  //
  // So: record the job first, arm the timer second, and treat arming as best-effort.
  await settlement.recordDeposit(jobId, {
    payer, amount: paymentRequirements.amount, asset: paymentRequirements.asset,
    txId: settle.json.transaction,
    releasesTo: sellerPayout,          // known now; release must not depend on the async arming step
  });

  const job = store.put({
    id: jobId, question, payer,
    amount: paymentRequirements.amount, amountDisplay: fromUnits(paymentRequirements.amount),
    assetSymbol: payAsset().symbol,
    asset: paymentRequirements.asset,
    deliverable: work.output,
    deliverableHash: sha256(work.output),
    agentVersion: work.agentVersion,
    workerTier: work.workerTier, model: work.model, workerDegraded: work.degraded,
    failedOver: work.failedOver,                 // stripped before the job is served, see publicJob
    failedOverPublic: work.failedOverPublic,
    settleTx: settle.json.transaction,
    scheduleId: null,                            // filled in below if arming succeeds
    releasesTo: sellerPayout,
    escrow, state: 'held', deadline,
    claimTokenHash: sha256(claimToken),      // the token itself is never stored
    createdAt: Date.now(), updatedAt: Date.now(),
  });

  // Arming the timer is a second Hedera round trip and the buyer does not need to wait for it: the
  // job already exists and is held, and the sweeper covers a failure to arm. Measured at ~6s, which
  // is 6s the buyer spent staring at a spinner. Off the critical path.
  const scheduled = { scheduleId: null };
  const arming = settlement.scheduleRelease(jobId, { to: sellerPayout, deadlineMs: deadline })
    .then(async (r) => {
      store.patch(jobId, { scheduleId: r.scheduleId });
      await record(jobId, 'escrow-scheduled', {
        scheduleId: r.scheduleId, releasesTo: sellerPayout, armedOnChain: true,
        deadline: new Date(deadline).toISOString(),
      });
    })
    .catch(async (e) => {
      console.error(`[work] could not arm the auto-release for ${jobId}: ${e.message}`);
      console.error('[work] the job is held and the deadline sweep will release it instead.');
      await record(jobId, 'schedule-failed', { error: String(e.message).slice(0, 200) });
    });
  arming.catch(() => {});

  await record(jobId, 'paid', {
    payer, amount: paymentRequirements.amount, asset: paymentRequirements.asset,
    settleTx: settle.json.transaction, escrow,
  });
  await record(jobId, 'delivered', {
    questionHash: sha256(question), deliverableHash: job.deliverableHash,
    agentVersion: work.agentVersion, workerTier: work.workerTier, model: work.model,
  });
  res.set('X-PAYMENT-RESPONSE', Buffer.from(JSON.stringify(settle.json)).toString('base64'));
  res.json({
    jobId,
    claimToken,   // shown once. Whoever holds this is the buyer for this job.
    deliverable: work.output,
    agentVersion: work.agentVersion, workerTier: work.workerTier, model: work.model,
    escrow: { account: escrow, state: 'held', amount: fromUnits(paymentRequirements.amount),
              asset: payAsset().symbol,
              releasesAt: new Date(deadline).toISOString(), scheduleId: scheduled.scheduleId },
    review: { approve: `POST /jobs/${jobId}/approve`, reject: `POST /jobs/${jobId}/reject` },
    settleTx: settle.json.transaction,
  });
});

async function decide(req, res, action) {
  const id = req.params.id;
  const job = store.get(id);
  if (!job) return res.status(404).json({ error: 'no such job' });

  // Without this check anyone who learns a job id can release or refund somebody else's money.
  const presented = req.get('X-Job-Token') || req.body?.token;
  if (!tokenMatches(job, presented)) {
    return res.status(403).json({ error: 'that decision belongs to whoever paid for this job' });
  }

  const reason = (req.body?.reason || '').toString().slice(0, 500) || null;

  // Claim the job BEFORE any transfer. On Hedera there are several awaits inside release(), so
  // without this two concurrent approvals would both pass a state check and both pay out.
  const claim = store.transition(id, 'held', 'settling', { decisionReason: reason });
  if (!claim.ok) return res.status(claim.status).json({ error: claim.reason });

  let result;
  try {
    result = action === 'approve'
      ? await settlement.release(id, reason || 'buyer approved')
      : await settlement.refund(id, reason || 'buyer rejected');
  } catch (e) {
    store.transition(id, 'settling', 'held', {});      // hand it back, nothing moved
    console.error(`[decide] settlement threw for ${id}: ${e.message}`);
    return res.status(502).json({ error: `settlement failed, so your payment is still sitting in escrow: ${e.message}` });
  }
  if (result.error) {
    store.transition(id, 'settling', 'held', {});
    return res.status(409).json({ error: result.error });
  }

  const state = action === 'approve' ? 'released' : 'refunded';
  store.transition(id, 'settling', state, { decisionTx: result.txId, decidedAt: Date.now() });
  await record(id, state, { reason, tx: result.txId, by: 'buyer' });
  res.json({ jobId: id, state, tx: result.txId, reason });
}

app.post('/jobs/:id/approve', rateLimit(30, 60000), (req, res) => decide(req, res, 'approve'));
app.post('/jobs/:id/reject', rateLimit(30, 60000), (req, res) => decide(req, res, 'reject'));

// Whatever else changes, these two never leave the server: the token hash authorises spending,
// and the upstream error is the provider's prose rather than ours.
const publicJob = ({ claimTokenHash, failedOver, ...rest }) => rest;

app.get('/jobs/:id', async (req, res) => {
  const job = store.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'no such job' });
  let trail = [];
  try { trail = await evidence.read(job.id); } catch (e) { console.error('[evidence] read failed:', e.message); }
  res.json({ ...publicJob(job), evidence: trail, evidenceUrl: evidence.publicUrl() });
});
app.get('/jobs', (_req, res) => res.json(store.list().map(publicJob)));

// On the local tier nothing executes a scheduled transaction for us, so the service sweeps due
// jobs itself. Every receipt says which of the two happened.
async function sweep() {
  for (const job of store.list()) {
    if (job.state !== 'held' || Date.now() < job.deadline) continue;

    // When the chain owns the release, the sweeper's job is to observe it, not to repeat it.
    if (settlement.schedulesOnChain && job.scheduleId) {
      const st = await settlement.scheduleStatus(job.scheduleId);
      if (st.executed) {
        const claim = store.transition(job.id, 'held', 'released', {
          decisionReason: 'nobody decided, so the scheduled transaction paid the seller',
          decisionTx: st.txId, decidedAt: Date.now(),
        });
        if (claim.ok) {
          await record(job.id, 'released', { reason: 'you did not decide in time, so the deadline released it to the seller', tx: st.txId,
                                             by: 'hedera-scheduled-transaction', scheduleId: job.scheduleId });
          console.log(`[sweep] schedule ${job.scheduleId} executed for ${job.id}`);
        }
        continue;
      }
      // Give the network a grace period before assuming the schedule will never fire. Only then
      // fall back to transferring ourselves, so a failed schedule cannot strand the seller's money.
      if (Date.now() < job.deadline + SCHEDULE_GRACE_MS) continue;
      console.log(`[sweep] schedule ${job.scheduleId} has not executed ${Math.round(SCHEDULE_GRACE_MS / 1000)}s past expiry — releasing directly`);
    }

    const claim = store.transition(job.id, 'held', 'settling',
      { decisionReason: 'you did not decide in time, so the deadline released it to the seller' });
    if (!claim.ok) continue;                       // a buyer decided first; leave it alone
    try {
      const r = await settlement.release(job.id, 'nobody decided, so the deadline released it');
      if (r.error) { store.transition(job.id, 'settling', 'held', {}); continue; }
      store.transition(job.id, 'settling', 'released', { decisionTx: r.txId, decidedAt: Date.now() });
      await record(job.id, 'released', { reason: 'you did not decide in time, so the deadline released it to the seller', tx: r.txId, by: 'deadline-sweep' });
      console.log(`[sweep] auto-released ${job.id}`);
    } catch (e) {
      store.transition(job.id, 'settling', 'held', {});
      console.error(`[sweep] ${job.id} left held: ${e.message}`);
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
  if (!t.settlement.degraded && DEMO_BUY_ENABLED) {
    console.log('[seller] WARNING: DEMO_BUY=on with real settlement — /demo/buy spends this account. Public exposure will drain it.');
  }
  const sweeper = setInterval(() => sweep().catch((e) => console.error('[sweep]', e)), 15000);
  const server = app.listen(PORT, () => console.log(`[seller] listening on http://localhost:${PORT}`));

  // A host replacing this container sends SIGTERM. Without a handler the process is killed
  // mid-request and exits non-zero, which the platform reports as a crash on every routine
  // redeploy. It also matters for more than tidiness: this service settles payments, and a
  // request cut off between taking the money and recording the job is the exact failure the
  // ordering in `work` exists to prevent. So stop accepting new connections, let the in-flight
  // ones finish, and exit cleanly.
  let closing = false;
  for (const signal of ['SIGTERM', 'SIGINT']) {
    process.on(signal, () => {
      if (closing) return;                       // a second signal must not re-enter this
      closing = true;
      console.log(`[seller] ${signal} received, finishing in-flight requests`);
      clearInterval(sweeper);
      server.close(() => { console.log('[seller] closed cleanly'); process.exit(0); });
      // If a client holds a connection open, do not hang the deploy forever.
      setTimeout(() => { console.log('[seller] shutdown timed out, exiting'); process.exit(0); }, 10000).unref();
    });
  }
};

boot().catch((e) => {
  console.error('[seller] boot failed:', e.message);
  if (e.cause) console.error('[seller] cause:', e.cause.code || e.cause.message || String(e.cause));
  console.error(e.stack?.split('\n').slice(0, 4).join('\n'));
  process.exit(1);
});
