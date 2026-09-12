# Recording the narration — Held

Everything else is finished. The picture is cut, timed and rendered; the only thing missing
is your voice. ETHGlobal bans text-to-speech and AI voiceover outright, so this part cannot
be automated, and it is the one step nobody else can do.

Ten clips, 234 words, about 2:18 of picture. Longest clip is 27 seconds.

## Before you start

- Quiet room, no fan or aircon. Phone on silent, in another room.
- Voice Memos is fine. So is any recorder that exports m4a, mp3 or wav.
- Sit a hand's width from the mic and speak at a normal volume. Do not lean in and whisper.
- Record a ten second test first and play it back. If you hear a hiss or an echo, move rooms.
- Read at a normal pace. Every line below is timed at about 120 words a minute, which is
  conversational. If you feel rushed, you are reading too fast, not too slow.

## The lines

One file per scene, named exactly as shown, saved into `video/public/audio/`.
A short silence at the start and end of each clip is fine and gets faded automatically.

### `open.m4a` — 6.5s

> You pay first. The money waits until you have read what you bought.

_13 words. Aim to finish inside 6.5s._

### `claim.m4a` — 12s  ·  1 of 7 · the claim

> x402 pays the seller the instant the response is written.

> For agent work that is backwards.

> Held changes one field. payTo is an escrow account.

_25 words. Aim to finish inside 12s._

### `quote.m4a` — 19s  ·  2 of 7 · the 402

> Here is the actual 402. Hedera testnet, priced in HBAR.

> payTo is the escrow account, not the seller's.

> The facilitator pays the gas, so the buying agent needs none.

_29 words. Aim to finish inside 19s._

### `pay.m4a` — 27.5s  ·  3 of 7 · pay

> Ask the agent something, then Pay and ask.

> That is a real payment settling on Hedera testnet right now.

> Blocky402 verifies it, the agent does the work, then it settles.

> The money lands in escrow, not with the seller.

_39 words. Aim to finish inside 27.5s._

### `row.m4a` — 16s  ·  4 of 7 · held

> The answer arrives at once. The money does not.

> That clock is a Hedera scheduled transaction.

> The wire up top shows the same clock.

> If I do nothing, it still pays the seller.

_33 words. Aim to finish inside 16s._

### `approve.m4a` — 12.5s  ·  5 of 7 · approve

> I approve, and the escrow pays the seller.

> RELEASED, with a real transaction id. Reject instead and the same escrow refunds me.

_22 words. Aim to finish inside 12.5s._

### `deadline.m4a` — 20s  ·  6 of 7 · the deadline

> A second server with a 90 second window. Nobody clicks anything here.

> The window runs out.

> Hedera executed the scheduled transaction and paid the seller. The service only watched.

_29 words. Aim to finish inside 20s._

### `proof-account.m4a` — 8.9s  ·  7 of 7 · proof

> None of this needs you to trust the service.

> Every payment, release and refund is on the public ledger.

_19 words. Aim to finish inside 8.9s._

### `proof-topic.m4a` — 7s  ·  7 of 7 · proof

> And the evidence trail is on a consensus topic anyone can read.

_12 words. Aim to finish inside 7s._

### `close.m4a` — 9s

> Escrow for agent work, settled on Hedera  ·  escrow 0.0.10495061  ·  topic 0.0.10495064

_13 words. Aim to finish inside 9s._

## When the clips are in

```bash
cd video
npm run timings     # measures every clip and tells you if any runs past its picture
npm run render      # writes out/held-demo.mp4 with your voice in it
```

`npm run timings` prints a row per scene. Anything marked OVER means that clip is longer
than the footage it sits on, so cut a sentence and record that one again. It also prints the
total runtime and says plainly whether it is inside ETHGlobal's 2:00 to 4:00 window, because
the upload rejects anything outside it rather than warning you.

## Things that will get the video rejected

Straight from the rules page, so worth having in front of you:

- Under 2:00 or over 4:00. The current cut is 2:14, so there is room but not a lot.
- Any music, and any text-on-screen standing in for a voice.
- Text to speech or an AI voice. It has to be you.
- Speeding the video up to fit. The render is pinned at normal speed for this reason.
- Recording on a phone, or exporting below 720p. The render is 1920x1080.

