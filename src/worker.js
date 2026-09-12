// The agent that actually does the paid work. Four tiers, highest available wins, and the tier is
// stamped on the deliverable so nobody has to guess which one ran.
//
// The version id is the part that matters for OutcomeLock: it is a hash of the prompt template,
// the model name and this file's own source. Change any of them and the id changes, so "which
// version of the agent produced this" is a checkable fact rather than a claim.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { workerTier } from './config.js';

const PROMPT_TEMPLATE =
  'You are a research assistant. Answer the question below in at most 200 words. ' +
  'Be concrete and cite nothing you cannot support.\n\nQuestion: ';

const MODELS = {
  anthropic: 'claude-opus-5',
  openai: 'gpt-4o-mini',
  gemini: 'gemini-2.0-flash',
  ollama: process.env.OLLAMA_MODEL || 'llama3.1',
  deterministic: 'none',
};

// An upstream error can echo request details back at us. It is stored on the job and the job is
// served publicly, so nothing secret-shaped may survive this, and the public form is a category
// rather than the provider's prose.
const SECRET_SHAPES = [
  /sk-ant-[A-Za-z0-9_-]{6,}/g, /\bsk-[A-Za-z0-9]{12,}/g, /\bAIza[0-9A-Za-z_-]{10,}/g,
  /302e020100300506032b6570[0-9a-f]{10,}/gi, /\bAKIA[0-9A-Z]{10,}/g,
  /\b[A-Fa-f0-9]{40,}\b/g,                    // long hex: keys, seeds, raw material
  /\bBearer\s+[A-Za-z0-9._-]{10,}/gi,
];
function redact(text) {
  let out = String(text);
  for (const re of SECRET_SHAPES) out = out.replace(re, '[REDACTED]');
  return out;
}

// What a buyer is allowed to know: that a tier was lost, and roughly why. Never the provider's
// raw response.
function classify(err) {
  const e = String(err).toLowerCase();
  if (e.includes('credit balance') || e.includes('quota') || e.includes('billing')) {
    return 'the model provider refused on billing or quota';
  }
  if (e.includes('401') || e.includes('403') || e.includes('unauthor')) {
    return 'the model provider rejected our credentials';
  }
  if (e.includes('429')) return 'the model provider rate-limited us';
  if (e.includes('timeout') || e.includes('econnrefused') || e.includes('fetch failed')) {
    return 'the model provider was unreachable';
  }
  return 'the model provider failed';
}

export function agentVersion() {
  const tier = workerTier();
  const src = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8');
  const id = crypto.createHash('sha256')
    .update(PROMPT_TEMPLATE).update(MODELS[tier.name] || 'none').update(src)
    .digest('hex').slice(0, 16);
  return { id: `outcomelock-worker:${id}`, tier: tier.name, model: MODELS[tier.name], degraded: tier.degraded };
}

async function runAnthropic(question) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODELS.anthropic, max_tokens: 600,
      messages: [{ role: 'user', content: PROMPT_TEMPLATE + question }],
    }),
  });
  if (!r.ok) throw new Error(`anthropic ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const d = await r.json();
  return d.content.map((c) => c.text).join('');
}

async function runOllama(question) {
  const host = process.env.OLLAMA_HOST || 'http://localhost:11434';
  const r = await fetch(`${host}/api/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODELS.ollama, prompt: PROMPT_TEMPLATE + question, stream: false }),
  });
  if (!r.ok) throw new Error(`ollama ${r.status}`);
  return (await r.json()).response;
}

// No key, no model, still a real deliverable. It restates the question, lists what answering it
// would need, and says plainly that no model ran. That is enough to exercise the escrow, which is
// the thing being demonstrated.
function runDeterministic(question) {
  const words = question.trim().split(/\s+/).filter(Boolean);
  return [
    'DETERMINISTIC WORKER — NO MODEL RAN.',
    '',
    `Question received: ${question.trim()}`,
    `Length: ${words.length} words.`,
    '',
    'To answer this properly an agent would need:',
    ...words.filter((w) => w.length > 6).slice(0, 5).map((w) => `  - source material on "${w.replace(/[^\w-]/g, '')}"`),
    '',
    'No model was available on this run, so no answer is asserted. This deliverable exists so the',
    'buyer has something concrete to approve or reject, which is what the escrow is being tested on.',
  ].join('\n');
}

export async function doWork(question) {
  const tier = workerTier();
  const version = agentVersion();
  const started = Date.now();
  let output, failedOver = null;
  try {
    if (tier.name === 'anthropic') output = await runAnthropic(question);
    else if (tier.name === 'ollama') output = await runOllama(question);
    else output = runDeterministic(question);
  } catch (e) {
    // A dead key must not take the demo down; it costs a tier and says so.
    failedOver = redact(String(e.message || e)).slice(0, 300);
    output = runDeterministic(question);
  }
  return {
    output,
    agentVersion: version.id,
    workerTier: failedOver ? 'deterministic (failed over)' : tier.name,
    model: failedOver ? 'none' : version.model,
    degraded: failedOver ? true : tier.degraded,
    failedOver,                                        // redacted, for the operator's logs
    failedOverPublic: failedOver ? classify(failedOver) : null,   // safe to serve to a buyer
    ms: Date.now() - started,
  };
}
