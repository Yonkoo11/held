# DEMO-SCRIPT — OutcomeLock

Generated 2026-09-12 · Target 150s (track cap is 5:00; shorter is better)
Track requirement being satisfied: *"demo video ≤ 5 minutes showing paid request execution"*

**Audio strategy: NOT YET LOCKED — needs Dami.** Recommendation: `native` (narrate while recording).
It is faster with a day left, and it makes captions byte-match the audio by construction rather than
by alignment. If you would rather record silent and add voiceover after, say so and this becomes
`separate` and the pacing changes.

---

## Pre-recording setup

- [ ] `npm run seller` running with `DEMO_BUY=on`, `REVIEW_MINUTES=25`
- [ ] **Fire one throwaway request before rolling** — the first request after a restart takes ~32s
      while it discovers the dead providers; every one after takes ~17s (FG-002)
- [ ] Second seller for the deadline shot: `PORT=4099 REVIEW_MINUTES=1.5 npm run seller`
- [ ] Click through the ngrok warning page **before** recording starts (FG-003)
- [ ] `data/jobs.json` cleared so the ledger starts empty, then buy on camera (FG-006)
- [ ] Browser at 100–125% zoom, notifications off, DevTools closed
- [ ] HashScan open in a second tab on the escrow account `0.0.10495061`
- [ ] Gemini budget checked — each take costs one request, ~8 left today (FG-001)

---

## Filming sequence

### Step 1 — the claim · 0:00–0:18
**Screen:** the landing page, top of the sheet.
**Show:** the headline, then the line *"Not to the seller — to escrow account 0.0.10495061, which
the 402 quote names as its payTo."*

Say:
[SUB] x402 pays the seller the moment the response is written.
[SUB] For a weather API that's fine. For agent work it's backwards.
[SUB] You find out if it was any good after the money's gone.
[SUB] OutcomeLock changes one field. payTo is an escrow account.

**DO NOT SHOW:** the ngrok warning page.

### Step 2 — the 402 quote · 0:18–0:35
**Screen:** terminal beside the browser, or the browser's network tab.
**Action:** `curl -s -X POST <url>/work -H 'content-type: application/json' -d '{"question":"..."}'`
**Show:** `network: hedera:testnet`, `asset 0.0.0`, and `payTo: 0.0.10495061`.

Say:
[SUB] Here's the actual 402. Hedera testnet, priced in HBAR.
[SUB] payTo is the escrow account, not the seller's.
[SUB] The facilitator pays the gas, so the buying agent needs none.

### Step 3 — pay, and wait honestly · 0:35–1:00
**Action:** type a question, click **Pay and ask**.
**WAIT:** ~17s. Do not cut. Narrate through it (FG-007).

Say:
[SUB] That's a real payment settling on Hedera testnet right now.
[SUB] Verify through Blocky402, then the agent does the work,
[SUB] then settle — and the money lands in escrow, not with the seller.

**DO NOT SHOW:** a first-run request. Warm it first or this step is 32 seconds.

### Step 4 — the deliverable and the clock · 1:00–1:25
**Screen:** the new row. The countdown is the thing to land on.
**Show:** the answer, then the right edge — HELD, 0.05 HBAR, the ticking clock, *"then it pays the
seller"*.

Say:
[SUB] The answer's here immediately. The money isn't.
[SUB] It's held, and that clock is a Hedera scheduled transaction.
[SUB] Here's the part people get wrong: if I do nothing, it pays the seller.
[SUB] A card authorisation expires back to the payer. This one expires forward.

**Narrate, do not hide:** the byline says "gemini (after 2 failed)" — that is two dead paid keys and
the service still answering (FG-005).

### Step 5 — approve · 1:25–1:45
**Action:** click **Approve — pay the seller**. Takes ~3s.
**Show:** the row flips to RELEASED with a real transaction id.

Say:
[SUB] I approve, and the escrow pays out. That's a real transaction id.
[SUB] Reject instead and the same escrow refunds me.

### Step 6 — the deadline, on the second server · 1:45–2:10
**Screen:** the port-4099 tab where the window is 90 seconds.
**Show:** the countdown reaching zero, then the row flipping to RELEASED on its own.

Say:
[SUB] Nobody clicked anything here. The window ran out.
[SUB] Hedera executed the scheduled transaction and paid the seller.
[SUB] The service only watched it happen — it didn't do the transfer.

### Step 7 — proof · 2:10–2:30
**Screen:** HashScan on escrow `0.0.10495061`, then the HCS topic `0.0.10495064`.

Say:
[SUB] None of this needs you to trust the service.
[SUB] Every payment, release and refund is on the public ledger,
[SUB] and the evidence trail — what was asked, which agent version answered —
[SUB] is on a consensus topic anyone can read.

---

## Do not show

| footgun | why |
|---|---|
| The ngrok warning page | reads as unfinished |
| A first-run (cold) request | 32s of dead air instead of 17s |
| A pre-seeded job's decision step | shows "paid for in another browser", no buttons |
| The `.env` file or any terminal that has printed a key | it is a testnet key, but never on camera |
| Gemini quota errors | if the quota trips mid-take, stop and restart the take |

## Async timings, measured not guessed

| operation | measured | what to say during it |
|---|---|---|
| 402 quote | ~4s over the tunnel | "this is the quote the agent gets" |
| pay → deliverable (warm) | **~17s** | verify → agent → settle narration |
| pay → deliverable (cold) | ~32s | never film this — warm first |
| approve → released | **~3s** | "that's the escrow paying out" |
| deadline → released | at expiry + up to 15s | "nobody clicked anything" |

## Runtime estimate

~150s across seven steps. Well inside the 5:00 cap. If it runs long, cut Step 2 (the raw 402) — the
same fact is visible on the page in Step 1.
