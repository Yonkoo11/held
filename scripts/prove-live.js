// Runs the whole Held loop against a running seller, then goes back to the Hedera mirror
// node and checks that what we claim happened actually appears on the ledger. Writes evidence/PROOF.md.
//
//   node --env-file=.env scripts/prove-live.js
//
// This exists because "the code ran without throwing" is not evidence. The only thing that counts
// is a third party being able to look the transactions up.
import fs from 'node:fs';
import { MIRROR_NODE, payAsset, printTiers, settlementTier } from '../src/config.js';

const SELLER = process.env.SELLER_URL || 'http://localhost:4021';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function post(path, body, headers = {}) {
  const r = await fetch(`${SELLER}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  return { status: r.status, json: await r.json().catch(() => null) };
}

// The mirror node lags consensus by a second or two, so poll rather than assume.
async function mirrorHasTransaction(txId, tries = 10) {
  if (!txId) return { found: false, note: 'no transaction id — the step failed before submitting' };
  const normalised = txId.replace('@', '-').replace(/\.(\d+)$/, '-$1');
  for (let i = 0; i < tries; i++) {
    const r = await fetch(`${MIRROR_NODE}/api/v1/transactions/${normalised}`);
    if (r.ok) {
      const d = await r.json();
      const t = (d.transactions || [])[0];
      if (t) return { found: true, result: t.result, consensus: t.consensus_timestamp };
    }
    await sleep(2000);
  }
  return { found: false };
}

async function topicMessages(topicId) {
  const r = await fetch(`${MIRROR_NODE}/api/v1/topics/${topicId}/messages?limit=50&order=asc`);
  if (!r.ok) return [];
  const d = await r.json();
  return (d.messages || []).map((m) => {
    try { return JSON.parse(Buffer.from(m.message, 'base64').toString()); } catch { return null; }
  }).filter(Boolean);
}

async function main() {
  const tier = settlementTier();
  printTiers('prove-live');
  const live = tier.name === 'hedera-testnet';
  if (!live) {
    console.log('\n[prove-live] settlement is on the LOCAL stand-in tier.');
    console.log('[prove-live] This run will still exercise every path, but it proves nothing about Hedera.');
    console.log('[prove-live] Run scripts/go-live.js first if you want real on-ledger evidence.\n');
  }

  const health = await (await fetch(`${SELLER}/health`)).json();
  console.log(`[prove-live] seller escrow ${health.escrow}, evidence ${health.evidenceTopic}`);

  const results = [];

  // ---- case 1: buyer approves, seller gets paid -------------------------------------------
  const q1 = 'Explain what a Hedera scheduled transaction is and when it executes.';
  const r1 = await post('/work', { question: q1 });
  if (r1.status !== 402) throw new Error(`expected 402 first, got ${r1.status}`);
  const accepted = r1.json.accepts[0];
  console.log(`[prove-live] quoted ${Number(accepted.amount) / 10 ** payAsset().decimals} ${payAsset().symbol} payable to ${accepted.payTo}`);

  const { buildPaymentFor } = await import('../src/payment.js');
  const payment = await buildPaymentFor(accepted);
  const paid = await post('/work', { question: q1 },
    { 'X-PAYMENT': Buffer.from(JSON.stringify(payment)).toString('base64') });
  if (paid.status !== 200) throw new Error(`payment failed: ${JSON.stringify(paid.json).slice(0, 300)}`);
  const job1 = paid.json;
  console.log(`[prove-live] job ${job1.jobId} paid, settle tx ${job1.settleTx}`);

  const approve = await post(`/jobs/${job1.jobId}/approve`, { reason: 'answered the question' },
    { 'X-Job-Token': job1.claimToken });
  if (approve.status !== 200) {
    throw new Error(`approve failed (${approve.status}): ${approve.json?.error || 'no reason given'}`);
  }
  console.log(`[prove-live] approved -> ${approve.json.state}, tx ${approve.json.tx}`);
  results.push({ case: 'buyer approves', job: job1.jobId, settleTx: job1.settleTx,
                 decisionTx: approve.json.tx, state: approve.json.state });

  // ---- case 2: buyer rejects, buyer gets refunded ------------------------------------------
  const q2 = 'Summarise the HTS token association rules.';
  const r2 = await post('/work', { question: q2 });
  const payment2 = await buildPaymentFor(r2.json.accepts[0]);
  const paid2 = await post('/work', { question: q2 },
    { 'X-PAYMENT': Buffer.from(JSON.stringify(payment2)).toString('base64') });
  const job2 = paid2.json;
  const reject = await post(`/jobs/${job2.jobId}/reject`, { reason: 'not specific enough' },
    { 'X-Job-Token': job2.claimToken });
  if (reject.status !== 200) {
    throw new Error(`reject failed (${reject.status}): ${reject.json?.error || 'no reason given'}`);
  }
  console.log(`[prove-live] rejected -> ${reject.json.state}, tx ${reject.json.tx}`);
  results.push({ case: 'buyer rejects', job: job2.jobId, settleTx: job2.settleTx,
                 decisionTx: reject.json.tx, state: reject.json.state });

  // ---- case 3: buyer says nothing, Hedera's scheduled transaction pays the seller -----------
  // Only meaningful with a short review window: run the seller with REVIEW_MINUTES=1 for this.
  const reviewMs = (health.reviewMinutes ?? 10) * 60 * 1000;
  let deadlineCase = null;
  if (reviewMs <= 3 * 60 * 1000) {
    const q3 = 'Does the scheduled release pay the seller when the buyer says nothing?';
    const r3 = await post('/work', { question: q3 });
    const payment3 = await buildPaymentFor(r3.json.accepts[0]);
    const paid3 = await post('/work', { question: q3 },
      { 'X-PAYMENT': Buffer.from(JSON.stringify(payment3)).toString('base64') });
    const job3 = paid3.json;
    console.log(`[prove-live] job ${job3.jobId} paid, schedule ${job3.escrow.scheduleId}, expires ${job3.escrow.releasesAt}`);
    console.log('[prove-live] waiting for the scheduled transaction to execute (not touching it)...');

    const until = Date.now() + reviewMs + 150000;
    let final = null;
    while (Date.now() < until) {
      const j = await (await fetch(`${SELLER}/jobs/${job3.jobId}`)).json();
      if (j.state === 'released') { final = j; break; }
      await sleep(5000);
    }
    if (!final) {
      console.log('[prove-live] the scheduled release did not land in time');
    } else {
      const byChain = (final.evidence || []).some((e) => e.payload?.by === 'hedera-scheduled-transaction');
      console.log(`[prove-live] released by ${byChain ? 'the Hedera scheduled transaction' : 'the fallback sweep'}, tx ${final.decisionTx}`);
      deadlineCase = { case: 'buyer says nothing', job: job3.jobId, settleTx: job3.settleTx,
                       decisionTx: final.decisionTx, state: final.state,
                       scheduleId: job3.escrow.scheduleId, byChain };
      results.push(deadlineCase);
    }
  } else {
    console.log(`[prove-live] skipping the deadline case — review window is ${reviewMs / 60000} min.`);
    console.log('[prove-live] re-run with REVIEW_MINUTES=1 on the seller to include it.');
  }

  // ---- verify against the ledger ------------------------------------------------------------
  const checks = [];
  if (live) {
    for (const r of results) {
      for (const [label, tx] of [['settlement', r.settleTx], ['decision', r.decisionTx]]) {
        const m = await mirrorHasTransaction(tx);
        checks.push({ job: r.job, label, tx, ...m });
        console.log(`[prove-live] mirror node ${m.found ? 'CONFIRMS' : 'CANNOT FIND'} ${label} ${tx}${m.result ? ` (${m.result})` : ''}`);
      }
    }
  }

  let evidence = [];
  if (live && health.evidenceTopic && /^\d+\.\d+\.\d+$/.test(health.evidenceTopic)) {
    await sleep(4000);
    evidence = await topicMessages(health.evidenceTopic);
    console.log(`[prove-live] evidence topic holds ${evidence.length} messages readable by anyone`);
  }

  const allFound = checks.length > 0 && checks.every((c) => c.found);
  const lines = [
    '# Held — proof of a live run',
    '',
    `Run at ${new Date().toISOString()}`,
    `Settlement tier: **${tier.name}** — ${tier.label}`,
    `Asset: ${payAsset().symbol} (${payAsset().id})`,
    '',
    live
      ? (allFound
          ? '**Every transaction below was confirmed by an independent read of the Hedera mirror node.**'
          : '**WARNING: at least one transaction could not be found on the mirror node. Treat this run as unproven.**')
      : '**This run was on the local stand-in tier. It proves the product logic and NOTHING about Hedera.**',
    '',
    '## Cases exercised',
    '',
    '| case | job | state | settlement tx | decision tx |',
    '|---|---|---|---|---|',
    ...results.map((r) => `| ${r.case} | \`${r.job.slice(0, 8)}\` | ${r.state} | \`${r.settleTx}\` | \`${r.decisionTx}\` |`),
    '',
  ];
  if (checks.length) {
    lines.push('## Independent mirror-node verification', '',
      '| job | what | transaction | found | result |', '|---|---|---|---|---|',
      ...checks.map((c) => `| \`${c.job.slice(0, 8)}\` | ${c.label} | \`${c.tx}\` | ${c.found ? 'yes' : 'NO'} | ${c.result || '-'} |`), '');
  }
  if (deadlineCase) {
    lines.push('## The deadline case', '',
      `The buyer was not asked and did nothing. Hedera's own scheduled transaction`,
      `\`${deadlineCase.scheduleId}\` released the escrow at expiry` +
      (deadlineCase.byChain ? ' — the service only observed it.' : ' (fallback sweep was used).'),
      `Look it up: https://hashscan.io/testnet/schedule/${deadlineCase.scheduleId}`, '');
  }
  if (health.escrow && /^\d+\.\d+\.\d+$/.test(health.escrow)) {
    lines.push('## Look it up yourself', '',
      `- escrow account: https://hashscan.io/testnet/account/${health.escrow}`,
      `- evidence topic: https://hashscan.io/testnet/topic/${health.evidenceTopic}`, '');
  }
  if (evidence.length) {
    lines.push('## Evidence trail as recorded on consensus', '', '```',
      ...evidence.map((e) => `${e.at}  ${e.type.padEnd(18)} ${JSON.stringify(e.payload).slice(0, 100)}`), '```', '');
  }
  fs.mkdirSync('evidence', { recursive: true });
  fs.writeFileSync('evidence/PROOF.md', lines.join('\n'));
  console.log('\n[prove-live] wrote evidence/PROOF.md');
  if (live && !allFound) process.exit(1);
}

main().catch((e) => { console.error('[prove-live] failed:', e.message); process.exit(1); });
