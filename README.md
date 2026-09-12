# OutcomeLock

**x402 pays the moment a request is served. That is wrong for agent work, where you only find out
whether you got anything useful after you have already paid.**

OutcomeLock is an x402-gated agent service on Hedera where the payment goes into escrow instead of
into the seller's account. The buyer gets the deliverable immediately. The seller gets the money
once the buyer has approved it, or once a review deadline passes — whichever comes first. Every
step is written to a public consensus log, including which version of the agent produced the work.

Built for ETHOnline 2026, Hedera "AI & Agentic Payments" track.

---

## The problem, concretely

An agent charges you 0.05 HBAR to answer a question. Under plain x402 the money is gone the instant
the HTTP response is written — before you have read a word of it. If the agent returns garbage, a
hallucination, or an empty string, your recourse is a support email.

Sellers have the mirror-image problem. "Just refund on request" means any buyer can consume the work
and then claw the money back.

OutcomeLock splits the difference with three endings and no trusted middleman deciding between them:

| what the buyer does | what happens to the money |
|---|---|
| approves | released to the seller immediately |
| rejects | refunded to the buyer immediately |
| nothing | released to the seller when the review window expires |

The third row is the one that makes this safe for sellers. Silence is not a veto.

---

## Architecture

```
  buyer agent                 seller service                    Hedera
 ─────────────               ───────────────                 ────────────
      │  POST /work                  │                             │
      ├─────────────────────────────►│                             │
      │  402 + payment requirements  │                             │
      │◄─────────────────────────────┤  payTo = ESCROW,            │
      │                              │  not the seller             │
      │  POST /work + X-PAYMENT      │                             │
      ├─────────────────────────────►│                             │
      │                              │──── /verify ───► Blocky402  │
      │                              │                  facilitator│
      │                              │  agent does the work        │
      │                              │──── /settle ───► ──────────►│ funds land
      │                              │                             │ in escrow
      │                              │──── HCS message ───────────►│ evidence
      │                              │──── ScheduleCreate ────────►│ auto-release
      │  deliverable + jobId         │                             │   armed
      │◄─────────────────────────────┤                             │
      │                              │                             │
      │  POST /jobs/:id/approve      │                             │
      ├─────────────────────────────►│──── transfer ──────────────►│ seller paid
      │                              │──── ScheduleDelete ────────►│ timer cancelled
```

| file | what it does |
|---|---|
| `src/seller.js` | the x402-gated service. Quotes the price, verifies and settles through Blocky402, runs the agent, arms the auto-release |
| `src/settlement.js` | escrow. Holds, releases, refunds, and schedules. Two implementations behind one interface |
| `src/evidence.js` | the append-only trail. HCS topic, or a local file on the degraded tier |
| `src/worker.js` | the agent doing the paid work, and the version id that identifies it |
| `src/payment.js` | builds the `X-PAYMENT` payload |
| `src/buyer.js` | the consuming agent, as a CLI |
| `scripts/go-live.js` | one command to create the escrow/buyer accounts and the evidence topic |
| `scripts/prove-live.js` | runs every path, then independently re-reads the mirror node to check it actually happened. Writes `PROOF.md` |

### Which Hedera pieces are load-bearing

Remove any one of these and there is no product:

- **x402 via Blocky402** — the paywall itself. The facilitator's `/supported` advertises
  `exact` on `hedera:testnet` and acts as fee payer (`0.0.7162784`), so a buyer needs no HBAR for gas.
- **The escrow account** — `payTo` in the payment requirements. This single field is the whole idea.
- **Scheduled transactions** — the auto-release. Armed at payment time with the review deadline as
  its expiry, deleted if the buyer decides early.
- **HCS** — the evidence trail. Anyone can read it from the mirror node without asking us.

### Agent identity

Every deliverable carries an agent version id: a hash of the prompt template, the model name, and
the worker's own source. Change any of them and the id changes. "Which version of the agent produced
this" is therefore a checkable fact rather than a claim — and it is what the buyer is really
approving when they release the money.

---

## Payment flow, step by step

1. Buyer `POST /work` with no payment header.
2. Server replies **402** with `accepts[0]` = `{ scheme: "exact", network: "hedera:testnet",
   asset, amount, payTo: <escrow>, maxTimeoutSeconds, extra: { feePayer } }`, plus an `outcomelock`
   extension block stating the review window and the release policy.
3. Buyer signs a Hedera transfer with `@x402/hedera`, base64-encodes the payload, retries with
   `X-PAYMENT`.
4. Server calls the facilitator's `/verify` **before doing any work**.
5. Server runs the agent.
6. Server calls `/settle`. Funds move buyer → **escrow**.
7. Server records the deposit, arms a scheduled release at `now + review window`, and writes
   `paid`, `delivered` and `escrow-scheduled` to the evidence trail.
8. Buyer reads the deliverable, then approves or rejects — or does nothing and the schedule fires.

---

## Setup

```bash
npm install
```

### Run it without any account (degraded tier)

```bash
npm run seller
node src/buyer.js ask "your question here"
```

It works end to end immediately. Settlement and evidence run on local stand-ins, and **every
receipt, log line and proof file says so**. This tier demonstrates the product logic and proves
nothing whatsoever about Hedera.

### Run it on Hedera testnet

1. Create a free account at <https://portal.hedera.com/register>. It is instant and comes funded
   with test HBAR.
2. Copy `.env.example` to `.env` and fill in `HEDERA_OPERATOR_ID` and `HEDERA_OPERATOR_KEY`.
   Edit the file directly — never paste a key into a chat window.
3. ```bash
   node --env-file=.env scripts/go-live.js
   ```
   This creates the escrow account, the buyer account and the evidence topic, and writes the new
   ids and keys back into `.env`. It prints public ids only.
4. ```bash
   node --env-file=.env src/seller.js          # should now print settlement tier "hedera-testnet"
   node --env-file=.env scripts/prove-live.js  # runs every path and writes PROOF.md
   ```

`prove-live.js` does not take the server's word for anything: after the run it queries the Hedera
mirror node for each transaction id and fails loudly if one cannot be found.

### Configuration

| variable | default | meaning |
|---|---|---|
| `PAY_ASSET` | `hbar` | `hbar` or `usdc`. HBAR is the default because a fresh testnet account is funded with it automatically |
| `PRICE` | `0.05` | price per request, in whole units of the asset |
| `REVIEW_MINUTES` | `10` | how long the buyer has before the money auto-releases |
| `FACILITATOR_URL` | `https://api.testnet.blocky402.com` | the x402 facilitator |
| `PORT` | `4021` | seller port |

---

## Honest status

Written down, built, tested and proven are four different things. Where this stands:

- **Tested, by running it:** the full buy → deliver → decide loop, all three endings, the evidence
  trail, the deadline sweeper, and the worker's failover when a model key is dead.
- **Built but not yet tested:** every Hedera code path. It is written against the SDK and parses.
  Until `PROOF.md` in this repo shows mirror-node-confirmed transaction ids, treat it as unrun.
- **Not claimed:** that escrow makes an agent's output correct. It does not. It proves who produced
  what, when, with which version, and that the buyer had a real chance to look before the money
  moved. Nothing more.

## Licence

Apache-2.0
