// The worker must never misreport which tier produced a deliverable (invariant I8).
//
//   node scripts/test-worker.js
//
// This exists because config.js once detected a `gemini` tier that doWork had no branch for: it
// silently ran the deterministic responder while stamping "gemini" and a model name on the receipt.
// A key would have appeared to work and changed nothing.
// Force the bottom tier before importing the worker. Free-tier Gemini allows 20 requests per day
// per model; a test suite that burns them is a test suite that breaks the demo.
for (const k of ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'GEMINI_API_KEY', 'OLLAMA_HOST']) delete process.env[k];

import { doWork, agentVersion } from '../src/worker.js';

let pass = 0, fail = 0;
const ok = (n) => { pass++; console.log(`  PASS  ${n}`); };
const no = (n, d = '') => { fail++; console.log(`  FAIL  ${n}${d ? ` — ${d}` : ''}`); };

// Every tier config.js can select must have a runner, or the receipt lies.
const { workerTier } = await import('../src/config.js');
const SELECTABLE = ['anthropic', 'openai', 'gemini', 'ollama', 'deterministic'];
const src = await (await import('node:fs')).promises.readFile(
  new URL('../src/worker.js', import.meta.url), 'utf8');
for (const tier of SELECTABLE) {
  if (tier === 'deterministic') { ok(`"${tier}" is handled explicitly`); continue; }
  new RegExp(`\\b${tier}:\\s*run`, 'i').test(src)
    ? ok(`"${tier}" has a runner wired in RUNNERS`)
    : no(`"${tier}" can be selected but has no runner`, 'it would silently fall through');
}

const r = await doWork('one sentence: what is escrow?');
r.output && r.output.length > 20 ? ok('a deliverable is always produced') : no('empty deliverable');

// The receipt must agree with what actually ran.
const ranDeterministic = r.workerTier.startsWith('deterministic');
ranDeterministic
  ? (r.model === 'none' && r.degraded
      ? ok('a deterministic run reports model "none" and degraded')
      : no('a deterministic run misreports itself', `model=${r.model} degraded=${r.degraded}`))
  : (r.model && r.model !== 'none'
      ? ok(`a real model run reports its model (${r.model})`)
      : no('a model run reports no model'));

ranDeterministic && !/no model ran/i.test(r.output)
  ? no('the deterministic output does not say so in its own text')
  : ok('the output itself states when no model ran');

r.failedOver
  ? (/sk-|AIza|302e0201/.test(r.failedOver)
      ? no('a secret-shaped string survived redaction in the failover reason')
      : ok('the failover reason carries nothing secret-shaped'))
  : ok('no failover this run');

agentVersion().id.startsWith('held-worker:')
  ? ok('the agent version id is well formed') : no('bad agent version id');

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
