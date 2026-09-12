// The buying agent. It asks for work, gets a 402, pays, reads the deliverable, and then decides
// whether the seller keeps the money.
//
//   node src/buyer.js ask "your question"
//   node src/buyer.js approve <jobId> [reason]
//   node src/buyer.js reject  <jobId> [reason]
//   node src/buyer.js show    <jobId>
import fs from 'node:fs';
import path from 'node:path';
import { payAsset } from './config.js';
import { buildPaymentFor } from './payment.js';

// The claim token is handed out once, at payment. Keep it: without it this CLI cannot decide on
// its own jobs, which is the same rule that stops a stranger deciding on them.
const TOKENS = path.join(process.cwd(), process.env.DATA_DIR || 'data', 'buyer-tokens.json');
const readTokens = () => { try { return JSON.parse(fs.readFileSync(TOKENS, 'utf8')); } catch { return {}; } };
function saveToken(jobId, token) {
  const t = readTokens(); t[jobId] = token;
  fs.mkdirSync(path.dirname(TOKENS), { recursive: true });
  fs.writeFileSync(TOKENS, JSON.stringify(t, null, 2), { mode: 0o600 });
}

const SELLER = process.env.SELLER_URL || 'http://localhost:4021';

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64');

async function ask(question) {
  console.log(`[buyer] asking: ${question}`);
  const first = await fetch(`${SELLER}/work`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ question }),
  });
  if (first.status !== 402) {
    console.log(`[buyer] expected a 402, got ${first.status}:`, (await first.text()).slice(0, 300));
    return;
  }
  const required = await first.json();
  const accepted = required.accepts[0];
  const lock = required.extensions?.held;
  console.log(`[buyer] 402 payment required`);
  console.log(`         price     ${Number(accepted.amount) / 10 ** payAsset().decimals} ${payAsset().symbol} (asset ${accepted.asset})`);
  console.log(`         network   ${accepted.network}`);
  console.log(`         payTo     ${accepted.payTo}   <- escrow, not the seller`);
  console.log(`         policy    ${lock?.releasePolicy ?? 'n/a'}`);

  const payment = await buildPaymentFor(accepted);
  const paid = await fetch(`${SELLER}/work`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-PAYMENT': b64(payment) },
    body: JSON.stringify({ question }),
  });
  const body = await paid.json();
  if (!paid.ok) { console.log(`[buyer] payment rejected (${paid.status}):`, body.error); return; }

  if (body.claimToken) saveToken(body.jobId, body.claimToken);
  console.log(`\n[buyer] paid. job ${body.jobId}`);
  console.log(`[buyer] settlement tx ${body.settleTx}`);
  console.log(`[buyer] money is HELD in ${body.escrow.account}, releases at ${body.escrow.releasesAt}`);
  console.log(`[buyer] agent version ${body.agentVersion} (tier: ${body.workerTier}, model: ${body.model})`);
  console.log(`\n--- deliverable ---\n${body.deliverable}\n-------------------`);
  console.log(`\n[buyer] decide with:`);
  console.log(`   node src/buyer.js approve ${body.jobId}`);
  console.log(`   node src/buyer.js reject  ${body.jobId} "not what I asked for"`);
}

async function decide(action, jobId, reason) {
  const token = readTokens()[jobId];
  if (!token) {
    console.log(`[buyer] no claim token stored for ${jobId} — this CLI did not pay for that job.`);
    return;
  }
  const r = await fetch(`${SELLER}/jobs/${jobId}/${action}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-Job-Token': token },
    body: JSON.stringify({ reason }),
  });
  const b = await r.json();
  if (!r.ok) { console.log(`[buyer] ${action} failed:`, b.error); return; }
  console.log(`[buyer] job ${b.jobId} is now ${b.state} (tx ${b.tx})`);
}

async function show(jobId) {
  const r = await fetch(`${SELLER}/jobs/${jobId}`);
  const j = await r.json();
  if (!r.ok) { console.log('[buyer]', j.error); return; }
  console.log(`job      ${j.id}`);
  console.log(`state    ${j.state}`);
  console.log(`amount   ${j.amountDisplay} ${j.assetSymbol || ''}`);
  console.log(`agent    ${j.agentVersion} (${j.workerTier})`);
  console.log(`hash     ${j.deliverableHash}`);
  console.log(`\nevidence trail${j.evidenceUrl ? ` (${j.evidenceUrl})` : ''}:`);
  for (const e of j.evidence) {
    console.log(`  ${e.at}  ${e.type.padEnd(18)} ${e.degraded ? '[degraded] ' : ''}${JSON.stringify(e.payload).slice(0, 110)}`);
  }
}

const [cmd, ...rest] = process.argv.slice(2);
const run = {
  ask: () => ask(rest.join(' ')),
  approve: () => decide('approve', rest[0], rest.slice(1).join(' ')),
  reject: () => decide('reject', rest[0], rest.slice(1).join(' ')),
  show: () => show(rest[0]),
}[cmd];
if (!run) {
  console.log('usage: node src/buyer.js ask "question" | approve <id> | reject <id> [reason] | show <id>');
  process.exit(1);
}
run().catch((e) => { console.error('[buyer]', e.message); process.exit(1); });
