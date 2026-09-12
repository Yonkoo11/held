// Tier selection. The app picks the highest tier it can actually run, prints which one it chose,
// and stamps that tier on every receipt and evidence entry. A demo on a lower tier is still a
// real demo — it just says so out loud.

export const HEDERA_TESTNET_USDC = '0.0.429274';   // verified on the mirror node 2026-09-10
export const HEDERA_USDC_DECIMALS = 6;
export const HBAR_ASSET_ID = '0.0.0';              // the scheme's id for native HBAR
export const HBAR_DECIMALS = 8;                    // tinybars

// Which asset the service charges in.
//
// Default is HBAR, and that is a deliberate call: a fresh testnet account is funded with HBAR
// automatically, whereas testnet USDC needs a separate faucet we have not found one of. Pricing in
// HBAR means the only human step in this whole project is the portal signup. USDC still works —
// set PAY_ASSET=usdc once an account actually holds some.
export function payAsset() {
  const choice = (process.env.PAY_ASSET || 'hbar').toLowerCase();
  return choice === 'usdc'
    ? { id: HEDERA_TESTNET_USDC, decimals: HEDERA_USDC_DECIMALS, symbol: 'USDC', isHbar: false }
    : { id: HBAR_ASSET_ID, decimals: HBAR_DECIMALS, symbol: 'HBAR', isHbar: true };
}
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
             label: `Hedera testnet, real ${payAsset().symbol} in a real escrow account` };
  }
  return { name: 'local-standin', degraded: true,
           label: 'local simulation, not Hedera testnet' };
}

// Evidence tier: HCS topic if we can reach the network with a key, otherwise an append-only file.
export function evidenceTier() {
  if (env('HEDERA_OPERATOR_ID') && env('HEDERA_OPERATOR_KEY')) {
    return { name: 'hcs', degraded: false, label: 'Hedera Consensus Service topic' };
  }
  return { name: 'file', degraded: true,
           label: 'local append-only file, not HCS' };
}

// Worker tiers, in priority order. Every tier whose credential is present is a candidate, and the
// worker walks DOWN the list on failure rather than dropping straight to the bottom — a dead key at
// the top must not disqualify a working one below it.
const WORKER_TIERS = [
  { name: 'anthropic', key: 'ANTHROPIC_API_KEY', degraded: false, label: 'Claude' },
  { name: 'openai',    key: 'OPENAI_API_KEY',    degraded: false, label: 'OpenAI' },
  { name: 'gemini',    key: 'GEMINI_API_KEY',    degraded: false, label: 'Gemini' },
  { name: 'ollama',    key: 'OLLAMA_HOST',       degraded: true,  label: 'local ollama' },
];

/** Every tier we could try, best first, always ending in the one that needs nothing. */
export function workerTiers() {
  const available = WORKER_TIERS.filter((t) => env(t.key)).map(({ key, ...rest }) => rest);
  return [...available, { name: 'deterministic', degraded: true,
                          label: 'deterministic responder, no model' }];
}

/** The tier we would try first. Used for display; doWork() may end up lower down. */
export function workerTier() {
  return workerTiers()[0];
}

export function tiers() {
  const chain = workerTiers();
  const worker = { ...chain[0] };
  // Name the whole cascade. Saying "Claude" when a dead key means Gemini answers is the same false
  // attribution the receipts are not allowed to make.
  if (chain.length > 1) worker.label = chain.map((t) => t.name).join(' → ');
  return { settlement: settlementTier(), evidence: evidenceTier(), worker };
}

export function printTiers(who) {
  const t = tiers();
  console.log(`[${who}] tiers in use:`);
  for (const [k, v] of Object.entries(t)) {
    console.log(`  ${k.padEnd(11)} ${v.degraded ? 'DEGRADED' : 'full    '}  ${v.label}`);
  }
  return t;
}
