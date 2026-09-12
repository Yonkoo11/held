# Access needed before building — Held (ETHOnline 2026)

Filled 2026-09-07, before any planning document. Deadline 2026-09-13 12:00 EDT (17:00 WAT).

Rules (enforced by `~/System/scripts/access-preflight.sh`):
1. An unchecked box means the project is **stopped**, not in progress.
2. Every line needs a `fallback:` that runs, demos, and says out loud that it is degraded.

The app picks the highest available tier at startup, prints which tier it chose, and stamps that
tier on every receipt it writes. A demo on the bottom tier is still a real demo.

## Hard requirements for the tracks we are entering

- [ ] Hedera testnet account + ED25519 key — needed for: HCS evidence topic, scheduled release transaction, EVM escrow deploy — how: https://portal.hedera.com/dashboard (email signup, testnet HBAR auto-funded) — cost: free — eta: 10 min — fallback: local anvil EVM + a file-backed append-only log with the same interface; every receipt and the UI banner read `a local simulation standing in for Hedera testnet`. Demo runs end to end, but the Hedera track cannot be entered on this tier.
- [x] Blocky402 facilitator — **PROBED 2026-09-07: no account and no API key needed.** The site states "Testnet MVP Ready - Open Access, No API Key Required", and it is MIT-licensed and self-hostable (`blockydevs/blocky402`). Packages `@x402/core`, `@x402/fetch`, `@x402/hedera` all resolve on npm at v2.25.0, published 2026-09-03/04. — fallback: self-host the same MIT facilitator locally, or the reference PoC at github.com/hedera-dev/x402-inference-pay-per-request-poc; identical flow, still Hedera.
- [x] **Domain: `heldprotocol.xyz`, bought 2026-09-12. Deployed 2026-09-12, waiting on DNS.**
      The service runs on Railway and is live at <https://held-production-0ce9.up.railway.app>.
      Both `heldprotocol.xyz` and `www` are registered on the service; the two Namecheap records
      and the key-loading command are in [`DEPLOY.md`](DEPLOY.md). Option (b) below was taken, with
      the key-custody tradeoff stated there and in the README's honest status.
      **Superseded detail, kept for the record:** at the time of writing it was **not pointing
      anywhere** — as of this line it has no nameservers and no A record, so it resolves to nothing.
      Two ways to finish it, and they differ on one thing that matters:
      **(a) Redirect.** Namecheap's own URL-redirect record sends it to the tunnel. Five minutes, no
      account anywhere else, no key leaves this machine. The visitor lands on an ngrok URL and sees
      the ngrok warning page first, and the target has to be re-pointed each time the tunnel churns.
      **(b) Host it.** Deploy the seller to Render or Fly and CNAME the domain at it. Stable URL, no
      warning page. It also means **the escrow private key goes onto a third-party host**. On testnet
      the blast radius is a funded test account and nothing else, but it is a real decision and it is
      Dami's to make, not mine.
      Recommendation with the deadline this close: (a) now so the domain resolves, and only attempt
      (b) if everything else is already filed.
- [ ] Public HTTPS URL for the x402-gated service — needed for: the Hedera track wording is "host a live x402-gated service", so a judge must be able to hit it — how: cloudflared quick tunnel (no account) or `ngrok http` — cost: free — eta: 5 min — fallback: bind localhost and ship a scripted `curl` transcript plus recorded run; submission states plainly that the URL was a tunnel and may be down.

## Upgrades — missing one costs a tier, not the project

- [ ] Test USDC on Hedera testnet — needed for: pricing the demo in a stablecoin, which is the story
      this track is actually about — how: <https://faucet.circle.com>, choose **Hedera Testnet**,
      paste the buyer account id that `scripts/go-live.js` prints — cost: free, 20 USDC per address
      per 2 hours — eta: 2 min — fallback: price in HBAR, which a fresh portal account already
      holds; identical code path, `PAY_ASSET=hbar`, and the demo is unaffected except that the
      asset reads as a gas token rather than a dollar.

- [ ] LLM key for the worker agent (Anthropic / OpenAI / Gemini AI Studio) — needed for: the agent actually producing the deliverable that gets paid for — how: aistudio.google.com is the fastest free tier — cost: free tier — eta: 5 min — **note: both paid accounts are reported out of credit** — fallback: four tiers in priority order — (1) hosted paid key, (2) hosted free tier, (3) local ollama, (4) deterministic scripted worker returning a fixed deliverable, stamped `a deterministic responder with no model behind it` on every receipt. Tier 4 still demonstrates the whole escrow mechanism, which is the actual product.
- [ ] Arc testnet access + USDC faucet — needed for: the optional Arc agentic-economy track (second settlement rail) — how: https://arc.circle.com docs / faucet — cost: free — eta: 15 min — fallback: rail stays Hedera-only, Arc track is not entered, nothing else changes. The settlement layer sits behind one adapter interface for exactly this reason.
- [ ] Bazantic account — needed for: the optional "Agentify a New API" track — how: https://bazantic.com — cost: free — eta: 10 min — fallback: the x402 gateway is still live and self-hosted; that track is not entered.

## Already in hand

- [x] Public GitHub repo — how: `gh repo create` under yonkoo11 — fallback: n/a, local git history is the evidence until pushed.
- [x] ETHGlobal ETHOnline 2026 registration — how: already applied — fallback: none possible; without it there is no submission.
- [x] Node/pnpm, Foundry, Docker — local toolchain — fallback: n/a.

## Not needed — recorded so it is not rediscovered on the last day

- **0G** was recorded in `~/System/PROJECTS.md` as the primary sponsor for this project. **0G is not
  a sponsor of ETHOnline 2026.** Verified 2026-09-07 against https://ethglobal.com/events/ethonline2026/prizes —
  the eleven sponsors are The Graph, Hedera, Arc, World, 1inch, ENS, Uniswap Foundation, Ledger,
  Privy, Chainlink, Bazantic. No 0G key, account, or storage bucket is required.
