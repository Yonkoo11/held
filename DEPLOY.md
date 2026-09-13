# Deploying Held to heldprotocol.xyz

**Done. Live over HTTPS at <https://heldprotocol.xyz> since 2026-09-13 12:25 WAT**, with
<https://www.heldprotocol.xyz> alongside it and plain HTTP redirecting to HTTPS. The Railway
address <https://held-production-0ce9.up.railway.app> still works and points at the same service.

`/health` on the live domain reports settlement, evidence and worker all on their real tier:
Hedera testnet with HBAR moving through escrow `0.0.10495061`, a Hedera Consensus Service topic for
the evidence trail, and Gemini behind the worker. Nothing is standing in.

The rest of this file is the record of how it got there, kept because the certificate took a day
longer than it should have and the reason is worth not repeating.

## What is already done

| | |
|---|---|
| Host | Railway project `held`, service `held`, running the real Node process |
| Why not serverless | There is a background sweeper and file-backed job state. A stateless function would run neither. |
| Storage | A 5 GB volume mounted at `/app/data`, so a job someone paid for survives a redeploy |
| Health check | `/health`, with restart on failure |
| Build size | `.railwayignore` keeps the 714 MB video directory out of the build |
| Domains | `heldprotocol.xyz` and `www.heldprotocol.xyz` are registered on the service and waiting on DNS |

## Step 1 — the DNS records, at Namecheap

Domain List, then Manage on heldprotocol.xyz, then the **Advanced DNS** tab.

**Four records, not two.** This is the part that was wrong for a day. Railway needs a TXT record
proving you own the domain, *as well as* the record that routes traffic. Their documentation is
blunt about it: "Both records are required, the domain will not verify with only the CNAME in
place." Without the TXT, the certificate sits in `VALIDATING_OWNERSHIP` forever, which is exactly
what it did, and the site answers plain HTTP but has no HTTPS at all.

Delete any leftover `@` or `www` rows first (a `URL Redirect Record`, an `A Record` pointing at
`69.46.46.x` or `162.255.119.137`, a `CNAME Record` pointing at `parkingpage.namecheap.com`). A
CNAME cannot share a name with another record, so a leftover row makes the whole name invalid.

| Type | Host | Value | TTL |
|---|---|---|---|
| ALIAS Record | `@` | `ooqoz4pq.up.railway.app` | Automatic |
| CNAME Record | `www` | `8rlcixxv.up.railway.app` | Automatic |
| TXT Record | `_railway-verify` | `railway-verify=bfb02e88524ea8afa37883e247984c4ec5348d9da038db1bb5956bb687cffd72` | Automatic |
| TXT Record | `_railway-verify.www` | `railway-verify=15533553174e1af857af2feda44d0275b2fb470831d7fde3b8e2b30b64e2f593` | Automatic |

The root one has to be **ALIAS**, not CNAME. Plain DNS does not allow a CNAME on the root of a
domain; Namecheap's ALIAS record is their way round it and Railway's docs name Namecheap
specifically as a provider whose workaround they accept.

The two tokens are tied to these particular domain registrations. Deleting and re-adding a custom
domain in Railway mints new ones, so if that happens the TXT values have to be re-read and replaced.
They are not secret; they are meant to be published in DNS.

Propagation is usually minutes. Railway then issues the certificate itself.

**What the diagnosis was before, and why it was wrong.** On 2026-09-13 this file said no cause had
been established, after ruling out CAA records, ACME challenge reachability, edge routing and DNS
propagation. Three of those four checks were sound and the fourth was actively misleading: Railway's
API reports `DNS_RECORD_STATUS_PROPAGATED` even when the record it wants is **absent**, so that
field was read as "DNS is fine" when it meant nothing at all. The useful query is
`domains { customDomains { status { verified verificationDnsHost verificationToken
dnsRecords { requiredValue currentValue } } } }`, which shows `verified: false` and prints the
wanted value next to the actual one. Both domains were pointing at edges belonging to an earlier,
deleted registration, and neither TXT record had ever existed. Check `verified` and
`requiredValue` vs `currentValue` first; ignore the propagation field.

## Step 2 — the keys

These never pass through the assistant, so run this yourself. It reads your env file, pushes the
values straight to Railway, and prints nothing.

```bash
cd ~/Projects/outcomelock \
  && set -a && . "$HOME/.outcomelock.env" 2>/dev/null; [ -f .env ] && . ./.env; set +a \
  && railway variables --skip-deploys \
      --set "HEDERA_OPERATOR_ID=$HEDERA_OPERATOR_ID" \
      --set "HEDERA_OPERATOR_KEY=$HEDERA_OPERATOR_KEY" \
      --set "HEDERA_ESCROW_KEY=$HEDERA_ESCROW_KEY" \
      --set "HEDERA_BUYER_ID=$HEDERA_BUYER_ID" \
      --set "HEDERA_BUYER_KEY=$HEDERA_BUYER_KEY" \
      --set "GEMINI_API_KEY=$GEMINI_API_KEY" > /dev/null \
  && echo "keys set" \
  && railway up --ci
```

Then confirm it came up on the real tier:

```bash
curl -s https://heldprotocol.xyz/health | python3 -m json.tool | head -20
```

`settlement` should read `Hedera testnet, with HBAR moving through a live escrow account` and
`degraded` should be `false`. If it still says local stand-in, a key did not arrive; check
`railway logs`.

The public ids are already set and are not secret: escrow `0.0.10495061`, evidence topic
`0.0.10495064`, price 0.05 HBAR, review window 20 minutes.

## The thing to decide before you point the domain

`DEMO_BUY=on` is set, which is what lets a judge click **Pay and ask** and watch a real payment
settle. It spends the server's own buyer account to do that. There are per-IP rate limits and an
input cap, so it is bounded, but a determined visitor can still drain the buyer account over time.

On testnet that costs nothing real and the fix is a refill from the portal. If you would rather it
not happen at all, `railway variables --set "DEMO_BUY=off"` and the page still shows every past job,
the live clock and the evidence trail; visitors just cannot buy. Judges being able to try it is
worth more than the inconvenience, so it is on.

Also worth knowing: the escrow private key is on Railway. It is a testnet key and the blast radius
is one funded test account, but it is a real property of this deployment and it is stated in the
README's honest-status section rather than left implicit.

## Redeploying later

```bash
railway up --ci          # from the repo root
railway logs             # if something looks wrong
railway status           # project, environment, service
```
