# Invariants

Rules this system must never break. Each one is stated as a property, with how it is enforced and
how it is tested. Several are here because they were broken first and caught on a real ledger.

`npm test` and `npm run attack` exist to keep these true.

---

## Money

### I1 — Escrow pays out at most once per job
Exactly one of: released to the seller, or refunded to the buyer. Never both, never twice.

- **Enforced by** `store.transition()` — a synchronous compare-and-set that claims a job into
  `settling` *before* any transfer. It contains no `await`, so two requests cannot interleave.
- **Also enforced by** the deadline sweeper, which observes Hedera's scheduled transaction rather
  than performing its own transfer when one is armed.
- **Tested by** `attack.js` (five concurrent approvals → exactly one accepted) and by per-job
  attribution of every escrow debit on the mirror node.
- **Broken on 2026-09-12.** The sweeper released at the deadline *and* the scheduled transaction
  executed: two 0.05 HBAR debits for one job, 13 seconds apart, both visible on chain. The
  single-threaded local tier hid it — the check and the write sat in one synchronous block there,
  while the Hedera path has four awaits between them.

### I2 — A paid job always exists
Once settlement succeeds, a job record exists before anything else can fail.

- **Enforced by** ordering in `seller.js`: settle → record deposit → `store.put` → *then* arm the
  timer. Arming is best-effort and wrapped.
- **Tested by** `regression.js` case 5, which injects a schedule failure and asserts the job is
  still present and `held`.
- **Broken on 2026-09-12.** A transient mirror-node lookup inside `scheduleRelease` threw after
  settlement. The request 500'd and the job was never stored: funds in escrow, no record of whose.

### I3 — Losing the timer never costs the money
If the on-chain schedule cannot be armed, or is armed and never fires, the buyer's funds still
resolve.

- **Enforced by** the sweeper's fallback, which releases directly once `SCHEDULE_GRACE_SECONDS`
  (default 90) have passed beyond expiry with no execution.
- **Tested by** `regression.js` case 5.

### I4 — Silence is not a veto
An unresponsive buyer cannot trap a seller's money. The review window always ends.

- **Enforced by** a Hedera scheduled transaction armed at payment time, with the review deadline as
  its expiry and `waitForExpiry(true)`.
- **Tested by** `regression.js` case 3 and `prove-live.js` case 3, which waits without intervening
  and confirms the release came from the schedule.

---

## Authority

### I5 — Only the buyer who paid may decide
Approve and reject are restricted to whoever made the payment.

- **Enforced by** a claim token issued once in the payment response. Only its SHA-256 is stored;
  comparison is `timingSafeEqual`.
- **Tested by** `attack.js` cases 1 and 2 — no token and wrong token both refused, right token
  accepted.
- **Broken until 2026-09-12.** There was no authorisation at all. Job ids are listed publicly on
  `/jobs`, so a job id was sufficient to move someone else's money. A stranger released a job in
  testing and received `200 OK`.

### I6 — The server never hands out what authorises spending
The claim-token hash is never serialised to a client.

- **Enforced by** `publicJob()`, which strips it from every job response.
- **Tested by** `attack.js` case 5, on both the list and the single-job view.

### I7 — No work without payment
The agent runs only after the facilitator has verified the payment.

- **Enforced by** calling `/verify` before `doWork()`, and `/settle` after.
- **Tested by** `attack.js` case 7 — unpaid and forged-payment requests both refused.

---

## Truthfulness

### I8 — Every output states which tier produced it
The app never presents degraded output as full output.

- **Enforced by** `config.js` tier selection, stamped onto every evidence entry, receipt, proof file
  and UI badge.
- **Observable**: with no model key the worker returns text beginning
  `No model ran for this request.`

### I9 — A local run never claims anything about Hedera
- **Enforced by** `prove-live.js`, which writes *"This run was on the local stand-in tier. It proves
  the product logic and NOTHING about Hedera"* unless settlement is `hedera-testnet`.

### I10 — A transaction id is a real transaction id
Anything recorded as a transaction must be resolvable by a third party.

- **Enforced by** taking ids from the `TransactionResponse`, never the receipt.
- **Tested by** `prove-live.js`, which re-queries the mirror node for every id and fails the run if
  one cannot be found.
- **Broken on 2026-09-12.** Ids were read off `TransactionReceipt`, which carries none, so the
  fallback produced the literal string `"SUCCESS"` as an id. The verifier caught it.

### I11 — Upstream error text never reaches a buyer
Model providers echo request details in error bodies, and job records are public.

- **Enforced by** redaction in `worker.js` plus a safe category, with the raw text stripped in
  `publicJob()`.
- **Tested by** `attack.js` case 5b.

---

## Secrets

### I12 — No secret is ever committed
- **Enforced by** `.gitignore`, a pre-commit guard (`scripts/install-hooks.js`) that refuses env
  files, key shapes and PEM blocks, and `npm run check:secrets` which audits permissions, tracking
  and the whole of git history.
- **Tested by** staging a fake key and an env file and confirming both commits are refused.

### I13 — A public endpoint never spends the server's own funds
- **Enforced by** `/demo/buy` returning 403 on any non-local settlement tier unless `DEMO_BUY=on` is
  set deliberately, plus per-IP rate limits on every paid route.
