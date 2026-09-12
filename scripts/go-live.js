// One command that takes OutcomeLock from the local stand-in onto real Hedera testnet.
//
//   1. create a testnet account at https://portal.hedera.com/register  (the only human step)
//   2. put HEDERA_OPERATOR_ID and HEDERA_OPERATOR_KEY in your environment file
//   3. node scripts/go-live.js
//
// It creates the escrow and buyer accounts, opens the evidence topic, writes the new keys straight
// into your environment file, and prints only public ids. Private keys are never printed.
import fs from 'node:fs';
import path from 'node:path';
import { MIRROR_NODE, payAsset } from '../src/config.js';

const ENV_FILE = path.join(process.cwd(), process.env.ENV_FILE || '.env');
const need = (k) => {
  const v = process.env[k];
  if (!v || !v.trim()) {
    console.error(`\nMissing ${k}.`);
    console.error('Create a testnet account at https://portal.hedera.com/register (free, instant,');
    console.error('auto-funded with test HBAR), then put the account id and DER private key into');
    console.error(`${ENV_FILE} and run this again. Edit that file directly — never paste a key into a chat.\n`);
    process.exit(1);
  }
  return v.trim();
};

const HBAR_FUNDING = Number(process.env.FUND_HBAR || 20);

function appendEnv(lines) {
  const existing = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, 'utf8') : '';
  const keep = existing.endsWith('\n') || existing === '' ? existing : existing + '\n';
  fs.writeFileSync(ENV_FILE, keep + lines.join('\n') + '\n', { mode: 0o600 });
}

async function operatorBalance(id) {
  const r = await fetch(`${MIRROR_NODE}/api/v1/accounts/${id}`);
  if (!r.ok) throw new Error(`mirror node does not know account ${id} (http ${r.status}) — is the id right, and is it a testnet account?`);
  const d = await r.json();
  return Number(d.balance?.balance || 0) / 1e8;
}

async function main() {
  const operatorId = need('HEDERA_OPERATOR_ID');
  const operatorKey = need('HEDERA_OPERATOR_KEY');
  const asset = payAsset();

  console.log(`[go-live] operator ${operatorId}`);
  const bal = await operatorBalance(operatorId);
  console.log(`[go-live] operator balance: ${bal} HBAR`);
  if (bal < HBAR_FUNDING * 2 + 5) {
    console.error(`[go-live] not enough HBAR to fund two accounts (need about ${HBAR_FUNDING * 2 + 5}).`);
    console.error('[go-live] top up at https://portal.hedera.com/dashboard, or lower FUND_HBAR.');
    process.exit(1);
  }

  const {
    Client, PrivateKey, AccountId, Hbar,
    AccountCreateTransaction, TopicCreateTransaction,
  } = await import('@hiero-ledger/sdk');

  const client = Client.forTestnet();
  client.setOperator(AccountId.fromString(operatorId), PrivateKey.fromStringED25519(operatorKey));

  async function createAccount(label) {
    const key = PrivateKey.generateED25519();
    const rx = await (await new AccountCreateTransaction()
      .setKeyWithoutAlias(key.publicKey)
      .setInitialBalance(new Hbar(HBAR_FUNDING))
      .setMaxAutomaticTokenAssociations(10)   // so an HTS payment is never rejected at preflight
      .execute(client)).getReceipt(client);
    const id = rx.accountId.toString();
    console.log(`[go-live] created ${label}: ${id} (funded ${HBAR_FUNDING} HBAR)`);
    return { id, key: key.toStringDer() };
  }

  const escrow = await createAccount('escrow account');
  const buyer = await createAccount('buyer account');

  const topicRx = await (await new TopicCreateTransaction()
    .setTopicMemo('OutcomeLock evidence trail')
    .execute(client)).getReceipt(client);
  const topicId = topicRx.topicId.toString();
  console.log(`[go-live] created evidence topic: ${topicId}`);

  // Both accounts were created with automatic token association slots, so USDC arriving from the
  // faucet associates itself. Explicit association is only a belt-and-braces path.
  const HEDERA_TESTNET_USDC = '0.0.429274';
  async function usdcBalance(accountId) {
    const r = await fetch(`${MIRROR_NODE}/api/v1/accounts/${accountId}/tokens?token.id=${HEDERA_TESTNET_USDC}`);
    if (!r.ok) return 0;
    const d = await r.json();
    return Number((d.tokens || [])[0]?.balance || 0) / 1e6;
  }

  console.log('');
  console.log('─'.repeat(74));
  console.log('OPTIONAL, ~2 minutes, and it makes the demo considerably stronger:');
  console.log('');
  console.log('  Claim test USDC at  https://faucet.circle.com');
  console.log('  Pick "Hedera Testnet" and paste this address:');
  console.log('');
  console.log(`      ${buyer.id}`);
  console.log('');
  console.log('  20 USDC per address every 2 hours. Paying an agent in a stablecoin is the story');
  console.log('  this track is about; HBAR works but reads as a gas token.');
  console.log('─'.repeat(74));

  const waitMs = Number(process.env.WAIT_USDC_SECONDS || 180) * 1000;
  let usdc = 0;
  if (waitMs > 0) {
    const until = Date.now() + waitMs;
    process.stdout.write('[go-live] watching for USDC to arrive (Ctrl-C to skip)');
    while (Date.now() < until) {
      usdc = await usdcBalance(buyer.id);
      if (usdc > 0) break;
      process.stdout.write('.');
      await new Promise((ok) => setTimeout(ok, 6000));
    }
    console.log('');
  }
  if (usdc > 0) {
    console.log(`[go-live] buyer holds ${usdc} USDC — switching the service to PAY_ASSET=usdc`);
  } else {
    console.log('[go-live] no USDC seen. Staying on HBAR, which needs nothing further.');
    console.log(`[go-live] claim it later and add PAY_ASSET=usdc yourself; the code path is the same.`);
  }

  appendEnv([
    '',
    `# written by scripts/go-live.js on ${new Date().toISOString()}`,
    `HEDERA_ESCROW_ID=${escrow.id}`,
    `HEDERA_ESCROW_KEY=${escrow.key}`,
    `HEDERA_BUYER_ID=${buyer.id}`,
    `HEDERA_BUYER_KEY=${buyer.key}`,
    `SELLER_ACCOUNT_ID=${operatorId}`,
    `HCS_TOPIC_ID=${topicId}`,
    `PAY_ASSET=${usdc > 0 ? 'usdc' : 'hbar'}`,
  ]);

  client.close();

  console.log('\n[go-live] done. Written to your environment file (keys not printed).');
  console.log(`[go-live] escrow   https://hashscan.io/testnet/account/${escrow.id}`);
  console.log(`[go-live] buyer    https://hashscan.io/testnet/account/${buyer.id}`);
  console.log(`[go-live] evidence https://hashscan.io/testnet/topic/${topicId}`);
  console.log('\nNext:');
  console.log('  node --env-file=.env src/seller.js         # settlement tier should now read "hedera-testnet"');
  console.log('  node --env-file=.env scripts/prove-live.js # runs the whole flow and prints HashScan links');
}

main().catch((e) => {
  console.error('[go-live] failed:', e.message);
  process.exit(1);
});
