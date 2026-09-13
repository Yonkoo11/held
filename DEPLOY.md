# Deploying Held to heldprotocol.xyz

The service is already deployed and running. Two things are left, and both need you: the DNS
records, and the Hedera keys. Neither can be done from this side.

**Live now:** <https://held-production-0ce9.up.railway.app>
It is serving the real page and taking real requests, but on the local stand-in tier, because no
keys are set yet. It says so on itself rather than pretending.

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

**Delete first. This is the step that actually went wrong.** Namecheap puts parking records on a
new domain, and adding the Railway records without removing those leaves both in place. Checked on
2026-09-13, after the new records were added:

```
heldprotocol.xyz      -> 69.46.46.18, 162.255.119.137     both Namecheap parking, no Railway
www.heldprotocol.xyz  -> y37qma4r.up.railway.app, 69.46.46.0    CNAME plus a leftover A record
```

A CNAME cannot coexist with another record on the same name. That is invalid DNS and it is why the
domain resolved inconsistently and TLS failed. So before adding anything, delete every existing
record on `@` and on `www`: the `URL Redirect Record`, any `A Record` pointing at `69.46.46.x` or
`162.255.119.137`, and any `CNAME Record` pointing at `parkingpage.namecheap.com`. The Advanced DNS
tab should have no `@` or `www` rows left at all before you add the two below.

**Then add these two:**

| Type | Host | Value | TTL |
|---|---|---|---|
| ALIAS Record | `@` | `i9c3rvr1.up.railway.app` | Automatic |
| CNAME Record | `www` | `y37qma4r.up.railway.app` | Automatic |

The root one has to be **ALIAS**, not CNAME. Plain DNS does not allow a CNAME on the root of a
domain; Namecheap's ALIAS record is their way of doing it and it is in the same dropdown.

Propagation is usually minutes, occasionally hours. Railway issues the TLS certificate on its own
once it can see the records, so there is nothing to click afterwards.

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
