# Held: paste-ready ETHOnline 2026 form copy

Each block below is ONE line per paragraph with no hard wrapping, so selecting a block and pasting
it into a form field gives clean paragraphs instead of a ragged column. Blank lines between
paragraphs are intentional and should be kept.

Verified 2026-09-13: short description 93/100 characters, description and how-it's-made both over
the 280 minimum, no em dashes, no curly quotes anywhere.


================================================================================
PROJECT NAME
================================================================================
Held


================================================================================
CATEGORY
================================================================================
Infrastructure


================================================================================
EMOJI
================================================================================
🧾


================================================================================
DEMONSTRATION LINK
================================================================================
https://heldprotocol.xyz


================================================================================
SHORT DESCRIPTION  (93 of 100 characters)
================================================================================
x402 payments that land in escrow, not the seller, until the buyer has read what they bought.


================================================================================
DESCRIPTION
================================================================================
x402 pays the seller the moment a request is served. For a weather API that is fine. For agent work it is backwards: you find out whether you got anything useful only after the money has gone, and your only recourse is a support email.

Held keeps the x402 flow exactly as it is and changes one field. payTo points at an escrow account instead of the seller. You pay, you get the deliverable immediately, and then you decide. Approve and the seller is paid. Reject and you are refunded. Say nothing and a Hedera scheduled transaction pays the seller when the review window expires, so silence is not a veto and a seller cannot have their money trapped by a buyer who never looks.

That last ending is the one people do not expect. A card authorisation that nobody captures expires backwards, and the payer keeps the money. This expires forwards.

Everything that happened is appended to a Hedera Consensus Service topic: what was asked, which build of the agent answered, the hash of what it produced, and what the buyer decided. Anyone can read it from the mirror node without trusting either party.

Three real paid requests settled on Hedera testnet, one for each ending. The transaction ids are in the repo and on HashScan.


================================================================================
HOW IT'S MADE
================================================================================
The service is an ordinary x402 resource server built on @x402/core, @x402/fetch and @x402/hedera at v2.25.0, with Blocky402 as the facilitator on testnet. A client that already speaks x402 needs no changes to buy from it.

The escrow is a plain Hedera account rather than a contract. Settlement happens immediately and irreversibly, so the seller knows the money is real, but it lands somewhere neither party can unilaterally take it from. Release is a separate, later transfer.

The deadline is a Hedera scheduled transaction armed at payment time, with the review deadline as its expiry and waitForExpiry set true. When nobody decides, Hedera executes it and the service only observes the result. The sweeper watches rather than transfers, which is what stops a job being paid out twice.

I tried the deferred x402 flow first. The Hedera scheme declares authorization as its default, so on paper settlement can be deferred past the request. It cannot be deferred far enough: the payload is a partially signed Hedera transaction and those expire in minutes, while a review window runs for hours. So Held holds money in an account rather than holding a signature.

The agent's version id is a hash of its prompt template, its model and its own source, because that is what a buyer is really approving. Not some agent, a specific identifiable build.

The proof page reads Hedera's mirror node from the visitor's own browser, with no server of ours in the path, so it keeps working whether or not the service is running.


================================================================================
GITHUB REPOSITORY
================================================================================
Account: Yonkoo11
Repository: held
URL: https://github.com/Yonkoo11/held


================================================================================
TECH STACK
================================================================================
Hedera
x402
Node.js
JavaScript
HTML
CSS


================================================================================
VIDEO LINK
================================================================================
https://youtu.be/E6pMtAp4fls


================================================================================
SELECT PRIZES
================================================================================
Select ONLY: Hedera - AI & Agentic Payments on Hedera

Do NOT select the main prize pool or finalist judging.
Leave Bazantic unselected, no account exists.


================================================================================
HEDERA: HOW THE INTEGRATION WORKS  (if the prize asks)
================================================================================
The x402 402 challenge names an escrow account in payTo instead of the seller, so paying settles immediately and irreversibly but lands somewhere neither party can take from unilaterally. Blocky402 is the facilitator on testnet and the fee payer covers gas, so a buying agent needs no HBAR of its own. Release is a later Hedera transfer, and the deadline path is a Hedera scheduled transaction armed at payment time with waitForExpiry set, which Hedera executes on its own when nobody decides. Every state change is appended to a Hedera Consensus Service topic, so the whole trail is readable from the mirror node without trusting the service. Escrow account 0.0.10495061, evidence topic 0.0.10495064.


================================================================================
FEEDBACK FOR HEDERA  (if the prize asks)
================================================================================
Blocky402 on testnet needing no account and no API key is the reason this got built at all. I had a paid request working within an hour of starting.

Scheduled transactions with waitForExpiry are the load-bearing primitive here, and I could not find a worked example of arming one with a future expiry and then observing its execution from a mirror node. The docs describe the fields but not that lifecycle. A single end-to-end sample would have saved me most of a day.

One sharp edge worth a warning in the docs: PrivateKey.fromStringED25519() silently accepts a raw ECDSA key and returns a different, valid-looking key rather than throwing. Everything then fails later with an INVALID_SIGNATURE that points nowhere near the real cause.

The x402 Hedera packages are days old and their API is not in any model's training data, so I read the installed type definitions instead of writing calls from memory. That is a good thing about the packages, not a complaint: the types are accurate.


================================================================================
AI TOOLS USED  (if the form asks)
================================================================================
Claude Code wrote most of the code in this repository, with me directing it. The idea, the track choices, what to cut and what was not good enough are mine, and the record of those decisions is in the repo under spec/ rather than asserted here. AI-USE.md names the specific interventions and what each one changed, including the security review that found an authorisation hole and a double payout, both of which were real and on chain. The narration in the demo video is my own voice, as the rules require.


================================================================================
OTHER LINKS, IF A FIELD WANTS THEM
================================================================================
Escrow account: https://hashscan.io/testnet/account/0.0.10495061
Evidence topic: https://hashscan.io/testnet/topic/0.0.10495064
An auto-release schedule: https://hashscan.io/testnet/schedule/0.0.10495601
Railway mirror of the same service: https://held-production-0ce9.up.railway.app


================================================================================
IMAGES  (all files are in submission/images/)
================================================================================
Logo, square 512x512        submission/images/logo-512.png
Cover image, 16:9 1280x720  submission/images/cover.png

Screenshots, upload at least three. Suggested order:
  submission/images/01-home.png        the argument, live wire diagram
  submission/images/03-proof.png       Hedera mirror node read in the browser
  submission/images/04-build.png       the live 402 with payTo at escrow
  submission/images/02-ask.png         the buy flow and the job register
  submission/images/05-invariants.png  the 13 properties and the two that broke
  submission/images/06-ledger.png      every job, filterable


================================================================================
FUTURE  (what's next for this project)
================================================================================
The escrow is a plain Hedera account today, which is the right call for a three day build but means the operator holds the key. The next step is moving it to a contract on Hedera's EVM so release is enforced by code rather than by us behaving well, with the same scheduled transaction arming the deadline.

Pricing is a flat 0.05 HBAR per question. A buyer approving work should be able to pay more for work that was better than asked for, and a seller should be able to quote per job rather than per call. That changes the 402 challenge, not the escrow mechanism.

Right now a rejection is a full refund and there is nothing in between. Real disputes are usually partial, so a split release, where the buyer releases part and refunds the rest, is the obvious next ending to add.

The agent version id is already a hash of the prompt, the model and the source. Publishing those hashes to the same consensus topic would let a buyer check that the build which answered them is the build the seller advertised, rather than taking the byline on trust.


================================================================================
TECH STACK PAGE, FIELD BY FIELD
================================================================================
Ethereum developer tools
  None apply. This is Hedera native, not EVM. If the list has no None option,
  leave it empty; if it refuses to save empty, pick Other.

Blockchain networks
  Hedera

Programming languages
  JavaScript

Web frameworks
  Express
  (the front end is hand written HTML and CSS, no framework)

Databases
  None. Job state is a flat JSON file on a mounted volume, deliberately, so it
  can be read during a demo. If the list has no None option, leave it empty.

Design tools
  None. The interface was designed in code, not in a design tool.

Other technologies, type each and press enter
x402
Blocky402
Hedera Consensus Service
Hedera Scheduled Transactions
@hiero-ledger/sdk
Hedera Mirror Node REST API
Google Gemini
Remotion
Puppeteer
ffmpeg

Describe how AI tools were used
Claude Code was the implementer and I directed it. It wrote most of the code in this repository; I decided what to build, which tracks to enter, what to cut and what was not good enough, and the record of those decisions is committed under spec/ rather than just asserted. Two examples of what that division actually produced: a review I asked for found an authorisation hole on approve and reject plus a double payout, both real and both visible on chain, and neither caught by a passing test. A design pass I rejected as generic was rebuilt from three rendered directions with the reasoning written down. AI-USE.md in the repo names every intervention and what changed as a result. The narration in the demo video is my own voice, as the rules require.
