// Builds every Hedera transaction this project sends, offline — no account, no network, no funds.
// It cannot prove a transfer succeeds on the ledger, but it does prove the builder calls are shaped
// correctly, and that is the part which has never been checked. Run it before touching go-live.js.
//
//   node scripts/dryrun-hedera.js
//
const {
  PrivateKey, AccountId, TokenId, Hbar, HbarUnit, Timestamp, TransactionId,
  TransferTransaction, ScheduleCreateTransaction, ScheduleDeleteTransaction,
  TopicCreateTransaction, TopicMessageSubmitTransaction, AccountCreateTransaction,
} = await import('@hiero-ledger/sdk');

const me = AccountId.fromString('0.0.1001');
const you = AccountId.fromString('0.0.1002');
const nodes = [AccountId.fromString('0.0.3')];
const offline = (tx) => tx.setTransactionId(TransactionId.generate(me)).setNodeAccountIds(nodes).freeze();

let pass = 0, fail = 0;
const t = (name, fn) => {
  try { fn(); pass++; console.log(`  ok    ${name}`); }
  catch (e) { fail++; console.log(`  FAIL  ${name} -> ${e.message.slice(0, 150)}`); }
};

t('account create, as go-live.js builds it', () =>
  offline(new AccountCreateTransaction()
    .setKeyWithoutAlias(PrivateKey.generateED25519().publicKey)
    .setInitialBalance(new Hbar(20))
    .setMaxAutomaticTokenAssociations(10)));

t('HBAR escrow transfer (tinybar amounts)', () =>
  offline(new TransferTransaction()
    .addHbarTransfer(me, Hbar.from(-5000000, HbarUnit.Tinybar))
    .addHbarTransfer(you, Hbar.from(5000000, HbarUnit.Tinybar))));

t('USDC escrow transfer (HTS, 6dp)', () => {
  const usdc = TokenId.fromString('0.0.429274');
  return offline(new TransferTransaction()
    .addTokenTransfer(usdc, me, -50000).addTokenTransfer(usdc, you, 50000));
});

t('scheduled auto-release with a future expiry + waitForExpiry', () => {
  const inner = new TransferTransaction()
    .addHbarTransfer(me, Hbar.from(-5000000, HbarUnit.Tinybar))
    .addHbarTransfer(you, Hbar.from(5000000, HbarUnit.Tinybar));
  return offline(new ScheduleCreateTransaction()
    .setScheduledTransaction(inner)
    .setScheduleMemo('Held auto-release test')
    .setWaitForExpiry(true)
    .setExpirationTime(Timestamp.fromDate(new Date(Date.now() + 10 * 60 * 1000))));
});

t('schedule delete (cancel when the buyer decides early)', () =>
  offline(new ScheduleDeleteTransaction().setScheduleId('0.0.9999')));

t('HCS topic create', () =>
  offline(new TopicCreateTransaction().setTopicMemo('Held evidence trail')));

t('HCS message submit', () =>
  offline(new TopicMessageSubmitTransaction()
    .setTopicId('0.0.8888')
    .setMessage(JSON.stringify({ jobId: 'x', type: 'paid' }))));

console.log(`\n${pass} built, ${fail} failed`);
process.exit(fail ? 1 : 0);
