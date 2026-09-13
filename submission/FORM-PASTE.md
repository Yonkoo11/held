# Held: paste-ready ETHOnline 2026 form copy

Humanized 2026-09-13 (em dashes removed, bolded inline-header list turned into prose, one triadic
run broken). Paste each block into the matching field. Nothing below is a hole except the video
line, which is filled the moment the release upload finishes.

## Project name
Held

## Category (recommendation)
Payments (if the list has it), otherwise Infrastructure. Reason: the whole idea is one change to a
payment flow.

## Emoji
🧾

## Tagline / short description
An x402-gated agent service on Hedera where the payment is held in escrow until the buyer has
actually read what the agent produced.

## Project description
x402 pays the seller the moment a request is served. For a weather API that is fine. For agent
work it is backwards: you only find out whether you got anything useful after the money has gone,
and your only recourse is a support email.

Held keeps the x402 flow exactly as it is and changes one field. payTo points at an escrow account
instead of the seller. The buyer pays, gets the deliverable immediately, and then decides. Approve
and the seller is paid. Reject and the buyer is refunded. Say nothing and a Hedera scheduled
transaction pays the seller when the review window expires, so silence is not a veto and a seller
cannot have their money trapped by a buyer who never looks.

Everything that happened is appended to a Hedera Consensus Service topic: what was asked, which
version of the agent answered, the hash of what it produced, and what the buyer decided. Anyone can
read that from the mirror node without trusting either party.

The agent's version id is a hash of its prompt template, its model and its own source code. That
matters because it is what the buyer is really approving. Not "some agent" but a specific,
identifiable build. Change the agent and the id changes.

Three real paid requests settled on Hedera testnet on 2026-09-12, one for each ending (approved,
rejected, released by the chain's own timer), all confirmed by the mirror node. The transaction ids
are in PROOF.md in the repo, and /proof on the live site reads the escrow account and the topic
straight from Hedera's mirror node in your own browser, with no Held server in the path.

What we are not claiming: escrow and an audit trail do not make an agent's output correct, and
nothing here checks whether an answer is any good. What it proves is narrower and checkable. Who
produced what, when, with which agent version, and that the buyer had a real chance to look before
the money moved.

## How it's made
Payments run through x402 via Blocky402. The facilitator's /supported endpoint advertises the exact
scheme on hedera:testnet and acts as fee payer (account 0.0.7162784), so the buying agent needs no
HBAR for gas at all. The seller calls /verify before doing any work and /settle afterwards. Built
against @x402/core, @x402/hedera and @x402/fetch v2.25.0.

The escrow account is simply the payTo in the payment requirements. One field, and it is the whole
idea.

Scheduled transactions arm the auto-release at payment time with the review deadline as the expiry,
and are deleted if the buyer decides early. HCS carries the evidence trail. Prices are in HBAR by
default (8 decimals, tinybars) because a fresh testnet account is funded with it automatically;
setting PAY_ASSET=usdc switches to testnet USDC 0.0.429274.

Two things cost real time and are worth knowing about.

The Hedera x402 scheme advertises an "authorization" payment flow, which looks at first like it
could hold funds pending approval. It cannot. The payload is a partially signed Hedera transaction,
and those expire in minutes, not days. That is exactly why the escrow has to be a separate account
with its own later transfer, and it is the thing most likely to be got wrong by anyone building
this.

Every outside dependency has a declared degraded tier. The app prints which tier it chose at boot
and stamps it on every receipt. With no model key the worker falls back to a deterministic
responder that says so in its own output. This was not decoration: during the build the Anthropic
key on the machine ran out of credit mid-run, the worker failed over, and the demo continued.

The sharpest lesson was ours. Our sweeper released a job at the deadline while the network's own
scheduled transaction also executed it, and the escrow paid twice for one job, thirteen seconds
apart, visible on chain. A service that arms a scheduled transaction has to observe it rather than
repeat it. That fix is in src/seller.js and the reasoning is in INVARIANTS.md.

## Links
Source: https://github.com/Yonkoo11/held
Live: https://heldprotocol.xyz (same service on Railway: https://held-production-0ce9.up.railway.app)
Demo video: https://github.com/Yonkoo11/held/releases/download/v1.0.0/held-demo.mp4
Escrow account: https://hashscan.io/testnet/account/0.0.10495061
Evidence topic: https://hashscan.io/testnet/topic/0.0.10495064
An auto-release schedule: https://hashscan.io/testnet/schedule/0.0.10495601

## Partner prizes
Partner prizes only. Do NOT tick the main pool / finalist judging.
1. Hedera: AI & Agentic Payments on Hedera. (Also eligible for Hedera's Open Source track, same
   selection.)
2. Bazantic: only if an account already exists. No account = leave empty.
3. Empty on purpose.

## Hedera: requirement checklist (if the form asks)
Live x402-gated service on Hedera testnet via Blocky402: yes, https://heldprotocol.xyz, escrow
0.0.10495061, facilitator api.testnet.blocky402.com.
Agent consuming it with at least one real paid request: yes, three on 2026-09-12, mirror-node
confirmed, see PROOF.md.
Public repo with setup, architecture and payment flow in the README: yes.
Demo video showing a paid request: yes, 2:14.
Extra-points items actually exercised on testnet: pay-per-call metering, HCS audit trail (topic
0.0.10495064), scheduled transactions for the auto-release, agent version identity. Not
implemented: A2A negotiation, UCP discovery, HTS custom fees.

## Feedback for Hedera
What worked. Blocky402 on testnet needs no account and no API key, which removed the usual
first-day blocker entirely. The facilitator paying gas means a buying agent needs no HBAR at all,
which is the right default for agent-to-agent payments and is underplayed in the docs. Scheduled
transactions with waitForExpiry are the reason this project exists in this shape: nothing else
gives you a deadline that executes itself with nobody online.

What cost us time, in the order it hurt:

1. createClientHederaSigner takes positional arguments and a PrivateKey object. Passing a config
   object fails with "t.startsWith is not a function", which points nowhere near the real problem.
2. The network field must be the CAIP-2 string hedera:testnet. Passing "testnet" throws
   "Unsupported Hedera network", and the doc comment on the field suggests otherwise.
3. TransactionReceipt has no transactionId. Reading it there gives undefined, and a fallback we had
   written recorded the literal string SUCCESS as a transaction id for a while.
4. PrivateKey.fromStringED25519() silently accepts a raw ECDSA key and returns a different,
   working-looking key. The portal issues ECDSA by default, so this is easy to hit and gives no
   error until a signature is rejected much later. We now ask the mirror node what key type an
   account has and check the derived public key against it before starting.
5. The SDK rename from @hashgraph/sdk to @hiero-ledger/sdk means a project can end up with two
   copies and two incompatible AccountId classes. Worth a louder note in the x402 packages.

## AI tools used (if the form asks)
Claude Code wrote most of the code. A human directed it and made the calls. The full disclosure is
AI-USE.md in the repo, with the planning trail in spec/, because the rules ask for the planning
artifacts and not just the output.
