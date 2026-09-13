<!-- The running build log. Every defect found, what caused it, and how it was proven fixed. This is the honest record, including the things that were wrong for hours. -->

# OutcomeLock — progress

## 2026-09-12 17:40 — M5: rename saved, live service on the new name, video next
- Rename to Held saved (6fccba9). Regression 13/13 on the third run; two earlier runs threw `fetch failed` at the deadline step from the client side, seller log clean. Recorded as a harness flake, not fixed.
- Live seller restarted by the serve loop on the renamed code; `/work` returns 402 with `"held"` extension, `hedera:testnet`, payTo 0.0.10495061. Public URL in `.live-url`.
- tmp-fixture/ (hand-made jobs.json from the M1 design work) left uncommitted.
- Video decision: silent with on-screen titles from ../docs/DEMO-SCRIPT.md's [SUB] lines, Held tokens (paper #faf8f4, ink #17150f, accent #b0431c, Fraunces / Spline Sans / Spline Sans Mono). Building with Skill(demo-video).
- Then: publish repo (deploy-to-github), file submission/SUBMISSION.md. Deadline 2026-09-13 17:00 WAT.


## 2026-09-12 17:05 — name decided: Held
The user chose **Held** as the product name. Rename (44 mentions, 22 files, plus `~/.outcomelock.env`)
is deferred until the session editing src/ commits, and must happen before publish and before the video.

## What Changed (Plain English)
Nothing runs yet. Today the project got a folder, a written list of every outside thing it needs
with a backup plan for each, and one important correction: the sponsor this project was planned
around is not actually at this event.

## Session 2026-09-07

### Done
- Created `~/Projects/outcomelock` (it did not exist; the morning health check had been flagging it).
- `../docs/ACCESS.md` written and passing `access-preflight.sh check` — no dependency without a fallback tier.
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
- `scripts/prove-live.js` runs, writes ../evidence/PROOF.md, and correctly states that a local-tier run proves
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

## Session 2026-09-12 (second pass — security review)

### What Changed (Plain English)
Two real holes were found and closed. Before today, anyone who knew a job's id could release or
refund somebody else's money with one web request — no password, nothing. A stranger did exactly
that in testing. Now only whoever paid for a job can decide on it. Second, the money could have gone
out twice if two clicks landed at the same moment; that one only showed up on the real Hedera path,
not the practice one, so the tests were quietly lying about it.

Also: the USDC faucet does exist after all (Circle's, it supports Hedera), so the demo can be priced
in dollars instead of a gas token. The setup command now prints the address and waits for it.

### Verified by running it
- `scripts/attack.js` — a re-runnable adversarial harness. 11 of 11 pass. It proves the stranger is
  refused, the real buyer is accepted, five concurrent approvals yield exactly one payout, a settled
  job cannot settle twice, the token hash never leaves the server, oversized input is refused, and
  both unpaid and forged-payment requests are refused.
- Functional regression re-run after the hardening: approve, reject and the deadline sweep all pass,
  and the evidence trail is complete for the auto-released job.

### The two defects, for the record
1. **No authorization on approve/reject.** Job ids are public on `/jobs`. Fixed with a one-time
   claim token issued at payment; only its hash is stored, compared in constant time.
2. **TOCTOU double-release.** Local path: check and write in one synchronous block, so it could not
   interleave and the test passed. Hedera path: four awaits in that gap, so two concurrent
   approvals would both transfer. Fixed with an atomic claim in `store.transition` before any
   money moves, reverting to `held` if the transfer throws.

### Correction to an earlier note
I wrote "no working testnet USDC faucet was found". Wrong — <https://faucet.circle.com> supports
Hedera Testnet, 20 USDC per address per 2 hours. That was a failure to look, not a fact.

### Still blocking
No Hedera account, so no Hedera code has run. Everything else is ready for it.

## Session 2026-09-12 — LIVE ON HEDERA

### What Changed (Plain English)
It works, for real, on Hedera. Three payments went through, the money sat in escrow, and all three
endings happened on the public ledger: approved and the seller was paid, rejected and the buyer was
refunded, and ignored — where Hedera's own timer paid the seller without anyone being online.
Anyone can look all of it up.

### Confirmed on testnet 2026-09-12, six transactions, all SUCCESS on the mirror node
- escrow account https://hashscan.io/testnet/account/0.0.10495061
- evidence topic https://hashscan.io/testnet/topic/0.0.10495064 (49 messages)
- full table in ../evidence/PROOF.md, regenerated by `npm run prove`

### Six real bugs, every one only visible on the live tier
1. `createClientHederaSigner` takes POSITIONAL args and a PrivateKey object — I passed a config
   object. Failed as "t.startsWith is not a function".
2. Its `network` is the CAIP-2 id `hedera:testnet`; `testnet` is rejected despite the doc comment.
3. Escrow debits need the ESCROW's signature, not just the operator's. INVALID_SIGNATURE.
4. Decision tx ids were read off the receipt, which has none — producing the literal id "SUCCESS".
5. **Double payout.** The sweeper released at the deadline AND Hedera's scheduled transaction
   executed. Two 0.05 HBAR debits for one job, 13 seconds apart, visible on chain. The sweeper now
   observes the schedule and only acts as a fallback 90s past expiry.
6. My own `pkill -f "node src/seller.js"` never matched `node --env-file-if-exists=.env
   src/seller.js`, so for a while I was testing stale code and drawing wrong conclusions from it.

### Honest notes
- Two transient `fetch failed` blips against Hedera/the facilitator. Boot already retries; a mid-run
  blip still aborts a proof run and needs a re-run.
- A balance-delta check I ran was contaminated by pre-fix schedules from earlier runs still firing.
  Per-job attribution on the mirror node is the only measurement that means anything here.

### Left
Demo video, publish the repo, file the submission.

---

## 2026-09-12 — front page rebuilt

### What Changed (Plain English)
The buyer page used to be a headline, a paragraph and a list. Now the first thing you see is a
drawing of where your money actually is: a line running from **you** on the left to **the seller**
on the right, with your payment sitting in a box in the middle, a clock on it, and the left half of
the line lit up to show the money has left you but not arrived anywhere. Nothing in flight and the
line is just drawn, empty. Buy something and it lights up and starts ticking.

Underneath, your purchases are no longer boxes. They read like a statement: a numbered entry, the
question, the answer, who produced it, and a money column on the right with the amount, the status,
the clock and the two buttons. When something closes, the reason and the real transaction id print
underneath at full width so you can read them.

Typeface changed too — the display face has more weight, and the body face was swapped off a banned
default.

### Verified, not assumed
- Looked at it in a real browser at desktop and phone size, with a real held purchase.
- Pasted a hostile question containing a fake image and a script tag: it prints as plain text,
  nothing runs.
- 16/16 security checks and 13/13 behaviour checks still pass; the server was not touched.
- Publish gate and ship bar both clean.

### Fixed during the pass
Mobile was genuinely broken at one point (the payment box landed on top of the text below it) and
the resting clock looked like an error. Both fixed and re-checked.

### Left
Demo video, publish the repo, file the submission, and the operator's sign-off on the headline.
