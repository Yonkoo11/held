# DEMO-FOOTGUNS — OutcomeLock

Rehearsed 2026-09-12 by walking the filming sequence against the live deploy and **timing every
step**. No conductor state files exist for this project (it was not built through that pipeline), so
these were found by running the demo, not by reading `.wire-state.json`.

| id | description | severity | fixable | workaround |
|---|---|---|---|---|
| FG-001 | Gemini free tier is **20 requests per day per model** and roughly 8 remain today. Exhausting it mid-shoot turns the answer into the deterministic placeholder. | CRITICAL | ACCEPT-ONLY | Budget the takes. Each paid request = 1 Gemini call. Allow 3 takes + 2 spare. If it trips: `GEMINI_MODEL=gemini-2.5-pro` draws from a different bucket, or stop and resume after midnight PT. |
| FG-002 | **First request after a restart takes ~32s**; every request after it takes ~17s. The first one pays to discover that Anthropic and OpenAI are out of credit. | HIGH | FIXED | Circuit breaker added — dead providers are skipped after the first failure. **Fire one throwaway request before rolling** so the camera never sees the 32s version. |
| FG-003 | The public URL is an ngrok tunnel, which shows a **click-through warning page** to browsers before the app. | HIGH | ACCEPT-ONLY | Click through *before* recording starts, or film `http://localhost:4021` and show the public URL only as text. Do not film the warning page. |
| FG-004 | The review window is 25 minutes, so the **deadline path cannot be filmed in real time**. | HIGH | FIXED | Run a second seller for that shot: `PORT=4099 REVIEW_MINUTES=1.5 npm run seller`. Film the countdown running out there. |
| FG-005 | The byline on every deliverable reads **"gemini (after 2 failed)"**. Reads as broken to anyone who does not know it is a designed cascade. | MEDIUM | ACCEPT-ONLY | Narrate it as the feature it is: two paid keys are dead and the thing kept working. Do not hide it — it is the tier system doing its job on camera. |
| FG-006 | A job bought outside the browser shows **"paid for in another browser"** and no decision buttons, because the claim token went elsewhere. | MEDIUM | ACCEPT-ONLY | Buy on camera, in the browser you are filming. Never film a pre-seeded job's decision step. |
| FG-007 | ~17s between clicking *Pay and ask* and the deliverable appearing: x402 verify, the agent, then settle on Hedera. | LOW | ACCEPT-ONLY | Narrate through it — this is the window to say what is happening on chain. Do not cut to black. |
| FG-008 | The escrow account holds finite testnet HBAR; each demo request moves 0.05. | LOW | ACCEPT-ONLY | ~400 requests of headroom. Not a risk for filming. |

## Acknowledged

FG-001 is the only CRITICAL and it is acknowledged rather than fixed: the quota is a property of the
free tier, not of this code. The mitigation is take discipline, and the deterministic fallback means
even a blown quota produces a working demo — just a weaker-sounding answer.
