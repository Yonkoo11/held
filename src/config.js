// Tier selection. The app picks the highest tier it can actually run, prints which one it chose,
// and stamps that tier on every receipt and evidence entry. A demo on a lower tier is still a
// real demo — it just says so out loud.

export const HEDERA_TESTNET_USDC = '0.0.429274';   // verified on the mirror node 2026-09-10
export const HEDERA_USDC_DECIMALS = 6;
export const HEDERA_CAIP2 = 'hedera:testnet';
export const FACILITATOR_URL = process.env.FACILITATOR_URL || 'https://api.testnet.blocky402.com';
export const MIRROR_NODE = 'https://testnet.mirrornode.hedera.com';

const env = (k) => {
  const v = process.env[k];
  return v && v.trim() ? v.trim() : null;
};

// Settlement tier: real Hedera if we hold an operator key, otherwise a local stand-in.
export function settlementTier() {
  if (env('HEDERA_OPERATOR_ID') && env('HEDERA_OPERATOR_KEY')) {
    return { name: 'hedera-testnet', degraded: false,
             label: 'Hedera testnet — real USDC, real escrow account' };
  }
  return { name: 'local-standin', degraded: true,
           label: 'LOCAL SIMULATION — NOT HEDERA TESTNET' };
}

// Evidence tier: HCS topic if we can reach the network with a key, otherwise an append-only file.
export function evidenceTier() {
  if (env('HEDERA_OPERATOR_ID') && env('HEDERA_OPERATOR_KEY')) {
    return { name: 'hcs', degraded: false, label: 'Hedera Consensus Service topic' };
  }
  return { name: 'file', degraded: true,
           label: 'LOCAL APPEND-ONLY FILE — NOT HCS' };
}

// Worker tier: four levels, in priority order. The bottom one needs no key and still produces a
// real deliverable, which is enough to demonstrate the escrow mechanism.
export function workerTier() {
  if (env('ANTHROPIC_API_KEY')) return { name: 'anthropic', degraded: false, label: 'Claude' };
  if (env('OPENAI_API_KEY'))    return { name: 'openai',    degraded: false, label: 'OpenAI' };
  if (env('GEMINI_API_KEY'))    return { name: 'gemini',    degraded: false, label: 'Gemini' };
  if (env('OLLAMA_HOST'))       return { name: 'ollama',    degraded: true,  label: 'local ollama' };
  return { name: 'deterministic', degraded: true,
           label: 'DETERMINISTIC WORKER — NO MODEL' };
}

export function tiers() {
  return { settlement: settlementTier(), evidence: evidenceTier(), worker: workerTier() };
}

export function printTiers(who) {
  const t = tiers();
  console.log(`[${who}] tiers in use:`);
  for (const [k, v] of Object.entries(t)) {
    console.log(`  ${k.padEnd(11)} ${v.degraded ? 'DEGRADED' : 'full    '}  ${v.label}`);
  }
  return t;
}
