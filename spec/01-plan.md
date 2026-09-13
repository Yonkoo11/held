<!-- The build plan, written on day one before any feature code. Track choices, the probe-first order, and the rule that no track is entered below depth 4 of 5. -->

# OutcomeLock — build plan (written 2026-09-07, deadline 2026-09-13 17:00 WAT)

## The product in one line
An agent service you pay for up front, where the money sits in escrow until you have seen what the
agent actually produced.

## Why this shape
x402 is pay-per-request: money moves the moment the request is served. That is fine for a weather
API and wrong for agent work, where you find out whether you got anything useful *after* you paid.
Blocky402 (probed today) settles immediately and has no deferred mode. OutcomeLock adds the missing
half: the x402 payment goes to an escrow contract, the agent's output and its version identity are
written to a public consensus log, and the money releases on the buyer's approval or on a deadline.

## Tracks entered — chosen, not asked about
| Track | Prize | Why | Depth we can reach |
|---|---|---|---|
| Hedera — AI & Agentic Payments | $6,000 (3 x $2,000) | Their extra-points list *is* this product: metering, agent identity, HCS audit trails, scheduled transactions | 5/5 — remove any one of x402 gating, escrow, HCS log or scheduled release and there is no product |
| Hedera — Improve the Hedera Harness | $2,000 (2 x $1,000) | Byproduct. We will hit rough edges building the above; the escrow + scheduled-release helper is a real harness contribution | 4/5 |
| Bazantic — Agentify a New API / Best Recipe | $1,000 + $1,000 | Near-zero marginal cost once the x402 gateway is live | 4/5, stretch only |

**Not entered, deliberately:** Arc (second chain, plus a mainnet-by-Sept-30 commitment, for $1,667 —
splits focus), The Graph (subgraphs do not index Hedera), World / ENS / 1inch / Uniswap / Ledger /
Privy / Chainlink (no path to depth 4 in six days). Submitting to a track at depth < 4 is banned.

## Build order — core action first, polish last

### Phase 0 — probe (today, 2026-09-07)
Blocking. No feature code until these are answered and written into `CLAUDE.md` with dates.
- Hedera testnet account, testnet HBAR in hand.
- Run the Blocky402 quickstart against a hello-world endpoint. **One real paid request on testnet.**
- Scheduled transaction: create one with a future deadline, cancel it, confirm both.
- HCS: create a topic, submit a message, read it back.
- Confirm the EVM JSON-RPC relay accepts a contract deploy.

**Gate:** a real payment moved on Hedera testnet today. If it did not, the track requirement is
unproven and everything after this is speculation.

### Phase 1 — can a buyer do the core thing? (2026-09-08 to 09-09)
- `Escrow.sol` on Hedera EVM testnet: fund, lock against a job id, release, refund, deadline.
- Seller service: x402-gated endpoint whose `payTo` is the escrow, not the seller.
- Worker agent behind it, with the four-tier model fallback from `../docs/ACCESS.md`.
- Buyer agent CLI making a real paid request.

**Gate:** run the buyer CLI, see 402, pay, get a deliverable, and see the money sitting in escrow on
HashScan. Nothing proceeds until that is on screen.

### Phase 2 — evidence and release (2026-09-10)
- HCS topic per job: request hash, agent version id, deliverable hash, buyer decision. Append-only.
- Agent identity (ERC-8004 or HCS-14) so "which version did this work" is a fact, not a claim.
- Buyer approve / reject → release or refund.
- Scheduled transaction auto-releases at the deadline if the buyer never responds.

**Gate:** a rejected job refunds; an ignored job auto-releases; both are readable from the HCS log
by someone who does not trust us.

### Phase 3 — product complete (2026-09-11)
- Buyer web view (Svelte + Vite): job, deliverable, evidence trail, approve / reject. Light and dark.
- README with setup, architecture and payment flow — a hard track requirement.
- Live public URL on a tunnel.
- Extract the harness contribution into its own PR for the second track.

### Phase 4 — demo and submission (2026-09-12)
- Demo video, 5 minutes or less, showing a real paid request executing. Show, do not narrate.
- Submission draft written in full.

### Phase 5 — FILE IT (2026-09-13, morning WAT)
Eleven of the last sixteen projects on this machine were finished and never submitted. The
submission gets filed on the morning of the 13th, not at 16:59.

## Boundaries — things this project must never claim
- Escrow and an audit trail do **not** prove the agent's output was semantically correct. They prove
  who produced what, when, and that the buyer had a real chance to look before the money moved.
- Nothing is "verified" because a transaction succeeded.

## Risks, honestly
- The `@x402/*` packages are four days old. Integration surprises are the most likely way this slips.
- Hedera scheduled transactions are unproven here — if they cannot be cancelled, the auto-release
  becomes a keeper bot and loses an extra-points item.
- AI credits are out. The worker may run on the deterministic bottom tier, which still demonstrates
  the escrow mechanism but makes a weaker video.
