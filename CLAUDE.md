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
- **CORRECTED 2026-09-10 from the installed type definitions, which beat the marketing copy.**
  Yesterday's note said x402/Blocky402 has no deferred settlement. Not quite right. The Hedera
  scheme declares `paymentFlows.default.supported = ["authorization", "upfront"]` with
  `"authorization"` as the default — so settlement *can* be deferred past the request.
  **But the deferral window is a Hedera transaction lifetime, not days:** the x402 Hedera payload is
  `{ transaction: base64 }`, a partially-signed Hedera transaction, and those expire in minutes.
  So the authorization flow cannot hold money for a buyer review period.
  **Conclusion unchanged, reason corrected:** OutcomeLock still needs its own escrow. The x402
  `payTo` points at an escrow account, settlement happens immediately into escrow, and release is a
  separate, later Hedera transaction.
- **Hedera testnet USDC is real and is the asset to price in:** token `0.0.429274`, symbol USDC,
  6 decimals, FUNGIBLE_COMMON. Confirmed live on the mirror node 2026-09-10. Mainnet is `0.0.456858`.
- **HTS association is a real trap.** `createHederaPreflightTransfer` fails the payment unless the
  `payTo` account is associated with the token or has a free auto-association slot. The escrow
  account MUST be associated with `0.0.429274` before it can receive a cent.
- **The x402 packages depend on `@hiero-ledger/sdk`, not `@hashgraph/sdk`** — Hedera's SDK was
  renamed. Mixing both means two SDK copies and two incompatible `AccountId` classes. Use
  `@hiero-ledger/sdk` for anything that touches an x402 payload.
- **CAIP-2 network id is `hedera:testnet`.** Not a chain-id number, not `hedera-testnet`.
- **Useful x402 server API names** (from `@x402/core/server`): `x402HTTPResourceServer`,
  `x402ResourceServer`, `HTTPFacilitatorClient`, `RouteConfig`, plus `BeforeSettleHook`,
  `AfterSettleHook` and `SettlementOverrides` — the hooks are how settlement gets pointed at escrow.
- **Live endpoints, probed 2026-09-10:** mirror node `https://testnet.mirrornode.hedera.com` 200;
  JSON-RPC relay `https://testnet.hashio.io/api` returns chainId `0x128` (296) and a current block;
  `https://blocky402.com/` and its `/docs/quickstart/` both 200.
- **The mirror node schedules API exposes `wait_for_expiry` and `expiration_time`,** so long-term
  scheduled transactions are at least modelled on testnet. Three recent schedules sampled; one had
  executed. Whether we can *create* one with a multi-day expiry is still unproven.
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

### Added 2026-09-12

- **The demo prices in HBAR, not USDC, and that is deliberate.** `isHbarAsset`/`HBAR_ASSET_ID`
  (`0.0.0`) are wired through the Hedera scheme, and a fresh portal account arrives funded with test
  HBAR, whereas no working testnet **USDC** faucet was found. Pricing in HBAR reduces the human
  steps in this whole project to exactly one: the portal signup. `PAY_ASSET=usdc` still works.
- **HBAR has 8 decimals (tinybars), USDC has 6.** Amount conversion is per-asset; a fixed 6 would
  have underpaid by 100x on HBAR.
- **HBAR needs no token association**, so the HTS association trap applies only to `PAY_ASSET=usdc`.
- **There is no keyless route to a funded testnet account.** Probed 2026-09-12:
  `portal.hedera.com/api/account` 403, `faucet.hedera.com` 403, `testnet.hedera.com/faucet`
  unreachable; `portal.hedera.com/register` 200. Key generation works offline but an unfunded key is
  not an account. **The portal signup is genuinely human-only.**
- **cloudflared quick tunnels do not work from this machine** — the tunnel registers a connection but
  then logs `Failed to initialize DNS local resolver ... i/o timeout` and the public URL returns
  nothing. **ngrok works.** Use ngrok, and send `ngrok-skip-browser-warning: 1` on API calls.
- **Puppeteer's bundled Chrome was missing**; `npx puppeteer browsers install chrome` fetched
  146.0.7680.153. The MCP server expects 131, so pass `executablePath` in `launchOptions`.

## Open Unknowns — DO NOT invent answers

- Whether a scheduled transaction can be created with a multi-day `expirationTime` and
  `waitForExpiry`, then deleted early if the buyer acts first. The fields exist in the mirror node
  schema; creating one needs credentials. **Still unproven — the auto-release depends on it.**
- Whether HCS-14 agent identity has a usable SDK or is a spec only. Unprobed.
- Whether the Hedera EVM (JSON-RPC relay) testnet endpoint is stable enough for contract deploys
  this week. Unprobed.
- Whether node 20 is sufficient for `@x402/*` v2.25.0. The packages declare no `engines.node` at
  all, so nothing is promised either way. Install succeeded on node 20.19.5 (401 packages).

**DO NOT invent endpoints, package APIs, or contract addresses.** Every one of the above gets
measured and the answer written here with its date before any code depends on it.
