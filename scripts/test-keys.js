// Key handling, tested. This exists because `PrivateKey.fromStringED25519()` accepts a raw ECDSA
// key silently and returns a different key, and the portal issues ECDSA by default — so the
// mistake is the common case, and it surfaces later as INVALID_SIGNATURE from the network.
//
//   node scripts/test-keys.js       (needs network for the two mirror-node cases)
import { PrivateKey } from '@hiero-ledger/sdk';
import { parsePrivateKey, accountKeyInfo } from '../src/hedera-key.js';

let pass = 0, fail = 0;
const t = (n, ok, d = '') => { ok ? (pass++, console.log(`  PASS  ${n}`))
                                 : (fail++, console.log(`  FAIL  ${n}${d ? ` — ${d}` : ''}`)); };

for (const [type, gen] of [['ECDSA_SECP256K1', () => PrivateKey.generateECDSA()],
                           ['ED25519', () => PrivateKey.generateED25519()]]) {
  const k = gen();
  for (const [label, form] of [['raw hex', k.toStringRaw()],
                               ['0x-prefixed raw hex', `0x${k.toStringRaw()}`],
                               ['DER', k.toStringDer()]]) {
    try {
      const { key } = parsePrivateKey(PrivateKey, form, type);
      t(`${type} supplied as ${label}`, key.publicKey.toStringRaw() === k.publicKey.toStringRaw(),
        'derived a different public key');
    } catch (e) { t(`${type} supplied as ${label}`, false, e.message.slice(0, 70)); }
  }
}

const ec = PrivateKey.generateECDSA();
t('a raw ECDSA key read as ED25519 derives the WRONG public key (the silent failure)',
  PrivateKey.fromStringED25519(ec.toStringRaw()).publicKey.toStringRaw() !== ec.publicKey.toStringRaw());
t('reading it with the ledger-declared type derives the right one',
  parsePrivateKey(PrivateKey, ec.toStringRaw(), 'ECDSA_SECP256K1').key.publicKey.toStringRaw()
    === ec.publicKey.toStringRaw());

try {
  const info = await accountKeyInfo('0.0.7162784');   // the Blocky402 fee payer, a real testnet account
  t('mirror node reports a real account\'s key type', Boolean(info.type), JSON.stringify(info).slice(0, 60));
} catch (e) { t('mirror node lookup', false, e.message.slice(0, 70)); }

try { await accountKeyInfo('0.0.999999999'); t('a nonexistent account is rejected', false); }
catch (e) { t('a nonexistent account is rejected readably', e.message.includes('never heard of')); }

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
