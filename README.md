# OutcomeLock

**An x402-gated agent service on Hedera where the payment goes into escrow instead of to the seller,
and is released only once the buyer has seen what the agent produced — or by a Hedera scheduled
transaction at the review deadline if they never look.**

Three real paid requests settled on Hedera testnet on 2026-09-12. All three endings — approved,
rejected, and released by the chain's own timer — confirmed by an independent read of the mirror
node. Escrow [`0.0.10495061`](https://hashscan.io/testnet/account/0.0.10495061) · evidence topic
[`0.0.10495064`](https://hashscan.io/testnet/topic/0.0.10495064) · transaction ids in
[`PROOF.md`](PROOF.md).

Built for ETHOnline 2026, Hedera "AI & Agentic Payments".

---

## The problem

x402 pays the seller the instant the response is written — before you have read a word of it. For a
weather API that is fine. For agent work it is backwards: you find out whether you got anything
useful *after* the money is gone, and your recourse is a support email.

Sellers have the mirror-image problem. "Refund on request" means any buyer can consume the work and
then claw the payment back.

OutcomeLock changes one field — `payTo` becomes an escrow account — and gets three endings, with no
trusted party choosing between them:

| the buyer | the money |
|---|---|
| approves | released to the seller immediately |
| rejects | refunded to the buyer immediately |
| does nothing | released to the seller by a Hedera scheduled transaction at the deadline |

The third row is what makes it safe for sellers. **Silence is not a veto.**

---

## Try it

```bash
npm install                 # also installs a pre-commit secret guard
npm run seller              # runs on a local stand-in; no account needed
npm run buyer -- ask "What is a Hedera scheduled transaction?"
```

It works end to end immediately, and says on every receipt that settlement is simulated. To run it
for real, see [Running on Hedera](#running-on-hedera).

| command | what it does |
|---|---|
| `npm test` | offline transaction build + key handling + all three endings |
| `npm run attack` | 16 adversarial checks against a running seller |
| `npm run prove` | runs every path for real, then re-reads the mirror node to confirm each id |
| `npm run dryrun` | builds every Hedera transaction offline, no account needed |
| `npm run check:secrets` | audits permissions, git tracking and the whole of git history |

---

## Which Hedera pieces are load-bearing

Remove any one and there is no product:

- **x402 via Blocky402** — the paywall. Its `/supported` advertises `exact` on `hedera:testnet` and
  names the fee payer `0.0.7162784`, so a buying agent needs no HBAR for gas at all.
- **The escrow account** — the `payTo`. One field, and the entire idea.
- **Scheduled transactions** — the deadline release. Armed at payment with `waitForExpiry`, deleted
  if the buyer decides early, and *observed* rather than repeated by the service.
- **HCS** — the evidence trail: what was asked, which agent version answered, the deliverable hash,
  and the decision. Readable from the mirror node without trusting either party.

**Agent identity.** Every deliverable carries a version id hashed from the prompt template, the model
name and the worker's own source. Change any of them and it changes — so "which build produced this"
is checkable, and it is what the buyer is really approving.

---

## Running on Hedera

1. Create a free testnet account at <https://portal.hedera.com/register> — instant, auto-funded.
2. Copy `.env.example` to `.env` and fill in `HEDERA_OPERATOR_ID` and `HEDERA_OPERATOR_KEY` by
   editing the file directly. Any key format works — ECDSA or ED25519, DER or raw hex, `0x` or not.
   You do not need to know which you have; the app asks the ledger and refuses to start on a mismatch.
3. `npm run go-live` — creates the escrow and buyer accounts and the evidence topic, writes them
   back, and prints only public ids. It pauses with the buyer's account id so you can claim test
   USDC at <https://faucet.circle.com> ("Hedera Testnet"); skip it and everything stays on HBAR.
4. `npm run seller`, then `npm run prove`.

`prove-live.js` takes nothing on trust: after the run it queries the mirror node for every
transaction id and fails loudly if one cannot be found.

### Configuration

| variable | default | meaning |
|---|---|---|
| `PAY_ASSET` | `hbar` | `hbar`, or `usdc` (testnet `0.0.429274`) |
| `PRICE` | `0.05` | price per request, whole units |
| `REVIEW_MINUTES` | `10` | how long the buyer has before auto-release |
| `SCHEDULE_GRACE_SECONDS` | `90` | how long past expiry to wait for the chain before releasing directly |
| `DEMO_BUY` | off | lets the web page buy using the server's own account. Refused on a live tier unless set |
| `MAX_QUESTION_CHARS` | `2000` | input cap |

---

## Documentation

| | |
|---|---|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | the state machine, who releases the money, tiers, files |
| [`INVARIANTS.md`](INVARIANTS.md) | the rules this system must never break, how each is enforced and tested |
| [`.agents/skills/x402-hedera/SKILL.md`](.agents/skills/x402-hedera/SKILL.md) | measured behaviour of the x402 and Hedera SDKs — read before writing a call |
| [`PROOF.md`](PROOF.md) | the last live run, with mirror-node-confirmed transaction ids |
| [`CLAUDE.md`](CLAUDE.md) | verified facts and open unknowns, each dated |

---

## Security

This moves money, so it was reviewed like something that moves money. `npm run attack` is a
re-runnable harness; 16 of 16 pass. Two defects were found that way and a third by a publish gate:

**Anyone could release anyone's escrow.** Approve and reject had no authorisation at all, and job
ids are listed publicly. A stranger released a job in testing and got `200 OK`. Now gated by a
one-time claim token, stored only as a hash and compared in constant time.

**A double payout the tests could not see.** The state check and the state write sat in one
synchronous block on the local tier, so concurrent approvals could not interleave and the test
passed. The Hedera path has four `await`s in that gap — and it paid twice for one job, 13 seconds
apart, visible on chain. Fixed with an atomic claim before any transfer.

**A paid job that was never recorded.** A transient mirror-node blip threw *after* settlement, so
the money reached escrow and no job existed. Fixed by recording the job before arming the timer and
making arming best-effort — verified by injecting that failure deliberately.

Also closed: rendering rebuilt as DOM nodes so user text can never become markup; upstream provider
errors redacted and replaced with a safe category before reaching a buyer; `/demo/buy` refused on a
live tier; per-IP rate limits; input caps.

### Secrets

Four independent layers, because one layer is how keys reach GitHub: `.gitignore`, `chmod 600`, a
pre-commit guard that refuses env files and key shapes in any file, and `npm run check:secrets`
which scans the entire git history. All four were verified by trying to defeat them.

---

## Honest status

Designed, built, tested and proven are four different things.

- **Proven on testnet:** all three endings, six transactions, every one confirmed by re-reading the
  mirror node — including a scheduled transaction executing at expiry with the service only watching.
- **Tested:** 16 adversarial checks, 13 regression checks including deliberate fault injection, 10
  key-handling checks, 7 offline transaction builds.
- **Not claimed:** that escrow makes an agent's output correct. It proves who produced what, when,
  with which version, and that the buyer had a real chance to look before the money moved.
- **Not production:** the escrow key is held by the service. A real deployment needs a threshold key
  or a contract. The public URL is a tunnel and will not outlive the demo.

## Licence

Apache-2.0
