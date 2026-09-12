// The agent that actually does the paid work. Four tiers, highest available wins, and the tier is
// stamped on the deliverable so nobody has to guess which one ran.
//
// The version id is the part that matters for OutcomeLock: it is a hash of the prompt template,
// the model name and this file's own source. Change any of them and the id changes, so "which
// version of the agent produced this" is a checkable fact rather than a claim.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { workerTier, workerTiers } from './config.js';

const PROMPT_TEMPLATE =
  'You are a research assistant. Answer the question below in at most 120 words of plain prose. ' +
  'Write continuous sentences. Do NOT use markdown, asterisks, bullet points, numbered lists or ' +
  'headings. Be concrete and claim nothing you cannot support.\n\nQuestion: ';

const MODELS = {
  anthropic: process.env.ANTHROPIC_MODEL || 'claude-opus-5',
  openai: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  // Free-tier Gemini quota is **20 requests per day, per project, PER MODEL**. Switching model name
  // therefore switches quota bucket. `gemini-2.0-flash` is retired (404 on a valid key) and
  // `gemini-flash-latest` is an alias whose bucket is easily exhausted; `gemini-2.5-flash` works and
  // draws from its own. Override with GEMINI_MODEL. A 404 lists what the key can actually use.
  gemini: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
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

// The version id covers the model that ACTUALLY ran, not the one we hoped to run. If a dead key
// pushes the work down to a different provider, that is a different agent and says so.
export function agentVersion(tierName) {
  const tier = tierName
    ? (workerTiers().find((t) => t.name === tierName) || { name: tierName, degraded: true })
    : workerTier();
  const src = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8');
  const id = crypto.createHash('sha256')
    .update(PROMPT_TEMPLATE).update(MODELS[tier.name] || 'none').update(src)
    .digest('hex').slice(0, 16);
  return { id: `outcomelock-worker:${id}`, tier: tier.name,
           model: MODELS[tier.name] || 'none', degraded: tier.degraded };
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

async function runOpenAI(question) {
  return withRetry('openai', () => openAIOnce(question));
}

async function openAIOnce(question) {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODELS.openai, max_tokens: 600,
      messages: [{ role: 'user', content: PROMPT_TEMPLATE + question }],
    }),
  });
  if (!r.ok) throw new Error(`openai ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return (await r.json()).choices[0].message.content;
}

// Google AI Studio. The key goes in a header, never the query string, so it cannot end up in a
// proxy log or an error URL.
// Transient upstream failures are normal and must not cost the tier. Observed against Gemini on
// 2026-09-12: intermittent 503 on an otherwise healthy key, two calls in three.
async function withRetry(label, fn, tries = 3) {
  let last;
  for (let i = 1; i <= tries; i++) {
    try { return await fn(); } catch (e) {
      last = e;
      const msg = String(e.message);
      // A per-DAY quota will not clear in a few seconds. Retrying it just wastes the demo's time
      // and delays the fall-through to a tier that can actually answer.
      if (/PerDay|RequestsPerDay/i.test(msg)) throw e;
      const retryable = /\b(429|500|502|503|504)\b|overload|unavailable|fetch failed/i.test(msg);
      if (!retryable || i === tries) throw e;
      // Honour the provider's own retry hint when it gives one.
      const hinted = msg.match(/"retryDelay"\s*:\s*"(\d+)s"/);
      const waitMs = hinted ? Math.min(Number(hinted[1]) * 1000, 8000) : 700 * i;
      await new Promise((ok) => setTimeout(ok, waitMs));
      continue;
    }
  }
  throw last;
}

async function runGemini(question) {
  return withRetry('gemini', () => geminiOnce(question));
}

async function geminiOnce(question) {
  const model = MODELS.gemini;
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify({
        contents: [{ parts: [{ text: PROMPT_TEMPLATE + question }] }],
        generationConfig: {
          maxOutputTokens: 800,
          // Current flash models think by default, and those tokens come out of the same budget.
          // We want a short factual answer, so the thinking is pure cost: it can consume the whole
          // allowance and return finishReason MAX_TOKENS with no text at all.
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    });
  if (!r.ok) {
    const body = (await r.text()).slice(0, 200);
    if (r.status === 404) {
      // A 404 here nearly always means a retired model name, not a bad key. Say which names work
      // rather than leaving the operator to guess.
      let usable = '';
      try {
        const l = await fetch('https://generativelanguage.googleapis.com/v1beta/models',
          { headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY } });
        if (l.ok) {
          const names = ((await l.json()).models || [])
            .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
            .map((m) => m.name.replace('models/', '')).slice(0, 5);
          if (names.length) usable = ` Your key can use: ${names.join(', ')}.`;
        }
      } catch { /* the 404 is the useful part */ }
      throw new Error(`gemini: model "${model}" is not available to this key.${usable} Set GEMINI_MODEL.`);
    }
    throw new Error(`gemini ${r.status}: ${body}`);   // 429/5xx are retried by withRetry
  }
  const d = await r.json();
  const text = (d.candidates?.[0]?.content?.parts || []).map((p) => p.text).filter(Boolean).join('');
  if (!text) throw new Error(`gemini returned no text (finishReason: ${d.candidates?.[0]?.finishReason})`);
  return text;
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

// Truncating a joined list drops the tail, and the tail is the failure that actually decided the
// outcome. Keep every tier's reason, trimming each one rather than the whole string.
function summariseAttempts(attempted) {
  if (!attempted.length) return null;
  return attempted.map((a) => `${a.tier}: ${a.error.slice(0, 120)}`).join(' | ');
}

export async function doWork(question) {
  const started = Date.now();

  // Every non-deterministic tier MUST have a runner here. A missing one used to fall through to the
  // deterministic responder while still reporting the tier's name and model on the receipt — a
  // false claim in the evidence trail, and exactly what invariant I8 forbids.
  const RUNNERS = {
    anthropic: runAnthropic,
    openai: runOpenAI,
    gemini: runGemini,
    ollama: runOllama,
  };

  const attempted = [];
  for (const tier of workerTiers()) {
    if (tier.name === 'deterministic') {
      const version = agentVersion('deterministic');
      return {
        output: runDeterministic(question),
        agentVersion: version.id,
        workerTier: attempted.length ? 'deterministic (failed over)' : 'deterministic',
        model: 'none',
        degraded: true,
        attempted,
        failedOver: summariseAttempts(attempted),
        failedOverPublic: attempted.length ? classify(attempted[attempted.length - 1].error) : null,
        ms: Date.now() - started,
      };
    }
    const run = RUNNERS[tier.name];
    if (!run) {
      attempted.push({ tier: tier.name, error: 'no runner implemented' });
      continue;
    }
    try {
      const output = await run(question);
      const version = agentVersion(tier.name);
      return {
        output,
        agentVersion: version.id,
        workerTier: attempted.length ? `${tier.name} (after ${attempted.length} failed)` : tier.name,
        model: version.model,
        degraded: tier.degraded,
        attempted,
        failedOver: summariseAttempts(attempted),
        failedOverPublic: attempted.length ? classify(attempted[attempted.length - 1].error) : null,
        ms: Date.now() - started,
      };
    } catch (e) {
      // A dead key costs a tier, never the demo. Try the next provider down.
      attempted.push({ tier: tier.name, error: redact(String(e.message || e)).slice(0, 200) });
    }
  }
  throw new Error('unreachable: the deterministic tier is always last');
}
