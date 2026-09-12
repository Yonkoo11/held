# Held — ETHOnline 2026 submission draft

Status: **DRAFT — NOT FILED.**
Deadline: 2026-09-13 12:00 EDT / 17:00 WAT.

> Every `<<FILL>>` below is a hole that must be closed before filing. Do not file with one left in.
> If the Hedera holes cannot be closed, read "If Hedera never runs" at the bottom before submitting
> to the Hedera track — submitting there without a live Hedera service would be a false claim.

---

## Track applied for

**Hedera — AI & Agentic Payments on Hedera** ($6,000, up to 3 teams x $2,000)

Requirement checklist, honestly marked:

| requirement | status |
|---|---|
| Host a live x402-gated service on Hedera testnet/mainnet via Blocky402 | **MET** — live and public, escrow `0.0.10495061`, facilitator `api.testnet.blocky402.com`, fee payer `0.0.7162784` |
| Build a platform/agent consuming that service with >= 1 real paid request | **MET** — three real paid requests on 2026-09-12, all confirmed by the mirror node. See `PROOF.md` |
| Public GitHub repo with README covering setup, architecture, payment flow | READY — README.md covers all three |
| Demo video <= 5 minutes showing paid request execution | `<<FILL: not recorded>>` |

Extra-points items actually implemented **and exercised on testnet**: pay-per-call metering, HCS
audit trail (topic `0.0.10495064`, 49 messages), scheduled transactions for the auto-release
(verified executing at expiry with the service only observing), and agent version identity.
Not implemented: A2A negotiation, UCP discovery, HTS custom fees.

---

## Name

Held

## One-liner

An x402-gated agent service on Hedera where the payment is held in escrow until the buyer has
actually read what the agent produced.

## Description

x402 pays the seller the instant a request is served. For a weather API that is fine. For agent
work it is backwards — you only discover whether you got anything useful *after* the money has
gone, and your only recourse is a support email.

Held keeps the x402 flow exactly as it is, and changes one field: `payTo` points at an
escrow account rather than at the seller. The buyer pays, gets the deliverable immediately, and
then decides. Approve and the seller is paid. Reject and the buyer is refunded. Say nothing and a
Hedera scheduled transaction pays the seller when the review window expires — so silence is not a
veto, and a seller cannot have their money trapped by an unresponsive buyer.

Everything that happened is appended to a Hedera Consensus Service topic: what was asked, which
version of the agent answered, the hash of what it produced, and what the buyer decided. Anyone can
read that from the mirror node without trusting either party.

The agent's version id is a hash of its prompt template, its model and its own source code. That
matters because it is what the buyer is really approving — not "some agent", but a specific,
identifiable build. Change the agent and the id changes.

## How it's made

- **x402 via Blocky402.** The facilitator's `/supported` advertises `exact` on `hedera:testnet` and
  acts as fee payer (`0.0.7162784`), so the buying agent needs no HBAR for gas. The seller calls
  `/verify` before doing any work and `/settle` afterwards. Built against `@x402/core`,
  `@x402/hedera` and `@x402/fetch` v2.25.0.
- **The escrow account** is the `payTo` in the payment requirements. One field, and it is the
  entire idea.
- **Scheduled transactions** arm the auto-release at payment time, with the review deadline as the
  expiry, and are deleted if the buyer decides early.
- **HCS** carries the evidence trail.
- Priced in **HBAR** by default (8 decimals / tinybars) because a fresh testnet account is funded
  with it automatically; `PAY_ASSET=usdc` switches to testnet USDC `0.0.429274`.

Two things worth flagging because they cost real time:

The Hedera x402 scheme advertises an `authorization` payment flow, which looks at first like it
could hold funds pending approval. It cannot — the payload is a partially-signed Hedera transaction
and those expire in minutes, not days. That is precisely why the escrow has to be a separate
account with its own later transfer, and it is the thing most likely to be got wrong by anyone
building this.

Every external dependency has a declared degraded tier, and the app prints which tier it chose and
stamps it on every receipt. With no model key the worker falls back to a deterministic responder
that says so in its own output. This is not decoration: during the build the Anthropic key on the
machine ran out of credit mid-run, the worker failed over, and the demo continued.

## Links

- Source: `<<FILL: public GitHub URL>>`
- Live service: `<<FILL: public URL — note it is a tunnel and may be down after the event>>`
- Demo video: `<<FILL>>`
- Escrow account on HashScan: https://hashscan.io/testnet/account/0.0.10495061
- Evidence topic on HashScan: https://hashscan.io/testnet/topic/0.0.10495064
- An auto-release schedule: https://hashscan.io/testnet/schedule/0.0.10495601
- Proof of a live run with mirror-node-confirmed transaction ids: `PROOF.md` in the repo

## What we are not claiming

Escrow and an audit trail do not make an agent's output correct, and nothing here verifies the
semantic quality of an answer. What it proves is narrower and checkable: who produced what, when,
with which agent version, and that the buyer had a real opportunity to look before the money moved.

---

## If Hedera never runs — no longer applicable

Superseded 2026-09-12: go-live ran, and all three endings are confirmed on testnet in `PROOF.md`.
Kept only as the rule that applied while it was unproven:

1. **Do not submit to the Hedera AI & Agentic Payments track.** A submission claiming a live Hedera
   service that does not exist is a false claim, and a judge will check `payTo` in about ten seconds.
2. Submit anyway to the general pool with the degraded tier stated plainly in the description. A
   filed honest entry beats an unfiled one, and eleven finished projects on this machine were never
   filed at all.
3. Say in the first line of the description that settlement runs on a local stand-in and what would
   change on Hedera.
