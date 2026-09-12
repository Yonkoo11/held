# How AI was used on this project

ETHOnline permits AI tools and asks for two things: say where and how they were used, and, if a
spec-driven workflow was used, put the spec files and planning artifacts in the repo. Both are here.

## The short version

This was built with Claude Code as the implementer and a human as the technical director. The AI
wrote most of the code in this repository. Every decision about what to build, which tracks to
enter, what to cut, and what was not good enough came from the human side, and the record of those
decisions is in [`spec/`](spec/) rather than being asserted here.

## Where AI wrote code

Effectively all of `src/`, `scripts/`, `public/index.html` and `video/`. Rather than list files with
percentages nobody can verify, the useful statement is the inverse: there is no hand-written module
that AI did not touch, and no AI-written module that went in unreviewed.

The two things AI did **not** produce are worth naming, because they are the two things the rules
care about:

- **The idea.** An x402 payment whose `payTo` is an escrow account, so the deadline pays the seller
  rather than expiring back to the buyer, is the thesis this project was accepted on. It predates
  any code.
- **The judgement about when something was not good enough.** That is the whole of `spec/03-design.md`.

## Where the human intervened, and what changed as a result

These are the moments that changed the build, taken from the log in [`spec/02-build-log.md`](spec/02-build-log.md)
and [`spec/03-design.md`](spec/03-design.md). They are specific because vague claims of oversight are
worth nothing.

| intervention | what changed |
|---|---|
| "Treat this like a delicate project, apply the thoroughness a senior developer would" | Triggered the security review that found the authorisation hole on approve/reject and the double payout. Both were real, both were on chain, neither was found by a passing test. |
| Pasted two screenshots of the site failing to load, while the AI was reporting it as up | Killed a false status claim. The tunnel had expired. The submission no longer depends on a public URL for this reason. |
| "The current design is very basic and not senior developer level" | The first design pass had skipped the step that generates range: three directions were written as prose instead of built. Rebuilt properly, three rendered proposals, one selected with the reasoning recorded. |
| "Remove all signs of AI generation" | Produced the audit in `spec/03-design.md` and a mechanical gate that now blocks the specific tells. Nine passages of copy were rewritten. |
| Renamed the product from OutcomeLock to Held | Rename applied across the repo, with two exceptions deliberately kept and documented: the live env path, and the agent ids already written to the Hedera evidence topic, which are records of what ran rather than branding. |
| Funded the testnet account, completed the Hedera portal signup, claimed the Circle faucet | There is no keyless route to a funded testnet account. This was probed and recorded in `CLAUDE.md`. The project could not run without it. |
| Recorded the demo narration | ETHGlobal bans text-to-speech and AI voiceover. The voice in the video is the operator's. |

## The spec trail

Four files, published because the rules ask for them:

| file | what it is |
|---|---|
| [`spec/01-plan.md`](spec/01-plan.md) | The plan written on day one, before any feature code. Includes the standing rule that no partner track is entered at less than depth 4 of 5, which is why this submission enters two partners and not five. |
| [`spec/02-build-log.md`](spec/02-build-log.md) | Every defect, its cause, and the evidence it was fixed. It is not flattering and it is not meant to be. |
| [`spec/03-design.md`](spec/03-design.md) | Two design passes. The first was rejected. The second records what was measured and what was removed. |
| [`spec/04-design-research.md`](spec/04-design-research.md) | Comparable research done with the browser open. Each entry names what was fetched and the rule it produced. |

`CLAUDE.md` in the repo root is the operating document the AI worked from. Its "Verified Facts"
section is the rule that no API, endpoint or SDK behaviour may be written from memory: each one is
probed, and the measurement is recorded with its date. Its "Open Unknowns" section lists what was
still not known at the time of writing. Two entries in it are corrections where an earlier claim was
wrong, left in place rather than edited out.

Some names in the design research are redacted. They are other builders' work studied privately,
and publishing the attributions is not ours to do. The observations and the rules they produced are
intact.

## What this does not claim

The human did not write the code by hand. Claiming otherwise would be easy and would fall apart the
first time a judge asked a question about a specific file. The claim being made is narrower and
checkable: the direction, the standards, the rejections and the domain judgement are human, they are
documented as they happened, and the resulting system was made to prove itself on a public ledger
rather than on anyone's word.

The reason that matters here more than usual is that this project is about not having to trust the
party telling you something happened. It would be an odd thing to demonstrate with a false claim on
the way in.
