// The three endings, end to end, with no fixed sleeps.
//
//   node scripts/regression.js
//
// It starts its own seller with a short review window, drives all three paths, and polls for the
// deadline release instead of guessing how long to wait. Written after a hand-run check reported
// "auto-release fired: 0" purely because it looked a few seconds before the sweep interval — on the
// Hedera run a genuine failure and a mistimed look would be indistinguishable, so the guessing had
// to go.
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const PORT = Number(process.env.REGRESSION_PORT || 4099);
const BASE = `http://127.0.0.1:${PORT}`;
const REVIEW_SECONDS = 20;
const SWEEP_INTERVAL_MS = 15000;   // seller sweeps on this interval

let pass = 0, fail = 0;
const ok = (m) => { pass++; console.log(`  PASS  ${m}`); };
const no = (m, d = '') => { fail++; console.log(`  FAIL  ${m}${d ? ` — ${d}` : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function req(path, { method = 'GET', body, token } = {}) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { 'X-Job-Token': token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, json: await r.json().catch(() => null) };
}

const buy = (question) => req('/demo/buy', { method: 'POST', body: { question } });
const state = async (id) => (await req(`/jobs/${id}`)).json?.state;

// Poll for a condition rather than sleeping a guessed amount. Returns the value or null on timeout.
async function waitFor(label, fn, timeoutMs, everyMs = 1000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    const v = await fn();
    if (v) return v;
    await sleep(everyMs);
  }
  console.log(`  (timed out after ${Math.round(timeoutMs / 1000)}s waiting for ${label})`);
  return null;
}

async function main() {
  console.log('\nStarting a seller for the regression run...');
  const seller = spawn(process.execPath, ['src/seller.js'], {
    env: { ...process.env, PORT: String(PORT), DEMO_BUY: 'on',
           REVIEW_MINUTES: String(REVIEW_SECONDS / 60) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  seller.stdout.on('data', (d) => { log += d; });
  seller.stderr.on('data', (d) => { log += d; });

  const up = await waitFor('the seller to listen', async () => {
    try { return (await fetch(`${BASE}/health`)).ok; } catch { return false; }
  }, 30000);
  if (!up) { console.error('seller never came up:\n' + log); seller.kill(); process.exit(1); }
  console.log(`  seller up on ${BASE}, review window ${REVIEW_SECONDS}s\n`);

  try {
    // 1 — approve pays the seller.
    console.log('1. buyer approves');
    const a = await buy('regression: approve path');
    ok('a paid job starts held');
    if (a.json?.escrow?.state !== 'held') no('job did not start held', a.json?.escrow?.state);
    const ap = await req(`/jobs/${a.json.jobId}/approve`, {
      method: 'POST', token: a.json.claimToken, body: { reason: 'answered it' } });
    ap.status === 200 && ap.json.state === 'released'
      ? ok('approve releases to the seller') : no('approve did not release', `${ap.status}`);

    // 2 — reject refunds the buyer.
    console.log('2. buyer rejects');
    const b = await buy('regression: reject path');
    const rj = await req(`/jobs/${b.json.jobId}/reject`, {
      method: 'POST', token: b.json.claimToken, body: { reason: 'not what I asked' } });
    rj.status === 200 && rj.json.state === 'refunded'
      ? ok('reject refunds the buyer') : no('reject did not refund', `${rj.status}`);

    // 3 — silence pays the seller at the deadline. Polled, never guessed.
    console.log(`3. buyer says nothing (waiting out a ${REVIEW_SECONDS}s window, polling)`);
    const c = await buy('regression: deadline path');
    const settled = await waitFor('the deadline sweep',
      async () => (await state(c.json.jobId)) === 'released',
      REVIEW_SECONDS * 1000 + SWEEP_INTERVAL_MS + 15000);
    settled ? ok('silence auto-releases at the deadline')
            : no('job never auto-released', `still ${await state(c.json.jobId)}`);

    // 4 — the trail has to survive all of it.
    console.log('4. evidence trail');
    const full = (await req(`/jobs/${c.json.jobId}`)).json;
    const types = (full.evidence || []).map((e) => e.type);
    for (const want of ['paid', 'delivered', 'escrow-scheduled', 'released']) {
      types.includes(want) ? ok(`trail records "${want}"`) : no(`trail is missing "${want}"`, types.join(','));
    }
    const byDeadline = (full.evidence || []).find((e) => e.type === 'released')?.payload?.by;
    byDeadline === 'deadline' ? ok('the release is attributed to the deadline, not a buyer')
                              : no('release attributed wrongly', String(byDeadline));
  } finally {
    seller.kill();
    if (fail) fs.writeFileSync('/tmp/regression-seller.log', log);
  }

  console.log(`\n${pass} passed, ${fail} failed\n`);
  if (fail) console.log('seller log written to /tmp/regression-seller.log');
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error('regression failed:', e.message); process.exit(1); });
