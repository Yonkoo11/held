# OutcomeLock

Escrowed settlement for agent work. An x402-gated service takes payment up front, but the money
lands in escrow instead of the seller's pocket, and is only released once the buyer has looked at
what the agent produced — or automatically, on a deadline, if the buyer never shows up.

## Verified Facts (do not trust marketing copy or older notes over these)

All dated 2026-09-07 unless stated.

- **0G is not a sponsor of ETHOnline 2026.** Eleven sponsors: The Graph, Hedera, Arc, World, 1inch,
  ENS, Uniswap Foundation, Ledger, Privy, Chainlink, Bazantic. Source: the live prizes page.
- **Deadline: 2026-09-13, 12:00 EDT = 17:00 WAT.**
- **Blocky402 testnet needs no account and no API key** — "Testnet MVP Ready - Open Access, No API
  Key Required". MIT, self-hostable, repo `blockydevs/blocky402`. Probed from blocky402.com.
- **Blocky402 settles immediately on request.** Its documented flow is: client pays through the
  facilitator, access is granted. **There is no deferred or escrowed settlement in it.** This is
  the gap OutcomeLock fills, and it means the escrow must be our own contract — the x402 `payTo`
  points at the escrow, not at the seller.
- **npm packages exist and are current:** `@x402/core` `@x402/fetch` `@x402/hedera` all v2.25.0,
  published 2026-09-03/04. `@hashgraph/sdk` 2.81.0. `hedera-agent-kit` 3.8.2.
- These x402 packages are **four days old**. Their API is not in any model's training data.
  Read the installed `.d.ts` files before writing a call. Do not write an x402 call from memory.
- Local toolchain: node v20.19.5, npm 10.8.2.
- **Hedera track hard requirements:** live x402-gated service on Hedera via Blocky402; a consumer
  agent making at least one real paid request; public repo with a README covering setup,
  architecture and payment flow; demo video of 5 minutes or less showing the paid request execute.
- **Hedera track extra points:** pay-per-call metering, A2A negotiation, ERC-8004 / HCS-14 agent
  identity, UCP discovery, HTS custom fees, HCS audit trails, scheduled transactions.

## Open Unknowns — DO NOT invent answers

- Whether a Hedera scheduled transaction can be created with a future execution deadline and then
  cancelled if the buyer acts first. This is what the auto-release depends on. Unprobed.
- Whether HCS-14 agent identity has a usable SDK or is a spec only. Unprobed.
- Whether the Hedera EVM (JSON-RPC relay) testnet endpoint is stable enough for contract deploys
  this week. Unprobed.
- Whether node 20 is sufficient for `@x402/*` v2.25.0 or they require node 22. Unprobed.

**DO NOT invent endpoints, package APIs, or contract addresses.** Every one of the above gets
measured and the answer written here with its date before any code depends on it.
