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

## Session 2026-09-10

### What Changed (Plain English)
The thing now works. You can ask the agent a question, get told to pay, pay, read the answer, and
then decide whether the seller keeps the money. All three endings work: you approve and they get
paid, you reject and you get your money back, or you say nothing and they get paid when the clock
runs out. Right now it runs on a local stand-in, not on Hedera, because there is still no Hedera
account. Every receipt says so.

### Verified by running it, not by reading it
- Buy flow: 402 quoted 0.05 USDC on `hedera:testnet`, paid, deliverable returned, money held.
- Approve -> released. Reject -> refunded. Silence past the deadline -> auto-released by the sweeper
  (log line `[sweep] auto-released e2ac1ad2...`).
- Evidence trail records paid / delivered / escrow-scheduled / released, each stamped `[degraded]`.
- Worker failover is real: the Anthropic key on this machine returns
  "Your credit balance is too low", the worker caught it, dropped to the deterministic tier, and the
  demo continued. Confirms the credit problem AND that it no longer stops anything.
- Facilitator handshake: `https://api.testnet.blocky402.com/supported` advertises
  `exact / hedera:testnet` with feePayer `0.0.7162784`. Retry added after one transient boot failure.

### NOT done - and one of these decides the prize
- **The Hedera tier has never run.** No operator key has existed on this machine. Every Hedera code
  path (HCS topic, real escrow transfer, scheduled release, real x402 payment) is written and
  parses, and has executed exactly zero times. The track requires a live x402-gated service on
  Hedera, so on today's tier the submission does not qualify.
- No public URL yet. No README yet. No demo video yet.

### Next, in order
1. Hedera testnet account -> environment file -> re-run the same flow on the real tier.
2. Associate the escrow account with USDC 0.0.429274 or payments fail preflight.
3. Public tunnel URL, README, demo video.

## Session 2026-09-12 (early morning)

### What Changed (Plain English)
There is now a web page you can open and use: type a question, pay, read the answer, then approve or
reject it while a countdown ticks. It is reachable from the public internet. And there is now a
single command that switches the whole thing from the practice version onto the real Hedera network
the moment an account exists.

### Tested by running it
- Web page renders and works (screenshotted); the buy button drives the same 402 -> pay -> retry
  path as the command line, through the same code.
- Public URL live via ngrok; the 402 quote was fetched from the open internet showing
  `hedera:testnet`, the escrow as payTo, and the facilitator's feePayer 0.0.7162784.
- Full regression re-run after switching the default asset to HBAR: quote, pay, approve, reject and
  the deadline sweeper all still pass.
- `scripts/prove-live.js` runs, writes PROOF.md, and correctly states that a local-tier run proves
  nothing about Hedera.

### Decisions taken without asking
- **Price in HBAR, not USDC.** A new testnet account is auto-funded with HBAR; no working testnet
  USDC faucet was found. This removes a dependency rather than adding one.
- **ngrok over cloudflared** — cloudflared registers but its DNS resolver times out on this machine.
- **No full design pass on the UI.** The build order here is core-first, polish-last, and the core
  is not yet proven on Hedera. The page is functional and honest rather than art-directed.

### Still true, still blocking
- **No Hedera account exists, so no Hedera code has ever run.** Probed every faucet and portal
  endpoint: there is no keyless path. The track requires a live service on Hedera. Until
  `scripts/go-live.js` runs, this does not qualify.
- No demo video yet. No submission filed yet.
