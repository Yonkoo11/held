// Resolving an operator key, without guessing.
//
// The Hedera portal issues ECDSA accounts by default and ED25519 on request, and shows the key as
// 0x-prefixed raw hex. Raw ECDSA and raw ED25519 are both 64 hex characters, so they cannot be told
// apart by looking. Worse, `PrivateKey.fromStringED25519()` accepts a raw ECDSA key without
// complaint and returns the wrong key — the failure surfaces later as INVALID_SIGNATURE from the
// network, which reads like a connectivity fault rather than a key-type mistake.
//
// So we do not guess. We ask the mirror node what key the account actually has, parse to match, and
// then verify that the private key we hold really does derive that public key. A typo, a key from a
// different account, or the wrong type all fail immediately with a sentence that says what to do.
import { MIRROR_NODE } from './config.js';

const strip = (s) => String(s || '').trim().replace(/^0x/i, '');

/** What the ledger says this account's key is. Public information only. */
export async function accountKeyInfo(accountId, attempt = 1) {
  let r;
  try {
    r = await fetch(`${MIRROR_NODE}/api/v1/accounts/${encodeURIComponent(accountId)}`);
  } catch (e) {
    // Transient `fetch failed` against the mirror node was observed twice on 2026-09-12, once
    // mid-payment. Retry rather than let a blip surface as a failed paid request.
    if (attempt >= 4) throw new Error(`mirror node unreachable after ${attempt} attempts: ${e.message}`);
    await new Promise((ok) => setTimeout(ok, 400 * attempt));
    return accountKeyInfo(accountId, attempt + 1);
  }
  if (r.status === 404) {
    throw new Error(`the mirror node has never heard of ${accountId}. Is it a testnet account id, in 0.0.x form?`);
  }
  if (!r.ok) throw new Error(`mirror node returned ${r.status} for ${accountId}`);
  const d = await r.json();
  if (!d.key?.key) throw new Error(`${accountId} has no simple public key on record (threshold or contract key?)`);
  return { type: d.key._type, publicKey: d.key.key, balanceHbar: Number(d.balance?.balance || 0) / 1e8 };
}

/**
 * Parse a private key in whatever form the portal gave it, for a known key type.
 * Accepts DER (302e…/3030…) or raw hex, with or without an 0x prefix.
 */
export function parsePrivateKey(PrivateKey, raw, type) {
  const s = strip(raw);
  if (!s) throw new Error('the key is empty');
  const isDer = /^30[0-9a-f]{2}02/i.test(s);
  const ecdsa = type === 'ECDSA_SECP256K1';
  const attempts = isDer
    ? [['DER', () => PrivateKey.fromStringDer(s)]]
    : ecdsa
      ? [['raw ECDSA', () => PrivateKey.fromStringECDSA(s)]]
      : [['raw ED25519', () => PrivateKey.fromStringED25519(s)]];
  // DER carries its own type, so a single attempt is enough; raw needs the ledger to tell us which.
  for (const [label, fn] of attempts) {
    try {
      const key = fn();
      if (key) return { key, format: label };
    } catch (e) {
      throw new Error(`could not read the key as ${label}: ${e.message}`);
    }
  }
  throw new Error('unrecognised private key format');
}

/**
 * Resolve and VERIFY an operator. Returns { key, format, type, balanceHbar }.
 * Throws with an actionable message rather than letting a wrong key fail later as a signature error.
 */
export async function resolveOperator(PrivateKey, accountId, rawKey) {
  const info = await accountKeyInfo(accountId);
  const { key, format } = parsePrivateKey(PrivateKey, rawKey, info.type);

  const derived = key.publicKey.toStringRaw().toLowerCase();
  const onLedger = strip(info.publicKey).toLowerCase();
  if (derived !== onLedger) {
    throw new Error(
      `the key in your environment file does not belong to ${accountId}.\n` +
      `  the ledger says that account's public key is ${onLedger.slice(0, 16)}…\n` +
      `  the key you supplied derives                 ${derived.slice(0, 16)}…\n` +
      `  -> copy both the account id and its key from the same portal account, or\n` +
      `     if the portal offered several key types, use the one shown as ${info.type}.`
    );
  }
  return { key, format, type: info.type, balanceHbar: info.balanceHbar };
}
