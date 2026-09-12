// Adversarial tests. These are the checks a reviewer would run against a service that moves money,
// written as a harness so they can be re-run after any change rather than done once by hand.
//
//   node scripts/attack.js          (seller must be running with DEMO_BUY=on)
//
// WARNING: this runs against whatever seller SELLER_URL points at and its jobs land in that
// seller's data directory. Run it against a test instance, not the one you are about to film:
//   DATA_DIR=data-test PORT=4099 DEMO_BUY=on npm run seller
//   SELLER_URL=http://localhost:4099 node scripts/attack.js
//
// Each case states the attack, the expected defence, and fails loudly if the defence is missing.
const SELLER = process.env.SELLER_URL || 'http://localhost:4021';

let pass = 0, fail = 0;
function check(name, ok, detail = '') {
  if (ok) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
}

async function req(path, { method = 'GET', body, token, headers = {} } = {}) {
  const r = await fetch(`${SELLER}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token !== undefined ? { 'X-Job-Token': token } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, json: await r.json().catch(() => null) };
}

const buy = async (question) => (await req('/demo/buy', { method: 'POST', body: { question } }));

async function main() {
  console.log(`\nAttacking ${SELLER}\n`);

  // 1 — the original hole: anyone who learns a job id could release the money.
  console.log('1. a stranger tries to release someone else\'s escrow');
  const a = await buy('attack: stranger approval');
  if (a.status !== 200) throw new Error(`could not set up: ${JSON.stringify(a.json)}`);
  const strangerApprove = await req(`/jobs/${a.json.jobId}/approve`, {
    method: 'POST', body: { reason: 'I am not the buyer' },
  });
  check('stranger with no token is refused', strangerApprove.status === 403,
    `got ${strangerApprove.status}`);
  const wrongToken = await req(`/jobs/${a.json.jobId}/approve`, {
    method: 'POST', token: 'f'.repeat(64), body: { reason: 'guessed' },
  });
  check('stranger with a wrong token is refused', wrongToken.status === 403, `got ${wrongToken.status}`);

  // 2 — the real buyer must still be able to act.
  console.log('2. the buyer who paid uses their token');
  const realApprove = await req(`/jobs/${a.json.jobId}/approve`, {
    method: 'POST', token: a.json.claimToken, body: { reason: 'it answered me' },
  });
  check('buyer with the right token succeeds', realApprove.status === 200 && realApprove.json.state === 'released',
    `got ${realApprove.status} ${JSON.stringify(realApprove.json)}`);

  // 3 — double-release. On Hedera there are several awaits inside release(), so a naive state
  //     check lets two concurrent approvals both pay out.
  console.log('3. five approvals fired at once on one job');
  const b = await buy('attack: concurrent release');
  const results = await Promise.all([1, 2, 3, 4, 5].map(() =>
    req(`/jobs/${b.json.jobId}/approve`, { method: 'POST', token: b.json.claimToken, body: { reason: 'race' } })));
  const ok = results.filter((r) => r.status === 200).length;
  check('exactly one approval is accepted', ok === 1, `${ok} were accepted`);
  const ledger = JSON.parse(await (await fetch(`${SELLER}/jobs/${b.json.jobId}`)).text());
  check('job ends in a settled state', ['released', 'refunded'].includes(ledger.state), `state=${ledger.state}`);

  // 4 — deciding twice.
  console.log('4. approving an already-settled job');
  const again = await req(`/jobs/${b.json.jobId}/approve`, {
    method: 'POST', token: b.json.claimToken, body: { reason: 'again' } });
  check('a settled job cannot be settled again', again.status === 409, `got ${again.status}`);

  // 5 — the jobs feed must not hand out the thing that authorises spending.
  console.log('5. reading the public job feed');
  const feed = await req('/jobs');
  const leaked = JSON.stringify(feed.json).includes('claimTokenHash');
  check('claim token hashes are not exposed', !leaked);
  const single = await req(`/jobs/${b.json.jobId}`);
  check('single job view does not expose it either', !JSON.stringify(single.json).includes('claimTokenHash'));

  // 5b — upstream error text must not reach a buyer. Providers echo request details in errors.
  console.log('5b. reading a job that failed over to a lower worker tier');
  const both = JSON.stringify([feed.json, single.json]);
  check('raw upstream error text is not served', !both.includes('"failedOver"'));
  check('a safe reason is served instead',
    !single.json.failedOverPublic || typeof single.json.failedOverPublic === 'string');
  for (const shape of [/sk-ant-[A-Za-z0-9_-]{6,}/, /\bsk-[A-Za-z0-9]{12,}/, /302e020100300506032b6570/i]) {
    check(`no ${shape.source.slice(0, 18)}… shaped string in the public job feed`, !shape.test(both));
  }

  // 6 — cost amplification. Every request runs a model and moves money.
  console.log('6. oversized input');
  const big = await req('/work', { method: 'POST', body: { question: 'x'.repeat(50000) } });
  check('an oversized question is rejected', big.status === 413, `got ${big.status}`);

  // 7 — unpaid access.
  console.log('7. asking for work without paying');
  const unpaid = await req('/work', { method: 'POST', body: { question: 'free please' } });
  check('work is refused without payment', unpaid.status === 402, `got ${unpaid.status}`);
  const junk = await req('/work', {
    method: 'POST', body: { question: 'free please' }, headers: { 'X-PAYMENT': 'bm90LWEtcGF5bWVudA==' } });
  check('a forged payment header is refused', junk.status === 402, `got ${junk.status}`);

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error('attack harness failed:', e.message); process.exit(1); });
