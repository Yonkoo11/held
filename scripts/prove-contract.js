// Deploys HeldEscrow to Hedera testnet's EVM and exercises every ending on chain: approve, reject,
// a partial split, and a permissionless expiry called by a third party who is neither the buyer nor
// the seller nor us. Writes evidence/CONTRACT.md.
//
// The operator key is read from the process environment and never printed. The buyer, seller and
// stranger keys are generated in memory for this run and are not persisted anywhere: none of them
// needs to outlive the proof, and a key on disk is a key to look after.
import fs from 'node:fs';
import { ethers } from 'ethers';
import { PrivateKey } from '@hiero-ledger/sdk';

const RPC = process.env.HEDERA_JSON_RPC || 'https://testnet.hashio.io/api';
const ART = JSON.parse(fs.readFileSync('contracts/out/HeldEscrow.sol/HeldEscrow.json', 'utf8'));

const raw = process.env.HEDERA_OPERATOR_KEY;
if (!raw) { console.error('[contract] HEDERA_OPERATOR_KEY is not set. Run via npm run prove:contract.'); process.exit(1); }

const provider = new ethers.JsonRpcProvider(RPC, undefined, { batchMaxCount: 1 });
const operator = new ethers.Wallet('0x' + PrivateKey.fromStringECDSA(raw).toStringRaw(), provider);

// Hedera's EVM uses TWO denominations and mixing them is the trap.
//   the `value` field of a transaction .......... weibar, 18 decimals
//   msg.value and call{value:} INSIDE the EVM ... tinybar, 8 decimals
//   eth_getBalance .............................. weibar, 18 decimals
// So money sent to a contract is written in weibar, and any amount handed to a contract as an
// ARGUMENT has to be written in tinybar. Getting this wrong does not error: the first run refunded
// correctly and merely printed 0.0000000002 HBAR, and the split reverted because a weibar figure
// was compared against a tinybar balance.
const weibar  = (n) => ethers.parseEther(String(n));          // for tx value
const tinybar = (n) => ethers.parseUnits(String(n), 8);       // for contract arguments
const fmtWei  = (v) => `${ethers.formatEther(v)} HBAR`;       // balances
const fmtTiny = (v) => `${ethers.formatUnits(v, 8)} HBAR`;    // event amounts
const scan = (h) => `https://hashscan.io/testnet/transaction/${h}`;
const log = [];
const say = (s) => { console.log(s); log.push(s); };

// Hedera's relay does not always estimate well, so gas is set explicitly on every call.
const GAS = { gasLimit: 900_000 };

async function fundWallet(to, amount) {
  // A plain transfer to an unknown EVM address auto-creates a Hedera account for it.
  const tx = await operator.sendTransaction({ to, value: amount, gasLimit: 2_000_000 });
  await tx.wait();
}

async function run() {
  const net = await provider.getNetwork();
  say(`chain id ${net.chainId} via ${RPC}`);
  say(`operator ${operator.address}, balance ${fmtWei(await provider.getBalance(operator.address))}`);

  say('\n## Deploy');
  const factory = new ethers.ContractFactory(ART.abi, ART.bytecode.object, operator);
  const escrow = await factory.deploy({ gasLimit: 3_000_000 });
  const dep = await escrow.deploymentTransaction().wait();
  const address = await escrow.getAddress();
  say(`HeldEscrow deployed at ${address}`);
  say(`  ${scan(dep.hash)}`);

  // Three fresh parties, funded enough to pay Hedera's gas.
  const buyer = new ethers.Wallet(ethers.Wallet.createRandom().privateKey, provider);
  const seller = new ethers.Wallet(ethers.Wallet.createRandom().privateKey, provider);
  const stranger = new ethers.Wallet(ethers.Wallet.createRandom().privateKey, provider);
  say('\n## Parties');
  say(`buyer    ${buyer.address}`);
  say(`seller   ${seller.address}`);
  say(`stranger ${stranger.address}   (neither party, and not the service)`);
  for (const w of [buyer, seller, stranger]) await fundWallet(w.address, weibar(30));

  const asBuyer = escrow.connect(buyer);
  const asStranger = escrow.connect(stranger);
  const id = (s) => ethers.id(s);

  const results = [];
  const settledOf = async (h) => {
    const r = await provider.getTransactionReceipt(h);
    const ev = r.logs.map((l) => { try { return escrow.interface.parseLog(l); } catch { return null; } })
      .find((p) => p && p.name === 'Settled');
    return ev ? { toSeller: ev.args.toSeller, toBuyer: ev.args.toBuyer, reason: ev.args.reason } : null;
  };

  // ── 1. approve ───────────────────────────────────────────────────────────
  say('\n## 1. The buyer approves');
  let job = id('contract-approve');
  let t = await asBuyer.fund(job, seller.address, 600, { value: weibar(2), ...GAS }); await t.wait();
  const s0 = await provider.getBalance(seller.address);
  t = await asBuyer.approve(job, GAS); const r1 = await t.wait();
  const got1 = (await provider.getBalance(seller.address)) - s0;
  say(`seller received ${fmtWei(got1)} of 2.0 HBAR held`);
  say(`  ${scan(r1.hash)}`);
  results.push(['approve', 'seller paid in full', fmtWei(got1), r1.hash]);

  // ── 2. reject ────────────────────────────────────────────────────────────
  say('\n## 2. The buyer rejects');
  job = id('contract-reject');
  t = await asBuyer.fund(job, seller.address, 600, { value: weibar(2), ...GAS }); await t.wait();
  const b0 = await provider.getBalance(buyer.address);
  t = await asBuyer.reject(job, GAS); const r2 = await t.wait();
  const ev2 = await settledOf(r2.hash);
  say(`refunded to the buyer ${fmtTiny(ev2.toBuyer)}, to the seller ${fmtTiny(ev2.toSeller)}`);
  say(`  ${scan(r2.hash)}`);
  results.push(['reject', 'buyer refunded in full', fmtTiny(ev2.toBuyer), r2.hash]);

  // ── 3. partial release, which the account escrow could not do ────────────
  say('\n## 3. The buyer splits it (new)');
  job = id('contract-split');
  t = await asBuyer.fund(job, seller.address, 600, { value: weibar(2), ...GAS }); await t.wait();
  t = await asBuyer.settle(job, tinybar(1.25), GAS); const r3 = await t.wait();
  const ev3 = await settledOf(r3.hash);
  say(`to the seller ${fmtTiny(ev3.toSeller)}, back to the buyer ${fmtTiny(ev3.toBuyer)}, of 2.0 held`);
  say(`  ${scan(r3.hash)}`);
  results.push(['settle', 'split between both', `${fmtTiny(ev3.toSeller)} / ${fmtTiny(ev3.toBuyer)}`, r3.hash]);

  // ── 4. silence, resolved by someone who is not us ────────────────────────
  say('\n## 4. Nobody decides, and a stranger closes it');
  job = id('contract-expire');
  t = await asBuyer.fund(job, seller.address, 60, { value: weibar(2), ...GAS }); await t.wait();
  try {
    await (await asStranger.expire(job, GAS)).wait();
    say('PROBLEM: expire succeeded before the deadline');
  } catch {
    say('expire before the deadline reverted, as it must');
  }
  say('waiting out the 60 second window...');
  await new Promise((r) => setTimeout(r, 66000));
  const s1 = await provider.getBalance(seller.address);
  t = await asStranger.expire(job, GAS); const r4 = await t.wait();
  const got4 = (await provider.getBalance(seller.address)) - s1;
  say(`the stranger pushed ${fmtWei(got4)} to the seller. Neither party, and not the service.`);
  say(`  ${scan(r4.hash)}`);
  results.push(['expire', 'paid by a third party at the deadline', fmtWei(got4), r4.hash]);

  // ── 5. and it cannot pay twice ───────────────────────────────────────────
  say('\n## 5. A settled job cannot pay again');
  try {
    await (await asBuyer.approve(id('contract-approve'), GAS)).wait();
    say('PROBLEM: a settled job paid out a second time');
  } catch {
    say('a second approve on an already settled job reverted');
  }
  say(`\ncontract balance after all four endings: ${fmtWei(await provider.getBalance(address))}`);

  fs.mkdirSync('evidence', { recursive: true });
  fs.writeFileSync('evidence/CONTRACT.md',
`# HeldEscrow on Hedera testnet

Release enforced by the contract rather than by this service behaving correctly. Generated by
\`npm run prove:contract\` on ${new Date().toISOString()}.

**Contract:** [\`${address}\`](https://hashscan.io/testnet/contract/${address})
**Chain:** Hedera testnet EVM, chain id ${net.chainId}

| Ending | What happened | Amount | Transaction |
| --- | --- | --- | --- |
${results.map(([k, w, a, h]) => `| \`${k}\` | ${w} | ${a} | [\`${h.slice(0, 18)}…\`](${scan(h)}) |`).join('\n')}

The fourth row is the one that matters. \`expire\` is permissionless, so the account that closed that
job was neither the buyer, nor the seller, nor this service. A seller's money cannot be trapped by a
quiet buyer even if we disappear.

The contract held ${fmtWei(await provider.getBalance(address))} after all four endings.

\`\`\`
${log.join('\n')}
\`\`\`
`);
  say('\nwrote evidence/CONTRACT.md');
}

run().catch((e) => { console.error('[contract]', e.shortMessage || e.message); process.exit(1); });
