# Architecture

## The one-line change

A normal x402 service puts the seller's account in `payTo`. Held puts an **escrow account**
there. Everything else follows from that.

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
      │                              │──── store job ──────────────│ (before anything else)
      │                              │──── ScheduleCreate ────────►│ auto-release armed
      │                              │──── HCS messages ──────────►│ evidence
      │  deliverable + claim token   │                             │
      │◄─────────────────────────────┤                             │
      │                              │                             │
      │  POST /jobs/:id/approve      │                             │
      │  + X-Job-Token               │                             │
      ├─────────────────────────────►│──── ScheduleDelete ────────►│ timer cancelled
      │                              │──── transfer ──────────────►│ seller paid
```

## Job state machine

```
                    ┌───────────┐
     payment ──────►│   held    │
                    └─────┬─────┘
                          │  store.transition('held' → 'settling')   [atomic, synchronous]
                          ▼
                    ┌───────────┐   transfer throws
                    │ settling  │ ─────────────────► back to held
                    └─────┬─────┘
                          ▼
              ┌───────────┴───────────┐
              ▼                       ▼
        ┌──────────┐            ┌──────────┐
        │ released │            │ refunded │
        └──────────┘            └──────────┘
```

`settling` is the whole point. Without it, two concurrent approvals both read `held`, both pass the
check, and both transfer — which is exactly what happened before it existed. See `INVARIANTS.md` I1.

`store.transition()` reads, checks and writes with **no `await` in between**, so it cannot interleave
with another request on Node's event loop. Adding an `await` inside it reintroduces the bug.

## Who releases the money

Three paths, and only ever one of them per job:

| trigger | mechanism | attributed in the trail as |
|---|---|---|
| buyer approves | delete the schedule, transfer escrow → seller | `buyer` |
| buyer rejects | delete the schedule, transfer escrow → buyer | `buyer` |
| buyer says nothing | **Hedera executes the scheduled transaction at expiry** | `hedera-scheduled-transaction` |
| schedule failed or never fired | direct transfer, 90s past expiry | `deadline-sweep` |

The sweeper's job when a schedule is armed is to **observe**, not to act. It polls
`/api/v1/schedules/{id}` for `executed_timestamp` and records that transaction. It only transfers
itself once `SCHEDULE_GRACE_SECONDS` have passed with no execution, so a failed schedule cannot
strand funds while a working one cannot be double-paid.

## Tiers

Every external dependency has a declared degraded mode. The app picks the highest tier it can
actually run, prints which, and stamps it on every receipt, evidence entry, proof file and UI badge.

| component | full | degraded |
|---|---|---|
| settlement | Hedera testnet escrow account | local JSON ledger, `a local simulation standing in for Hedera testnet` |
| evidence | HCS topic, readable by anyone | append-only JSONL file, every line marked degraded |
| worker | Anthropic → OpenAI → Gemini | local ollama → deterministic responder that says no model ran |

A degraded run is a real run. It is never presented as a full one — `prove-live.js` refuses to claim
anything about Hedera when settlement is local.

## Authorisation

There are no accounts and no login. The buyer is whoever paid, proven by a **claim token** returned
exactly once in the payment response.

- 32 random bytes, returned to the payer and never stored.
- The server keeps only `sha256(token)` and compares with `timingSafeEqual`.
- `publicJob()` strips the hash from every response, so reading `/jobs` does not let you spend.
- The web page keeps tokens in `localStorage`; open it in another browser and the decision buttons
  are replaced by an explanation.

## Agent identity

Each deliverable carries `agentVersion` — `sha256(prompt template + model name + worker source)`,
truncated. Change any of the three and the id changes. It is written to the evidence trail alongside
the deliverable hash, so "which build produced this" is checkable rather than asserted. That is what
the buyer is really approving when they release the money.

## Files

| file | responsibility |
|---|---|
| `src/seller.js` | HTTP surface, the 402, the payment flow, the state machine's caller, the sweeper |
| `src/settlement.js` | escrow: hold, release, refund, schedule. Two implementations, one interface |
| `src/store.js` | job records and the only legal way to change a job's state |
| `src/evidence.js` | the append-only trail: HCS topic or local file |
| `src/worker.js` | the paid work, its tier fallback, and the agent version id |
| `src/payment.js` | builds the `X-PAYMENT` payload |
| `src/hedera-key.js` | resolves and verifies an operator key against the ledger |
| `src/config.js` | tier selection, asset selection, constants |
| `src/buyer.js` | the consuming agent, as a CLI |

## What this does not do

- It does not judge whether the agent's answer is *correct*. Nothing here evaluates semantics.
- It does not stop a buyer rejecting good work. It gives the seller a deadline, not an arbiter.
- It is not custody-free: the escrow account's key is held by the service. A production version
  would use a threshold key split between the parties, or a contract. Stated plainly rather than
  glossed.
