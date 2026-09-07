# OutcomeLock — progress

## What Changed (Plain English)
Nothing runs yet. Today the project got a folder, a written list of every outside thing it needs
with a backup plan for each, and one important correction: the sponsor this project was planned
around is not actually at this event.

## Session 2026-09-07

### Done
- Created `~/Projects/outcomelock` (it did not exist; the morning health check had been flagging it).
- `ACCESS.md` written and passing `access-preflight.sh check` — no dependency without a fallback tier.
- Verified the event facts against the live prize page rather than the old notes.

### Verified facts (dated 2026-09-07, beat the old notes)
- Deadline: **Sunday 2026-09-13, 12:00 EDT = 17:00 WAT**. Six days.
- **0G is NOT a sponsor of ETHOnline 2026.** `PROJECTS.md` recorded it as the primary sponsor for
  this project. The eleven sponsors are: The Graph, Hedera, Arc, World, 1inch, ENS, Uniswap
  Foundation, Ledger, Privy, Chainlink, Bazantic. Source: ethglobal.com/events/ethonline2026/prizes.
- Hedera "AI & Agentic Payments" ($6,000, up to 3 x $2,000) hard requirements: live x402-gated
  service on Hedera **via Blocky402**; a consumer agent making >= 1 real paid request; public repo
  with setup/architecture/payment-flow README; demo video <= 5 min showing the paid request.
- Its extra-points list: pay-per-call metering, A2A negotiation, ERC-8004 / HCS-14 agent identity,
  UCP discovery, HTS custom fees, **HCS audit trails**, **scheduled transactions**.

### Open unknowns — DO NOT invent answers
- Blocky402: signup cost, eta, whether it supports deferred/outcome-based settlement or only
  charge-on-request. **This is the single biggest technical risk and gets probed first.**
- Whether Hedera scheduled transactions can be created with a future expiry and cancelled, which is
  what the auto-release deadline needs.
- Whether HCS-14 agent identity is usable in six days or is a spec with no SDK.

### Next
Probe Blocky402 + Hedera scheduled transactions before any feature code.
